import * as THREE from 'three';
import { buildHall, HALL, plaqueTexture } from './hall.js';
import { loadSpecimen } from './specimen.js';

const $ = (id) => document.getElementById(id);
const coarse = matchMedia('(pointer: coarse)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const quality = coarse ? 'low' : 'high';

// ---------- renderer / scene ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.6 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 140);
camera.rotation.order = 'YXZ';
const hall = buildHall(scene, quality);
const PT = HALL.platform.h + 0.03; // platform top

// ---------- the procession ----------
const LAYOUT = [
  { id: 'elephant', x: 6.9, z: 0.7, yaw: 0.04, lift: 0 },
  { id: 'bison', x: 1.5, z: -1.75, yaw: -0.06, lift: 0 },
  { id: 'crocodile', x: -2.5, z: 2.0, yaw: 0.05, lift: 0 },
  { id: 'swan', x: -5.7, z: -1.35, yaw: -0.1, lift: 0.32 },
  { id: 'cat', x: -8.1, z: 1.45, yaw: 0.1, lift: 0.86 },
  { id: 'owl', x: -10.4, z: -1.0, yaw: -0.2, lift: 1.3, perch: true }
];
const ANIMALS = window.ANIMALS3D;
const specimens = [];
const plinthMat = new THREE.MeshStandardMaterial({ color: 0x232625, roughness: 0.6 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x4b3a2a, roughness: 0.85 });
const plinthTop = new THREE.MeshStandardMaterial({ color: 0x3a3e3c, roughness: 0.7 });

function addPlinth(L, sp) {
  const size = sp.box.getSize(new THREE.Vector3());
  if (L.perch) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, L.lift, 10), woodMat); post.position.set(L.x, PT + L.lift / 2, L.z); post.castShadow = true; scene.add(post);
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.42, 10), woodMat); log.rotation.z = Math.PI / 2; log.position.set(L.x + 0.02, PT + L.lift - 0.03, L.z); log.castShadow = true; scene.add(log);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.05, 20), plinthMat); foot.position.set(L.x, PT + 0.025, L.z); scene.add(foot);
  } else if (L.lift > 0) {
    const w = size.x + 0.3, d = Math.max(size.z, 0.3) + 0.3;
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, L.lift, d), plinthMat); p.position.set(L.x, PT + L.lift / 2, L.z); p.castShadow = true; p.receiveShadow = true; scene.add(p);
    const t = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.02, d + 0.03), hall.brass); t.position.set(L.x, PT + L.lift - 0.03, L.z); scene.add(t);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, 0.03, d + 0.01), plinthTop); cap.position.set(L.x, PT + L.lift - 0.005, L.z); cap.receiveShadow = true; scene.add(cap);
  }
}
function addPlaque(L, A) {
  const tex = plaqueTexture(A.curator.common, A.curator.name);
  for (const s of [1, -1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.6 }));
    p.position.set(L.x, HALL.platform.h + 0.1, s * (HALL.platform.z + 0.02));
    p.rotation.y = s > 0 ? 0 : Math.PI; p.rotation.x = -0.55 * 0; scene.add(p);
  }
}

// ---------- state ----------
const state = { sel: 0, all: false, balcony: false, lockUntil: 0 };
let yaw = 0, pitch = 0;
const pos = new THREE.Vector3(18.5, 1.62, 8.2);
function look(target) {
  const d = target.clone().sub(pos);
  yaw = Math.atan2(-d.x, -d.z); pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
}

// ---------- UI ----------
const slider = $('stage'), stopsEl = $('stops');
function stageLabel(t) { return t < 0.5 ? 'Skeleton' : t < 1.5 ? 'Shrink-wrapped' : t < 2.5 ? 'Curator’s model' : 'Alive'; }
// the panel speaks as the museum until the reveal
function updateText() {
  const sp = specimens[state.sel]; if (!sp) return;
  const A = sp.A, C = A.curator, t = sp.stage, real = t >= 2.5;
  $('nm').textContent = real ? A.name : C.common;
  $('lt').textContent = real ? A.latin : C.name;
  $('sz').textContent = real ? A.size : 'Restored by the curator';
  const cap = $('cap');
  cap.className = 'cap' + (t >= 1.5 && t < 2.5 ? ' curator' : real ? ' reveal' : '');
  if (t < 0.5) cap.textContent = 'The bones as mounted. This is all the curator had to work from.';
  else if (t < 1.5) cap.textContent = 'Shrink-wrapped: skin pulled tight over the bones, and nothing more.';
  else if (t < 2.5) cap.textContent = '“' + C.label + '”';
  else { const i = A.curator.reveal.indexOf('.'); cap.innerHTML = ''; const b = document.createElement('b'); b.textContent = A.curator.reveal.slice(0, i + 1); cap.append(b, A.curator.reveal.slice(i + 1)); }
}
function showSelected() {
  const sp = specimens[state.sel]; if (!sp) return;
  const A = sp.A;
  slider.value = Math.round(sp.stage * 100);
  updateText(); $('stagetag').textContent = stageLabel(sp.stage);
  [...stopsEl.children].forEach((b, i) => b.classList.toggle('on', Math.abs(sp.stage - i) < 0.5));
  $('hides').innerHTML = ''; A.hides.forEach(h => { const li = document.createElement('li'); li.textContent = h; $('hides').appendChild(li); });
  $('parallel').textContent = A.parallel;
  specimens.forEach((s, i) => { s.spot.intensity = i === state.sel ? 26 : 9; });
  try { if (location.hash.slice(1) !== A.id) history.replaceState(null, '', '#' + A.id); } catch (e) { }
  dirty = true;
}
function select(i, glideTo) {
  if (glideTo) state.lockUntil = performance.now() + 6000;
  state.sel = (i + specimens.length) % specimens.length;
  showSelected();
  if (glideTo) glide(state.sel);
}
function setStage(t, which) {
  const list = state.all ? specimens : [specimens[which ?? state.sel]];
  list.forEach(s => s.setStage(t));
  if (Math.abs(slider.value / 100 - t) > 0.004) slider.value = Math.round(t * 100);
  [...stopsEl.children].forEach((b, i) => b.classList.toggle('on', Math.abs(t - i) < 0.5));
  $('stagetag').textContent = stageLabel(t);
  updateText();
  dirty = true;
}
slider.addEventListener('input', () => { stopPlay(); state.lockUntil = performance.now() + 6000; setStage(slider.value / 100); });
stopsEl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; stopPlay(); state.lockUntil = performance.now() + 6000; tweenStage(+b.dataset.t); });
$('prev').addEventListener('click', () => { state.lockUntil = performance.now() + 8000; select(state.sel - 1, true); });
$('next').addEventListener('click', () => { state.lockUntil = performance.now() + 8000; select(state.sel + 1, true); });
$('all').addEventListener('change', (e) => { state.all = e.target.checked; if (state.all) setStage(specimens[state.sel].stage); });
$('about').addEventListener('click', () => { const open = $('drawer').hidden; $('drawer').hidden = !open; $('about').setAttribute('aria-expanded', open); });
$('level').addEventListener('click', () => {
  state.balcony = !state.balcony;
  $('level').textContent = state.balcony ? 'Floor' : 'Balcony'; $('level').setAttribute('aria-pressed', state.balcony);
  const tgt = specimens[state.sel] ? specimens[state.sel].center : new THREE.Vector3();
  const bx = Math.round((tgt.x + 2 - 2) / 4) * 4 + 2;
  const to = state.balcony ? new THREE.Vector3(bx, HALL.balconyY[0] + 1.75, HALL.colZ - 0.25) : new THREE.Vector3(tgt.x + 3.5, 1.62, 6.5);
  glideTo(to, tgt);
});

let tween = null;
function tweenStage(t1) {
  const sp = specimens[state.sel]; const t0 = sp.stage;
  if (reduce) { setStage(t1); slider.value = t1 * 100; return; }
  tween = { t0, t1, s: performance.now(), d: Math.abs(t1 - t0) * 1100 + 1 };
}
let playing = false, playDir = 1, hold = 0;
$('play').addEventListener('click', () => playing ? stopPlay() : startPlay());
function startPlay() { playing = true; $('play').setAttribute('aria-pressed', 'true'); $('playlbl').textContent = 'Pause'; const s = specimens[state.sel].stage; playDir = s >= 3 ? -1 : 1; }
function stopPlay() { playing = false; $('play').setAttribute('aria-pressed', 'false'); $('playlbl').textContent = 'Play'; }

// ---------- camera glide ----------
let glideAnim = null;
function viewpoint(i) {
  const sp = specimens[i], c = sp.center, size = sp.size;
  // stand far enough back that the animal fits the uncovered part of the screen
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), th = tv * camera.aspect;
  const visFrac = Math.max(0.35, (1 + visibleCentreNdc()) / 2);
  const d = Math.max((size.x * 0.62 + 0.25) / th, (size.y * 0.62 + 0.2) / (tv * visFrac), 0.9) + size.z * 0.5;
  const ang = 0.62;
  let p = new THREE.Vector3(c.x + Math.sin(ang) * d, 0, c.z + Math.cos(ang) * d + 0.4);
  if (state.balcony) p.set(Math.round(c.x / 4) * 4 + 2, HALL.balconyY[0] + 1.75, HALL.colZ - 0.25);
  else p.y = Math.min(1.62, Math.max(c.y + size.y * 0.35, 1.1));
  p.z = Math.min(p.z, HALL.wallZ - 1.2);
  // shift the aim point down so the animal sits in the middle of the uncovered part of the screen
  const dist = p.distanceTo(c), off = visibleCentreNdc() * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
  return { p, t: new THREE.Vector3(c.x, c.y - off, c.z) };
}
function glide(i) { const v = viewpoint(i); glideTo(v.p, v.t); }
function glideTo(p, t) {
  const fromYaw = yaw, fromPitch = pitch, from = pos.clone();
  const save = pos.clone(); pos.copy(p); look(t); const toYaw = yaw, toPitch = pitch; pos.copy(save); yaw = fromYaw; pitch = fromPitch;
  let dy = toYaw - fromYaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
  glideAnim = { from, to: p.clone(), y0: fromYaw, dy, p0: fromPitch, p1: toPitch, s: performance.now(), d: reduce ? 1 : 1400 };
}

// ---------- input: look, walk, tap ----------
const keys = {};
addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return; keys[e.code] = true; });
addEventListener('keyup', (e) => { keys[e.code] = false; });
let drag = null;
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() }; glideAnim = null; });
canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const k = coarse ? 0.0055 : 0.0042;
  yaw += (e.clientX - drag.x) * k; pitch += (e.clientY - drag.y) * k;
  pitch = Math.max(-1.35, Math.min(1.35, pitch));
  drag.x = e.clientX; drag.y = e.clientY; dirty = true;
});
canvas.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
  if (moved < 8 && performance.now() - drag.t < 400) pick(e.clientX, e.clientY);
  drag = null;
});
canvas.addEventListener('wheel', (e) => { e.preventDefault(); walk(-Math.sign(e.deltaY) * 0.6, 0); dirty = true; }, { passive: false });

const ray = new THREE.Raycaster();
// the part of the screen not covered by the panel
function visibleCentreNdc() {
  const r = $('panel').getBoundingClientRect();
  const top = Math.max(0, Math.min(innerHeight, r.top));
  return 1 - top / innerHeight;
}
function gazeSpecimen() {
  const cy = visibleCentreNdc(), v = new THREE.Vector3();
  let best = -1, bd = Infinity;
  specimens.forEach((s, i) => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, behind = false;
    for (let k = 0; k < 8; k++) {
      v.set(k & 1 ? s.wbox.max.x : s.wbox.min.x, k & 2 ? s.wbox.max.y : s.wbox.min.y, k & 4 ? s.wbox.max.z : s.wbox.min.z);
      v.applyMatrix4(camera.matrixWorldInverse); if (v.z > -0.05) { behind = true; break; }
      v.applyMatrix4(camera.projectionMatrix);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    if (behind) return;
    const pad = 0.08;
    if (0 >= x0 - pad && 0 <= x1 + pad && cy >= y0 - pad && cy <= y1 + pad) {
      const d = s.center.distanceTo(camera.position);
      if (d < bd) { bd = d; best = i; }
    }
  });
  return { i: best, d: bd };
}
function hitSpecimen(nx, ny) {
  ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
  let best = -1, bd = Infinity;
  specimens.forEach((s, i) => { const h = ray.ray.intersectBox(s.wbox, new THREE.Vector3()); if (h) { const d = h.distanceTo(camera.position); if (d < bd) { bd = d; best = i; } } });
  return { i: best, d: bd };
}
function pick(cx, cy) {
  const r = canvas.getBoundingClientRect();
  const h = hitSpecimen((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  if (h.i >= 0) { state.lockUntil = performance.now() + 8000; select(h.i, false); }
}

// virtual joystick (touch)
const joy = $('joy'), knob = $('knob'); let jv = { x: 0, y: 0 }, jid = null;
if (coarse) joy.hidden = false;
joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture(e.pointerId); moveJoy(e); glideAnim = null; });
joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) moveJoy(e); });
const endJoy = () => { jid = null; jv = { x: 0, y: 0 }; knob.style.transform = 'translate(-50%,-50%)'; };
joy.addEventListener('pointerup', endJoy); joy.addEventListener('pointercancel', endJoy);
function moveJoy(e) {
  const r = joy.getBoundingClientRect(), R = r.width / 2;
  let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  jv = { x, y }; knob.style.transform = `translate(calc(-50% + ${x * R * 0.6}px), calc(-50% + ${y * R * 0.6}px))`;
}

function walk(f, s) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  pos.x += fx * f + rx * s; pos.z += fz * f + rz * s;
  const hx = HALL.L / 2 - 1, hz = HALL.wallZ - 0.8;
  pos.x = Math.max(-hx, Math.min(hx, pos.x));
  if (state.balcony) { pos.z = Math.sign(pos.z || 1) * Math.max(HALL.colZ - 0.3, Math.min(hz, Math.abs(pos.z))); pos.y = HALL.balconyY[0] + 1.75; }
  else { pos.z = Math.max(-hz, Math.min(hz, pos.z)); pos.y = onPlatform() ? 1.62 + HALL.platform.h : 1.62; }
}
const onPlatform = () => pos.x > HALL.platform.x0 && pos.x < HALL.platform.x1 && Math.abs(pos.z) < HALL.platform.z;

// ---------- loop ----------
let dirty = true, last = performance.now(), gazeT = 0;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 72 : 60; camera.updateProjectionMatrix(); dirty = true;
  joy.style.bottom = ($('panel').offsetHeight + 24) + 'px';
}
new ResizeObserver(() => { joy.style.bottom = ($('panel').offsetHeight + 24) + 'px'; }).observe($('panel'));
if (coarse) $('hint').hidden = true;
addEventListener('resize', resize); resize();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  // movement
  let f = 0, s = 0;
  if (keys.KeyW || keys.ArrowUp) f += 1; if (keys.KeyS || keys.ArrowDown) f -= 1;
  if (keys.KeyD) s += 1; if (keys.KeyA) s -= 1;
  if (keys.ArrowLeft) { yaw += dt * 1.6; dirty = true; } if (keys.ArrowRight) { yaw -= dt * 1.6; dirty = true; }
  f -= jv.y; s += jv.x;
  if (f || s) { const sp = (keys.ShiftLeft || keys.ShiftRight ? 5 : 2.4) * dt; walk(f * sp, s * sp); dirty = true; glideAnim = null; }
  if (glideAnim) {
    const k = Math.min(1, (now - glideAnim.s) / glideAnim.d), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    pos.lerpVectors(glideAnim.from, glideAnim.to, e); yaw = glideAnim.y0 + glideAnim.dy * e; pitch = glideAnim.p0 + (glideAnim.p1 - glideAnim.p0) * e;
    if (k >= 1) glideAnim = null; dirty = true;
  }
  if (tween) {
    const k = Math.min(1, (now - tween.s) / tween.d), e = k * k * (3 - 2 * k), t = tween.t0 + (tween.t1 - tween.t0) * e;
    setStage(t); slider.value = t * 100; if (k >= 1) tween = null;
  }
  if (playing && specimens.length) {
    if (hold > 0) hold -= dt;
    else {
      const sp = specimens[state.sel]; const prev = sp.stage; let t = prev + playDir * dt * 0.5;
      for (const k of [0, 1, 2, 3]) if ((prev - k) * (t - k) < 0) { t = k; hold = 1.4; }
      if (t >= 3) { t = 3; playDir = -1; hold = 1.6; } if (t <= 0) { t = 0; playDir = 1; hold = 1.4; }
      setStage(t); slider.value = t * 100;
    }
  }
  // gaze selection: whatever you look at becomes the specimen in the panel
  gazeT += dt;
  if (gazeT > 0.3 && specimens.length && now > state.lockUntil && !playing && !tween) {
    gazeT = 0; camera.updateMatrixWorld();
    const h = gazeSpecimen();
    if (h.i >= 0 && h.i !== state.sel && h.d < 16) select(h.i, false);
  }
  if (!dirty) return;
  camera.position.copy(pos); camera.rotation.set(pitch, yaw, 0);
  renderer.render(scene, camera); dirty = false;
}

// ---------- boot ----------
async function boot() {
  try { await Promise.race([Promise.all([document.fonts.load('46px "IM Fell English SC"'), document.fonts.load('italic 34px "IM Fell English"')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) { }
  let n = 0;
  const total = LAYOUT.length;
  $('loadmsg').textContent = `Unpacking the collection… 0 of ${total}`;
  const loads = LAYOUT.map(async (L) => {
    const A = ANIMALS.find(a => a.id === L.id);
    const sp = await loadSpecimen(A, './data');
    const yBase = PT + L.lift;
    sp.root.position.set(L.x, yBase, L.z); sp.root.rotation.y = L.yaw;
    sp.root.updateMatrixWorld(true);
    scene.add(sp.root);
    sp.size = sp.box.getSize(new THREE.Vector3());
    sp.wbox = sp.box.clone().applyMatrix4(sp.root.matrixWorld);
    sp.center = sp.wbox.getCenter(new THREE.Vector3());
    const spot = new THREE.SpotLight(0xffe2b8, 9, 22, 0.32, 0.6, 1.4);
    spot.position.set(sp.center.x - 2, 14, sp.center.z + 4); spot.target.position.copy(sp.center);
    scene.add(spot, spot.target); sp.spot = spot;
    addPlinth(L, sp); addPlaque(L, A);
    sp.L = L;
    n++; $('loadmsg').textContent = `Unpacking the collection… ${n} of ${total}`;
    dirty = true;
    return sp;
  });
  const list = await Promise.all(loads);
  specimens.push(...list);
  specimens.forEach(s => s.setStage(2));
  const h = location.hash.slice(1), hi = specimens.findIndex(s => s.A.id === h);
  state.sel = hi >= 0 ? hi : 0;
  if (hi >= 0) { const v = viewpoint(hi); pos.copy(v.p); look(v.t); }
  else look(new THREE.Vector3(4, 1.6, 0));
  state.lockUntil = performance.now() + 2500;
  showSelected(); setStage(2);
  $('loading').hidden = true;
  dirty = true;
}
addEventListener('hashchange', () => { const i = specimens.findIndex(s => s.A.id === location.hash.slice(1)); if (i >= 0 && i !== state.sel) { state.lockUntil = performance.now() + 8000; select(i, true); } });
requestAnimationFrame(frame);
boot().catch(err => { $('loadmsg').textContent = 'The collection could not be loaded: ' + err.message; console.error(err); });
window.__hall = { specimens, state, glide, select, setStage, pos, get yaw() { return yaw; }, set yaw(v) { yaw = v; dirty = true; }, set pitch(v) { pitch = v; dirty = true; }, look: (x, y, z) => { look(new THREE.Vector3(x, y, z)); dirty = true; }, place: (x, y, z) => { pos.set(x, y, z); dirty = true; } };
