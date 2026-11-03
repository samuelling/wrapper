// Node: runs src/anatomy.js with a 3D-aware builder and writes build/prims/<id>.json
const fs = require('fs'), path = require('path');

// ---- shared noise helpers (same as the browser) ----
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hash(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function noise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const fbm = (x, y) => noise(x, y) * 0.55 + noise(x * 2.07 + 5.3, y * 2.07 + 1.7) * 0.3 + noise(x * 4.3 + 9.1, y * 4.3 + 3.3) * 0.15;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function interp(arr, t) { if (typeof arr === 'number') return arr; if (arr.length === 1) return arr[0]; const f = clamp(t, 0, 1) * (arr.length - 1), i = Math.min(arr.length - 2, Math.floor(f)); return lerp(arr[i], arr[i + 1], f - i); }
function pw(pairs, x) { // piecewise linear over [[x, v], ...]
  if (x <= pairs[0][0]) return pairs[0][1];
  for (let i = 0; i < pairs.length - 1; i++) if (x <= pairs[i + 1][0]) return lerp(pairs[i][1], pairs[i + 1][1], (x - pairs[i][0]) / (pairs[i + 1][0] - pairs[i][0]));
  return pairs[pairs.length - 1][1];
}
function cr(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return [0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)); }
function sampleOpen(pts, step) { const out = [], seg = [], u = []; if (pts.length === 1) return { pts: [pts[0]], seg: [0], u: [0] }; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]; const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step)); for (let k = 0; k < n; k++) { out.push(cr(p0, p1, p2, p3, k / n)); seg.push(i); u.push(k / n); } } out.push(pts[pts.length - 1]); seg.push(pts.length - 2); u.push(1); return { pts: out, seg, u }; }
function sampleClosed(pts, step) { const out = [], n0 = pts.length; for (let i = 0; i < n0; i++) { const p0 = pts[(i - 1 + n0) % n0], p1 = pts[i], p2 = pts[(i + 1) % n0], p3 = pts[(i + 2) % n0]; const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step)); for (let k = 0; k < n; k++) out.push(cr(p0, p1, p2, p3, k / n)); } return out; }

const ZKEYS = ['z', 'mirror', 'th', 'prof', 'thx', 'zx', 'zs', 'rz', 'zfn'];
class Builder3D {
  constructor() { this.prims = []; this.eyes = []; this.m = [1, 0, 0, 1, 0, 0]; this.sc = 1; this.rot = 0; this.group = 'body'; this.far = false; this.Z(); }
  Z(o) { this.zst = Object.assign({ z: 0, mirror: false, th: null, prof: 'dome', thx: null, zx: null }, o || {}); }
  tp(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  local(x, y, s, r, group, fn) {
    const om = this.m, osc = this.sc, og = this.group, orot = this.rot, oz = this.zst;
    const c = Math.cos(r) * s, si = Math.sin(r) * s, m = om;
    this.m = [m[0] * c + m[2] * si, m[1] * c + m[3] * si, m[0] * -si + m[2] * c, m[1] * -si + m[3] * c, m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    this.sc = osc * s; this.rot = orot + r; this.group = group || og;
    fn();
    this.m = om; this.sc = osc; this.group = og; this.rot = orot; this.zst = oz;
  }
  frame() { const o = this.tp(0, 0), e = this.tp(1, 0); return { ox: o[0], oy: o[1], dx: (e[0] - o[0]) / this.sc, dy: (e[1] - o[1]) / this.sc, sc: this.sc }; }
  zopts(o) {
    const z = Object.assign({}, this.zst); o = o || {};
    for (const k of ZKEYS) if (o[k] !== undefined) z[k] = o[k];
    if (o.z !== undefined && o.zx === undefined) z.zx = null;
    if (o.th !== undefined && o.thx === undefined) z.thx = null;
    const sc = this.sc;
    const out = { z: z.z * sc, mirror: !!z.mirror, th: z.th != null ? z.th * sc : null, prof: z.prof || 'dome', thx: z.thx ? z.thx.map(p => [p[0], p[1] * sc]) : null, zx: z.zx ? z.zx.map(p => [p[0], p[1] * sc]) : null, frame: this.frame() };
    if (z.rz !== undefined) out.rz = z.rz * sc;
    return { out, raw: z };
  }
  localX(wx, wy) { const f = this.frame(); return ((wx - f.ox) * f.dx + (wy - f.oy) * f.dy) / f.sc; }
  push(layer, kind, geom, o) {
    o = o || {};
    const { out } = this.zopts(o);
    const far = o.far !== undefined ? o.far : this.far;
    const p = Object.assign({ layer, kind, group: o.group || this.group, far, color: o.color || null, fur: o.fur, spec: o.spec, depth: o.depth }, geom, out);
    if (far) { p.z = -Math.abs(p.z); if (p.zsamp) p.zsamp = p.zsamp.map(v => -Math.abs(v)); if (p.zx) p.zx = p.zx.map(q => [q[0], -Math.abs(q[1])]); }
    this.prims.push(p);
  }
  shape(layer, pts, o) { const p = (o && o.sharp ? pts : sampleClosed(pts, 1.0 / this.sc)).map(q => this.tp(q[0], q[1])); this.push(layer, 'poly', { pts: p }, o); }
  ellipse(layer, x, y, rx, ry, rot, o) {
    const c = this.tp(x, y), { out } = this.zopts(o);
    let z = out.z; if (out.zx) z = pw(out.zx, x);
    const rz = out.rz !== undefined ? out.rz : (out.th != null && layer !== 'hole' ? Math.min(out.th, Math.max(rx, ry) * this.sc) : Math.min(rx, ry) * this.sc);
    this.push(layer, 'ell', { c, rx: rx * this.sc, ry: ry * this.sc, ang: this.rot + (rot || 0), rz, zc: z, holeTh: layer === 'hole' ? (o && o.th ? o.th * this.sc : null) : null }, Object.assign({}, o, { zx: undefined }));
  }
  circle(layer, x, y, r, o) { this.ellipse(layer, x, y, r, r, 0, o); }
  tube(layer, pts, radii, o) {
    o = o || {};
    const S = sampleOpen(pts, 1.0 / this.sc), P = S.pts, n = P.length;
    const R = P.map((_, i) => {
      if (typeof radii === 'number') return radii;
      if (radii.length === 2 && pts.length !== 2) return lerp(radii[0], radii[1], (S.seg[i] + S.u[i]) / (pts.length - 1));
      const a = radii[Math.min(S.seg[i], radii.length - 1)], b = radii[Math.min(S.seg[i] + 1, radii.length - 1)];
      return lerp(a, b, S.u[i]);
    });
    const { out, raw } = this.zopts(o);
    let zs;
    if (o.zfn) { const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); zs = cum.map(c => o.zfn(c / cum[n - 1]) * this.sc); }
    else if (o.zs) zs = P.map((_, i) => lerp(o.zs[Math.min(S.seg[i], o.zs.length - 1)], o.zs[Math.min(S.seg[i] + 1, o.zs.length - 1)], S.u[i]) * this.sc);
    else if (out.zx) zs = P.map(q => pw(out.zx, q[0]));
    else zs = P.map(() => out.z);
    this.push(layer, 'tube', { pts: P.map(q => this.tp(q[0], q[1])), r: R.map(r => r * this.sc), zsamp: zs }, Object.assign({}, o, { zx: undefined, zfn: undefined }));
  }
  bone(x1, y1, x2, y2, r1, r2, k, o) {
    k = k || 1.25;
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, mr = Math.min(r1, r2) * 0.78;
    this.tube('bone', [[x1, y1], [x1 + dx * 0.5, y1 + dy * 0.5], [x2, y2]], [r1 * 0.9, mr, r2 * 0.9], o);
    this.circle('bone', x1 + ux * r1 * 0.35, y1 + uy * r1 * 0.35, r1 * k * 0.85, o);
    this.circle('bone', x2 - ux * r2 * 0.35, y2 - uy * r2 * 0.35, r2 * k * 0.85, o);
  }
  chain(pts, radii, k, o) { for (let i = 0; i < pts.length - 1; i++) this.bone(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], interp(radii, i / Math.max(1, pts.length - 2)), interp(radii, (i + 1) / Math.max(1, pts.length - 1)), k, o); }
  tooth(layer, x, y, w, h, o) { this.shape(layer, [[x - w / 2, y - Math.sign(h) * 1], [x - w * 0.32, y + h * 0.6], [x, y + h], [x + w * 0.32, y + h * 0.6], [x + w / 2, y - Math.sign(h) * 1]], o); }
  claw(x, y, len, ang, r, layer, o) { const c = Math.cos(ang), s = Math.sin(ang), p = (a, b) => [x + a * c - b * s, y + a * s + b * c]; this.tube(layer || 'bone', [p(0, 0), p(len * 0.55, len * 0.12), p(len, len * 0.42)], [r, r * 0.7, r * 0.15], o); }
  spine(pts, n, o) {
    const S = sampleOpen(pts, 0.5 / this.sc).pts, cum = [0];
    for (let i = 1; i < S.length; i++) cum.push(cum[i - 1] + Math.hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1]));
    const total = cum[cum.length - 1], seg = total / n, verts = []; let j = 0;
    for (let i = 0; i < n; i++) {
      const sd = (i + 0.5) * seg; while (j < cum.length - 2 && cum[j + 1] < sd) j++;
      const f = (sd - cum[j]) / ((cum[j + 1] - cum[j]) || 1), x = lerp(S[j][0], S[j + 1][0], f), y = lerp(S[j][1], S[j + 1][1], f);
      let tx = S[j + 1][0] - S[j][0], ty = S[j + 1][1] - S[j][1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const dx = -ty, dy = tx, t = n > 1 ? i / (n - 1) : 0;
      const r = interp(o.r, t), h = interp(o.h || 0, t), tilt = interp(o.tilt || 0, t), gap = o.gap !== undefined ? o.gap : 0.15, half = seg * 0.5 * (1 - gap);
      if (h > 0) { const ddx = dx * Math.cos(tilt) + tx * Math.sin(tilt), ddy = dy * Math.cos(tilt) + ty * Math.sin(tilt), sw = interp(o.sw || 0.5, t); this.tube('bone', [[x + dx * r * 0.5, y + dy * r * 0.5], [x + ddx * (r + h), y + ddy * (r + h)]], [r * sw, r * sw * 0.55], { z: 0 }); }
      if (o.arch !== false) this.circle('bone', x + dx * r * 0.7, y + dy * r * 0.7, r * 0.62, { z: 0 });
      // transverse processes give the column some width in 3D
      if (o.arch !== false) this.tube('bone', [[x, y], [x + dx * r * 0.2, y + dy * r * 0.2]], r * 0.38, { zs: [0, r * 1.7], mirror: true });
      this.tube('bone', [[x - tx * half, y - ty * half], [x + tx * half, y + ty * half]], r, { z: 0 });
      if (o.chev) { const cl = interp(o.chev, t); if (cl > 0.5) { const vx = -dx, vy = -dy, a = 0.45, ex = vx * Math.cos(a) + tx * Math.sin(a), ey = vy * Math.cos(a) + ty * Math.sin(a); this.tube('bone', [[x + vx * r * 0.6, y + vy * r * 0.6], [x + ex * (r + cl), y + ey * (r + cl)]], [r * 0.32, r * 0.18], { z: 0 }); } }
      verts.push({ x, y, tx, ty, dx, dy, r });
    }
    return verts;
  }
  ribs(verts, lens, o) {
    verts.forEach((v, i) => {
      const t = verts.length > 1 ? i / (verts.length - 1) : 0, L = interp(lens, t); if (L <= 0.5) return;
      const vx = -v.dx, vy = -v.dy, sw = interp(o.sweep || 0.25, t), en = interp(o.end || 0.08, t), W = interp(o.w || 20, t);
      const pts = [[v.x + vx * v.r * 0.3, v.y + vy * v.r * 0.3], [v.x + vx * L * 0.5 + v.tx * L * sw, v.y + vy * L * 0.5 + v.ty * L * sw], [v.x + vx * L + v.tx * L * en, v.y + vy * L + v.ty * L * en]];
      const zfn = (s) => s < 0.5 ? W * Math.sin(s / 0.5 * Math.PI / 2) * (0.35 + 0.65 * s / 0.5) + v.r * 0.6 * (1 - s / 0.5) : W * (1 - 0.5 * Math.pow((s - 0.5) / 0.5, 1.6));
      this.tube('bone', pts, [interp(o.r, 0), interp(o.r, 1)], { zfn, mirror: true });
      if (o.unc && i < verts.length - 1) { const m = pts[1], ul = L * o.unc; this.tube('bone', [m, [m[0] + v.tx * ul - vx * ul * 0.25, m[1] + v.ty * ul - vy * ul * 0.25]], [interp(o.r, 0) * 0.7, interp(o.r, 0) * 0.35], { z: W * 0.95, mirror: true }); }
    });
  }
  osteoderms(verts, from, to, o) {
    for (let i = from; i < Math.min(to, verts.length); i++) {
      const v = verts[i], t = (i - from) / Math.max(1, to - from - 1), up = interp(o.lift, t), sz = interp(o.size, t);
      const x = v.x + v.dx * up, y = v.y + v.dy * up, ang = Math.atan2(v.ty, v.tx);
      this.ellipse('bone', x, y, sz, sz * 0.45, ang, { rz: sz * 0.7 });
      this.tube('bone', [[x - v.tx * sz * 0.3, y - v.ty * sz * 0.3], [x + v.dx * sz * 0.55, y + v.dy * sz * 0.55]], [sz * 0.25, sz * 0.08]);
    }
  }
  ring(x, y, r, w, n, o) { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; this.ellipse('bone', x + Math.cos(a) * r, y + Math.sin(a) * r, w, w * 0.7, a + Math.PI / 2, Object.assign({ rz: w * 0.5 }, o)); } }
  eye(x, y, r, o) { const p = this.tp(x, y); this.eyes.push({ stage: o.stage || 'L', x: p[0], y: p[1], r: r * this.sc, rS: (o.rS || r * 1.2) * this.sc, z: o.z !== undefined ? o.z * this.sc : null, iris: o.iris, irisHi: o.irisHi, pupil: o.pupil || 'round', pupilR: o.pupilR || 0.45 }); }
  line() { } dot() { }
}

globalThis.SW = { noise, fbm, mix, sstep, clamp, lerp };
require(path.join(__dirname, '../js/anatomy.js'));
const out = path.join(__dirname, '../build/prims'); fs.mkdirSync(out, { recursive: true });
for (const A of globalThis.ANIMALS3D) {
  const b = new Builder3D(); A.build(b);
  if (A.curator) { b.Z(); b.far = false; A.curator.build(b); }
  const keep = ['id', 'unitsPerM', 'vox', 'wrap', 'skinT', 'blend', 'furAmp', 'fur', 'skinCol', 'boneCol', 'toothCol', 'groundY'];
  const meta = {}; keep.forEach(k => meta[k] = A[k]);
  if (A.curator) meta.curator = { fur: !!A.curator.fur, furAmp: A.curator.furAmp || 0, exposeTeeth: !!A.curator.exposeTeeth };
  fs.writeFileSync(path.join(out, A.id + '.json'), JSON.stringify({ meta, prims: b.prims, eyes: b.eyes }));
  console.log(A.id, b.prims.length, 'prims', b.eyes.length, 'eyes');
}
