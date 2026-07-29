(() => {
  'use strict';
  const canvas=document.querySelector('#game'), ctx=canvas.getContext('2d');
  const menu=document.querySelector('#menu'), message=document.querySelector('#message'), hud=document.querySelector('#hud'), touch=document.querySelector('#touch');
  const speedEl=document.querySelector('#speed'), distanceEl=document.querySelector('#distance'), resume=document.querySelector('#resume'), retry=document.querySelector('#retry');
  let W=0,H=0,dpr=1,horizon=0,state='menu',last=0,position=0,speed=0,lateral=0,steerVisual=0,distance=0,shake=0,crashCooldown=0;
  const input={left:false,right:false,gas:false,brake:false};
  const MAX_SPEED=285, DRAW_DISTANCE=1650, ROAD_SEGMENTS=95;
  const traffic=[];

  function resize(){ dpr=Math.min(devicePixelRatio||1,2); W=innerWidth; H=innerHeight; canvas.width=W*dpr; canvas.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); horizon=H*.30; draw(); }
  function curveAt(z){ return Math.sin(z/1250)*.72+Math.sin(z/5100)*1.15+Math.sin((z+900)/410)*.13; }
  function hillAt(z){ return Math.sin(z/1800)*H*.035+Math.sin(z/510)*H*.012; }
  function roadPoint(d){
    const p=1-d/DRAW_DISTANCE, depth=Math.max(0,p); const y=horizon+Math.pow(depth,1.72)*(H-horizon*.84)+hillAt(position+d)-hillAt(position);
    const bend=(curveAt(position+d)-curveAt(position))*W*.19*(d/DRAW_DISTANCE); const center=W/2+bend-lateral*W*.31*depth;
    const half=(W*.035+W*.48*Math.pow(depth,1.45)); return {y,center,half,depth};
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
      const stripe=(Math.floor((position+d1)/105)%2)===0;
      poly([[0,b.y],[W,b.y],[W,a.y],[0,a.y]],stripe?'#123238':'#102c31');
      poly([[b.center-b.half*1.1,b.y],[b.center+b.half*1.1,b.y],[a.center+a.half*1.1,a.y],[a.center-a.half*1.1,a.y]],stripe?'#f34c79':'#f7d8ce');
      poly([[b.center-b.half,b.y],[b.center+b.half,b.y],[a.center+a.half,a.y],[a.center-a.half,a.y]],stripe?'#282b39':'#242735');
      if(stripe){ for(const lane of[-1/3,1/3]) poly([[b.center+b.half*lane-1,b.y],[b.center+b.half*lane+1,b.y],[a.center+a.half*lane+3,a.y],[a.center+a.half*lane-3,a.y]],'#d9f8fbaa'); }
      if(i%9===0){ drawPost(a.center-a.half*1.18,a.y,a.depth);drawPost(a.center+a.half*1.18,a.y,a.depth); }
    }
  }
  function drawPost(x,y,s){ if(s<.06)return;ctx.fillStyle='#f8e7dc';ctx.fillRect(x-2*s,y-25*s,4*s,25*s);ctx.fillStyle='#ff3e83';ctx.shadowColor='#ff3e83';ctx.shadowBlur=10*s;ctx.fillRect(x-5*s,y-28*s,10*s,7*s);ctx.shadowBlur=0; }
  function resetTraffic(){ traffic.length=0; for(let i=0;i<13;i++)traffic.push({z:350+i*190+Math.random()*150,lane:[-.62,0,.62][i%3],speed:95+Math.random()*95,color:['#56eaff','#ff497b','#ffd15d','#9b72ff'][i%4]}); }
  function drawTraffic(){
    const visible=[]; for(const car of traffic){ let d=car.z-position; while(d<0)d+=5200; if(d<DRAW_DISTANCE)visible.push({car,d,p:roadPoint(d)}); }
    visible.sort((a,b)=>b.d-a.d); for(const v of visible){ const s=.12+v.p.depth*.82,x=v.p.center+v.car.lane*v.p.half*.58,w=46*s,h=72*s; drawCar(x-w/2,v.p.y-h,w,h,v.car.color,false); }
  }
  function drawCar(x,y,w,h,color,player){
    ctx.save();ctx.translate(x,y); if(player){ctx.translate(w/2,h/2);ctx.rotate(-steerVisual*.045);ctx.translate(-w/2,-h/2);} ctx.shadowColor=color;ctx.shadowBlur=player?24:10;ctx.fillStyle=color;
    ctx.beginPath();ctx.moveTo(w*.13,h);ctx.lineTo(0,h*.35);ctx.quadraticCurveTo(w*.08,0,w*.3,0);ctx.lineTo(w*.7,0);ctx.quadraticCurveTo(w*.92,0,w,h*.35);ctx.lineTo(w*.87,h);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#0b1020';polyLocal([[w*.22,h*.16],[w*.78,h*.16],[w*.88,h*.49],[w*.12,h*.49]]);ctx.fillStyle='#ff284f';ctx.fillRect(w*.08,h*.72,w*.22,h*.11);ctx.fillRect(w*.7,h*.72,w*.22,h*.11);ctx.fillStyle='#eefcff';ctx.fillRect(w*.46,h*.06,w*.08,h*.82);ctx.restore();
  }
  function polyLocal(points){ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.closePath();ctx.fill();}
  function drawPlayer(){ const w=Math.min(112,W*.19),h=w*.57,x=W/2-w/2+steerVisual*W*.018,y=H-h-Math.max(16,H*.025);drawCar(x,y,w,h,'#ff3e88',true);ctx.fillStyle='#40eaff55';ctx.fillRect(x+w*.2,y+h,w*.6,Math.max(2,speed/MAX_SPEED*5)); }
  function draw(){ ctx.save();if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);drawRoad();drawTraffic();drawPlayer();ctx.restore(); }
  function update(dt){
    const throttle=input.gas?92:0, drag=22+speed*speed*.00058; speed+= (throttle-drag-(input.brake?175:0))*dt; speed=Math.max(0,Math.min(MAX_SPEED,speed));
    const turn=(input.right?1:0)-(input.left?1:0), grip=.65+speed/MAX_SPEED*1.45; lateral+=turn*grip*dt; lateral-=curveAt(position)*speed/MAX_SPEED*.19*dt; steerVisual+=(turn-steerVisual)*Math.min(1,dt*10);
    if(Math.abs(lateral)>1){speed-=85*dt;shake=Math.max(shake,3);lateral=Math.max(-1.28,Math.min(1.28,lateral));} else shake=Math.max(0,shake-dt*18);
    position+=speed*dt*1.62; distance+=speed*dt/3600; crashCooldown-=dt;
    for(const car of traffic){car.z+=car.speed*dt*.78;let d=car.z-position;while(d<0)d+=5200;if(d<55&&Math.abs(lateral-car.lane)<.34&&crashCooldown<=0){speed*=.25;shake=14;crashCooldown=1.2;}}
    speedEl.textContent=Math.round(speed);distanceEl.textContent=distance.toFixed(1);
  }
  function start(){position=0;speed=0;lateral=0;distance=0;shake=0;resetTraffic();state='playing';menu.classList.remove('visible');message.classList.remove('visible');hud.classList.add('playing');touch.classList.add('playing');last=performance.now();requestAnimationFrame(loop);}
  function pause(){if(state!=='playing')return;state='paused';showMessage('EN PAUSA','Motor en espera','La ruta sigue cuando vos quieras.',true);}
  function showMessage(k,t,txt,canResume){document.querySelector('#resultKicker').textContent=k;document.querySelector('#resultTitle').textContent=t;document.querySelector('#resultText').textContent=txt;resume.style.display=canResume?'block':'none';retry.style.display=canResume?'none':'block';message.classList.add('visible');touch.classList.remove('playing');}
  function loop(now){if(state!=='playing')return;const dt=Math.min(.035,(now-last)/1000);last=now;update(dt);draw();requestAnimationFrame(loop);}
  const keyMap={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowUp:'gas',w:'gas',W:'gas',ArrowDown:'brake',s:'brake',S:'brake'};
  addEventListener('keydown',e=>{if(keyMap[e.key]){input[keyMap[e.key]]=true;e.preventDefault();}if(e.key==='Escape'||e.key==='p'||e.key==='P')pause();});
  addEventListener('keyup',e=>{if(keyMap[e.key])input[keyMap[e.key]]=false;});addEventListener('blur',()=>Object.keys(input).forEach(k=>input[k]=false));
  document.querySelectorAll('[data-control]').forEach(b=>{const c=b.dataset.control;const on=e=>{e.preventDefault();input[c]=true;b.classList.add('active');};const off=e=>{e.preventDefault();input[c]=false;b.classList.remove('active');};b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off);});
  document.querySelector('#start').addEventListener('click',start);retry.addEventListener('click',start);document.querySelector('#pause').addEventListener('click',pause);resume.addEventListener('click',()=>{message.classList.remove('visible');touch.classList.add('playing');state='playing';last=performance.now();requestAnimationFrame(loop);});addEventListener('resize',resize);resetTraffic();resize();
})();
