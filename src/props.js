// NEON//REVENANT — utilería del entorno.
// Reglas de legibilidad aplicadas:
//   1. El entorno va en valores medios y desaturados (grises, tierras, azules apagados).
//   2. El color saturado se reserva para el jugador, los hostiles y el botín.
//   3. Contraste de valor bajo en el suelo y alto en la silueta de los objetos grandes.
//   4. Repetición con variación: mismo prop en 2-3 colores y rotaciones distintas.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Geometrías compartidas: se marcan para que el recolector no las libere al cambiar de sector.
const boxCache = new THREE.BoxGeometry(1, 1, 1);
const cylCache = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const sphCache = new THREE.SphereGeometry(0.5, 12, 8);
const coneCache = new THREE.ConeGeometry(0.5, 1, 8);
for (const g of [boxCache, cylCache, sphCache, coneCache]) g.userData.shared = true;

function mat(color, rough = .86, metal = .06) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: false });
}

function box(parent, m, size, pos, rot) {
  const o = new THREE.Mesh(boxCache, m);
  o.scale.set(size[0], size[1], size[2]);
  o.position.set(pos[0], pos[1], pos[2]);
  if (rot) o.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  parent.add(o);
  return o;
}
function cyl(parent, m, r, h, pos, rot) {
  const o = new THREE.Mesh(cylCache, m);
  o.scale.set(r * 2, h, r * 2);
  o.position.set(pos[0], pos[1], pos[2]);
  if (rot) o.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  parent.add(o);
  return o;
}
function sph(parent, m, r, pos) {
  const o = new THREE.Mesh(sphCache, m);
  o.scale.setScalar(r * 2);
  o.position.set(pos[0], pos[1], pos[2]);
  parent.add(o);
  return o;
}
function cone(parent, m, r, h, pos) {
  const o = new THREE.Mesh(coneCache, m);
  o.scale.set(r * 2, h, r * 2);
  o.position.set(pos[0], pos[1], pos[2]);
  parent.add(o);
  return o;
}

// ------------------------------------------------------------------ coches
const CAR_BODIES = [0xb9bfc2, 0x8b9295, 0x6f7b80, 0xa8563f, 0x3f5a6b, 0xc9c3b4, 0x4c5450];
export function makeCar(rnd, style = 'city') {
  const g = new THREE.Group();
  const body = mat(CAR_BODIES[Math.floor(rnd() * CAR_BODIES.length)], .42, .5);
  const glass = mat(0x2b3a42, .18, .75);
  const rubber = mat(0x191d1f, .95, 0);
  const light = new THREE.MeshStandardMaterial({ color: 0xfff2cf, emissive: 0xffd9a0, emissiveIntensity: .55, roughness: .3 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x5a1c14, emissive: 0xb03018, emissiveIntensity: .7, roughness: .4 });
  const isVan = style === 'industrial' ? rnd() < .55 : rnd() < .22;
  const isTruck = !isVan && style === 'industrial' && rnd() < .3;
  const w = isTruck ? 2.5 : 2.0, h = isVan ? 2.0 : isTruck ? 2.4 : 1.45, l = isTruck ? 6.4 : isVan ? 4.8 : 4.3;
  g.userData.foot = [w / 2 + .18, l / 2 + .18, h * 1.05];

  box(g, body, [w, h * .52, l], [0, h * .42, 0]);
  box(g, glass, [w * .88, h * .38, l * .52], [0, h * .82, isTruck ? .9 : isVan ? .2 : -.1]);
  if (isTruck) {
    box(g, body, [w * 1.02, h * .62, l * .38], [0, h * .78, -l * .3]);
    box(g, mat(0x5c6367, .8, .3), [w * 1.05, .18, l * .36], [0, h * .48, -l * .3]);
  } else {
    box(g, body, [w * .94, h * .22, l * .3], [0, h * .58, -l * .34]);
  }
  box(g, body, [w * 1.02, .14, .3], [0, h * .3, l * .5]);
  box(g, light, [w * .26, .12, .06], [-w * .3, h * .45, l * .52]);
  box(g, light, [w * .26, .12, .06], [w * .3, h * .45, l * .52]);
  box(g, tail, [w * .26, .1, .06], [-w * .3, h * .45, -l * .52]);
  box(g, tail, [w * .26, .1, .06], [w * .3, h * .45, -l * .52]);
  const wr = isTruck ? .52 : .42;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    cyl(g, rubber, wr, .24, [sx * w * .52, wr * .92, sz * l * .34], [0, 0, Math.PI / 2]);
  }
  for (const o of g.children) { o.castShadow = true; o.receiveShadow = true; }
  return g;
}

// ------------------------------------------------------------------ farola
export function makeLamp(rnd, warm = true) {
  const g = new THREE.Group();
  const pole = mat(0x4a5155, .7, .55);
  const head = new THREE.MeshStandardMaterial({
    color: warm ? 0xffe6b8 : 0xdfeef2, emissive: warm ? 0xffc477 : 0xbfe4ee,
    emissiveIntensity: .8, roughness: .35
  });
  cyl(g, pole, .09, 5.2, [0, 2.6, 0]);
  g.userData.foot = [.3, .3, 5.2];
  box(g, pole, [1.0, .1, .16], [0, 5.15, .42]);
  box(g, head, [.62, .16, .3], [0, 5.02, .78]);
  cyl(g, pole, .16, .3, [0, .15, 0]);
  for (const o of g.children) o.castShadow = true;
  return g;
}

// ------------------------------------------------------------------ naturaleza
export function makeTree(rnd) {
  const g = new THREE.Group();
  const trunk = mat(0x5b4530, .95, 0);
  const leafSets = [[0x5f7a45, 0x6f8a4e], [0x4d6b3c, 0x5f7f47], [0x6b7a3d, 0x7d8c4a]];
  const set = leafSets[Math.floor(rnd() * leafSets.length)];
  const h = 2.2 + rnd() * 1.4;
  cyl(g, trunk, .17, h, [0, h / 2, 0]);
  g.userData.foot = [.62, .62, 6];
  const n = 3;
  for (let i = 0; i < n; i++) {
    const m = mat(i % 2 ? set[1] : set[0], .95, 0);
    sph(g, m, .95 - i * .16, [(rnd() - .5) * .5, h + .35 + i * .62, (rnd() - .5) * .5]);
  }
  for (const o of g.children) o.castShadow = true;
  return g;
}
export function makePlanter(rnd) {
  const g = new THREE.Group();
  box(g, mat(0x9a8f7e, .95, 0), [1.5, .5, 1.5], [0, .25, 0]);
  g.userData.foot = [.82, .82, .62];
  box(g, mat(0x4f3a28, .98, 0), [1.3, .12, 1.3], [0, .5, 0]);
  for (let i = 0; i < 4; i++) {
    sph(g, mat(rnd() < .5 ? 0x5f7a45 : 0x6b7a3d, .95, 0), .3, [(rnd() - .5) * 1.0, .72, (rnd() - .5) * 1.0]);
  }
  for (const o of g.children) o.castShadow = true;
  return g;
}

// ------------------------------------------------------------------ mobiliario urbano
export function makeBench(rnd) {
  const g = new THREE.Group();
  const wood = mat(0x8a6a45, .92, 0);
  const iron = mat(0x474d50, .7, .5);
  box(g, wood, [1.9, .1, .55], [0, .46, 0]);
  g.userData.foot = [1.02, .36, .68];
  box(g, wood, [1.9, .42, .08], [0, .62, -.24]);
  for (const x of [-.8, .8]) { box(g, iron, [.1, .46, .5], [x, .23, 0]); box(g, iron, [.12, .5, .12], [x, .25, .22]); }
  for (const o of g.children) o.castShadow = true;
  return g;
}
export function makeKiosk(rnd) {
  const g = new THREE.Group();
  const base = mat(0x8d8578, .9, .05);
  const stripe = mat([0xb9624a, 0x5c7f8a, 0x7d8c5a][Math.floor(rnd() * 3)], .85, .05);
  box(g, base, [3.4, 2.5, 2.4], [0, 1.25, 0]);
  g.userData.foot = [1.78, 1.3, 2.95];
  box(g, stripe, [3.6, .5, 2.6], [0, 2.6, 0]);
  box(g, mat(0x3b4448, .6, .4), [3.0, 1.0, .1], [0, 1.5, 1.24]);
  box(g, mat(0x2b3338, .8, .2), [3.8, .12, 2.8], [0, 2.9, 0]);
  for (const o of g.children) o.castShadow = true;
  return g;
}
export function makeBarrier(rnd) {
  const g = new THREE.Group();
  const m = mat(0xd8d2c4, .9, 0);
  const red = mat(0xa8443a, .9, 0);
  box(g, m, [1.9, .9, .12], [0, .55, 0]);
  g.userData.foot = [1.0, .28, 1.12];
  box(g, red, [1.9, .22, .14], [0, .78, 0]);
  for (const x of [-.85, .85]) box(g, mat(0x555b5e, .8, .4), [.12, 1.1, .12], [x, .55, -.1]);
  for (const o of g.children) o.castShadow = true;
  return g;
}
export function makeCone(rnd) {
  const g = new THREE.Group();
  cone(g, mat(0xcf6a2a, .9, 0), .22, .7, [0, .35, 0]);
  g.userData.foot = [.34, .34, .7];
  box(g, mat(0xd9d3c6, .9, 0), [.6, .08, .6], [0, .04, 0]);
  return g;
}

// ------------------------------------------------------------------ industrial / puerto
const CONTAINER_COLORS = [0x8a5a49, 0x4d6a72, 0x6f7a55, 0x8d8b7f, 0x5a6070, 0xa0714f];
export function makeContainer(rnd) {
  const g = new THREE.Group();
  const m = mat(CONTAINER_COLORS[Math.floor(rnd() * CONTAINER_COLORS.length)], .88, .22);
  const frame = mat(0x3e4548, .8, .4);
  box(g, m, [6.0, 2.6, 2.5], [0, 1.3, 0]);
  g.userData.foot = [3.06, 1.32, 2.62];
  for (let i = -2; i <= 2; i++) box(g, frame, [.12, 2.5, 2.56], [i * 1.4, 1.3, 0]);
  box(g, frame, [6.1, .16, 2.56], [0, 2.52, 0]);
  box(g, frame, [6.1, .16, 2.56], [0, .1, 0]);
  for (const o of g.children) { o.castShadow = true; o.receiveShadow = true; }
  return g;
}
export function makeCrate(rnd) {
  const g = new THREE.Group();
  const m = mat(rnd() < .5 ? 0x8a6f4c : 0x7b7d70, .95, 0);
  const s = .8 + rnd() * .5;
  g.userData.foot = [s / 2, s / 2, s];
  box(g, m, [s, s, s], [0, s / 2, 0]);
  box(g, mat(0x5c5f57, .95, 0), [s * 1.02, .08, s * 1.02], [0, s * .62, 0]);
  for (const o of g.children) { o.castShadow = true; o.receiveShadow = true; }
  return g;
}
export function makePallet(rnd) {
  const g = new THREE.Group();
  const m = mat(0x9c7f57, .96, 0);
  g.userData.foot = [.66, .68, .3];
  for (let i = 0; i < 4; i++) box(g, m, [1.2, .09, .16], [0, .09, -.5 + i * .34]);
  for (let i = 0; i < 3; i++) box(g, m, [.14, .13, 1.2], [-.5 + i * .5, .2, 0]);
  return g;
}
export function makeForklift(rnd) {
  const g = new THREE.Group();
  const body = mat(0xc2a53c, .7, .3);
  const dark = mat(0x2f3437, .85, .2);
  box(g, body, [1.2, .9, 1.9], [0, .75, 0]);
  g.userData.foot = [.72, 1.2, 1.95];
  box(g, dark, [1.1, .8, .9], [0, 1.5, -.35]);
  box(g, body, [.9, .12, .1], [0, 1.05, .95]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, dark, sz > 0 ? .28 : .34, .18, [sx * .55, sz > 0 ? .28 : .34, sz * .7], [0, 0, Math.PI / 2]);
  box(g, mat(0x8f8a72, .9, 0), [.9, .1, .7], [0, .1, 1.4]);
  for (const o of g.children) o.castShadow = true;
  return g;
}
export function makeRack(rnd) {
  const g = new THREE.Group();
  const frame = mat(0x5a6a70, .8, .45);
  const wood = mat(0x9a8154, .95, 0);
  const w = 4.5 + rnd() * 2.5;
  g.userData.foot = [w / 2 + .2, .92, 4.2];
  for (const x of [-w / 2, w / 2]) for (const z of [-.7, .7]) box(g, frame, [.14, 4.2, .14], [x, 2.1, z]);
  for (let i = 1; i <= 3; i++) box(g, wood, [w, .1, 1.5], [0, i * 1.2, 0]);
  for (let i = 0; i < 4; i++) {
    const c = makeCrate(rnd);
    c.position.set((rnd() - .5) * (w - 1), 1.25 + Math.floor(rnd() * 3) * 1.2, (rnd() - .5) * .8);
    c.scale.setScalar(.7);
    g.add(c);
  }
  for (const o of g.children) o.castShadow = true;
  return g;
}
export function makeCrane(rnd) {
  const g = new THREE.Group();
  const steel = mat(0x6a7072, .8, .5);
  const warn = mat(0xc9a33c, .85, .2);
  g.userData.foot = [2.4, 2.4, 16];
  for (const x of [-1.4, 1.4]) for (const z of [-1.4, 1.4]) {
    box(g, steel, [.3, 16, .3], [x, 8, z]);
    box(g, warn, [.34, .5, .34], [x, 1.2, z]);
  }
  for (let i = 1; i < 6; i++) {
    box(g, steel, [3.2, .18, .18], [0, i * 2.6, -1.4], [0, 0, i % 2 ? .5 : -.5]);
    box(g, steel, [.18, .18, 3.2], [1.4, i * 2.6, 0], [i % 2 ? -.5 : .5, 0, 0]);
  }
  box(g, steel, [22, .7, .9], [8, 16.4, 0]);
  box(g, steel, [.5, .5, 9], [17.5, 15.8, 0]);
  box(g, warn, [1.4, 1.0, 1.4], [17.5, 14.6, 0]);
  for (const o of g.children) o.castShadow = true;
  return g;
}
export function makeBoat(rnd) {
  const g = new THREE.Group();
  const hull = mat(rnd() < .5 ? 0xd7d2c6 : 0x8a99a0, .7, .2);
  const trim = mat(0x9c4c3c, .8, .05);
  const wood = mat(0x8a6f4c, .95, 0);
  const L = 9 + rnd() * 4;
  g.userData.foot = [1.55, L / 2 + .3, 3];
  box(g, hull, [2.8, 1.5, L], [0, .75, 0]);
  box(g, trim, [2.9, .3, L], [0, 1.4, 0]);
  box(g, wood, [2.4, .18, L * .8], [0, 1.6, 0]);
  box(g, hull, [2.0, 1.5, 2.6], [0, 2.4, -L * .1]);
  cyl(g, mat(0x555b5e, .7, .5), .1, 4.2, [0, 4.5, -L * .1]);
  for (const o of g.children) { o.castShadow = true; o.receiveShadow = true; }
  return g;
}
export function makeSign(rnd, text) {
  const g = new THREE.Group();
  const pole = mat(0x4a5155, .8, .5);
  const plate = mat(0x3f6a7a, .7, .1);
  cyl(g, pole, .08, 3.4, [0, 1.7, 0]);
  g.userData.foot = [1.15, .16, 3.6];
  box(g, plate, [2.2, .9, .08], [0, 3.4, 0]);
  box(g, mat(0xdfe6e4, .9, 0), [1.9, .6, .06], [0, 3.4, .06]);
  return g;
}
export function makeAwning(rnd, color = 0xb9624a) {
  const g = new THREE.Group();
  const m = mat(color, .9, 0);
  box(g, m, [3.2, .12, 1.6], [0, 2.7, .8], [.22, 0, 0]);
  for (const x of [-1.5, 1.5]) cyl(g, mat(0x4a5155, .8, .5), .06, 2.6, [x, 1.3, 1.5]);
  return g;
}

// ------------------------------------------------------------------ suelo con variación
// Manchas de distinto valor: rompen la uniformidad del suelo sin añadir ruido de color.
export function makeGroundPatches(parent, rnd, color, count = 26, radius = 44) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .16, depthWrite: false });
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, r = 6 + rnd() * radius;
    const w = 3 + rnd() * 11, d = 3 + rnd() * 11;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = rnd() * Math.PI;
    p.position.set(Math.cos(a) * r, 0.02 + i * 0.0006, Math.sin(a) * r);
    parent.add(p);
  }
}
// Franjas de circulación: guían la vista hacia el centro de la arena.
export function makeRoadMarks(parent, rnd, color, radius = 40) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .22, depthWrite: false });
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + .4;
    for (let k = 0; k < 9; k++) {
      const r = radius - k * 3.6;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(.34, 2.0), m);
      p.rotation.x = -Math.PI / 2;
      p.rotation.z = -ang;
      p.position.set(Math.cos(ang) * r, 0.03, Math.sin(ang) * r);
      parent.add(p);
    }
  }
}

// ------------------------------------------------------------------ composición
// Coloca utilería evitando las plataformas de juego y el punto de aparición.
function freeSpot(rnd, blocked, radius, minCenter = 9) {
  for (let tries = 0; tries < 24; tries++) {
    const a = rnd() * Math.PI * 2, r = minCenter + rnd() * (radius - minCenter);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    let ok = true;
    for (const p of blocked) {
      if (Math.abs(x - p.x) < p.hw + 2.2 && Math.abs(z - p.z) < p.hd + 2.2) { ok = false; break; }
    }
    if (ok) return { x, z, a };
  }
  return null;
}

const STYLES = {
  plaza: (g, rnd, blocked) => {
    makeGroundPatches(g, rnd, 0x6b6252, 30, 42);
    makeRoadMarks(g, rnd, 0xcfc7b2, 40);
    for (let i = 0; i < 14; i++) {
      const s = freeSpot(rnd, blocked, 44); if (!s) continue;
      const t = makeTree(rnd); t.position.set(s.x, 0, s.z); t.rotation.y = rnd() * 6.28; g.add(t);
    }
    for (let i = 0; i < 8; i++) {
      const s = freeSpot(rnd, blocked, 42); if (!s) continue;
      const p = makePlanter(rnd); p.position.set(s.x, 0, s.z); g.add(p);
    }
    for (let i = 0; i < 7; i++) {
      const s = freeSpot(rnd, blocked, 40); if (!s) continue;
      const b = makeBench(rnd); b.position.set(s.x, 0, s.z); b.rotation.y = s.a; g.add(b);
    }
    for (let i = 0; i < 4; i++) {
      const s = freeSpot(rnd, blocked, 40); if (!s) continue;
      const k = makeKiosk(rnd); k.position.set(s.x, 0, s.z); k.rotation.y = s.a; g.add(k);
      const aw = makeAwning(rnd, [0xb9624a, 0x5c7f8a, 0x8d8b7f][Math.floor(rnd() * 3)]);
      aw.position.set(s.x, 0, s.z); aw.rotation.y = s.a; g.add(aw);
    }
    for (let i = 0; i < 10; i++) {
      const s = freeSpot(rnd, blocked, 44); if (!s) continue;
      const l = makeLamp(rnd, true); l.position.set(s.x, 0, s.z); l.rotation.y = rnd() * 6.28; g.add(l);
    }
    for (let i = 0; i < 12; i++) {
      const s = freeSpot(rnd, blocked, 43); if (!s) continue;
      const c = makeCar(rnd, 'city'); c.position.set(s.x, 0, s.z); c.rotation.y = s.a + (rnd() - .5) * .6; g.add(c);
    }
    for (let i = 0; i < 9; i++) {
      const s = freeSpot(rnd, blocked, 40); if (!s) continue;
      const b = makeBarrier(rnd); b.position.set(s.x, 0, s.z); b.rotation.y = s.a; g.add(b);
    }
    for (let i = 0; i < 10; i++) {
      const s = freeSpot(rnd, blocked, 40); if (!s) continue;
      const c = makeCone(rnd); c.position.set(s.x, 0, s.z); g.add(c);
    }
    for (let i = 0; i < 3; i++) {
      const s = freeSpot(rnd, blocked, 38); if (!s) continue;
      const sg = makeSign(rnd); sg.position.set(s.x, 0, s.z); sg.rotation.y = s.a; g.add(sg);
    }
  },
  harbor: (g, rnd, blocked) => {
    makeGroundPatches(g, rnd, 0x53606a, 28, 42);
    makeRoadMarks(g, rnd, 0xc4cbb4, 40);
    for (let i = 0; i < 16; i++) {
      const s = freeSpot(rnd, blocked, 45); if (!s) continue;
      const c = makeContainer(rnd); c.position.set(s.x, 0, s.z); c.rotation.y = s.a + (rnd() < .5 ? 0 : Math.PI / 2); g.add(c);
      if (rnd() < .35) { const c2 = makeContainer(rnd); c2.position.set(s.x, 2.6, s.z); c2.rotation.y = c.rotation.y; g.add(c2); }
    }
    for (let i = 0; i < 10; i++) {
      const s = freeSpot(rnd, blocked, 44); if (!s) continue;
      const c = makeCrate(rnd); c.position.set(s.x, 0, s.z); c.rotation.y = rnd() * 6.28; g.add(c);
    }
    for (let i = 0; i < 8; i++) {
      const s = freeSpot(rnd, blocked, 42); if (!s) continue;
      const p = makePallet(rnd); p.position.set(s.x, 0, s.z); p.rotation.y = rnd() * 6.28; g.add(p);
    }
    for (let i = 0; i < 3; i++) {
      const s = freeSpot(rnd, blocked, 40); if (!s) continue;
      const f = makeForklift(rnd); f.position.set(s.x, 0, s.z); f.rotation.y = s.a; g.add(f);
    }
    for (let i = 0; i < 10; i++) {
      const s = freeSpot(rnd, blocked, 43); if (!s) continue;
      const l = makeLamp(rnd, true); l.position.set(s.x, 0, s.z); l.rotation.y = rnd() * 6.28; g.add(l);
    }
    for (let i = 0; i < 8; i++) {
      const s = freeSpot(rnd, blocked, 44); if (!s) continue;
      const c = makeCar(rnd, 'industrial'); c.position.set(s.x, 0, s.z); c.rotation.y = s.a; g.add(c);
    }
    for (let i = 0; i < 12; i++) {
      const s = freeSpot(rnd, blocked, 40); if (!s) continue;
      const b = makeBarrier(rnd); b.position.set(s.x, 0, s.z); b.rotation.y = s.a; g.add(b);
    }
    // Agua y embarcaciones en el perímetro: dan profundidad y un horizonte legible.
    const water = new THREE.Mesh(new THREE.RingGeometry(48, 130, 48), new THREE.MeshStandardMaterial({ color: 0x2f4a55, roughness: .28, metalness: .35 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -1.4; g.add(water);
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI * 2, r = 54 + rnd() * 24;
      const b = makeBoat(rnd); b.position.set(Math.cos(a) * r, -1.1, Math.sin(a) * r); b.rotation.y = a + Math.PI / 2; g.add(b);
    }
    for (let i = 0; i < 2; i++) {
      const a = rnd() * Math.PI * 2, r = 50 + rnd() * 10;
      const c = makeCrane(rnd); c.position.set(Math.cos(a) * r, -1.2, Math.sin(a) * r); c.rotation.y = -a; g.add(c);
    }
  },
  industrial: (g, rnd, blocked) => {
    makeGroundPatches(g, rnd, 0x5a5750, 30, 42);
    makeRoadMarks(g, rnd, 0xd8d2b8, 40);
    for (let i = 0; i < 10; i++) {
      const s = freeSpot(rnd, blocked, 44); if (!s) continue;
      const rk = makeRack(rnd); rk.position.set(s.x, 0, s.z); rk.rotation.y = s.a; g.add(rk);
    }
    for (let i = 0; i < 12; i++) {
      const s = freeSpot(rnd, blocked, 44); if (!s) continue;
      const c = makeContainer(rnd); c.position.set(s.x, 0, s.z); c.rotation.y = s.a; g.add(c);
    }
    for (let i = 0; i < 12; i++) {
      const s = freeSpot(rnd, blocked, 42); if (!s) continue;
      const c = makeCrate(rnd); c.position.set(s.x, 0, s.z); c.rotation.y = rnd() * 6.28; g.add(c);
    }
    for (let i = 0; i < 6; i++) {
      const s = freeSpot(rnd, blocked, 40); if (!s) continue;
      const p = makePallet(rnd); p.position.set(s.x, 0, s.z); g.add(p);
    }
    for (let i = 0; i < 3; i++) {
      const s = freeSpot(rnd, blocked, 40); if (!s) continue;
      const f = makeForklift(rnd); f.position.set(s.x, 0, s.z); f.rotation.y = s.a; g.add(f);
    }
    for (let i = 0; i < 9; i++) {
      const s = freeSpot(rnd, blocked, 43); if (!s) continue;
      const l = makeLamp(rnd, false); l.position.set(s.x, 0, s.z); l.rotation.y = rnd() * 6.28; g.add(l);
    }
    for (let i = 0; i < 9; i++) {
      const s = freeSpot(rnd, blocked, 44); if (!s) continue;
      const c = makeCar(rnd, 'industrial'); c.position.set(s.x, 0, s.z); c.rotation.y = s.a; g.add(c);
    }
    for (let i = 0; i < 10; i++) {
      const s = freeSpot(rnd, blocked, 40); if (!s) continue;
      const b = makeBarrier(rnd); b.position.set(s.x, 0, s.z); b.rotation.y = s.a; g.add(b);
    }
    for (let i = 0; i < 6; i++) {
      const s = freeSpot(rnd, blocked, 40); if (!s) continue;
      const t = makeTree(rnd); t.position.set(s.x, 0, s.z); t.scale.setScalar(.8); g.add(t);
    }
  },
  // ---- AGUJA: azotea corporativa. Cristal, columnas y pasarelas elevadas. --
  spire: (g, rnd, blocked) => {
    makeGroundPatches(g, rnd, 0x616a74, 26, 42);
    makeRoadMarks(g, rnd, 0xa8b6c4, 40);
    for (let i = 0; i < 14; i++) {
      const s = freeSpot(rnd, blocked, 44); if (!s) continue;
      const p = makePillar(rnd); p.position.set(s.x, 0, s.z); g.add(p);
    }
    for (let i = 0; i < 10; i++) {
      const s = freeSpot(rnd, blocked, 42); if (!s) continue;
      const w = makeCatwalk(rnd); w.position.set(s.x, 0, s.z); w.rotation.y = s.a; g.add(w);
    }
    for (let i = 0; i < 8; i++) {
      const s = freeSpot(rnd, blocked, 40); if (!s) continue;
      const b = makeBench(rnd); b.position.set(s.x, 0, s.z); b.rotation.y = s.a; g.add(b);
    }
    for (let i = 0; i < 8; i++) {
      const s = freeSpot(rnd, blocked, 43); if (!s) continue;
      const l = makeLamp(rnd, false); l.position.set(s.x, 0, s.z); l.rotation.y = rnd() * 6.28; g.add(l);
    }
    for (let i = 0; i < 6; i++) {
      const s = freeSpot(rnd, blocked, 42); if (!s) continue;
      const p = makePlanter(rnd); p.position.set(s.x, 0, s.z); g.add(p);
    }
    for (let i = 0; i < 8; i++) {
      const s = freeSpot(rnd, blocked, 40); if (!s) continue;
      const b = makeBarrier(rnd); b.position.set(s.x, 0, s.z); b.rotation.y = s.a; g.add(b);
    }
    // Horizontes de ciudad: sólo silueta, a mucha distancia. Cada torre es una
    // sola geometría, así que 16 torres cuestan 16 draw calls y no 200.
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2, r = 62 + rnd() * 34;
      const t = makeTowerBlock(rnd);
      t.position.set(Math.cos(a) * r, -6 - rnd() * 12, Math.sin(a) * r);
      t.rotation.y = rnd() * 6.28; g.add(t);
    }
  },
  // ---- CHATARRERÍA: vertedero de maquinaria. Montones, neumáticos, restos. --
  waste: (g, rnd, blocked) => {
    makeGroundPatches(g, rnd, 0x5c5344, 32, 42);
    makeRoadMarks(g, rnd, 0xbdb49a, 40);
    for (let i = 0; i < 16; i++) {
      const s = freeSpot(rnd, blocked, 44); if (!s) continue;
      const h = makeScrapHeap(rnd); h.position.set(s.x, 0, s.z); h.rotation.y = rnd() * 6.28; g.add(h);
    }
    for (let i = 0; i < 10; i++) {
      const s = freeSpot(rnd, blocked, 42); if (!s) continue;
      const t = makeTireStack(rnd); t.position.set(s.x, 0, s.z); t.rotation.y = rnd() * 6.28; g.add(t);
    }
    for (let i = 0; i < 8; i++) {
      const s = freeSpot(rnd, blocked, 43); if (!s) continue;
      const w = makeWreck(rnd); w.position.set(s.x, 0, s.z); w.rotation.y = s.a; g.add(w);
    }
    for (let i = 0; i < 10; i++) {
      const s = freeSpot(rnd, blocked, 42); if (!s) continue;
      const c = makeCrate(rnd); c.position.set(s.x, 0, s.z); c.rotation.y = rnd() * 6.28; g.add(c);
    }
    for (let i = 0; i < 8; i++) {
      const s = freeSpot(rnd, blocked, 42); if (!s) continue;
      const c = makeContainer(rnd); c.position.set(s.x, 0, s.z); c.rotation.y = s.a; g.add(c);
    }
    for (let i = 0; i < 7; i++) {
      const s = freeSpot(rnd, blocked, 43); if (!s) continue;
      const l = makeLamp(rnd, true); l.position.set(s.x, 0, s.z); l.rotation.y = rnd() * 6.28; g.add(l);
    }
    for (let i = 0; i < 10; i++) {
      const s = freeSpot(rnd, blocked, 40); if (!s) continue;
      const b = makeBarrier(rnd); b.position.set(s.x, 0, s.z); b.rotation.y = s.a; g.add(b);
    }
    for (let i = 0; i < 10; i++) {
      const s = freeSpot(rnd, blocked, 40); if (!s) continue;
      const c = makeCone(rnd); c.position.set(s.x, 0, s.z); g.add(c);
    }
    for (let i = 0; i < 2; i++) {
      const a = rnd() * Math.PI * 2, r = 46 + rnd() * 12;
      const c = makeCrane(rnd); c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); c.rotation.y = -a; g.add(c);
    }
  }
};

// ---------------------------------------------------------------------------
// Utilería nueva para los sectores AGUJA y CHATARRERÍA.
const METALS = [0x8a9096, 0x6f767c, 0x9a8f7c, 0x7d6f5c, 0x5f686e];
function metalMat(rnd, rough = .6) { return mat(METALS[Math.floor(rnd() * METALS.length)], rough, .55); }

// Columna de cristal: estructura fina, panel translúcido y zócalo iluminado.
function makePillar(rnd) {
  const h = 4.5 + rnd() * 4;
  const steel = metalMat(rnd, .45);
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fb4c4, roughness: .12, metalness: .8, transparent: true, opacity: .42 });
  const base = mat(0x4a545c, .8, .4);
  const strip = new THREE.MeshStandardMaterial({ color: 0x2c3a40, emissive: 0x6ef7e7, emissiveIntensity: 1.1, roughness: .3 });
  const parts = [
    { geo: boxCache, mat: base, size: [1.5, .25, 1.5], pos: [0, .12, 0], rot: null },
    { geo: boxCache, mat: steel, size: [1.4, .18, 1.4], pos: [0, h + .3, 0], rot: null },
    { geo: boxCache, mat: strip, size: [1.3, .06, 1.3], pos: [0, .32, 0], rot: null }
  ];
  for (const [x, z] of [[-.55, -.55], [.55, -.55], [-.55, .55], [.55, .55]]) parts.push({ geo: boxCache, mat: steel, size: [.12, h, .12], pos: [x, h / 2 + .2, z], rot: null });
  const g = bakeProp(parts);
  // El panel de cristal va aparte: es translúcido y no debe proyectar sombra.
  const panel = new THREE.Mesh(stamp(boxCache, [1.2, h - .4, 1.2], [0, h / 2 + .2, 0], null), glass);
  panel.castShadow = false; panel.receiveShadow = false;
  g.add(panel);
  return g;
}
// Pasarela elevada: una sola pieza de acero.
function makeCatwalk(rnd) {
  const steel = metalMat(rnd, .5);
  const len = 3 + rnd() * 3;
  const parts = [
    { geo: boxCache, mat: steel, size: [len, .16, 1.3], pos: [0, .95, 0], rot: null },
    { geo: boxCache, mat: steel, size: [.22, .95, .22], pos: [-len / 2 + .2, .48, 0], rot: null },
    { geo: boxCache, mat: steel, size: [.22, .95, .22], pos: [len / 2 - .2, .48, 0], rot: null }
  ];
  for (const s of [-1, 1]) {
    parts.push({ geo: boxCache, mat: steel, size: [.1, .9, .1], pos: [-len / 2 + .2, .5, s * .55], rot: null });
    parts.push({ geo: boxCache, mat: steel, size: [.1, .9, .1], pos: [len / 2 - .2, .5, s * .55], rot: null });
    parts.push({ geo: boxCache, mat: steel, size: [len, .08, .08], pos: [0, 1.35, s * .55], rot: null });
  }
  return bakeProp(parts);
}
// ---------------------------------------------------------------------------
// FUSIÓN DE PROPS: los props compuestos (torres, chatarra, neumáticos, restos)
// se hornean en UNA sola geometría por material. Es la diferencia entre cientos
// de draw calls y uno por prop. Se hace aquí porque son decorado: no se animan.
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function stamp(geo, size, pos, rot) {
  const g = geo.clone();
  _v.set(pos[0], pos[1], pos[2]);
  _e.set(rot ? rot[0] || 0 : 0, rot ? rot[1] || 0 : 0, rot ? rot[2] || 0 : 0);
  _q.setFromEuler(_e);
  _m4.compose(_v, _q, _s.set(size[0], size[1], size[2]));
  g.applyMatrix4(_m4);
  return g;
}
// Devuelve un grupo con una malla por material distinto.
function bakeProp(parts, shadows = true) {
  const g = new THREE.Group();
  const byMat = new Map();
  for (const p of parts) {
    const key = p.mat.uuid;
    if (!byMat.has(key)) byMat.set(key, { mat: p.mat, geos: [] });
    byMat.get(key).geos.push(stamp(p.geo, p.size, p.pos, p.rot));
  }
  for (const { mat: m, geos } of byMat.values()) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (geos.length > 1) geos.forEach(x => x.dispose());
    merged.userData.shared = true;
    const mesh = new THREE.Mesh(merged, m);
    mesh.castShadow = shadows; mesh.receiveShadow = shadows;
    g.add(mesh);
  }
  return g;
}

// Torre lejana: una sola geometría. Se ve, no se usa.
function makeTowerBlock(rnd) {
  const h = 18 + rnd() * 46, w = 5 + rnd() * 8;
  const body = mat(0x59616b, .9, .15);
  const win = new THREE.MeshStandardMaterial({ color: 0x3a4a54, emissive: 0x8fd8e8, emissiveIntensity: .5, roughness: .4 });
  const rows = Math.min(7, Math.max(3, Math.floor(h / 6)));
  const parts = [{ geo: boxCache, mat: body, size: [w, h, w], pos: [0, h / 2, 0], rot: null }];
  for (let i = 0; i < rows; i++) parts.push({ geo: boxCache, mat: win, size: [w * .86, .5, w * .86], pos: [0, 3 + i * (h / (rows + 1)), 0], rot: null });
  // Lejos: no proyecta sombra, no merece el coste.
  return bakeProp(parts, false);
}
// Montón de chatarra: bloques apilados fundidos en una pieza.
function makeScrapHeap(rnd) {
  const n = 3 + Math.floor(rnd() * 5);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const w = .7 + rnd() * 1.5, h = .4 + rnd() * .9, d = .7 + rnd() * 1.3;
    parts.push({ geo: boxCache, mat: metalMat(rnd, .75), size: [w, h, d], pos: [(rnd() - .5) * 1.8, h / 2 + i * .28, (rnd() - .5) * 1.8], rot: [0, rnd() * 3, (rnd() - .5) * .25] });
  }
  return bakeProp(parts);
}
// Pila de neumáticos: una sola pieza.
function makeTireStack(rnd) {
  const rubber = mat(0x1b1e21, .95, .05);
  const n = 2 + Math.floor(rnd() * 4);
  const parts = [];
  for (let i = 0; i < n; i++) parts.push({ geo: cylCache, mat: rubber, size: [1.24, .34, 1.24], pos: [0, .18 + i * .32, 0], rot: [0, rnd() * .6, 0] });
  return bakeProp(parts);
}
// Resto de vehículo: esqueleto de coche en una pieza.
function makeWreck(rnd) {
  const rust = mat([0x7a4a32, 0x6b5340, 0x5a4a44][Math.floor(rnd() * 3)], .92, .2);
  const dark = mat(0x2a2a2c, .9, .3);
  const parts = [
    { geo: boxCache, mat: rust, size: [2.1, .62, 1.0], pos: [0, .55, 0], rot: null },
    { geo: boxCache, mat: rust, size: [1.15, .52, .92], pos: [-.25, 1.05, 0], rot: null },
    { geo: boxCache, mat: dark, size: [1.0, .42, .86], pos: [-.25, 1.06, -.02], rot: null },
    { geo: boxCache, mat: rust, size: [.5, .3, .95], pos: [.9, .95, 0], rot: [0, 0, .25] },
    { geo: boxCache, mat: dark, size: [.3, .3, .3], pos: [-.7, .2, .5], rot: [rnd(), rnd(), rnd()] },
    { geo: boxCache, mat: dark, size: [.3, .3, .3], pos: [.7, .2, -.5], rot: [rnd(), rnd(), rnd()] }
  ];
  return bakeProp(parts);
}

// Un punto en el plano XZ está dentro de la huella orientada del colisionador.
function insideFoot(c, x, z, pad = 0) {
  const dx = x - c.x, dz = z - c.z;
  const lx = c.cos * dx - c.sin * dz, lz = c.sin * dx + c.cos * dz;
  return Math.abs(lx) < c.hw + pad && Math.abs(lz) < c.hd + pad;
}

export function buildEnvironment(level, rnd, blockedRects, outColliders) {
  const g = new THREE.Group();
  const builder = STYLES[level.style] || STYLES.plaza;
  builder(g, rnd, blockedRects || []);
  // Solo los volúmenes grandes proyectan sombra: el resto ensuciaría el mapa de sombras.
  g.traverse(o => {
    if (!o.isMesh) return;
    const v = o.scale.x * o.scale.y * o.scale.z;
    o.castShadow = v > 2.4;
    o.receiveShadow = v > 12;
  });

  // ------------------------------------------------------------------
  // Colisionadores: cada prop declara `userData.foot = [hw, hd, alto]`.
  // Se recogen aquí (y no al colocarlos) para que la utilería siga siendo
  // datos puro y el juego decida qué hace con las huellas.
  if (outColliders) {
    const raw = [];
    for (const o of g.children) {
      const f = o.userData && o.userData.foot;
      if (!f) continue;                       // toldos, manchas de suelo, agua...
      const a = o.rotation.y || 0;
      raw.push({
        x: o.position.x, z: o.position.z, a,
        hw: f[0], hd: f[1], h: f[2],
        cos: Math.cos(a), sin: Math.sin(a),
        r: Math.hypot(f[0], f[1]),
        obj: o
      });
    }
    // Los volúmenes grandes ganan: si uno pequeño nace dentro de uno grande,
    // se oculta (un árbol dentro de un contenedor no se ve y no bloquea).
    raw.sort((p, q) => (q.hw * q.hd) - (p.hw * p.hd));
    for (const c of raw) {
      let clash = false;
      for (const k of outColliders) {
        if (insideFoot(k, c.x, c.z, .35) || insideFoot(c, k.x, k.z, -.2)) { clash = true; break; }
      }
      if (clash) { c.obj.visible = false; continue; }
      outColliders.push(c);
    }
  }
  return g;
}
