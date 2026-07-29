(() => {
  'use strict';
  const canvas = document.querySelector('#racerGame');
  const ctx = canvas.getContext('2d');
  const menu = document.querySelector('#menu');
  const message = document.querySelector('#message');
  const hud = document.querySelector('#hud');
  const controls = document.querySelector('#controls');
  const scoreEl = document.querySelector('#score');
  const bestEl = document.querySelector('#best');
  const resume = document.querySelector('#resume');
  const retry = document.querySelector('#retry');
  let W = 0, H = 0, dpr = 1, roadWidth = 0, roadLeft = 0, laneWidth = 0;
  let state = 'menu', last = 0, distance = 0, speed = 370, roadOffset = 0, spawnTimer = 0;
  let best = Number(localStorage.getItem('neonRacerBest')) || 0;
  let enemies = [], particles = [], flash = 0;
  const player = { lane: 1, x: 0, y: 0, w: 48, h: 88, targetX: 0 };
  bestEl.textContent = best;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    roadWidth = Math.min(W * .88, 520); roadLeft = (W - roadWidth) / 2; laneWidth = roadWidth / 3;
    player.w = Math.min(50, laneWidth * .42); player.h = player.w * 1.78; player.y = H - player.h - Math.max(75, H * .1);
    setLane(player.lane, true);
  }
  function laneX(lane, width = player.w) { return roadLeft + laneWidth * (lane + .5) - width / 2; }
  function setLane(lane, instant = false) {
    player.lane = Math.max(0, Math.min(2, lane)); player.targetX = laneX(player.lane);
    if (instant) player.x = player.targetX;
  }
  function start() {
    distance = 0; speed = 370; roadOffset = 0; spawnTimer = .7; enemies = []; particles = []; flash = 0;
    setLane(1, true); state = 'playing'; menu.classList.remove('visible'); message.classList.remove('visible');
    hud.classList.add('playing'); controls.classList.add('playing'); last = performance.now(); requestAnimationFrame(loop);
  }
  function pause() {
    if (state !== 'playing') return; state = 'paused'; showMessage('EN PAUSA', 'Respirá un poco', 'La pista te espera.', true);
  }
  function showMessage(kicker, title, text, canResume) {
    document.querySelector('#messageKicker').textContent = kicker; document.querySelector('#messageTitle').textContent = title;
    document.querySelector('#messageText').textContent = text; resume.style.display = canResume ? 'block' : 'none';
    retry.style.display = canResume ? 'none' : 'block'; message.classList.add('visible'); controls.classList.remove('playing');
  }
  function gameOver() {
    state = 'over'; flash = 1; const result = Math.floor(distance);
    if (result > best) { best = result; localStorage.setItem('neonRacerBest', best); bestEl.textContent = best; }
    for (let i = 0; i < 28; i++) particles.push({ x: player.x + player.w / 2, y: player.y + player.h / 2, vx: (Math.random() - .5) * 390, vy: (Math.random() - .5) * 390, life: .5 + Math.random() * .6, color: Math.random() > .45 ? '#ff496d' : '#ffd55c' });
    showMessage('FIN DE CARRERA', '¡Choque!', `Recorriste ${result} metros.`, false); draw();
  }
  function move(dir) { if (state === 'playing') setLane(player.lane + dir); }
  function spawn() {
    const available = [0,1,2].filter(lane => !enemies.some(e => e.lane === lane && e.y < 150));
    if (!available.length) return;
    const lane = available[Math.floor(Math.random() * available.length)]; const truck = Math.random() < .2;
    const w = Math.min(truck ? 57 : 48, laneWidth * .5); const h = w * (truck ? 2.05 : 1.75);
    const colors = ['#ff416b','#a66bff','#ffd04f','#47e6b1','#ff813d'];
    enemies.push({ lane, x: laneX(lane, w), y: -h - 20, w, h, color: colors[Math.floor(Math.random()*colors.length)], truck, passed: false, drift: (Math.random()-.5)*5 });
  }
  function update(dt) {
    speed = Math.min(720, 370 + distance * .19); distance += speed * dt * .045; roadOffset = (roadOffset + speed * dt) % 90;
    player.x += (player.targetX - player.x) * Math.min(1, dt * 12);
    spawnTimer -= dt; if (spawnTimer <= 0) { spawn(); spawnTimer = Math.max(.48, 1.1 - distance / 1600) + Math.random() * .3; }
    enemies.forEach(e => { e.y += speed * dt * (e.truck ? .87 : 1); e.x += e.drift * dt; });
    enemies = enemies.filter(e => e.y < H + 130);
    for (const e of enemies) if (hit(player, e)) { gameOver(); return; }
    scoreEl.textContent = Math.floor(distance);
  }
  function hit(a,b) { const padX = a.w*.18, padY = a.h*.1; return a.x+padX < b.x+b.w-padX && a.x+a.w-padX > b.x+padX && a.y+padY < b.y+b.h-padY && a.y+a.h-padY > b.y+padY; }
  function roundedRect(x,y,w,h,r) { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); }
  function drawCar(car, playerCar = false) {
    ctx.save(); ctx.translate(car.x, car.y); ctx.shadowBlur = playerCar ? 22 : 11; ctx.shadowColor = playerCar ? '#56eaff' : car.color;
    ctx.fillStyle = playerCar ? '#31dff5' : car.color; roundedRect(0,0,car.w,car.h,car.w*.24); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#09101b'; roundedRect(car.w*.16,car.h*.2,car.w*.68,car.h*.34,car.w*.12); ctx.fill();
    ctx.fillStyle = playerCar ? '#baf9ff' : '#ffebaa'; ctx.fillRect(car.w*.12,car.h*.07,car.w*.18,5); ctx.fillRect(car.w*.7,car.h*.07,car.w*.18,5);
    ctx.fillStyle = '#ff315d'; ctx.fillRect(car.w*.12,car.h*.88,car.w*.2,5); ctx.fillRect(car.w*.68,car.h*.88,car.w*.2,5);
    ctx.fillStyle = playerCar ? '#e6fdff' : 'rgba(255,255,255,.45)'; ctx.fillRect(car.w*.47,car.h*.07,car.w*.06,car.h*.8);
    ctx.fillStyle = '#03060b'; [-3,car.w-2].forEach(x => { ctx.fillRect(x,car.h*.22,5,car.h*.2); ctx.fillRect(x,car.h*.65,5,car.h*.2); }); ctx.restore();
  }
  function draw() {
    ctx.fillStyle = '#071013'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = '#0b261d'; ctx.fillRect(0,0,roadLeft,H); ctx.fillRect(roadLeft+roadWidth,0,W,H);
    for (let y = -60 + roadOffset; y < H; y += 90) { ctx.fillStyle = '#20a36d'; ctx.fillRect(roadLeft-18,y,9,38); ctx.fillRect(roadLeft+roadWidth+9,y,9,38); }
    ctx.fillStyle = '#151a21'; ctx.fillRect(roadLeft,0,roadWidth,H);
    ctx.fillStyle = '#eff9ed'; ctx.fillRect(roadLeft,0,5,H); ctx.fillRect(roadLeft+roadWidth-5,0,5,H);
    for (let lane=1; lane<3; lane++) for (let y=-65+roadOffset; y<H; y+=90) { ctx.fillStyle='rgba(211,240,244,.62)'; ctx.fillRect(roadLeft+laneWidth*lane-2,y,4,48); }
    const glow = ctx.createLinearGradient(roadLeft,0,roadLeft+roadWidth,0); glow.addColorStop(0,'rgba(38,232,255,.08)'); glow.addColorStop(.5,'transparent'); glow.addColorStop(1,'rgba(255,55,105,.07)'); ctx.fillStyle=glow; ctx.fillRect(roadLeft,0,roadWidth,H);
    enemies.forEach(e => drawCar(e)); drawCar(player,true);
    particles.forEach(p => { ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,4,4); }); ctx.globalAlpha=1;
    if (flash > 0) { ctx.fillStyle=`rgba(255,70,90,${flash*.28})`; ctx.fillRect(0,0,W,H); }
  }
  function loop(now) { if (state !== 'playing') return; const dt = Math.min(.033,(now-last)/1000); last=now; update(dt); draw(); if(state==='playing') requestAnimationFrame(loop); }
  addEventListener('resize', resize); addEventListener('keydown', e => { if(['ArrowLeft','a','A'].includes(e.key)) move(-1); if(['ArrowRight','d','D'].includes(e.key)) move(1); if(e.key==='Escape'||e.key==='p') pause(); });
  document.querySelector('#start').addEventListener('click', start); retry.addEventListener('click', start); document.querySelector('#pause').addEventListener('click', pause);
  resume.addEventListener('click', () => { message.classList.remove('visible'); controls.classList.add('playing'); state='playing'; last=performance.now(); requestAnimationFrame(loop); });
  controls.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); move(Number(b.dataset.dir)); }));
  let touchX=0; canvas.addEventListener('pointerdown', e => touchX=e.clientX); canvas.addEventListener('pointerup', e => { const dx=e.clientX-touchX; if(Math.abs(dx)>24) move(dx>0?1:-1); else move(e.clientX<W/2?-1:1); });
  resize(); draw();
})();
