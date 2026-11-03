(function () {
  'use strict';
  const { W, H, compute, render, drawOverlays, sstep } = SW;
  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  const frame = document.createElement('canvas'); frame.width = W; frame.height = H;
  const fctx = frame.getContext('2d'); const img = fctx.createImageData(W, H);
  const $ = (id) => document.getElementById(id);
  const slider = $('t'), busy = $('busy');
  const animals = window.ANIMALS;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = { id: 'elephant', view: 'body', t: 1 };
  const cache = new Map();
  let C = null, A = null, playing = false, raf = 0, target = null;

  // ---------- picker ----------
  const picker = $('picker');
  animals.forEach(a => {
    const bt = document.createElement('button'); bt.textContent = a.name; bt.dataset.id = a.id; bt.id = 'pick-' + a.id;
    bt.addEventListener('click', () => select(a.id));
    picker.appendChild(bt);
  });

  function getC(a, view) {
    const k = a.id + ':' + view;
    if (cache.has(k)) { const v = cache.get(k); cache.delete(k); cache.set(k, v); return v; }
    const v = compute(a, view);
    cache.set(k, v);
    while (cache.size > 2) cache.delete(cache.keys().next().value);
    return v;
  }

  function select(id, view) {
    state.id = id; if (view) state.view = view;
    A = animals.find(a => a.id === id) || animals[0];
    state.id = A.id;
    [...picker.children].forEach(b => b.setAttribute('aria-pressed', b.dataset.id === A.id ? 'true' : 'false'));
    $('vBody').setAttribute('aria-pressed', state.view === 'body'); $('vSkull').setAttribute('aria-pressed', state.view === 'skull');
    $('pname').textContent = A.name; $('platin').textContent = A.latin;
    $('size').textContent = 'Adult size: ' + A.size;
    $('hides').innerHTML = ''; A.hides.forEach(h => { const li = document.createElement('li'); li.textContent = h; $('hides').appendChild(li); });
    $('parallel').textContent = A.parallel;
    try { if (location.hash.slice(1) !== A.id) history.replaceState(null, '', '#' + A.id); } catch (e) { }
    busy.classList.add('on');
    setTimeout(() => {
      C = getC(A, state.view);
      busy.classList.remove('on');
      draw();
    }, 30);
  }

  // ---------- drawing ----------
  function background(V) {
    const g = ctx.createRadialGradient(W * 0.38, H * 0.3, 40, W * 0.5, H * 0.5, W * 0.75);
    g.addColorStop(0, '#26302b'); g.addColorStop(1, '#0b0e0c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.setTransform(V.s, 0, 0, V.s, V.ox, V.oy);
    if (state.view === 'body') {
      const gy = A.groundY || 560;
      const fl = ctx.createLinearGradient(0, gy, 0, gy + 60);
      fl.addColorStop(0, 'rgba(255,255,255,0.05)'); fl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = fl; ctx.fillRect(-200, gy, 1400, 80);
      ctx.strokeStyle = 'rgba(235,228,210,0.12)'; ctx.lineWidth = 1 / V.s; ctx.beginPath(); ctx.moveTo(-200, gy); ctx.lineTo(1400, gy); ctx.stroke();
      const sh = A.shadow || [520, 560, 360, 14];
      const rg = ctx.createRadialGradient(sh[0], sh[1], 0, sh[0], sh[1], sh[2]);
      rg.addColorStop(0, 'rgba(0,0,0,0.5)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.translate(sh[0], sh[1]); ctx.scale(1, sh[3] / sh[2]); ctx.translate(-sh[0], -sh[1]);
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(sh[0], sh[1], sh[2], 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (A.bg) A.bg(ctx);
    }
    ctx.restore();
  }
  function scaleBar(V) {
    const pxPerCm = A.unitsPerM / 100 * V.s;
    const opts = [1, 2, 5, 10, 20, 50, 100, 200];
    let cm = opts[0]; for (const o of opts) if (o * pxPerCm <= 130) cm = o;
    const len = cm * pxPerCm, x = W - 22 - len, y = H - 22;
    ctx.strokeStyle = 'rgba(235,228,210,0.75)'; ctx.lineWidth = cv.clientWidth && cv.clientWidth < 600 ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.moveTo(x + len, y - 5); ctx.lineTo(x + len, y + 5); ctx.stroke();
    ctx.fillStyle = 'rgba(235,228,210,0.85)'; ctx.font = '600 ' + (cv.clientWidth && cv.clientWidth < 600 ? 22 : 14) + 'px Archivo, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(cm >= 100 ? (cm / 100) + ' m' : cm + ' cm', x + len / 2, y - 9);
  }
  function draw() {
    if (!C) return;
    const t = state.t;
    render(C, t, img);
    fctx.putImageData(img, 0, 0);
    background(C.V);
    ctx.drawImage(frame, 0, 0);
    ctx.save(); ctx.setTransform(C.V.s, 0, 0, C.V.s, C.V.ox, C.V.oy);
    drawOverlays(ctx, A, t, state.view);
    ctx.restore();
    scaleBar(C.V);
    const lbl = t < 0.5 ? 'Skeleton' : t < 1.5 ? 'Shrink-wrapped' : 'Alive';
    $('stagetag').textContent = lbl;
    [...$('stops').children].forEach((b, i) => b.classList.toggle('on', Math.abs(t - i) < 0.5));
  }

  // ---------- controls ----------
  slider.addEventListener('input', () => { stop(); target = null; state.t = slider.value / 100; draw(); });
  $('stops').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; stop(); goTo(+b.dataset.t / 100); });
  $('vBody').addEventListener('click', () => { if (state.view !== 'body') select(state.id, 'body'); });
  $('vSkull').addEventListener('click', () => { if (state.view !== 'skull') select(state.id, 'skull'); });
  $('play').addEventListener('click', () => { playing ? stop() : start(); });

  function goTo(tt) {
    if (reduce) { state.t = tt; slider.value = tt * 100; draw(); return; }
    target = tt; cancelAnimationFrame(raf);
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const d = target - state.t;
      if (Math.abs(d) < 0.005) { state.t = target; target = null; slider.value = state.t * 100; draw(); return; }
      state.t += Math.sign(d) * Math.min(Math.abs(d), dt * 1.4);
      slider.value = state.t * 100; draw(); raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function start() {
    playing = true; $('play').setAttribute('aria-pressed', 'true'); $('playLbl').textContent = 'Pause';
    $('playIcon').innerHTML = '<path d="M2 1h3v10H2zM7 1h3v10H7z"/>';
    cancelAnimationFrame(raf);
    let last = performance.now(), dir = state.t >= 2 ? -1 : 1, hold = 0;
    const step = (now) => {
      if (!playing) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (hold > 0) { hold -= dt; raf = requestAnimationFrame(step); return; }
      const prev = state.t;
      state.t += dir * dt * 0.55;
      for (const k of [0, 1, 2]) if ((prev - k) * (state.t - k) < 0 || state.t === k) { state.t = k; hold = 0.9; }
      if (state.t >= 2) { state.t = 2; dir = -1; } if (state.t <= 0) { state.t = 0; dir = 1; }
      slider.value = state.t * 100; draw(); raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function stop() {
    playing = false; cancelAnimationFrame(raf); $('play').setAttribute('aria-pressed', 'false'); $('playLbl').textContent = 'Play the morph';
    $('playIcon').innerHTML = '<path d="M2 1l9 5-9 5z"/>';
  }

  // ---------- boot ----------
  function boot(saved) {
    const h = location.hash.slice(1);
    if (saved && saved.id) { state.id = saved.id; state.view = saved.view || 'body'; state.t = saved.t ?? 1; }
    else if (animals.some(a => a.id === h)) state.id = h;
    slider.value = state.t * 100;
    select(state.id, state.view);
  }
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h !== state.id && animals.some(a => a.id === h)) select(h); });
  try { window.claude?.hot?.snapshot(() => ({ id: state.id, view: state.view, t: state.t })); } catch (e) { }
  window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
  window.__sw = { state, select, draw, setT: (t) => { state.t = t; slider.value = t * 100; draw(); } };
})();
