(() => {
  'use strict';
  const canvas = document.querySelector('#snakeGame'), ctx = canvas.getContext('2d');
  const app = document.querySelector('#snakeApp'), menu = document.querySelector('#snakeMenu');
  const dialog = document.querySelector('#snakeMessage'), hint = document.querySelector('#snakeHint');
  const leftScore = document.querySelector('#leftScore'), rightScore = document.querySelector('#rightScore');
  const leftLabel = document.querySelector('#leftLabel'), rightLabel = document.querySelector('#rightLabel');
  const rightBox = document.querySelector('#rightBox'), title = document.querySelector('#snakeTitle');
  const eyebrow = document.querySelector('#snakeEyebrow'), result = document.querySelector('#snakeResult');
  const resume = document.querySelector('#snakeResume');
  const DIR = { up: {x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
  const speedMs = { slow: 155, normal: 115, fast: 82 };
  let W, H, dpr, cols, rows, cell, ox, oy, mode = 'classic', speed = 'normal';
  let snakes = [], food, special, running = false, paused = false, accumulator = 0, last = 0, score = 0;
  let particles = [], touchStarts = new Map(), audio;
  const bestKey = 'neon-snake-best';

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = Math.max(14, Math.floor(Math.min(W / 34, H / 23)));
    cols = Math.max(18, Math.floor(W / cell) - 2); rows = Math.max(12, Math.floor(H / cell) - 2);
    ox = Math.floor((W - cols * cell) / 2); oy = Math.floor((H - rows * cell) / 2);
  }
  function beep(freq, duration=.07) {
    try { audio ||= new (AudioContext || webkitAudioContext)(); const o=audio.createOscillator(), g=audio.createGain(); o.frequency.value=freq; g.gain.value=.045; g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration); o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime+duration); } catch (_) {}
  }
  function makeSnake(x, y, dir, color) {
    const tailDir = {x:-dir.x,y:-dir.y};
    return { body:[{x,y},{x:x+tailDir.x,y:y+tailDir.y},{x:x+tailDir.x*2,y:y+tailDir.y*2}], dir:{...dir}, queued:{...dir}, color, alive:true, points:0, grow:0 };
  }
  function occupied(x,y) { return snakes.some(s => s.body.some(p => p.x===x && p.y===y)); }
  function spawnFood() {
    let p; do { p={x:1+Math.floor(Math.random()*(cols-2)),y:1+Math.floor(Math.random()*(rows-2))}; } while(occupied(p.x,p.y)); food=p;
  }
  function spawnSpecial() {
    if (special || Math.random() > .3) return;
    let p; do { p={x:1+Math.floor(Math.random()*(cols-2)),y:1+Math.floor(Math.random()*(rows-2)),life:65}; } while(occupied(p.x,p.y) || (food.x===p.x&&food.y===p.y)); special=p;
  }
  function start(selected=mode) {
    mode=selected; score=0; particles=[]; special=null; accumulator=0;
    const cy=Math.floor(rows/2);
    snakes = mode==='classic'
      ? [makeSnake(Math.floor(cols*.32),cy,DIR.right,'#64ffac')]
      : [makeSnake(Math.floor(cols*.25),cy,DIR.right,'#64ffac'),makeSnake(Math.floor(cols*.75),cy,DIR.left,'#ffcf43')];
    spawnFood(); configureHud(); menu.classList.remove('visible'); dialog.classList.remove('visible'); app.classList.add('playing');
    running=true; paused=false; hint.style.opacity='1'; setTimeout(()=>hint.style.opacity='0',2600); last=performance.now(); requestAnimationFrame(loop);
  }
  function configureHud() {
    if(mode==='classic'){ leftLabel.textContent='PUNTOS'; rightLabel.textContent='RÉCORD'; leftScore.textContent=score; rightScore.textContent=localStorage.getItem(bestKey)||0; }
    else { leftLabel.textContent='JUGADOR 1'; rightLabel.textContent='JUGADOR 2'; leftScore.textContent=snakes[0]?.points||0; rightScore.textContent=snakes[1]?.points||0; }
    rightBox.style.display='block';
  }
  function turn(index, dir) {
    const s=snakes[index]; if(!s || !s.alive) return;
    if(dir.x !== -s.dir.x || dir.y !== -s.dir.y) s.queued={...dir};
  }
  function step() {
    snakes.forEach(s => { s.dir={...s.queued}; });
    const heads=snakes.map(s=>({x:s.body[0].x+s.dir.x,y:s.body[0].y+s.dir.y}));
    const dead=snakes.map((s,i)=> heads[i].x<0||heads[i].x>=cols||heads[i].y<0||heads[i].y>=rows || snakes.some(other=>other.body.some((p,k)=>p.x===heads[i].x&&p.y===heads[i].y && !(other===s&&k===other.body.length-1&&s.grow===0))));
    if(snakes.length===2 && heads[0].x===heads[1].x && heads[0].y===heads[1].y) dead[0]=dead[1]=true;
    snakes.forEach((s,i)=>{ if(dead[i]) s.alive=false; else { s.body.unshift(heads[i]); if(s.grow>0)s.grow--; else s.body.pop(); } });
    if(dead.some(Boolean)) return finish(dead);
    snakes.forEach((s,i)=>{
      const h=s.body[0];
      if(h.x===food.x&&h.y===food.y){ s.grow+=2; s.points++; score++; burst(food.x,food.y,'#ff5d77'); beep(620); spawnFood(); spawnSpecial(); }
      if(special&&h.x===special.x&&h.y===special.y){ s.grow+=4; s.points+=3; score+=3; burst(special.x,special.y,'#ffd34e'); special=null; beep(850,.12); }
    });
    if(special && --special.life<=0) special=null;
    configureHud();
  }
  function finish(dead) {
    paused=true; eyebrow.textContent='FIN DE LA PARTIDA'; resume.dataset.action='restart'; resume.querySelector('b').textContent='REVANCHA';
    if(mode==='classic'){
      const old=Number(localStorage.getItem(bestKey)||0), isBest=score>old; if(isBest)localStorage.setItem(bestKey,score);
      title.textContent=isBest&&score>0?'¡Nuevo récord!':'Fin'; result.textContent=`Conseguiste ${score} punto${score===1?'':'s'}`;
    } else {
      const winner=dead[0]&&!dead[1]?2:dead[1]&&!dead[0]?1:0; title.textContent=winner?`Jugador ${winner} gana`:'Empate'; result.textContent='La arena no perdona';
    }
    dialog.classList.add('visible'); beep(180,.25);
  }
  function burst(x,y,color){ for(let i=0;i<14;i++) particles.push({x:(x+.5)*cell+ox,y:(y+.5)*cell+oy,vx:(Math.random()-.5)*180,vy:(Math.random()-.5)*180,life:1,color}); }
  function updateParticles(dt){ particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt*2.2}); particles=particles.filter(p=>p.life>0); }
  function rectCell(p,color,scale=.76){ const inset=cell*(1-scale)/2; ctx.fillStyle=color; ctx.shadowColor=color; ctx.shadowBlur=13; ctx.beginPath(); ctx.roundRect(ox+p.x*cell+inset,oy+p.y*cell+inset,cell-2*inset,cell-2*inset,cell*.25);ctx.fill(); }
  function draw(){
    ctx.clearRect(0,0,W,H); ctx.strokeStyle='rgba(91,255,165,.12)';ctx.lineWidth=1;ctx.strokeRect(ox-.5,oy-.5,cols*cell+1,rows*cell+1);
    ctx.shadowBlur=18;ctx.shadowColor='#ff5670';ctx.fillStyle='#ff5670';ctx.beginPath();ctx.arc(ox+(food.x+.5)*cell,oy+(food.y+.5)*cell,cell*.3,0,Math.PI*2);ctx.fill();
    if(special){ ctx.shadowColor='#ffd34e';ctx.fillStyle='#ffd34e';const pulse=.25+Math.sin(performance.now()/100)*.05;ctx.beginPath();ctx.arc(ox+(special.x+.5)*cell,oy+(special.y+.5)*cell,cell*pulse,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffd34e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(ox+(special.x+.5)*cell,oy+(special.y+.5)*cell,cell*.42,0,Math.PI*2);ctx.stroke(); }
    snakes.forEach(s=>s.body.slice().reverse().forEach((p,i)=>rectCell(p,s.color,.56+i/s.body.length*.25)));
    ctx.shadowBlur=0; particles.forEach(p=>{ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4)});ctx.globalAlpha=1;
  }
  function loop(now){ if(!running)return;const dt=Math.min((now-last)/1000,.04);last=now;if(!paused){accumulator+=dt*1000;while(accumulator>=speedMs[speed]){step();accumulator-=speedMs[speed];if(paused)break}updateParticles(dt)}draw();requestAnimationFrame(loop); }
  function pause(){if(!running||paused)return;paused=true;eyebrow.textContent='PARTIDA EN PAUSA';title.textContent='Pausa';result.textContent=mode==='duel'?'Cada jugador desliza en su mitad':'Deslizá en cualquier dirección';resume.dataset.action='resume';resume.querySelector('b').textContent='CONTINUAR';dialog.classList.add('visible');}
  function showMenu(){running=false;paused=false;app.classList.remove('playing');dialog.classList.remove('visible');menu.classList.add('visible');draw();}
  function swipe(e){const st=touchStarts.get(e.pointerId);if(!st)return;const dx=e.clientX-st.x,dy=e.clientY-st.y;if(Math.hypot(dx,dy)<22)return;const dir=Math.abs(dx)>Math.abs(dy)?(dx>0?DIR.right:DIR.left):(dy>0?DIR.down:DIR.up);const player=mode==='duel'?(st.x<W/2?0:1):0;turn(player,dir);touchStarts.delete(e.pointerId);}
  canvas.addEventListener('pointerdown',e=>{touchStarts.set(e.pointerId,{x:e.clientX,y:e.clientY});try{canvas.setPointerCapture(e.pointerId)}catch(_){}});
  canvas.addEventListener('pointermove',swipe);canvas.addEventListener('pointerup',swipe);canvas.addEventListener('pointercancel',e=>touchStarts.delete(e.pointerId));
  document.querySelectorAll('[data-snake-mode]').forEach(b=>b.addEventListener('click',()=>start(b.dataset.snakeMode)));
  document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{speed=b.dataset.speed;document.querySelectorAll('[data-speed]').forEach(x=>x.classList.toggle('selected',x===b));}));
  document.querySelector('#snakePause').addEventListener('click',pause);document.querySelector('#snakeHome').addEventListener('click',pause);
  document.querySelector('#snakeMenuButton').addEventListener('click',showMenu);
  resume.addEventListener('click',()=>resume.dataset.action==='restart'?start():(paused=false,dialog.classList.remove('visible'),last=performance.now()));
  document.addEventListener('keydown',e=>{const map={ArrowUp:DIR.up,ArrowDown:DIR.down,ArrowLeft:DIR.left,ArrowRight:DIR.right,w:DIR.up,s:DIR.down,a:DIR.left,d:DIR.right};if(map[e.key])turn(mode==='duel'&&e.key.startsWith('Arrow')?1:0,map[e.key]);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused)pause()});addEventListener('resize',resize);resize();food={x:Math.floor(cols/2),y:Math.floor(rows/2)};draw();
  if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('../sw.js'));
})();
