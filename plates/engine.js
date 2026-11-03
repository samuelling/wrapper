/* Shrink-wrap engine: bones -> shrink-wrapped skin -> living soft tissue.
   Every stage is a signed distance field + height field + colour field on one raster.
   Morphing interpolates the fields, so skin literally grows over and between the bones. */
(function () {
  'use strict';
  const W = 900, H = 558, N = W * H;

  // ---------- small maths ----------
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function hash(x, y) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, y) => noise(x, y) * 0.55 + noise(x * 2.07 + 5.3, y * 2.07 + 1.7) * 0.3 + noise(x * 4.3 + 9.1, y * 4.3 + 3.3) * 0.15;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const hex = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  function interp(arr, t) {
    if (typeof arr === 'number') return arr;
    if (arr.length === 1) return arr[0];
    const f = clamp(t, 0, 1) * (arr.length - 1), i = Math.min(arr.length - 2, Math.floor(f));
    return lerp(arr[i], arr[i + 1], f - i);
  }

  // ---------- curves ----------
  function cr(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [
      0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
    ];
  }
  // returns {pts, seg, u} : dense points, their control segment index and parameter
  function sampleOpen(pts, step) {
    const out = [], seg = [], u = [];
    if (pts.length === 1) return { pts: [pts[0]], seg: [0], u: [0] };
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < n; k++) { out.push(cr(p0, p1, p2, p3, k / n)); seg.push(i); u.push(k / n); }
    }
    out.push(pts[pts.length - 1]); seg.push(pts.length - 2); u.push(1);
    return { pts: out, seg, u };
  }
  function sampleClosed(pts, step) {
    const out = [], n0 = pts.length;
    for (let i = 0; i < n0; i++) {
      const p0 = pts[(i - 1 + n0) % n0], p1 = pts[i], p2 = pts[(i + 1) % n0], p3 = pts[(i + 2) % n0];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < n; k++) out.push(cr(p0, p1, p2, p3, k / n));
    }
    return out;
  }

  // ---------- builder: collects primitives in world space ----------
  class Builder {
    constructor() { this.prims = []; this.over = []; this.m = [1, 0, 0, 1, 0, 0]; this.sc = 1; this.rot = 0; this.group = 'body'; this.far = false; }
    tp(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
    local(x, y, s, r, group, fn) {
      const om = this.m, osc = this.sc, og = this.group, orot = this.rot;
      const c = Math.cos(r) * s, si = Math.sin(r) * s, m = om;
      // new = m * [c -si; si c] translated
      this.m = [m[0] * c + m[2] * si, m[1] * c + m[3] * si, m[0] * -si + m[2] * c, m[1] * -si + m[3] * c, m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
      this.sc = osc * s; this.rot = orot + r; this.group = group || og;
      fn();
      this.m = om; this.sc = osc; this.group = og; this.rot = orot;
    }
    push(layer, poly, o) {
      o = o || {};
      this.prims.push({ layer, poly, o, group: o.group || this.group, far: o.far !== undefined ? o.far : this.far });
    }
    shape(layer, pts, o) {
      const step = 1.2 / this.sc;
      const p = (o && o.sharp) ? pts : sampleClosed(pts, step);
      this.push(layer, p.map(q => this.tp(q[0], q[1])), o);
    }
    ellipse(layer, x, y, rx, ry, rot, o) {
      const n = clamp(Math.ceil(Math.PI * 2 * Math.max(rx, ry) * this.sc / 1.2), 14, 160), pts = [];
      const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry; pts.push(this.tp(x + ex * c - ey * s, y + ex * s + ey * c)); }
      this.push(layer, pts, o);
    }
    circle(layer, x, y, r, o) { this.ellipse(layer, x, y, r, r, 0, o); }
    // tapered tube along a smooth centreline, rounded caps; radii per control point
    tube(layer, pts, radii, o) {
      const S = sampleOpen(pts, 1.0 / this.sc), P = S.pts, n = P.length;
      const R = P.map((_, i) => {
        if (typeof radii === 'number') return radii;
        if (radii.length === 2 && pts.length !== 2) { // linear along length
          return lerp(radii[0], radii[1], (S.seg[i] + S.u[i]) / (pts.length - 1));
        }
        const a = radii[Math.min(S.seg[i], radii.length - 1)], b = radii[Math.min(S.seg[i] + 1, radii.length - 1)];
        return lerp(a, b, S.u[i]);
      });
      const L = [], Rt = [];
      for (let i = 0; i < n; i++) {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        L.push([P[i][0] - ty * R[i], P[i][1] + tx * R[i]]);
        Rt.push([P[i][0] + ty * R[i], P[i][1] - tx * R[i]]);
      }
      const poly = [];
      const cap = (c, r, ang0) => { const k = Math.max(6, Math.ceil(r * this.sc / 0.8)); for (let j = 1; j < k; j++) { const a = ang0 - Math.PI * j / k; poly.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); } };
      // tangent angles at ends
      const t0 = Math.atan2(P[Math.min(1, n - 1)][1] - P[0][1], P[Math.min(1, n - 1)][0] - P[0][0]);
      const t1 = Math.atan2(P[n - 1][1] - P[Math.max(0, n - 2)][1], P[n - 1][0] - P[Math.max(0, n - 2)][0]);
      for (let i = 0; i < n; i++) poly.push(L[i]);
      cap(P[n - 1], R[n - 1], t1 + Math.PI / 2);
      for (let i = n - 1; i >= 0; i--) poly.push(Rt[i]);
      cap(P[0], R[0], t0 - Math.PI / 2);
      this.push(layer, poly.map(q => this.tp(q[0], q[1])), o);
    }
    // long bone: shaft with swollen ends
    bone(x1, y1, x2, y2, r1, r2, k, o) {
      k = k || 1.25;
      const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      const mr = Math.min(r1, r2) * 0.78;
      this.tube('bone', [[x1, y1], [x1 + dx * 0.5, y1 + dy * 0.5], [x2, y2]], [r1 * 0.9, mr, r2 * 0.9], o);
      this.circle('bone', x1 + ux * r1 * 0.35, y1 + uy * r1 * 0.35, r1 * k * 0.85, o);
      this.circle('bone', x2 - ux * r2 * 0.35, y2 - uy * r2 * 0.35, r2 * k * 0.85, o);
    }
    // chain of bones through joints
    chain(pts, radii, k, o) { for (let i = 0; i < pts.length - 1; i++) this.bone(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], interp(radii, i / Math.max(1, pts.length - 2)), interp(radii, (i + 1) / Math.max(1, pts.length - 1)), k, o); }
    tooth(layer, x, y, w, h, o) { // h>0 points down, h<0 up
      this.shape(layer, [[x - w / 2, y - Math.sign(h) * 1], [x - w * 0.32, y + h * 0.6], [x, y + h], [x + w * 0.32, y + h * 0.6], [x + w / 2, y - Math.sign(h) * 1]], o);
    }
    claw(x, y, len, ang, r, layer, o) {
      const c = Math.cos(ang), s = Math.sin(ang);
      const p = (a, b) => [x + a * c - b * s, y + a * s + b * c];
      this.tube(layer || 'bone', [p(0, 0), p(len * 0.55, len * 0.12), p(len, len * 0.42)], [r, r * 0.7, r * 0.15], o);
    }
    // vertebral column along a curve; returns vertebra frames
    spine(pts, n, o) {
      const S = sampleOpen(pts, 0.5 / this.sc).pts, cum = [0];
      for (let i = 1; i < S.length; i++) cum.push(cum[i - 1] + Math.hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1]));
      const total = cum[cum.length - 1], seg = total / n, verts = [];
      let j = 0;
      for (let i = 0; i < n; i++) {
        const sd = (i + 0.5) * seg; while (j < cum.length - 2 && cum[j + 1] < sd) j++;
        const f = (sd - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
        const x = lerp(S[j][0], S[j + 1][0], f), y = lerp(S[j][1], S[j + 1][1], f);
        let tx = S[j + 1][0] - S[j][0], ty = S[j + 1][1] - S[j][1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        const dx = -ty, dy = tx; // dorsal
        const t = n > 1 ? i / (n - 1) : 0;
        const r = interp(o.r, t), h = interp(o.h || 0, t), tilt = interp(o.tilt || 0, t), gap = o.gap !== undefined ? o.gap : 0.15;
        const half = seg * 0.5 * (1 - gap);
        if (h > 0) {
          const ddx = dx * Math.cos(tilt) + tx * Math.sin(tilt), ddy = dy * Math.cos(tilt) + ty * Math.sin(tilt);
          const sw = interp(o.sw || 0.5, t);
          this.tube('bone', [[x + dx * r * 0.5, y + dy * r * 0.5], [x + ddx * (r + h), y + ddy * (r + h)]], [r * sw, r * sw * 0.55], o.pass);
        }
        if (o.arch !== false) this.circle('bone', x + dx * r * 0.7, y + dy * r * 0.7, r * 0.62, o.pass);
        this.tube('bone', [[x - tx * half, y - ty * half], [x + tx * half, y + ty * half]], r, o.pass);
        if (o.chev) {
          const cl = interp(o.chev, t);
          if (cl > 0.5) {
            const vx = -dx, vy = -dy, a = 0.45;
            const ex = vx * Math.cos(a) + tx * Math.sin(a), ey = vy * Math.cos(a) + ty * Math.sin(a);
            this.tube('bone', [[x + vx * r * 0.6, y + vy * r * 0.6], [x + ex * (r + cl), y + ey * (r + cl)]], [r * 0.32, r * 0.18], o.pass);
          }
        }
        verts.push({ x, y, tx, ty, dx, dy, r });
      }
      return verts;
    }
    ribs(verts, lens, o) {
      verts.forEach((v, i) => {
        const t = verts.length > 1 ? i / (verts.length - 1) : 0, L = interp(lens, t);
        if (L <= 0.5) return;
        const vx = -v.dx, vy = -v.dy, sw = interp(o.sweep || 0.25, t), en = interp(o.end || 0.08, t);
        const pts = [[v.x + vx * v.r * 0.3, v.y + vy * v.r * 0.3], [v.x + vx * L * 0.5 + v.tx * L * sw, v.y + vy * L * 0.5 + v.ty * L * sw], [v.x + vx * L + v.tx * L * en, v.y + vy * L + v.ty * L * en]];
        this.tube('bone', pts, [interp(o.r, 0), interp(o.r, 1)], o.pass);
        if (o.unc && i < verts.length - 1) { const m = pts[1], ul = L * o.unc; this.tube('bone', [m, [m[0] + v.tx * ul - vx * ul * 0.25, m[1] + v.ty * ul - vy * ul * 0.25]], [interp(o.r, 0) * 0.7, interp(o.r, 0) * 0.35], o.pass); }
      });
    }
    osteoderms(verts, from, to, o) {
      for (let i = from; i < Math.min(to, verts.length); i++) {
        const v = verts[i], t = (i - from) / Math.max(1, to - from - 1), up = interp(o.lift, t), sz = interp(o.size, t);
        const x = v.x + v.dx * up, y = v.y + v.dy * up, ang = Math.atan2(v.ty, v.tx);
        this.ellipse('bone', x, y, sz, sz * 0.45, ang, o.pass);
        this.tube('bone', [[x - v.tx * sz * 0.3, y - v.ty * sz * 0.3], [x + v.dx * sz * 0.55, y + v.dy * sz * 0.55]], [sz * 0.25, sz * 0.08], o.pass);
      }
    }
    ring(x, y, r, w, n, o) { // sclerotic ring of overlapping ossicles
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; this.ellipse('bone', x + Math.cos(a) * r, y + Math.sin(a) * r, w, w * 0.7, a + Math.PI / 2, o); }
    }
    // overlays (drawn live on top)
    eye(x, y, r, o) {
      const p = this.tp(x, y);
      this.over.push(Object.assign({}, o, { type: 'eye', x: p[0], y: p[1], r: r * this.sc, rS: (o.rS || r * 1.2) * this.sc, rot: this.rot + (o.rot || 0), group: this.group }));
    }
    line(pts, o) {
      const P = (o.sharp ? pts : sampleOpen(pts, 1 / this.sc).pts).map(q => this.tp(q[0], q[1]));
      this.over.push(Object.assign({}, o, { type: 'line', pts: P, w: (o.w || 1) * this.sc, group: this.group }));
    }
    dot(x, y, rx, ry, o) {
      const p = this.tp(x, y);
      this.over.push(Object.assign({}, o, { type: 'dot', x: p[0], y: p[1], rx: rx * this.sc, ry: ry * this.sc, rot: this.rot + (o.rot || 0), group: this.group }));
    }
  }

  // ---------- Euclidean distance transform (Felzenszwalb & Huttenlocher) ----------
  const INF = 1e20;
  const _f = new Float64Array(Math.max(W, H)), _d = new Float64Array(Math.max(W, H)), _v = new Int32Array(Math.max(W, H)), _z = new Float64Array(Math.max(W, H) + 1);
  function dt1(n) {
    let k = 0; _v[0] = 0; _z[0] = -INF; _z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((_f[q] + q * q) - (_f[_v[k]] + _v[k] * _v[k])) / (2 * q - 2 * _v[k]);
      while (s <= _z[k]) { k--; s = ((_f[q] + q * q) - (_f[_v[k]] + _v[k] * _v[k])) / (2 * q - 2 * _v[k]); }
      k++; _v[k] = q; _z[k] = s; _z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (_z[k + 1] < q) k++; const d = q - _v[k]; _d[q] = d * d + _f[_v[k]]; }
  }
  // distance from each pixel to the nearest pixel where test(i) is true
  function edt(mask, invert) {
    const out = new Float32Array(N);
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) { const m = mask[y * W + x]; _f[y] = (invert ? !m : m) ? 0 : INF; }
      dt1(H);
      for (let y = 0; y < H; y++) out[y * W + x] = _d[y];
    }
    for (let y = 0; y < H; y++) {
      const o = y * W;
      for (let x = 0; x < W; x++) _f[x] = out[o + x];
      dt1(W);
      for (let x = 0; x < W; x++) out[o + x] = Math.sqrt(_d[x]);
    }
    return out;
  }
  function boxBlur(src, r, passes) {
    let a = src, tmp = new Float32Array(N), b = new Float32Array(N);
    r = Math.max(1, Math.round(r));
    for (let p = 0; p < (passes || 1); p++) {
      for (let y = 0; y < H; y++) {
        const o = y * W; let acc = 0;
        for (let x = -r; x <= r; x++) acc += a[o + clamp(x, 0, W - 1)];
        for (let x = 0; x < W; x++) { tmp[o + x] = acc / (2 * r + 1); acc += a[o + Math.min(W - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; }
      }
      for (let x = 0; x < W; x++) {
        let acc = 0;
        for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, H - 1) * W + x];
        for (let y = 0; y < H; y++) { b[y * W + x] = acc / (2 * r + 1); acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; }
      }
      if (p < (passes || 1) - 1) { a = b; b = new Float32Array(N); }
    }
    return b;
  }
  const prof = (d, r) => { if (d <= 0) return 0; const q = r - Math.min(d, r); return Math.sqrt(Math.max(0, r * r - q * q)); };

  // ---------- textures ----------
  const TEX = {
    none: () => 0,
    fur: (x, y) => (noise(x * 1.1, y * 0.28) - 0.5) + (noise(x * 0.35 + 7, y * 0.35) - 0.5) * 0.7,
    wool: (x, y) => (fbm(x * 0.42, y * 0.42) - 0.5) * 1.8,
    feather: (x, y) => {
      const fs = 4.2, v = y / fs * 1.25, row = Math.floor(v), u = x / fs + (row & 1) * 0.5;
      const fu = u - Math.floor(u) - 0.5, fv = v - row;
      return (fv - fu * fu * 2.4) * 0.7 + (noise(x * 0.5, y * 0.5) - 0.5) * 0.35;
    },
    scale: (x, y) => {
      const sc = 6.5, sy = sc * 0.78, row = Math.floor(y / sy), fx = (x / sc + (row & 1) * 0.5) % 1, fy = y / sy - row;
      const bx = 1 - Math.abs(fx - 0.5) * 2, by = 1 - Math.abs(fy - 0.5) * 2;
      return Math.sqrt(Math.max(0, Math.min(bx, by))) - 0.5 + (noise(x * 0.3, y * 0.3) - 0.5) * 0.4;
    },
    wrinkle: (x, y) => {
      const r = 1 - Math.abs(fbm(x * 0.07 + 3, y * 0.21) * 2 - 1), r2 = 1 - Math.abs(fbm(x * 0.2 + 11, y * 0.06) * 2 - 1);
      return (r * r * r - 0.4) * 0.8 + (r2 * r2 * r2 - 0.4) * 0.5;
    },
    follicle: (x, y) => {
      const c = 3.4, row = Math.floor(y / c), fx = x / c + (row & 1) * 0.5, fy = y / c;
      const dx = fx - Math.floor(fx) - 0.5, dy = fy - Math.floor(fy) - 0.5, d = Math.sqrt(dx * dx + dy * dy);
      return Math.max(0, 1 - d / 0.28) * 0.9 + (noise(x * 0.4, y * 0.4) - 0.5) * 0.2;
    },
    skin: (x, y) => (fbm(x * 0.25, y * 0.25) - 0.5) * 0.5
  };

  // ---------- compute all three stages for an animal + view ----------
  function viewFor(A, view) {
    if (view === 'skull') {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of A._b.prims) {
        if (p.group !== 'head' || !(p.layer === 'bone' || p.layer === 'teeth')) continue;
        for (const q of p.poly) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
      }
      const pad = A.skullPad || 0.32, bw = x1 - x0, bh = y1 - y0;
      x0 -= bw * pad; x1 += bw * pad; y0 -= bh * pad; y1 += bh * pad;
      const s = Math.min(W / (x1 - x0), H / (y1 - y0));
      return { s, ox: (W - (x1 - x0) * s) / 2 - x0 * s, oy: (H - (y1 - y0) * s) / 2 - y0 * s };
    }
    const f = A.frame || [0, 0, 1000, 620];
    const s = Math.min(W / f[2], H / f[3]);
    return { s, ox: (W - f[2] * s) / 2 - f[0] * s, oy: (H - f[3] * s) / 2 - f[1] * s };
  }

  function buildAnimal(A) {
    if (A._b) return;
    const b = new Builder();
    A.build(b);
    A._b = b;
  }

  function compute(A, view) {
    buildAnimal(A);
    const V = viewFor(A, view), s = V.s;
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.setTransform(s, 0, 0, s, V.ox, V.oy); x.lineJoin = 'round'; return x; };
    const boneX = mk(), teethX = mk(), recX = mk(), edgeX = mk(), tisX = mk(), colX = mk(), bareX = mk(), farBX = mk(), farLX = mk(), tEdgeX = mk();
    const path = (ctx, poly) => { ctx.beginPath(); ctx.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]); ctx.closePath(); };
    const fill = (ctx, poly, style, op) => { ctx.globalCompositeOperation = op || 'source-over'; ctx.fillStyle = style || '#fff'; path(ctx, poly); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; };
    edgeX.lineWidth = 1.05 * Math.max(1, 1 / s) * (view === 'skull' ? 1.6 : 1);
    edgeX.strokeStyle = '#fff';
    tEdgeX.lineWidth = 1.6 * Math.max(1, 1 / s) * (view === 'skull' ? 1.8 : 1); tEdgeX.strokeStyle = '#fff';
    for (const p of A._b.prims) {
      const poly = p.poly, o = p.o;
      switch (p.layer) {
        case 'bone': case 'teeth': case 'teethX': {
          fill(boneX, poly);
          if (p.layer === 'bone') fill(teethX, poly, '#fff', 'destination-out'); else fill(teethX, poly, p.layer === 'teethX' ? '#00ff00' : '#ff0000');
          fill(recX, poly, '#fff', 'destination-out');
          fill(edgeX, poly, '#fff', 'destination-out'); path(edgeX, poly); edgeX.stroke();
          fill(farBX, poly, '#fff', p.far ? 'source-over' : 'destination-out');
          break;
        }
        case 'hole':
          fill(boneX, poly, '#fff', 'destination-out'); fill(teethX, poly, '#fff', 'destination-out'); fill(recX, poly, '#fff', 'destination-out');
          path(edgeX, poly); edgeX.stroke();
          break;
        case 'recess':
          recX.globalAlpha = o.depth !== undefined ? o.depth : 0.6; fill(recX, poly); recX.globalAlpha = 1;
          break;
        case 'tissue':
          fill(tisX, poly);
          if (o.color) fill(colX, poly, o.color); else fill(colX, poly, '#fff', 'destination-out');
          if (o.fur === false) fill(bareX, poly, 'rgb(' + Math.round((o.spec !== undefined ? o.spec : 0.25) * 255) + ',255,0)'); else fill(bareX, poly, '#fff', 'destination-out');
          fill(farLX, poly, '#fff', p.far ? 'source-over' : 'destination-out');
          fill(tEdgeX, poly, '#fff', 'destination-out');
          if (o.edge) {
            tEdgeX.globalAlpha = o.edge === true ? 1 : o.edge;
            if (o.edgeFull) tEdgeX.strokeStyle = '#fff';
            else { // limbs: let the outline fade out where the limb merges into the body
              let y0 = 1e9, y1 = -1e9; for (const q of poly) { if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
              const g = tEdgeX.createLinearGradient(0, y0 + (y1 - y0) * 0.3, 0, y0 + (y1 - y0) * 0.62);
              g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, '#fff'); tEdgeX.strokeStyle = g;
            }
            path(tEdgeX, poly); tEdgeX.stroke(); tEdgeX.globalAlpha = 1;
          }
          break;
      }
    }
    const get = (x) => x.getImageData(0, 0, W, H).data;
    const bD = get(boneX), tD = get(teethX), rD = get(recX), eD = get(edgeX), lD = get(tisX), cD = get(colX), brD = get(bareX), fbD = get(farBX), flD = get(farLX);
    const teRaw = get(tEdgeX), teA = new Float32Array(N); for (let i = 0; i < N; i++) teA[i] = teRaw[i * 4 + 3] / 255;
    const teB = boxBlur(teA, Math.max(1, 0.7 * s), 1);

    const Bm = new Uint8Array(N), Tm = new Uint8Array(N);
    for (let i = 0; i < N; i++) { Bm[i] = bD[i * 4 + 3] > 127 ? 1 : 0; Tm[i] = lD[i * 4 + 3] > 127 ? 1 : 0; }

    const P = A.params;
    const rc = P.wrap * s, sk = P.skinT * s, rb = P.boneR * s, RL = P.plump * s;
    // --- bone field
    // near and far limbs are wrapped separately, so skin never webs between them
    const Bn = new Uint8Array(N), Bf = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const f = fbD[i * 4 + 3] > 127; Bn[i] = Bm[i] && !f ? 1 : 0; Bf[i] = Bm[i] && f ? 1 : 0; }
    const D1n = edt(Bn, false), D1f = edt(Bf, false), DinB = edt(Bm, true);
    const D1 = new Float32Array(N); for (let i = 0; i < N; i++) D1[i] = Math.min(D1n[i], D1f[i]);
    // --- shrink-wrap: morphological closing of the bones, then a skin thickness
    const close = (D) => { const dil = new Uint8Array(N); for (let i = 0; i < N; i++) dil[i] = D[i] <= rc ? 1 : 0; return edt(dil, true); };
    const En = close(D1n), Ef = close(D1f);
    const S0 = new Uint8Array(N); for (let i = 0; i < N; i++) S0[i] = (En[i] > rc || Ef[i] > rc || Bm[i]) ? 1 : 0;
    const D3 = edt(S0, false), DinS = edt(S0, true);
    const sdfB = new Float32Array(N), sdfS = new Float32Array(N), sdfL = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      sdfB[i] = Bm[i] ? -(DinB[i] - 0.5) : D1[i] - 0.5;
      sdfS[i] = S0[i] ? -(DinS[i] - 0.5 + sk) : D3[i] - 0.5 - sk;
    }
    // --- living: shrink-wrap plus soft tissue, smoothed
    const L0 = new Uint8Array(N); for (let i = 0; i < N; i++) L0[i] = (sdfS[i] < 0 || Tm[i]) ? 1 : 0;
    const rl = (P.blend || 3) * s;
    const DL = edt(L0, false); const dl = new Uint8Array(N); for (let i = 0; i < N; i++) dl[i] = DL[i] <= rl ? 1 : 0;
    const EL = edt(dl, true); const Lm = new Uint8Array(N); for (let i = 0; i < N; i++) Lm[i] = (EL[i] > rl || L0[i]) ? 1 : 0;
    const DLo = edt(Lm, false), DLi = edt(Lm, true);
    for (let i = 0; i < N; i++) sdfL[i] = Lm[i] ? -(DLi[i] - 0.5) : DLo[i] - 0.5;
    const sdfLs = boxBlur(sdfL, 1, 1);

    // world coords per pixel
    const wx = (px) => (px - V.ox) / s, wy = (py) => (py - V.oy) / s;
    const tex0 = TEX[P.tex || 'none'], stex0 = TEX[P.sTex || 'skin'];
    // in close-up, textures get finer than world scale so fur and feathers keep a believable grain
    const ts = view === 'skull' ? Math.sqrt(s / viewFor(A, 'body').s) : 1;
    const tex = (x, y) => tex0(x * ts, y * ts), stex = (x, y) => stex0(x * ts, y * ts);
    const furAmp = (P.furAmp || 0) * s / ts, texAmp = (P.texAmp || 0) * s / ts, sTexAmp = (P.sTexAmp !== undefined ? P.sTexAmp : 0.25) * s / ts;

    // --- heights
    const hB = new Float32Array(N), hS = new Float32Array(N), hL = new Float32Array(N);
    const rec = new Float32Array(N), edge = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (!Bm[i]) continue;
      rec[i] = rD[i * 4 + 3] / 255; edge[i] = eD[i * 4 + 3] / 255;
      hB[i] = prof(DinB[i], rb) - rec[i] * rb * 1.1 - edge[i] * rb * 0.35;
    }
    const hBb = boxBlur(hB, Math.max(1, 1.0 * s), 2);
    const bone = P.boneCol || [232, 224, 203], toothC = P.toothCol || [238, 232, 210];
    const skinC = P.skinCol, far = 0.7;

    const stB = { sdf: sdfB, h: hB, rgb: new Uint8ClampedArray(N * 3), ao: new Uint8ClampedArray(N), sp: new Uint8ClampedArray(N) };
    const stS = { sdf: sdfS, h: hS, rgb: new Uint8ClampedArray(N * 3), ao: new Uint8ClampedArray(N), sp: new Uint8ClampedArray(N) };
    const stL = { sdf: sdfL, h: hL, rgb: new Uint8ClampedArray(N * 3), ao: new Uint8ClampedArray(N), sp: new Uint8ClampedArray(N) };
    let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
    const furry = P.fur !== false;
    for (let y = 0; y < H; y++) {
      const Y = wy(y);
      for (let x = 0; x < W; x++) {
        const i = y * W + x, X = wx(x);
        const inS = sdfS[i] < 1.5, inL0 = sdfLs[i] < 6 * s + furAmp * 2;
        if (!inS && !inL0 && !Bm[i]) continue;
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
        const tR = tD[i * 4], tG = tD[i * 4 + 1], isT = tD[i * 4 + 3] > 127, exposed = isT && tG > tR;
        const fb = fbD[i * 4 + 3] > 127, fl = flD[i * 4 + 3] > 127;
        // bone colour
        const nv = noise(X * 0.15, Y * 0.15);
        let c = isT ? toothC : bone;
        const kB = (0.9 + 0.1 * nv) * (1 - 0.18 * rec[i]);
        stB.rgb[i * 3] = c[0] * kB; stB.rgb[i * 3 + 1] = c[1] * kB; stB.rgb[i * 3 + 2] = c[2] * (kB - 0.04 * rec[i]);
        stB.ao[i] = 255 * (1 - 0.55 * rec[i] - 0.35 * edge[i]) * (fb ? far : 1);
        stB.sp[i] = isT ? 120 : 60;
        // shrink-wrap
        const sag = Bm[i] ? 0 : Math.min(1, D1[i] / (rc + 0.01));
        if (inS) {
          const eS = prof(-sdfS[i], 3 * s);
          hS[i] = hBb[i] * 0.9 + eS * 0.7 - sag * rc * 0.5 + stex(X, Y) * sTexAmp;
          const kS = 0.92 + 0.12 * fbm(X * 0.05, Y * 0.05);
          c = isT ? toothC : skinC;
          stS.rgb[i * 3] = c[0] * kS; stS.rgb[i * 3 + 1] = c[1] * kS; stS.rgb[i * 3 + 2] = c[2] * kS;
          stS.ao[i] = 255 * (1 - 0.35 * sag - 0.3 * rec[i]) * (fb ? far : 1);
          stS.sp[i] = isT ? 120 : (P.skinSpec || 0.12) * 255;
        }
        // alive
        const bare = brD[i * 4 + 1] > 127;
        if (furry && !bare && Math.abs(sdfLs[i]) < 10 * s) {
          sdfL[i] = sdfLs[i] - furAmp * (noise(X * 0.9 * ts, Y * 0.9 * ts) * 0.7 + noise(X * 0.3 * ts + 4, Y * 0.3 * ts) * 0.5 - 0.35);
        } else sdfL[i] = sdfLs[i];
        if (sdfL[i] < 1.5) {
          const dome = prof(-sdfL[i], RL);
          const tx = bare ? (P.bareTex ? TEX[P.bareTex](X * ts, Y * ts) * 0.4 : 0) : tex(X, Y);
          const te = Math.min(1, teB[i] * 1.6);
          hL[i] = dome + (P.boneShow || 0) * hS[i] + tx * texAmp - te * (P.edgeDepth || 4) * s;
          let col;
          if (exposed) col = toothC;
          else if (cD[i * 4 + 3] > 127) col = [cD[i * 4], cD[i * 4 + 1], cD[i * 4 + 2]];
          else col = A.coat(X, Y);
          const kL = bare ? 1 : 0.94 + 0.1 * noise(X * 0.6, Y * 0.6);
          stL.rgb[i * 3] = col[0] * kL; stL.rgb[i * 3 + 1] = col[1] * kL; stL.rgb[i * 3 + 2] = col[2] * kL;
          const edgeDark = 1 - 0.18 * (1 - Math.min(1, -sdfL[i] / (RL * 0.35 + 1)));
          stL.ao[i] = 255 * edgeDark * (1 - 0.3 * te) * (fl ? far : 1);
          stL.sp[i] = exposed ? 110 : bare ? brD[i * 4] : (P.coatSpec || 0.04) * 255;
        }
      }
    }
    const pad = 4;
    return { V, view, B: stB, S: stS, L: stL, box: [Math.max(1, bx0 - pad), Math.max(1, by0 - pad), Math.min(W - 2, bx1 + pad), Math.min(H - 2, by1 + pad)] };
  }

  // ---------- frame renderer ----------
  const LX = -0.48, LY = -0.62, LZ = 0.62, LN = Math.hypot(LX, LY, LZ);
  const lx = LX / LN, ly = LY / LN, lz = LZ / LN;
  const hxv = lx, hyv = ly, hzv = lz + 1, hn = Math.hypot(hxv, hyv, hzv);
  const Hx = hxv / hn, Hy = hyv / hn, Hz = hzv / hn;
  const SPEC = new Float32Array(256); for (let i = 0; i < 256; i++) SPEC[i] = Math.pow(i / 255, 28);
  const hbuf = new Float32Array(N), cbuf = new Float32Array(N);

  function render(C, t, img) {
    const d = img.data; d.fill(0);
    const a = t <= 1 ? t : t - 1, s0 = t <= 1 ? C.B : C.S, s1 = t <= 1 ? C.S : C.L;
    const [x0, y0, x1, y1] = C.box;
    const sdf0 = s0.sdf, sdf1 = s1.sdf, h0 = s0.h, h1 = s1.h;
    for (let y = y0 - 1; y <= y1 + 1; y++) {
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        const i = y * W + x;
        const sd = sdf0[i] + (sdf1[i] - sdf0[i]) * a;
        cbuf[i] = sd < 0.5 ? Math.min(1, 0.5 - sd) : 0;
        hbuf[i] = h0[i] + (h1[i] - h0[i]) * a;
      }
    }
    const r0 = s0.rgb, r1 = s1.rgb, a0 = s0.ao, a1 = s1.ao, p0 = s0.sp, p1 = s1.sp;
    // when blending colour, a pixel that is empty in one stage takes the other stage's colour
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x, cov = cbuf[i];
        if (cov <= 0) continue;
        const in0 = sdf0[i] < 1.5, in1 = sdf1[i] < 1.5;
        let k = a; if (!in0) k = 1; else if (!in1) k = 0;
        const j = i * 3;
        const R = r0[j] + (r1[j] - r0[j]) * k, G = r0[j + 1] + (r1[j + 1] - r0[j + 1]) * k, Bc = r0[j + 2] + (r1[j + 2] - r0[j + 2]) * k;
        const ao = (a0[i] + (a1[i] - a0[i]) * k) / 255, sp = (p0[i] + (p1[i] - p0[i]) * k) / 255;
        const nx = -(hbuf[i + 1] - hbuf[i - 1]) * 0.5, ny = -(hbuf[i + W] - hbuf[i - W]) * 0.5;
        const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
        const X = nx * inv, Y = ny * inv, Z = inv;
        const dif = Math.max(0, X * lx + Y * ly + Z * lz);
        const sh = Math.max(0, X * Hx + Y * Hy + Z * Hz);
        const spec = SPEC[Math.min(255, (sh * 255) | 0)] * sp * 230;
        const lit = (0.36 + 0.78 * dif) * ao;
        const o = i * 4;
        d[o] = R * lit + spec; d[o + 1] = G * lit + spec; d[o + 2] = Bc * lit + spec * 0.95;
        d[o + 3] = cov * 255;
      }
    }
  }

  // ---------- overlays ----------
  function stageAlpha(st, t) {
    const aS = sstep(0.45, 0.9, t), aL = sstep(1.3, 1.8, t);
    if (st === 'L') return aL;
    if (st === 'S') return aS * (1 - aL);
    if (st === 'SL') return aS;
    if (st === 'B') return 1 - sstep(0.1, 0.6, t);
    return 1;
  }
  function drawEye(ctx, e, t) {
    const aS = sstep(0.45, 0.9, t), aL = sstep(1.3, 1.75, t);
    if (aS <= 0.001) return;
    const iris = e.iris || '#3a2618';
    ctx.save();
    ctx.translate(e.x, e.y); ctx.rotate(e.rot || 0);
    if (aL < 1) { // lidless, staring eyeball sitting in the socket
      const r = e.rS;
      ctx.globalAlpha = aS * (1 - aL);
      let g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#5a4a40'); g.addColorStop(0.6, '#241a15'); g.addColorStop(1, '#0d0907');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = aS * (1 - aL) * 0.75;
      ctx.fillStyle = iris; ctx.beginPath(); ctx.arc(r * 0.12, 0, r * 0.62, 0, Math.PI * 2); ctx.fill();
      drawPupil(ctx, e, r * 0.62, r * 0.12);
      ctx.globalAlpha = aS * (1 - aL);
      ctx.strokeStyle = 'rgba(160,96,88,0.85)'; ctx.lineWidth = r * 0.14; ctx.beginPath(); ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,250,240,0.85)'; ctx.beginPath(); ctx.ellipse(-r * 0.32, -r * 0.38, r * 0.16, r * 0.1, -0.6, 0, Math.PI * 2); ctx.fill();
    }
    if (aL > 0) {
      const r = e.r, open = e.open || 0.78;
      ctx.globalAlpha = aL;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * open, e.tilt || 0, 0, Math.PI * 2); ctx.clip();
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.1, 0, 0, r * 1.05);
      g.addColorStop(0, e.irisHi || iris); g.addColorStop(1, iris);
      ctx.fillStyle = e.sclera || g; ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
      if (e.sclera) { ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r * 0.1, 0, r * 0.8, 0, Math.PI * 2); ctx.fill(); }
      drawPupil(ctx, e, e.sclera ? r * 0.8 : r, r * 0.1);
      ctx.fillStyle = 'rgba(255,252,245,0.9)'; ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.17, r * 0.11, -0.6, 0, Math.PI * 2); ctx.fill();
      // upper-lid shadow
      const sg = ctx.createLinearGradient(0, -r * open, 0, 0); sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 1.2);
      ctx.restore();
      ctx.strokeStyle = e.lid || '#16100c'; ctx.lineWidth = Math.max(0.8, r * 0.16);
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * open, e.tilt || 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  function drawPupil(ctx, e, r, off) {
    ctx.fillStyle = '#050403'; ctx.beginPath();
    const p = e.pupil || 'round';
    if (p === 'slit') ctx.ellipse(off, 0, r * 0.14, r * 0.82, 0, 0, Math.PI * 2);
    else if (p === 'hbar') ctx.ellipse(off, 0, r * 0.55, r * 0.2, 0, 0, Math.PI * 2);
    else if (p === 'vslit') ctx.ellipse(off, 0, r * 0.12, r * 0.85, 0, 0, Math.PI * 2);
    else ctx.arc(off, 0, r * (e.pupilR || 0.45), 0, Math.PI * 2);
    ctx.fill();
  }
  function drawOverlays(ctx, A, t, view) {
    for (const o of A._b.over) {
      if (o.type === 'eye') { drawEye(ctx, o, t); continue; }
      const al = stageAlpha(o.stage || 'L', t) * (o.alpha !== undefined ? o.alpha : 1);
      if (al <= 0.001) continue;
      ctx.globalAlpha = al;
      if (o.type === 'line') {
        ctx.strokeStyle = o.color || '#000'; ctx.lineWidth = o.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(o.pts[0][0], o.pts[0][1]); for (let i = 1; i < o.pts.length; i++) ctx.lineTo(o.pts[i][0], o.pts[i][1]); ctx.stroke();
      } else if (o.type === 'dot') {
        ctx.fillStyle = o.color || '#000'; ctx.beginPath(); ctx.ellipse(o.x, o.y, o.rx, o.ry, o.rot || 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  window.SW = { W, H, Builder, compute, render, drawOverlays, viewFor, buildAnimal, noise, fbm, mix, hex, sstep, clamp, lerp };
})();
