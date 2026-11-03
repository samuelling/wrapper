// The gallery building: a long nave under a glass roof, cast-iron columns, two tiers of balconies,
// a dark procession platform down the middle. Units are metres; the procession marches toward +x.
import * as THREE from 'three';

export const HALL = { L: 64, W: 26, H: 21, balconyY: [6.2, 11.6], colZ: 9.6, wallZ: 13, platform: { x0: -13, x1: 16.5, z: 3.8, h: 0.34 } };

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

function parquet() {
  return canvasTex(1024, 1024, (x, w, h) => {
    x.fillStyle = '#5a3c26'; x.fillRect(0, 0, w, h);
    const pw = 64, ph = 256;
    for (let r = 0; r < h / pw; r++) for (let c = -1; c < w / ph + 1; c++) {
      const off = (r % 2) * ph / 2, X = c * ph + off, Y = r * pw;
      const k = 0.78 + Math.random() * 0.32;
      x.fillStyle = `rgb(${Math.round(112 * k)},${Math.round(76 * k)},${Math.round(48 * k)})`;
      x.fillRect(X + 1, Y + 1, ph - 2, pw - 2);
      x.strokeStyle = 'rgba(30,18,10,0.18)'; x.lineWidth = 1;
      for (let g = 0; g < 6; g++) { const gy = Y + 6 + Math.random() * (pw - 12); x.beginPath(); x.moveTo(X + 4, gy); x.bezierCurveTo(X + ph * 0.3, gy + 3, X + ph * 0.6, gy - 3, X + ph - 4, gy + 1); x.stroke(); }
    }
    x.fillStyle = 'rgba(20,12,6,0.55)';
    for (let r = 0; r <= h / pw; r++) x.fillRect(0, r * pw - 1, w, 2);
  }, [16, 16]);
}
function stone() {
  return canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#a99c86'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '60,50,40' : '230,220,200'},${Math.random() * 0.06})`; x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 2 + Math.random() * 6); }
    x.strokeStyle = 'rgba(70,60,48,0.35)'; x.lineWidth = 2;
    for (let y = 0; y <= h; y += 64) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
    for (let y = 0; y < h; y += 64) for (let xx = (y / 64 % 2) * 64; xx <= w; xx += 128) { x.beginPath(); x.moveTo(xx, y); x.lineTo(xx, y + 64); x.stroke(); }
  }, [10, 5]);
}
function slate() {
  return canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#3d403d'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1); }
  }, [8, 2]);
}

export function plaqueTexture(name, latin) {
  return canvasTex(512, 150, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#dcbd6c'); g.addColorStop(0.5, '#c39d48'); g.addColorStop(1, '#9f7f36');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(40,30,8,0.6)'; x.lineWidth = 3; x.strokeRect(10, 10, w - 20, h - 20);
    x.fillStyle = '#21190a'; x.textAlign = 'center';
    x.font = '600 46px "IM Fell English SC", Georgia, serif'; x.fillText(name, w / 2, 70);
    x.font = 'italic 34px "IM Fell English", Georgia, serif'; x.fillText(latin, w / 2, 118);
  });
}

export function buildHall(scene, quality) {
  const { L, W, H, balconyY, colZ, wallZ, platform } = HALL;
  const g = new THREE.Group(); scene.add(g);
  const iron = new THREE.MeshStandardMaterial({ color: 0x2b3431, roughness: 0.55, metalness: 0.35 });
  const ironLight = new THREE.MeshStandardMaterial({ color: 0x46524d, roughness: 0.5, metalness: 0.4 });
  const wallMat = new THREE.MeshStandardMaterial({ map: stone(), roughness: 0.92 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3423, roughness: 0.7 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc29a46, roughness: 0.32, metalness: 0.8 });

  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, W * 1.1), new THREE.MeshStandardMaterial({ map: parquet(), roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  // procession platform
  const pl = new THREE.Mesh(new THREE.BoxGeometry(platform.x1 - platform.x0, platform.h, platform.z * 2), new THREE.MeshStandardMaterial({ map: slate(), roughness: 0.85 }));
  pl.position.set((platform.x0 + platform.x1) / 2, platform.h / 2, 0); pl.receiveShadow = true; pl.castShadow = false; g.add(pl);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(platform.x1 - platform.x0 + 0.06, 0.035, platform.z * 2 + 0.06), brass);
  edge.position.set(pl.position.x, platform.h + 0.005, 0); g.add(edge);
  const top = new THREE.Mesh(new THREE.BoxGeometry(platform.x1 - platform.x0 - 0.04, 0.04, platform.z * 2 - 0.04), new THREE.MeshStandardMaterial({ map: slate(), roughness: 0.8 }));
  top.position.set(pl.position.x, platform.h + 0.012, 0); top.receiveShadow = true; g.add(top);

  // long walls and end walls
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(L, H), wallMat); w.position.set(0, H / 2, s * wallZ); w.rotation.y = s > 0 ? Math.PI : 0; w.receiveShadow = true; g.add(w);
    const e = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat); e.position.set(s * L / 2, H / 2, 0); e.rotation.y = -s * Math.PI / 2; g.add(e);
  }
  // display cases along the walls (dim, warm)
  const caseGlass = new THREE.MeshStandardMaterial({ color: 0x2a2a24, roughness: 0.12, metalness: 0.1, emissive: 0x6a5434, emissiveIntensity: 0.55 });
  for (const s of [-1, 1]) for (let x = -26; x <= 26; x += 8) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.2, 0.9), caseGlass); c.position.set(x, 1.9, s * (wallZ - 0.5)); g.add(c);
    const f = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.15, 1.0), iron); f.position.set(x, 3.55, s * (wallZ - 0.5)); g.add(f);
  }

  // columns (two tiers per side), capitals and balcony slabs with railings
  const colGeo = new THREE.CylinderGeometry(0.16, 0.2, 1, 12);
  const capGeo = new THREE.CylinderGeometry(0.42, 0.18, 0.5, 12);
  const xs = []; for (let x = -L / 2 + 4; x <= L / 2 - 4; x += 4) xs.push(x);
  const levels = [[0, balconyY[0]], [balconyY[0], balconyY[1]], [balconyY[1], H - 1.6]];
  const nCol = xs.length * 2 * levels.length;
  const cols = new THREE.InstancedMesh(colGeo, iron, nCol), caps = new THREE.InstancedMesh(capGeo, ironLight, nCol);
  const m = new THREE.Matrix4(); let k = 0;
  for (const s of [-1, 1]) for (const x of xs) for (const [y0, y1] of levels) {
    m.compose(new THREE.Vector3(x, (y0 + y1) / 2, s * colZ), new THREE.Quaternion(), new THREE.Vector3(1, y1 - y0, 1)); cols.setMatrixAt(k, m);
    m.compose(new THREE.Vector3(x, y1 - 0.25, s * colZ), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); caps.setMatrixAt(k, m); k++;
  }
  cols.castShadow = true; g.add(cols, caps);
  const railH = 1.05, balW = wallZ - colZ + 0.5;
  for (const y of balconyY) for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(L, 0.32, balW), wood); slab.position.set(0, y - 0.16, s * (colZ + balW / 2 - 0.5)); slab.receiveShadow = true; g.add(slab);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(L, 0.55, 0.24), iron); beam.position.set(0, y - 0.45, s * (colZ - 0.35)); g.add(beam);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.07, 0.1), ironLight); rail.position.set(0, y + railH, s * (colZ - 0.4)); g.add(rail);
    const rail2 = rail.clone(); rail2.position.y = y + 0.12; g.add(rail2);
  }
  // balusters
  const bGeo = new THREE.BoxGeometry(0.035, railH, 0.035);
  const nB = Math.floor(L / 0.18) * 4, bal = new THREE.InstancedMesh(bGeo, iron, nB); k = 0;
  for (const y of balconyY) for (const s of [-1, 1]) for (let x = -L / 2; x < L / 2 && k < nB; x += 0.18) {
    m.makeTranslation(x, y + railH / 2, s * (colZ - 0.4)); bal.setMatrixAt(k++, m);
  }
  bal.count = k; g.add(bal);
  // arches between columns at the top tier
  const archGeo = new THREE.TorusGeometry(2, 0.12, 6, 24, Math.PI);
  const arches = new THREE.InstancedMesh(archGeo, iron, xs.length * 2); k = 0;
  for (const s of [-1, 1]) for (let i = 0; i < xs.length - 1; i++) { m.makeTranslation((xs[i] + xs[i + 1]) / 2, H - 1.85, s * colZ); arches.setMatrixAt(k++, m); }
  arches.count = k; g.add(arches);

  // glass roof: luminous panes with an iron grid, raised on a cornice
  const roofY = H;
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(L, W), new THREE.MeshBasicMaterial({ color: 0xdde8f2, fog: false }));
  sky.rotation.x = Math.PI / 2; sky.position.y = roofY + 0.4; g.add(sky);
  const corMat = new THREE.MeshStandardMaterial({ color: 0x9a8e78, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(L, 1.3, 1.2), corMat); c1.position.set(0, roofY - 0.5, s * (W / 2 - 0.6)); g.add(c1);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, W), corMat); c2.position.set(s * (L / 2 - 0.6), roofY - 0.5, 0); g.add(c2);
  }
  const nBar = Math.ceil(L / 1.6) + Math.ceil(W / 1.6) + 2;
  const bar = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.12, 0.12), iron, nBar); k = 0;
  for (let x = -L / 2; x <= L / 2; x += 1.6) { m.compose(new THREE.Vector3(x, roofY + 0.3, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(W, 1, 1)); bar.setMatrixAt(k++, m); }
  for (let z = -W / 2; z <= W / 2; z += 1.6) { m.compose(new THREE.Vector3(0, roofY + 0.3, z), new THREE.Quaternion(), new THREE.Vector3(L, 1, 1)); bar.setMatrixAt(k++, m); }
  bar.count = k; g.add(bar);
  const truss = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.5, W), iron, xs.length); k = 0;
  for (const x of xs) { m.makeTranslation(x, roofY - 0.1, 0); truss.setMatrixAt(k++, m); }
  g.add(truss);

  // tall arched window on the far end wall
  const winMat = new THREE.MeshBasicMaterial({ color: 0xc9d8e4, fog: false });
  const sh = new THREE.Shape(); const ww = 9, wh = 11;
  sh.moveTo(-ww / 2, 0); sh.lineTo(ww / 2, 0); sh.lineTo(ww / 2, wh); sh.absarc(0, wh, ww / 2, 0, Math.PI, false); sh.lineTo(-ww / 2, 0);
  for (const sx of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), winMat);
    win.position.set(sx * (L / 2 - 0.05), 3.5, 0); win.rotation.y = -sx * Math.PI / 2; g.add(win);
    const mul = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 1, 0.12), iron, 16); let q = 0;
    for (let i = -3; i <= 3; i++) { m.compose(new THREE.Vector3(sx * (L / 2 - 0.12), 3.5 + (wh + ww / 2 * Math.sqrt(1 - (i / 4) ** 2)) / 2, i * ww / 8), new THREE.Quaternion(), new THREE.Vector3(1, wh + ww / 2 * Math.sqrt(1 - (i / 4) ** 2), 1)); mul.setMatrixAt(q++, m); }
    for (let j = 1; j <= 5; j++) { m.compose(new THREE.Vector3(sx * (L / 2 - 0.12), 3.5 + j * wh / 5.5, 0), new THREE.Quaternion(), new THREE.Vector3(1, 0.12 / 1, ww * 8.3)); mul.setMatrixAt(q++, m); }
    mul.count = q; g.add(mul);
  }

  // light: daylight from the glass roof plus a warm fill
  scene.add(new THREE.HemisphereLight(0xdde7f0, 0x6a5038, 1.35));
  const sun = new THREE.DirectionalLight(0xfff3e2, 2.4);
  sun.position.set(-6, 24, 8); sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  const sm = quality === 'low' ? 1024 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 8, bottom: -8, near: 5, far: 50 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  scene.fog = new THREE.Fog(0x55595a, 30, 95);
  scene.background = new THREE.Color(0x55595a);
  return { group: g, brass, sun };
}
