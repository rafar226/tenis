(() => {
  'use strict';
  const canvas=document.querySelector('#game'), ctx=canvas.getContext('2d');
  const menu=document.querySelector('#menu'), message=document.querySelector('#message'), hud=document.querySelector('#hud'), touch=document.querySelector('#touch');
  const speedEl=document.querySelector('#speed'), distanceEl=document.querySelector('#distance'), placeEl=document.querySelector('#place'), timerEl=document.querySelector('#timer'), stageEl=document.querySelector('#stage'), resume=document.querySelector('#resume'), retry=document.querySelector('#retry');
  const raceProgress=document.querySelector('#raceProgress'),progressFill=document.querySelector('#progressFill'),progressStage=document.querySelector('#progressStage'),remainingEl=document.querySelector('#remaining'),startLights=document.querySelector('#startLights'),lightText=document.querySelector('#lightText');
  let W=0,H=0,dpr=1,horizon=0,state='menu',last=0,position=0,speed=0,lateral=0,steerVisual=0,distance=0,timeLeft=45,nextCheckpoint=2,shake=0,crashCooldown=0,banner='',bannerLife=0;
  let audioCtx=null,engineOsc=null,engineGain=null,engineFilter=null,roadOsc=null,roadGain=null,soundOn=true,countdownId=0;
  const input={left:false,right:false,gas:false,brake:false};
  const MAX_SPEED=285, DRAW_DISTANCE=1650, ROAD_SEGMENTS=95, FINISH_KM=6, WORLD_PER_KM=5832;
  const traffic=[];

  function initAudio(){
    if(audioCtx){ if(audioCtx.state==='suspended')audioCtx.resume(); return; }
    const AudioContext=window.AudioContext||window.webkitAudioContext; if(!AudioContext)return;
    audioCtx=new AudioContext();
    engineOsc=audioCtx.createOscillator(); engineOsc.type='sawtooth'; engineFilter=audioCtx.createBiquadFilter(); engineFilter.type='lowpass'; engineGain=audioCtx.createGain();
    engineOsc.connect(engineFilter).connect(engineGain).connect(audioCtx.destination); engineGain.gain.value=0; engineOsc.start();
    roadOsc=audioCtx.createOscillator(); roadOsc.type='square'; roadGain=audioCtx.createGain(); roadOsc.connect(roadGain).connect(audioCtx.destination); roadOsc.frequency.value=42; roadGain.gain.value=0; roadOsc.start();
  }
  function updateAudio(){
    if(!audioCtx)return; const active=soundOn&&state==='playing', rev=speed/MAX_SPEED;
    engineOsc.frequency.setTargetAtTime(48+rev*92+(input.gas?18:0),audioCtx.currentTime,.045); engineFilter.frequency.setTargetAtTime(180+rev*720,audioCtx.currentTime,.06);
    engineGain.gain.setTargetAtTime(active?(.025+rev*.055):0,audioCtx.currentTime,.08);
    roadGain.gain.setTargetAtTime(active && Math.abs(lateral)>1.08 ? .018 : 0,audioCtx.currentTime,.04);
  }
  function impactSound(){
    if(!audioCtx||!soundOn)return; const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(); osc.type='sawtooth';osc.frequency.setValueAtTime(105,audioCtx.currentTime);osc.frequency.exponentialRampToValueAtTime(38,audioCtx.currentTime+.28);gain.gain.setValueAtTime(.16,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.32);osc.connect(gain).connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+.33);
  }
  function signalSound(freq,duration=.13){if(!audioCtx||!soundOn)return;const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.frequency.value=freq;gain.gain.setValueAtTime(.11,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);osc.connect(gain).connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration);}

  function resize(){ dpr=Math.min(devicePixelRatio||1,2); W=innerWidth; H=innerHeight; canvas.width=W*dpr; canvas.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); horizon=H*.30; draw(); }
  function curveAt(z){ return Math.sin(z/1250)*.72+Math.sin(z/5100)*1.15+Math.sin((z+900)/410)*.13; }
  function hillAt(z){ return Math.sin(z/1800)*H*.035+Math.sin(z/510)*H*.012; }
  function roadPoint(d){
    const p=1-d/DRAW_DISTANCE, depth=Math.max(0,p); const y=horizon+Math.pow(depth,1.72)*(H-horizon*.84)+hillAt(position+d)-hillAt(position);
    const bend=(curveAt(position+d)-curveAt(position))*W*.19*(d/DRAW_DISTANCE); const center=W/2+bend-lateral*W*.31*depth;
    const half=(W*.035+W*.39*Math.pow(depth,1.45)); return {y,center,half,depth};
  }
  function poly(points,color){ ctx.fillStyle=color; ctx.beginPath(); ctx.moveTo(points[0][0],points[0][1]); for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]); ctx.closePath(); ctx.fill(); }
  function drawSky(){
    const sky=ctx.createLinearGradient(0,0,0,horizon+80); sky.addColorStop(0,'#08061c'); sky.addColorStop(.55,'#33205f'); sky.addColorStop(1,'#f25b86'); ctx.fillStyle=sky; ctx.fillRect(0,0,W,horizon+90);
    ctx.fillStyle='#ffd6c8'; ctx.beginPath(); ctx.arc(W*.76,horizon*.52,Math.min(W,H)*.055,0,Math.PI*2); ctx.fill();
    const base=horizon+20; ctx.fillStyle='#17132f'; ctx.beginPath(); ctx.moveTo(0,base); for(let x=0;x<=W;x+=W/10)ctx.lineTo(x,base-32-Math.sin(x*.021)*25-Math.sin(x*.073)*4); ctx.lineTo(W,base+80);ctx.lineTo(0,base+80);ctx.fill();
    ctx.fillStyle='#090a20'; for(let x=0;x<W;x+=Math.max(18,W/42)){ const bh=12+((x*17)%39);ctx.fillRect(x,base-bh,Math.max(10,W/55),bh+25); if((x/18)%3<1) {ctx.fillStyle='#ff5f8b88';ctx.fillRect(x+4,base-bh+5,2,3);ctx.fillStyle='#090a20';} }
  }
  function drawRoad(){
    drawSky(); ctx.fillStyle='#102a31';ctx.fillRect(0,horizon,W,H-horizon);
    for(let i=ROAD_SEGMENTS-1;i>=0;i--){
      const d1=DRAW_DISTANCE*(i/ROAD_SEGMENTS),d2=DRAW_DISTANCE*((i+1)/ROAD_SEGMENTS),a=roadPoint(d1),b=roadPoint(d2); if(a.y<b.y)continue;
      poly([[0,b.y],[W,b.y],[W,a.y],[0,a.y]],'#102e33');
      poly([[b.center-b.half,b.y],[b.center+b.half,b.y],[a.center+a.half,a.y],[a.center-a.half,a.y]],'#272a37');
      const laneStripe=(Math.floor((position+d1)/145)%2)===0;
      if(laneStripe){ for(const lane of[-1/3,1/3]) poly([[b.center+b.half*lane-1,b.y],[b.center+b.half*lane+1,b.y],[a.center+a.half*lane+2.5,a.y],[a.center+a.half*lane-2.5,a.y]],'#d9f8fb88'); }
      poly([[b.center-b.half,b.y],[b.center-b.half+Math.max(1,3*a.depth),b.y],[a.center-a.half+Math.max(1,4*a.depth),a.y],[a.center-a.half,a.y]],'#70ecff99');
      poly([[b.center+b.half-Math.max(1,3*a.depth),b.y],[b.center+b.half,b.y],[a.center+a.half,a.y],[a.center+a.half-Math.max(1,4*a.depth),a.y]],'#70ecff99');
      if(i%9===0){ drawPost(a.center-a.half*1.18,a.y,a.depth);drawPost(a.center+a.half*1.18,a.y,a.depth); }
    }
  }
  function drawPost(x,y,s){ if(s<.06)return;ctx.fillStyle='#f8e7dc';ctx.fillRect(x-2*s,y-25*s,4*s,25*s);ctx.fillStyle='#ff3e83';ctx.shadowColor='#ff3e83';ctx.shadowBlur=10*s;ctx.fillRect(x-5*s,y-28*s,10*s,7*s);ctx.shadowBlur=0; }
  function resetTraffic(){
    traffic.length=0;
    const colors=['#56eaff','#ffd15d','#9b72ff','#53ef9d','#ff754f','#eaf5ff','#ff497b'];
    const speeds=[218,205,242,195,230,215,248];
    for(let i=0;i<7;i++)traffic.push({progress:.025+i*.018,lane:[-.62,0,.62][i%3],targetLane:[-.62,0,.62][i%3],speed:speeds[i],color:colors[i],change:1.5+i*.37,finished:false});
  }
  function drawTraffic(){
    const visible=[]; for(const car of traffic){ const d=(car.progress-distance)*WORLD_PER_KM; if(d>0&&d<DRAW_DISTANCE)visible.push({car,d,p:roadPoint(d)}); }
    visible.sort((a,b)=>b.d-a.d); for(const v of visible){ const s=.12+v.p.depth*.82,x=v.p.center+v.car.lane*v.p.half*.58,w=46*s,h=72*s; drawCar(x-w/2,v.p.y-h,w,h,v.car.color,false); }
  }
  function drawCheckpoint(){
    const target=Math.min(nextCheckpoint,FINISH_KM),d=(target-distance)*WORLD_PER_KM;if(d<=0||d>=DRAW_DISTANCE)return;const p=roadPoint(d),s=.15+p.depth*.85;if(p.depth<.05)return;
    const left=p.center-p.half*1.06,right=p.center+p.half*1.06,top=p.y-105*s;ctx.save();ctx.lineWidth=Math.max(2,9*s);ctx.strokeStyle=target===FINISH_KM?'#f6fbff':'#ffcc62';ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=12*s;ctx.beginPath();ctx.moveTo(left,p.y);ctx.lineTo(left,top);ctx.lineTo(right,top);ctx.lineTo(right,p.y);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#121326';ctx.fillRect(left,top-18*s,right-left,31*s);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font=`900 ${Math.max(8,20*s)}px "Barlow Condensed",sans-serif`;ctx.fillText(target===FINISH_KM?'META':'CHECKPOINT',p.center,top+5*s);ctx.restore();
  }
  function drawCar(x,y,w,h,color,player){
    ctx.save();ctx.translate(x,y); if(player){ctx.translate(w/2,h/2);ctx.rotate(-steerVisual*.045);ctx.translate(-w/2,-h/2);} ctx.shadowColor=color;ctx.shadowBlur=player?24:10;ctx.fillStyle=color;
    ctx.beginPath();ctx.moveTo(w*.13,h);ctx.lineTo(0,h*.35);ctx.quadraticCurveTo(w*.08,0,w*.3,0);ctx.lineTo(w*.7,0);ctx.quadraticCurveTo(w*.92,0,w,h*.35);ctx.lineTo(w*.87,h);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#0b1020';polyLocal([[w*.22,h*.16],[w*.78,h*.16],[w*.88,h*.49],[w*.12,h*.49]]);ctx.fillStyle='#ff284f';ctx.fillRect(w*.08,h*.72,w*.22,h*.11);ctx.fillRect(w*.7,h*.72,w*.22,h*.11);ctx.fillStyle='#eefcff';ctx.fillRect(w*.46,h*.06,w*.08,h*.82);ctx.restore();
  }
  function polyLocal(points){ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.closePath();ctx.fill();}
  function drawRaceCar(x,y,w,h){
    ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(-steerVisual*.045);ctx.translate(-w/2,-h/2);
    ctx.fillStyle='#070812';ctx.fillRect(-w*.04,h*.39,w*.13,h*.48);ctx.fillRect(w*.91,h*.39,w*.13,h*.48);
    ctx.fillStyle='#13131d';ctx.fillRect(w*.04,h*.08,w*.92,h*.09);ctx.fillStyle='#ff3e88';ctx.fillRect(0,h*.02,w,h*.07);ctx.fillRect(w*.09,0,w*.07,h*.18);ctx.fillRect(w*.84,0,w*.07,h*.18);
    ctx.shadowColor='#ff3e88';ctx.shadowBlur=26;const body=ctx.createLinearGradient(0,0,w,h);body.addColorStop(0,'#ff74a9');body.addColorStop(.46,'#ff347d');body.addColorStop(1,'#a90f55');ctx.fillStyle=body;
    polyLocal([[w*.19,h*.18],[w*.81,h*.18],[w*.96,h*.43],[w*.9,h*.91],[w*.72,h],[w*.28,h],[w*.1,h*.91],[w*.04,h*.43]]);ctx.shadowBlur=0;
    ctx.fillStyle='#101426';polyLocal([[w*.29,h*.22],[w*.71,h*.22],[w*.82,h*.49],[w*.18,h*.49]]);ctx.fillStyle='#49dff044';polyLocal([[w*.32,h*.25],[w*.68,h*.25],[w*.75,h*.43],[w*.25,h*.43]]);
    ctx.fillStyle='#ff245c';ctx.shadowColor='#ff245c';ctx.shadowBlur=13;ctx.fillRect(w*.12,h*.59,w*.25,h*.12);ctx.fillRect(w*.63,h*.59,w*.25,h*.12);ctx.shadowBlur=0;
    ctx.fillStyle='#191724';polyLocal([[w*.12,h*.79],[w*.88,h*.79],[w*.76,h],[w*.24,h]]);ctx.fillStyle='#05060a';ctx.fillRect(w*.25,h*.89,w*.5,h*.08);
    ctx.fillStyle='#d9fbff';ctx.fillRect(w*.47,h*.2,w*.06,h*.56);ctx.fillStyle='#45e9ff';ctx.shadowColor='#45e9ff';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(w*.39,h*.93,w*.035,0,Math.PI*2);ctx.arc(w*.61,h*.93,w*.035,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function drawPlayer(){ const w=Math.min(126,W*.21),h=w*.62,x=W/2-w/2+steerVisual*W*.018,y=H-h-Math.max(12,H*.02);drawRaceCar(x,y,w,h);if(speed>25){ctx.fillStyle=`rgba(62,229,255,${.08+speed/MAX_SPEED*.18})`;ctx.fillRect(x+w*.34,y+h,w*.32,Math.max(2,speed/MAX_SPEED*6));} }
  function draw(){ ctx.save();if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);drawRoad();drawCheckpoint();drawTraffic();drawPlayer();ctx.restore();if(bannerLife>0){ctx.save();ctx.globalAlpha=Math.min(1,bannerLife*1.5);ctx.fillStyle='#ff3e8833';ctx.fillRect(0,H*.32,W,H*.2);ctx.textAlign='center';ctx.font=`900 ${Math.min(58,W*.09)}px "Barlow Condensed",sans-serif`;ctx.fillStyle='#fff';ctx.shadowColor='#ff3e88';ctx.shadowBlur=22;ctx.fillText(banner,W/2,H*.44);ctx.restore();} }
  function update(dt){
    const throttle=input.gas?92:0, drag=22+speed*speed*.00058; speed+= (throttle-drag-(input.brake?175:0))*dt; speed=Math.max(0,Math.min(MAX_SPEED,speed));
    const turn=(input.right?1:0)-(input.left?1:0), grip=.65+speed/MAX_SPEED*1.45; lateral+=turn*grip*dt; lateral-=curveAt(position)*speed/MAX_SPEED*.19*dt; steerVisual+=(turn-steerVisual)*Math.min(1,dt*10);
    const offRoad=Math.abs(lateral)>1.08;
    if(offRoad){speed-=34*dt;shake=Math.max(shake,1.8);lateral=Math.max(-1.38,Math.min(1.38,lateral));} else shake=Math.max(0,shake-dt*18);
    position+=speed*dt*1.62; distance+=speed*dt/3600; timeLeft=Math.max(0,timeLeft-dt);crashCooldown-=dt;bannerLife=Math.max(0,bannerLife-dt);
    for(const car of traffic){
      if(!car.finished){car.progress+=car.speed*dt/3600;if(car.progress>=FINISH_KM)car.finished=true;}
      car.change-=dt;if(car.change<=0){car.targetLane=[-.62,0,.62][Math.floor(Math.random()*3)];car.change=1.7+Math.random()*3;}car.lane+=(car.targetLane-car.lane)*Math.min(1,dt*1.1);
      const d=(car.progress-distance)*WORLD_PER_KM;if(d>0&&d<55&&Math.abs(lateral-car.lane)<.34&&crashCooldown<=0){speed*=.25;shake=14;crashCooldown=1.2;impactSound();}
    }
    if(distance>=nextCheckpoint&&nextCheckpoint<FINISH_KM){timeLeft+=30;nextCheckpoint+=2;banner='CHECKPOINT  +30';bannerLife=2;}
    const place=1+traffic.filter(car=>car.progress>distance).length;
    const stage=Math.min(3,Math.floor(distance/2)+1),remaining=Math.max(0,FINISH_KM-distance);
    speedEl.textContent=Math.round(speed);distanceEl.textContent=Math.min(distance,FINISH_KM).toFixed(1);placeEl.textContent=place;timerEl.textContent=Math.ceil(timeLeft);stageEl.textContent=stage;progressStage.textContent=stage;remainingEl.textContent=`FALTAN ${remaining.toFixed(1)} KM`;progressFill.style.width=`${Math.min(100,distance/FINISH_KM*100)}%`;
    updateAudio();
    if(distance>=FINISH_KM){finishRace(true,place);return;}if(timeLeft<=0){finishRace(false,place);}
  }
  function finishRace(completed,place){state='finished';updateAudio();touch.classList.remove('playing');const won=completed&&place===1;if(won)showMessage('CAMPEÓN','¡Ganaste la carrera!',`Terminaste 1° entre 8 pilotos con ${Math.ceil(timeLeft)} segundos restantes.`,false);else if(completed)showMessage('META','Carrera completada',`Terminaste en la posición ${place} de 8. Probá otra vez para ganar.`,false);else showMessage('TIEMPO AGOTADO','Fin de la carrera',`Llegaste a ${distance.toFixed(1)} km en la posición ${place}.`,false);}
  function start(){initAudio();countdownId++;const id=countdownId;position=0;speed=0;lateral=0;distance=0;timeLeft=45;nextCheckpoint=2;banner='';bannerLife=0;shake=0;resetTraffic();state='countdown';menu.classList.remove('visible');message.classList.remove('visible');hud.classList.add('playing');raceProgress.classList.add('playing');touch.classList.remove('playing');speedEl.textContent='0';distanceEl.textContent='0.0';placeEl.textContent='8';timerEl.textContent='45';stageEl.textContent='1';progressStage.textContent='1';remainingEl.textContent='FALTAN 6.0 KM';progressFill.style.width='0%';draw();runCountdown(id);}
  function runCountdown(id){const bulbs=[...startLights.querySelectorAll('i')];startLights.classList.add('visible');let step=0;const tick=()=>{if(id!==countdownId)return;bulbs.forEach(b=>b.className='');if(step===0){bulbs[0].classList.add('on','red');lightText.textContent='3';signalSound(330);}else if(step===1){bulbs[0].classList.add('on','red');bulbs[1].classList.add('on','amber');lightText.textContent='2';signalSound(330);}else if(step===2){bulbs[0].classList.add('on','red');bulbs[1].classList.add('on','amber');lightText.textContent='1';signalSound(330);}else{bulbs[2].classList.add('on','green');lightText.textContent='¡YA!';signalSound(660,.28);state='playing';touch.classList.add('playing');last=performance.now();updateAudio();requestAnimationFrame(loop);setTimeout(()=>{if(id===countdownId)startLights.classList.remove('visible');},700);return;}step++;setTimeout(tick,850);};tick();}
  function pause(){if(state!=='playing')return;state='paused';updateAudio();showMessage('EN PAUSA','Motor en espera','La ruta sigue cuando vos quieras.',true);}
  function showMessage(k,t,txt,canResume){document.querySelector('#resultKicker').textContent=k;document.querySelector('#resultTitle').textContent=t;document.querySelector('#resultText').textContent=txt;resume.style.display=canResume?'block':'none';retry.style.display=canResume?'none':'block';message.classList.add('visible');touch.classList.remove('playing');}
  function loop(now){if(state!=='playing')return;const dt=Math.min(.035,(now-last)/1000);last=now;update(dt);draw();requestAnimationFrame(loop);}
  const keyMap={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowUp:'gas',w:'gas',W:'gas',ArrowDown:'brake',s:'brake',S:'brake'};
  addEventListener('keydown',e=>{if(keyMap[e.key]){input[keyMap[e.key]]=true;e.preventDefault();}if(e.key==='Escape'||e.key==='p'||e.key==='P')pause();});
  addEventListener('keyup',e=>{if(keyMap[e.key])input[keyMap[e.key]]=false;});addEventListener('blur',()=>Object.keys(input).forEach(k=>input[k]=false));
  document.querySelectorAll('[data-control]').forEach(b=>{const c=b.dataset.control;const on=e=>{e.preventDefault();input[c]=true;b.classList.add('active');};const off=e=>{e.preventDefault();input[c]=false;b.classList.remove('active');};b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off);});
  document.querySelector('#start').addEventListener('click',start);retry.addEventListener('click',start);document.querySelector('#pause').addEventListener('click',pause);
  document.querySelector('#sound').addEventListener('click',e=>{soundOn=!soundOn;e.currentTarget.textContent=soundOn?'♪':'×';e.currentTarget.setAttribute('aria-label',soundOn?'Desactivar sonido':'Activar sonido');if(soundOn)initAudio();updateAudio();});
  resume.addEventListener('click',()=>{initAudio();message.classList.remove('visible');touch.classList.add('playing');state='playing';last=performance.now();updateAudio();requestAnimationFrame(loop);});addEventListener('resize',resize);resetTraffic();resize();
})();
