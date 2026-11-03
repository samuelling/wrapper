// Loads one baked animal and builds its three morphing meshes: bone, shrink-wrap, alive.
import * as THREE from 'three';

const lin = (c) => Math.pow(c / 255, 2.2);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function view(buf, e) {
  const T = { u16: Uint16Array, u8: Uint8Array, u32: Uint32Array, f32: Float32Array }[e.t];
  return new T(buf, e.o, e.n);
}
function dequant(q, lo, rng) {
  const out = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) { const k = i % 3; out[i] = lo[k] + q[i] / 65535 * rng[k]; }
  return out;
}
function normalsFor(pos, index) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeVertexNormals();
  return g.getAttribute('normal').array;
}

// Standard material whose vertices, normals and colours slide from a start set to an end set.
function morphMaterial(opts) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: opts.roughness, metalness: 0 });
  mat.userData.uMorph = { value: 1 };
  const hasGloss = !!opts.gloss;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMorph = mat.userData.uMorph;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uMorph;
attribute vec3 position0;
attribute vec3 normal0;
attribute vec3 color0;
${hasGloss ? 'attribute float gloss; varying float vGloss;' : ''}`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(mix(normal0, normal, uMorph));')
      .replace('#include <begin_vertex>', 'vec3 transformed = mix(position0, position, uMorph);')
      .replace('#include <color_vertex>', `#include <color_vertex>
vColor = mix(color0, color, uMorph);
${hasGloss ? 'vGloss = gloss;' : ''}`);
    if (hasGloss) {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vGloss;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.22, smoothstep(0.05, 0.6, vGloss));');
    }
  };
  return mat;
}
function morphDepth(mat) {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  d.onBeforeCompile = (sh) => {
    sh.uniforms.uMorph = mat.userData.uMorph;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uMorph;\nattribute vec3 position0;')
      .replace('#include <begin_vertex>', 'vec3 transformed = mix(position0, position, uMorph);');
  };
  return d;
}

function irisTexture(e) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(56, 56, 6, 64, 64, 64);
  g.addColorStop(0, e.irisHi || e.iris); g.addColorStop(1, e.iris);
  x.fillStyle = g; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#050403'; x.beginPath();
  if (e.pupil === 'slit') x.ellipse(64, 64, 8, 52, 0, 0, Math.PI * 2);
  else if (e.pupil === 'hbar') x.ellipse(64, 64, 36, 13, 0, 0, Math.PI * 2);
  else x.arc(64, 64, 62 * (e.pupilR || 0.45), 0, Math.PI * 2);
  x.fill();
  x.fillStyle = 'rgba(255,252,245,0.9)'; x.beginPath(); x.ellipse(44, 42, 10, 6, -0.6, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function loadSpecimen(A, base) {
  const man = await fetch(`${base}/${A.id}.json`).then(r => { if (!r.ok) throw new Error(A.id + ' ' + r.status); return r.json(); });
  // mesh arrays travel as one base64 block inside the JSON
  const bin = atob(man.bin), buf = new ArrayBuffer(bin.length), u8 = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  delete man.bin;
  const root = new THREE.Group(); root.name = A.id;
  const parts = {};
  const skin = A.skinCol, bone = A.boneCol;
  for (const name of ['bone', 'wrap', 'curator', 'alive']) {
    const e = man.meshes[name];
    const pos = dequant(view(buf, e.pos), e.lo, e.rng);
    const index = view(buf, e.idx);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.computeVertexNormals();
    const n = pos.length / 3;
    const col = view(buf, e.col);
    const C = new Float32Array(n * 3);
    let mat;
    if (name === 'bone') {
      for (let i = 0; i < n * 3; i++) C[i] = lin(col[i]);
      g.setAttribute('color', new THREE.BufferAttribute(C, 3));
      mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
      const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
      parts.bone = { mesh: m };
      root.add(m);
      continue;
    }
    const pos0 = dequant(view(buf, e.pos0), e.lo, e.rng);
    g.setAttribute('position0', new THREE.BufferAttribute(pos0, 3));
    g.setAttribute('normal0', new THREE.BufferAttribute(normalsFor(pos0, index), 3));
    const C0 = new Float32Array(n * 3);
    const col0 = view(buf, e.col0);
    if (name === 'wrap') {
      for (let i = 0; i < n * 3; i++) { C[i] = lin(col[i]); C0[i] = lin(col0[i]); }
    } else {
      // coat colours come from the pattern functions in anatomy.js, evaluated in side-view coordinates
      const coat = view(buf, e.coat), ao = view(buf, e.ao), coat0 = e.coat0 ? view(buf, e.coat0) : null;
      const endCoat = name === 'alive' ? A.coat : A.curator.coat, startCoat = A.curator.coat;
      const W = (P, i) => [P[i * 3] * man.upm + man.xc, man.groundY - P[i * 3 + 1] * man.upm];
      for (let i = 0; i < n; i++) {
        const a = ao[i] / 255;
        let c = [col[i * 3], col[i * 3 + 1], col[i * 3 + 2]], c0 = [col0[i * 3], col0[i * 3 + 1], col0[i * 3 + 2]];
        if (coat[i]) c = endCoat(...W(pos, i));
        if (coat0 && coat0[i]) c0 = startCoat(...W(pos0, i));
        for (let k = 0; k < 3; k++) { C[i * 3 + k] = lin(c[k]) * a; C0[i * 3 + k] = lin(c0[k]) * a; }
      }
      const gl = view(buf, e.gloss), G = new Float32Array(n);
      for (let i = 0; i < n; i++) G[i] = gl[i] / 255;
      g.setAttribute('gloss', new THREE.BufferAttribute(G, 1));
    }
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setAttribute('color0', new THREE.BufferAttribute(C0, 3));
    mat = morphMaterial({ roughness: name === 'wrap' ? 0.48 : name === 'curator' ? 0.62 : 0.86, gloss: name !== 'wrap' });
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true; m.receiveShadow = true;
    m.customDepthMaterial = morphDepth(mat);
    m.frustumCulled = false;
    parts[name] = { mesh: m, mat };
    root.add(m);
  }
  // eyes
  const eyes = [];
  const ballMat = new THREE.MeshStandardMaterial({ color: 0x150e0a, roughness: 0.12, metalness: 0 });
  const sphere = new THREE.SphereGeometry(1, 20, 14), disc = new THREE.CircleGeometry(1, 28);
  for (const e of man.eyes) {
    const tex = irisTexture(e);
    const irisMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.15, transparent: true });
    const mk = (r, z, lidless) => {
      const g = new THREE.Group();
      const ball = new THREE.Mesh(sphere, lidless ? ballMat : ballMat); ball.scale.setScalar(r); g.add(ball);
      const iris = new THREE.Mesh(disc, irisMat); iris.scale.setScalar(r * (lidless ? 0.66 : 0.82));
      iris.position.z = e.side * r * (lidless ? 0.985 : 0.97); if (e.side < 0) iris.rotation.y = Math.PI;
      g.add(iris);
      if (lidless) { // raw rim of the socket
        const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.98, r * 0.09, 8, 28), new THREE.MeshStandardMaterial({ color: 0x9a6056, roughness: 0.5 }));
        rim.position.z = e.side * r * 0.25; g.add(rim);
      }
      g.position.set(e.x, e.y, z); root.add(g); return g;
    };
    if (e.stage === 'C') eyes.push({ C: mk(e.r, e.zL, false) });
    else eyes.push({ S: mk(e.rS, e.zS, true), L: mk(e.r, e.zL, false) });
  }
  let stage = -1;
  function setStage(t) {
    if (t === stage) return; stage = t;
    // 0 skeleton, 1 shrink-wrap, 2 curator's model, 3 alive
    const k = (lo) => Math.min(1, Math.max(0, t - lo));
    parts.bone.mesh.visible = t < 1.0;
    parts.wrap.mesh.visible = t > 0.001 && t <= 1.0; parts.wrap.mat.userData.uMorph.value = k(0);
    parts.curator.mesh.visible = t > 1.0 && t <= 2.0; parts.curator.mat.userData.uMorph.value = k(1);
    parts.alive.mesh.visible = t > 2.0; parts.alive.mat.userData.uMorph.value = k(2);
    const sc = { S: smooth(0.45, 0.9, t) * (1 - smooth(1.05, 1.35, t)), C: smooth(1.3, 1.75, t) * (1 - smooth(2.05, 2.35, t)), L: smooth(2.3, 2.75, t) };
    for (const e of eyes) for (const key of ['S', 'C', 'L']) {
      if (!e[key]) continue;
      e[key].visible = sc[key] > 0.01; e[key].scale.setScalar(Math.max(0.001, sc[key]));
    }
  }
  setStage(2);
  // bounds in metres (for placement and picking)
  const box = new THREE.Box3();
  parts.alive.mat.userData.uMorph.value = 1; box.setFromObject(parts.alive.mesh); box.union(new THREE.Box3().setFromObject(parts.bone.mesh)); box.union(new THREE.Box3().setFromObject(parts.curator.mesh));
  return { A, root, setStage, box, man, get stage() { return stage; } };
}
