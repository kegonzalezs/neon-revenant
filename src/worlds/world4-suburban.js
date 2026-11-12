// MUNDO 4 — «BARRIO RESIDENCIAL» · Kenney City Kit Suburban
// ---------------------------------------------------------------------------
// Barrio con calles asfaltadas, aceras, pasos de cebra, rotondas con arbolado
// y manzanas de casas con tejados verdes/grises, cercas de madera, caminos y
// plantadores. city-kit-suburban NO trae piezas de carretera: el asfalto, las
// aceras y los pasos de cebra son mallas procedurales MATE (InstancedMesh /
// planos), igual de baratas en draw calls que el resto del diorama.
//
// Manzanas entre calles: los edificios se apoyan con margen sobre la acera y
// cada uno publica huella solida. El spawn (0,4) cae en el cruce central,
// siempre despejado.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { UNIT, ARENA } from './registry.js';

export const MODELS = [
  'building-type-a', 'building-type-b', 'building-type-c', 'building-type-d',
  'building-type-e', 'building-type-f', 'building-type-g', 'building-type-h',
  'building-type-i', 'building-type-j', 'building-type-k', 'building-type-l',
  'building-type-m', 'building-type-n', 'building-type-o', 'building-type-p',
  'building-type-q', 'building-type-r', 'building-type-s', 'building-type-t',
  'building-type-u',
  'driveway-long', 'driveway-short', 'path-long', 'path-short',
  'path-stones-long', 'path-stones-messy', 'path-stones-short',
  'fence-1x2', 'fence-1x3', 'fence-1x4', 'fence-2x2', 'fence-2x3',
  'fence-3x2', 'fence-3x3', 'fence-low', 'fence',
  'planter', 'tree-large', 'tree-small'
];

const S = UNIT;
const ASPHALT = 0x565b5e, SIDEWALK = 0x9ba1a5, ZEBRA = 0xd8dcd8;

export function buildWorld4(c) {
  const R = c.rnd;
  const rand = (a, b) => a + (b - a) * R();
  const pick = arr => arr[Math.floor(R() * arr.length) % arr.length];
  const safe = (x, z, r = 10) => Math.hypot(x, z - 4) > r;

  // ------------------------------------------------------------- césped base
  c.platform(0, 0, ARENA, ARENA, 0);
  const grass = new THREE.MeshStandardMaterial({ color: 0x7d9070, roughness: .96, metalness: 0 });
  c.mesh(new THREE.PlaneGeometry(150, 150), grass, 0, -.02, 0,
    { rotX: -Math.PI / 2, name: 'W4_town_grass' });

  // ------------------------------------------------ calles, aceras, cebra ---
  // Rejilla de 3 avenidas por eje (x/z = -24, 0, 24). Asfalto y aceras son
  // planos; los pasos de cebra van en UN InstancedMesh (cien rayas, un draw).
  const roadMat = new THREE.MeshStandardMaterial({ color: ASPHALT, roughness: .95, metalness: 0 });
  const walkMat = new THREE.MeshStandardMaterial({ color: SIDEWALK, roughness: .96, metalness: 0 });
  for (const cx of [-24, 0, 24]) {
    c.mesh(new THREE.PlaneGeometry(8, ARENA * 2), roadMat, cx, .02, 0, { rotX: -Math.PI / 2, name: 'W4_road_v' });
    c.mesh(new THREE.PlaneGeometry(ARENA * 2, 8), roadMat, 0, .02, cx, { rotX: -Math.PI / 2, name: 'W4_road_h' });
    for (const o of [-5.2, 5.2]) {
      c.mesh(new THREE.PlaneGeometry(2.4, ARENA * 2), walkMat, cx + o, .05, 0, { rotX: -Math.PI / 2, name: 'W4_walk_v' });
      c.mesh(new THREE.PlaneGeometry(ARENA * 2, 2.4), walkMat, 0, .05, cx + o, { rotX: -Math.PI / 2, name: 'W4_walk_h' });
    }
  }
  // Pasos de cebra: franjas blancas a ambos lados de cada cruce.
  const stripeGeo = new THREE.PlaneGeometry(.85, 6.6);
  const stripeMat = new THREE.MeshStandardMaterial({ color: ZEBRA, roughness: .95, metalness: 0 });
  const stripes = [];
  for (const cx of [-24, 0, 24]) for (const cz of [-24, 0, 24]) {
    for (const o of [-5.6, 5.6]) {
      for (let k = -2; k <= 2; k++) {
        stripes.push({ x: cx + k * 1.5, z: cz + o, rot: -Math.PI / 2 });   // cruces E-O
        stripes.push({ x: cx + o, z: cz + k * 1.5, rot: 0 });              // cruces N-S
      }
    }
  }
  const stripeIM = new THREE.InstancedMesh(stripeGeo, stripeMat, stripes.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    stripes.forEach((st, i) => {
      e.set(-Math.PI / 2, 0, st.rot); q.setFromEuler(e);
      v.set(st.x, .06, st.z);
      m.compose(v, q, sc); stripeIM.setMatrixAt(i, m);
    });
    stripeIM.instanceMatrix.needsUpdate = true;
    stripeIM.receiveShadow = true; stripeIM.name = 'W4_zebra';
  }
  c.root.add(stripeIM); c.stats.meshes++; c.stats.drawCalls++;

  // --------------------------------------------------- manzanas y casas -----
  // 16 manzanas entre avenidas; casas del kit con margen sobre la acera y
  // huella solida. Tipos variados (tejados verdes y grises como la ref.).
  const blocks = [];
  for (const bx of [-37, -12, 12, 37]) for (const bz of [-37, -12, 12, 37]) {
    blocks.push({ bx, bz, w: Math.abs(bx) === 12 ? 12 : 14, d: Math.abs(bz) === 12 ? 12 : 14 });
  }
  const houses = new Map();
  const placeHouse = (x, z, yaw) => {
    const model = 'building-type-' + 'abcdefghijklmnopqrstu'[Math.floor(R() * 21)];
    if (!houses.has(model)) houses.set(model, []);
    const sc = S * rand(1.05, 1.25);
    houses.get(model).push({ x, y: .03, z, scale: sc, yaw });
    const bw = c.sizeOf(model).x * sc * .5 + .4;
    const bd = c.sizeOf(model).z * sc * .5 + .4;
    const bh = c.sizeOf(model).y * sc;
    const rot = Math.abs(Math.sin(yaw)) > .5;
    c.solid(x, z, rot ? bd : bw, rot ? bw : bd, bh, yaw);
  };
  for (const bl of blocks) {
    const n = 2 + Math.floor(R() * 2);
    for (let k = 0; k < n; k++) {
      const x = bl.bx + rand(-bl.w * .28, bl.w * .28);
      const z = bl.bz + rand(-bl.d * .28, bl.d * .28);
      if (!safe(x, z, 9)) continue;
      placeHouse(x, z, (Math.floor(R() * 4)) * Math.PI / 2);
    }
    // Camino de entrada desde la acera + piedras sueltas.
    if (R() < .8) c.one('driveway-long', bl.bx + rand(-3, 3), .03, bl.bz + (bl.bz > 0 ? bl.d * .62 : -bl.d * .62),
      { scale: S * .9, yaw: bl.bz > 0 ? 0 : Math.PI });
    if (R() < .6) c.one('path-stones-messy', bl.bx + rand(-4, 4), .03, bl.bz + rand(-4, 4),
      { scale: S * .8, yaw: R() * 6.28 });
  }
  for (const [model, ts] of houses) c.batch(model, ts);

  // ------------------------------------------------------ cercas y arbolado
  // Cercas de madera perimetrales en el borde exterior de las manzanas y
  // arbolado urbano junto a las aceras + plantadores en los cruces.
  const fences = new Map();
  const addFence = (model, x, z, yaw) => {
    if (!fences.has(model)) fences.set(model, []);
    fences.get(model).push({ x, y: .03, z, scale: S, yaw });
  };
  for (const bl of blocks) {
    const model = pick(['fence-1x3', 'fence-1x4', 'fence-2x3', 'fence-low']);
    for (const o of [-1, 1]) {
      addFence(model, bl.bx, bl.bz + o * bl.d * .62, 0);
      addFence(model, bl.bx + o * bl.w * .62, bl.bz, Math.PI / 2);
    }
  }
  for (const [model, ts] of fences) c.batch(model, ts);
  const treesBig = [], treesSmall = [];
  for (let k = 0; k < 46; k++) {
    const x = rand(-42, 42), z = rand(-42, 42);
    if (!safe(x, z, 9) || Math.min(Math.abs(Math.abs(x) - 24), Math.abs(Math.abs(z) - 24)) < 4) continue;
    (R() < .4 ? treesBig : treesSmall).push({ x, y: .03, z, scale: S * rand(.8, 1.2), yaw: R() * 6.28 });
    if (safe(x, z, 12) && R() < .6) c.solid(x, z, S * .4, S * .4, S * 1.6);
  }
  // Rotondas: plantador con arbol en las 4 esquinas de cada cruce.
  for (const cx of [-24, 0, 24]) for (const cz of [-24, 0, 24]) {
    for (const [ox, oz] of [[-6.8, -6.8], [6.8, -6.8], [-6.8, 6.8], [6.8, 6.8]]) {
      c.one('planter', cx + ox, .03, cz + oz, { scale: S * .9, yaw: 0 });
      if (R() < .7) treesSmall.push({ x: cx + ox, y: .5, z: cz + oz, scale: S * .7, yaw: R() * 6.28 });
    }
  }
  c.batch('tree-large', treesBig);
  c.batch('tree-small', treesSmall);

  // ---------------------------------------------- bordes cerrados ----------
  // Cinta de cercas altas en ±45.5 + césped que cae suavemente: el barrio se
  // lee como maqueta cerrada sin cortes de camara.
  const rim = [];
  for (let d = -44; d <= 44; d += S) {
    rim.push({ x: d, y: 0, z: -45.6, scale: S, yaw: 0 });
    rim.push({ x: d, y: 0, z: 45.6, scale: S, yaw: 0 });
    rim.push({ x: -45.6, y: 0, z: d, scale: S, yaw: Math.PI / 2 });
    rim.push({ x: 45.6, y: 0, z: d, scale: S, yaw: Math.PI / 2 });
  }
  c.batch('fence-3x3', rim);
  const apron = new THREE.Mesh(new THREE.RingGeometry(ARENA + 1, ARENA + 30, 48),
    new THREE.MeshStandardMaterial({ color: 0x6f8264, roughness: .97, metalness: 0 }));
  apron.rotation.x = -Math.PI / 2; apron.position.y = -.12;
  apron.receiveShadow = false; apron.name = 'W4_apron';
  c.root.add(apron); c.stats.meshes++;

  // ------------------------------------------------------------- fondo ----
  // Cinturon arbolado sobre la apron exterior (mismos arboles del barrio,
  // escala mayor: linea de horizonte de suburbio) y cumulus mate cálidos.
  const belt = [];
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * Math.PI * 2 + (R() - .5) * .06;
    const r = ARENA + 10 + R() * 16;
    belt.push({
      x: Math.cos(a) * r, y: -.1, z: Math.sin(a) * r,
      scale: S * (1.6 + R() * .9), yaw: R() * 6.28
    });
  }
  c.batch('tree-large', belt.filter((_, k) => k % 2 === 0));
  c.batch('tree-small', belt.filter((_, k) => k % 2 === 1));
  c.clouds({ count: 12, y: 34, rMin: 66, rMax: 105, color: 0xf7f6f1, scale: 7.5 });
}
