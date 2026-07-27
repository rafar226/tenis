(() => {
  'use strict';
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const app = document.querySelector('#app');
  const menu = document.querySelector('#menu');
  const message = document.querySelector('#message');
  const hint = document.querySelector('#hint');
  const scoreEl = document.querySelector('#score');
  const titleEl = document.querySelector('#messageTitle');
  const eyebrowEl = document.querySelector('#messageEyebrow');
  const resumeButton = document.querySelector('#resumeButton');

  let W = 0, H = 0, dpr = 1, running = false, paused = false, mode = 'solo';
  let last = 0, serveTimer = 0, soundOn = true, audio;
  const points = [0, 0], target = [0.5, 0.5], pointers = new Map();
  const paddle = [{ y: .5, vy: 0 }, { y: .5, vy: 0 }];
  const ball = { x: .5, y: .5, vx: 0, vy: 0, r: 9 };

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ball.r = Math.max(7, Math.min(W, H) * .013);
  }

  function tone(freq, duration = .06, volume = .04) {
    if (!soundOn) return;
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.frequency.value = freq; osc.type = 'sine'; gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
    osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
  }

  function resetBall(loser = Math.random() < .5 ? 0 : 1) {
    ball.x = .5; ball.y = .32 + Math.random() * .36; ball.vx = 0; ball.vy = 0;
    serveTimer = .75;
    ball.nextDir = loser === 0 ? -1 : 1;
  }

  function start(selected) {
    mode = selected; points[0] = points[1] = 0; paddle[0].y = paddle[1].y = .5;
    target[0] = target[1] = .5; menu.classList.remove('visible'); message.classList.remove('visible');
    app.classList.add('playing'); running = true; paused = false; updateScore(); resetBall();
    hint.style.opacity = '1'; setTimeout(() => hint.style.opacity = '0', 2800);
    last = performance.now(); requestAnimationFrame(loop);
  }

  function updateScore() { scoreEl.innerHTML = `<span>${points[0]}</span><i></i><span>${points[1]}</span>`; }
  function showMenu() { running = false; paused = false; app.classList.remove('playing'); message.classList.remove('visible'); menu.classList.add('visible'); }
  function pause() { if (!running) return; paused = true; eyebrowEl.textContent = 'PARTIDA EN PAUSA'; titleEl.textContent = 'Pausa'; resumeButton.querySelector('span').textContent = 'CONTINUAR'; resumeButton.dataset.action = 'resume'; message.classList.add('visible'); }
  function gameOver(winner) { paused = true; eyebrowEl.textContent = 'FIN DE LA PARTIDA'; titleEl.textContent = mode === 'solo' ? (winner === 1 ? '¡Ganaste!' : 'La máquina gana') : `Jugador ${winner + 1} gana`; resumeButton.querySelector('span').textContent = 'REVANCHA'; resumeButton.dataset.action = 'restart'; message.classList.add('visible'); tone(winner === 1 ? 720 : 220, .3, .07); }

  function update(dt) {
    if (serveTimer > 0) {
      serveTimer -= dt;
      if (serveTimer <= 0) { const speed = Math.min(W, H) * .68; ball.vx = ball.nextDir * speed; ball.vy = (Math.random() - .5) * speed * .75; }
    }
    const padH = Math.max(82, H * .2), maxSpeed = H * 2.1;
    if (mode === 'solo') {
      const predict = ball.vx < 0 ? ball.y : .5;
      target[0] += (predict - target[0]) * Math.min(1, dt * 2.7);
    }
    for (let i = 0; i < 2; i++) {
      const old = paddle[i].y;
      const delta = Math.max(-maxSpeed * dt / H, Math.min(maxSpeed * dt / H, target[i] - old));
      paddle[i].y = Math.max(padH / H / 2, Math.min(1 - padH / H / 2, old + delta));
      paddle[i].vy = (paddle[i].y - old) * H / Math.max(dt, .001);
    }
    ball.x += ball.vx * dt / W; ball.y += ball.vy * dt / H;
    if (ball.y * H - ball.r < 0 && ball.vy < 0) { ball.y = ball.r / H; ball.vy *= -1; tone(330); }
    if (ball.y * H + ball.r > H && ball.vy > 0) { ball.y = 1 - ball.r / H; ball.vy *= -1; tone(330); }
    const padW = Math.max(14, W * .017), margin = Math.max(30, W * .055);
    for (let i = 0; i < 2; i++) {
      const px = i === 0 ? margin : W - margin;
      const approaching = i === 0 ? ball.vx < 0 : ball.vx > 0;
      if (approaching && Math.abs(ball.x * W - px) < padW / 2 + ball.r + Math.abs(ball.vx * dt) && Math.abs(ball.y * H - paddle[i].y * H) < padH / 2 + ball.r) {
        ball.x = (px + (i === 0 ? padW / 2 + ball.r : -padW / 2 - ball.r)) / W;
        ball.vx = Math.abs(ball.vx) * (i === 0 ? 1 : -1) * 1.045;
        const offset = (ball.y - paddle[i].y) / (padH / H / 2);
        ball.vy = offset * Math.abs(ball.vx) * .78 + paddle[i].vy * .16;
        tone(520 + Math.abs(offset) * 180, .08, .06);
      }
    }
    if (ball.x < -.04 || ball.x > 1.04) {
      const scorer = ball.x < 0 ? 1 : 0; points[scorer]++; updateScore(); tone(150, .16, .06);
      if (points[scorer] >= 7) gameOver(scorer); else resetBall(scorer === 0 ? 1 : 0);
    }
  }

  function roundedRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.strokeStyle = 'rgba(112,221,239,.15)'; ctx.lineWidth = 2; ctx.setLineDash([10, 15]); ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.restore();
    const padH = Math.max(82, H * .2), padW = Math.max(14, W * .017), margin = Math.max(30, W * .055);
    ctx.shadowBlur = 24; ctx.shadowColor = '#42e5ff'; ctx.fillStyle = '#74f1ff';
    roundedRect(margin - padW / 2, paddle[0].y * H - padH / 2, padW, padH, padW / 2);
    roundedRect(W - margin - padW / 2, paddle[1].y * H - padH / 2, padW, padH, padW / 2);
    ctx.shadowColor = '#ff4964'; ctx.shadowBlur = 28; ctx.fillStyle = '#ff536d'; ctx.beginPath(); ctx.arc(ball.x * W, ball.y * H, ball.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, .025); last = now;
    if (!paused) update(dt); draw(); requestAnimationFrame(loop);
  }

  function pointerTarget(e) {
    const side = e.clientX < W / 2 ? 0 : 1;
    if (mode === 'solo' && side === 0) return;
    pointers.set(e.pointerId, side); target[side] = e.clientY / H;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  }
  canvas.addEventListener('pointerdown', pointerTarget);
  canvas.addEventListener('pointermove', e => { const side = pointers.get(e.pointerId); if (side !== undefined) target[side] = e.clientY / H; });
  canvas.addEventListener('pointerup', e => pointers.delete(e.pointerId));
  canvas.addEventListener('pointercancel', e => pointers.delete(e.pointerId));
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => start(b.dataset.mode)));
  document.querySelector('#pauseButton').addEventListener('click', pause);
  document.querySelector('#homeButton').addEventListener('click', pause);
  document.querySelector('#menuButton').addEventListener('click', showMenu);
  resumeButton.addEventListener('click', () => resumeButton.dataset.action === 'restart' ? start(mode) : (paused = false, message.classList.remove('visible'), last = performance.now()));
  document.querySelector('#soundButton').addEventListener('click', e => { soundOn = !soundOn; e.currentTarget.querySelector('b').textContent = soundOn ? 'ACTIVADO' : 'DESACTIVADO'; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) pause(); });
  addEventListener('resize', resize); resize(); draw();
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
})();
