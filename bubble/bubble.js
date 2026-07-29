(() => {
  const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d');
  const app = document.querySelector('#bubbleApp'), menu = document.querySelector('#menu');
  const dialog = document.querySelector('#dialog'), scoreEl = document.querySelector('#score');
  const bestEl = document.querySelector('#best'), title = document.querySelector('#title');
  const missesEl = document.querySelector('#misses'), missBox = document.querySelector('.miss-box'), toast = document.querySelector('#toast');
  const eyebrow = document.querySelector('#eyebrow'), result = document.querySelector('#result');
  const resume = document.querySelector('#resume');
  const COLORS = ['#55eaff','#ff527e','#ffd45e','#9d76ff','#65f2a8'];
  let W, H, dpr, radius, diameter, rowH, cols, top, shooterY, boardLeft, boardRight;
  let grid = [], shot = null, current = 0, next = 1, aim = -Math.PI / 2;
  let running = false, paused = false, aiming = false, score = 0, misses = 0;
  let particles = [], drops = [], last = 0;
  let audio = null, toastTimer = 0;
  let best = +(localStorage.getItem('neonBubbleBest') || 0); bestEl.textContent = best;

  const cellKey = (r,c) => `${r}:${c}`;
  function cellPos(r,c) { return { x: boardLeft + radius + c * diameter + (r % 2 ? radius : 0), y: top + radius + r * rowH }; }
  function valid(r,c) { const max = cols - (r % 2); return r >= 0 && c >= 0 && c < max; }
  function neighbors(r,c) {
    const ds = r % 2 ? [[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]] : [[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]];
    return ds.map(([dr,dc])=>[r+dr,c+dc]).filter(([rr,cc])=>valid(rr,cc));
  }
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    canvas.width = W*dpr; canvas.height = H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    cols = Math.max(8, Math.min(13, Math.floor(W / 48)));
    radius = Math.min(25, Math.max(17, W / (cols*2 + 1))); diameter = radius*2; rowH = radius*1.73;
    boardLeft = (W - cols * diameter) / 2; boardRight = boardLeft + cols * diameter;
    top = Math.max(70, H*.105); shooterY = H - Math.max(54, H*.09);
  }
  function newColor() {
    const present = [...new Set([...grid.values()].map(b=>b.color))];
    const pool = present.length ? present : COLORS.slice(0,4);
    return pool[Math.floor(Math.random()*pool.length)];
  }
  function initialGrid() {
    grid = new Map();
    for (let r=0;r<6;r++) for(let c=0;c<cols-(r%2);c++) {
      if (r < 4 || Math.random()>.18) grid.set(cellKey(r,c),{r,c,color:COLORS[Math.floor(Math.random()*4)]});
    }
  }
  function start() {
    initAudio(); resize(); initialGrid(); particles=[]; drops=[]; score=0; misses=0; shot=null;
    current=newColor(); next=newColor(); running=true; paused=false; aim=-Math.PI/2;
    scoreEl.textContent='0'; updateMisses(); menu.classList.remove('visible'); dialog.classList.remove('visible'); app.classList.add('playing'); last=performance.now(); requestAnimationFrame(loop);
  }
  function pause() {
    if(!running || paused || shot) return; paused=true; eyebrow.textContent='PARTIDA EN PAUSA'; title.textContent='Pausa'; result.textContent=''; resume.style.display='block'; dialog.classList.add('visible');
  }
  function gameOver(win=false) {
    running=false; paused=true; shot=null; app.classList.remove('playing');
    eyebrow.textContent=win?'TABLERO LIMPIO':'FIN DE LA PARTIDA'; title.textContent=win?'¡Ganaste!':'Sin espacio'; result.textContent=`PUNTAJE: ${score}`; resume.style.display='none'; dialog.classList.add('visible');
    if(score>best){best=score;localStorage.setItem('neonBubbleBest',best);bestEl.textContent=best;}
  }
  function shoot() {
    if(!running || paused || shot) return;
    const min=-Math.PI+.18,max=-.18; aim=Math.max(min,Math.min(max,aim));
    const speed=Math.max(700,H*1.05); shot={x:W/2,y:shooterY,color:current,vx:Math.cos(aim)*speed,vy:Math.sin(aim)*speed}; current=next; next=newColor();
  }
  function closestCell(x,y) {
    let bestCell=null, bd=Infinity;
    const approx=Math.max(0,Math.round((y-top-radius)/rowH));
    for(let r=Math.max(0,approx-2);r<=approx+2;r++) for(let c=0;c<cols-(r%2);c++) {
      if(grid.has(cellKey(r,c))) continue; const p=cellPos(r,c), d=(p.x-x)**2+(p.y-y)**2;
      if(d<bd){bd=d;bestCell={r,c};}
    }
    return bestCell;
  }
  function attach() {
    const cell=closestCell(shot.x,shot.y); if(!cell){shot=null;return;}
    const bubble={...cell,color:shot.color}; grid.set(cellKey(cell.r,cell.c),bubble); burstAt(...Object.values(cellPos(cell.r,cell.c)),bubble.color,5); shot=null;
    const group=flood(cell.r,cell.c,bubble.color);
    if(group.length>=3){
      group.forEach(k=>pop(k));
      const groupPoints=group.length*10+Math.max(0,group.length-3)*15;
      score+=groupPoints;misses=0;updateMisses();showToast(group.length===3?`+${groupPoints}`:`¡GRUPO DE ${group.length}!  +${groupPoints}`);playPop(group.length);
      const anchored=new Set(), queue=[]; for(const [k,b] of grid)if(b.r===0){anchored.add(k);queue.push(b);}
      while(queue.length){const b=queue.shift();neighbors(b.r,b.c).forEach(([r,c])=>{const k=cellKey(r,c);if(grid.has(k)&&!anchored.has(k)){anchored.add(k);queue.push(grid.get(k));}});}
      let fallen=0;[...grid.keys()].filter(k=>!anchored.has(k)).forEach(k=>{const b=grid.get(k),p=cellPos(b.r,b.c);drops.push({x:p.x,y:p.y,color:b.color,vy:20});grid.delete(k);score+=15;fallen++;});
      if(fallen){showToast(`¡CAÍDA x${fallen}!  +${fallen*15}`);playDrop();}
      scoreEl.textContent=score; if(!grid.size){setTimeout(()=>gameOver(true),450);return;}
    } else {
      misses++;updateMisses();playMiss();
      if(misses>=5){const penalty=Math.min(50,score);score-=penalty;scoreEl.textContent=score;misses=0;updateMisses();showToast(`5 FALLOS  −${penalty}`,true);playPenalty();}
      else if(misses===4)showToast('¡ÚLTIMO INTENTO!',true);
    }
    if([...grid.values()].some(b=>cellPos(b.r,b.c).y+radius>shooterY-radius*2.2)) gameOver(false);
  }
  function flood(r,c,color) {
    const seen=new Set(), q=[[r,c]];
    while(q.length){const [rr,cc]=q.pop(),k=cellKey(rr,cc),b=grid.get(k);if(!b||b.color!==color||seen.has(k))continue;seen.add(k);neighbors(rr,cc).forEach(n=>q.push(n));}
    return [...seen];
  }
  function pop(k){const b=grid.get(k);if(!b)return;const p=cellPos(b.r,b.c);burstAt(p.x,p.y,b.color,10);grid.delete(k);}
  function burstAt(x,y,color,n){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=35+Math.random()*110;particles.push({x,y,color,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.45+Math.random()*.3});}}
  function updateMisses(){missesEl.textContent=`${misses}/5`;missBox.classList.toggle('warning',misses>=4);}
  function showToast(text,penalty=false){clearTimeout(toastTimer);toast.textContent=text;toast.className=penalty?'penalty':'';void toast.offsetWidth;toast.classList.add('show');toastTimer=setTimeout(()=>toast.classList.remove('show'),950);}
  function initAudio(){if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();}
  function tone(freq,duration=.08,type='sine',volume=.05,delay=0){if(!audio)return;const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+duration);}
  function playPop(n){tone(430+n*35,.09,'sine',.06);tone(620+n*45,.12,'triangle',.045,.06);}
  function playDrop(){tone(720,.08,'sine',.04);tone(920,.12,'sine',.035,.07);}
  function playMiss(){tone(170,.055,'sine',.018);}
  function playPenalty(){tone(150,.22,'sawtooth',.055);tone(95,.3,'square',.035,.08);}
  function update(dt){
    if(shot){shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;if(shot.x<boardLeft+radius){shot.x=boardLeft+radius;shot.vx=Math.abs(shot.vx)}if(shot.x>boardRight-radius){shot.x=boardRight-radius;shot.vx=-Math.abs(shot.vx)}
      let hit=shot.y<=top+radius; if(!hit)for(const b of grid.values()){const p=cellPos(b.r,b.c);if((p.x-shot.x)**2+(p.y-shot.y)**2<(diameter-3)**2){hit=true;break;}} if(hit)attach();
    }
    particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=120*dt;p.life-=dt});particles=particles.filter(p=>p.life>0);
    drops.forEach(p=>{p.y+=p.vy*dt;p.vy+=550*dt});drops=drops.filter(p=>p.y<H+50);
  }
  function bubble(x,y,color,r=radius){const g=ctx.createRadialGradient(x-r*.3,y-r*.35,r*.08,x,y,r);g.addColorStop(0,'#fff');g.addColorStop(.16,color);g.addColorStop(1,'#10101e');ctx.fillStyle=g;ctx.shadowColor=color;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(x,y,r-1,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
  function draw(){
    ctx.clearRect(0,0,W,H);ctx.strokeStyle='rgba(109,229,255,.13)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,top);ctx.lineTo(W,top);ctx.stroke();
    grid.forEach(b=>{const p=cellPos(b.r,b.c);bubble(p.x,p.y,b.color)});drops.forEach(p=>bubble(p.x,p.y,p.color));
    if(running){let a=aim,x=W/2,y=shooterY;ctx.save();ctx.setLineDash([7,10]);ctx.strokeStyle='rgba(135,238,255,.38)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);for(let i=0;i<22;i++){x+=Math.cos(a)*13;y+=Math.sin(a)*13;if(x<boardLeft+radius||x>boardRight-radius){a=Math.PI-a;x=Math.max(boardLeft+radius,Math.min(boardRight-radius,x))}ctx.lineTo(x,y)}ctx.stroke();ctx.restore();bubble(W/2,shooterY,current);bubble(W/2+radius*2.5,shooterY+5,next,radius*.62);ctx.fillStyle='#718294';ctx.font='10px system-ui';ctx.fillText('SIG.',W/2+radius*2.5-11,shooterY-radius*.9);}
    if(shot)bubble(shot.x,shot.y,shot.color);particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life*1.8);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill()});ctx.globalAlpha=1;
  }
  function loop(t){if(!running)return;const dt=Math.min(.025,(t-last)/1000);last=t;if(!paused)update(dt);draw();requestAnimationFrame(loop);}
  function point(e){const p=e.touches?e.touches[0]:e;return{x:p.clientX,y:p.clientY};}
  function setAim(e){const p=point(e),dx=p.x-W/2,dy=p.y-shooterY;if(dy<0)aim=Math.atan2(dy,dx);}
  canvas.addEventListener('pointerdown',e=>{if(running&&!paused&&!shot){aiming=true;setAim(e)}});canvas.addEventListener('pointermove',e=>{if(aiming)setAim(e)});canvas.addEventListener('pointerup',e=>{if(aiming){setAim(e);aiming=false;shoot()}});canvas.addEventListener('pointercancel',()=>aiming=false);
  document.querySelector('#start').onclick=start;document.querySelector('#restart').onclick=start;document.querySelector('#pause').onclick=pause;
  resume.onclick=()=>{paused=false;dialog.classList.remove('visible');last=performance.now()};
  addEventListener('resize',()=>{resize();draw()});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});resize();draw();
  if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('../sw.js'));
})();
