// MUNDO 7 — «REINO HEXAGONAL» · Kenney Hexagon Kit
// ---------------------------------------------------------------------------
// Gran isla de baldosas hexagonales: praderas, bosques, colinas, caminos de
// tierra, rio con puente, montañas nevadas al norte y costa de arena al sur
// con puerto y barcos. Coronada por castillo amurallado, torres de mago,
// molino de viento, aldea, granja y mercado.
//
// TESELADO: el paso y el ancho del hexagono se MIDEN con la caja delimitadora
// del GLB (sizeOf) y se decide la orientacion (punta arriba o plano arriba);
// el hueco residual se disimula con un disco base oscuro que lee como junteo.
// Edificios y arboles se colocan SOLO sobre celdas libres (rejilla de
// ocupacion, como en el Mundo 2). Oceano estilizado rodea toda la isla.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { UNIT, ARENA } from './registry.js';

export const MODELS = [
  'grass', 'grass-forest', 'grass-hill', 'dirt', 'dirt-lumber',
  'sand', 'sand-rocks', 'stone', 'stone-hill', 'stone-mountain', 'stone-rocks',
  'water', 'water-rocks',
  'path-start', 'path-straight', 'path-end', 'path-corner', 'path-corner-sharp',
  'path-crossing', 'path-intersectionA', 'path-square', 'path-square-end',
  'bridge', 'unit-tree', 'unit-ship', 'unit-ship-large', 'unit-tower',
  'building-castle', 'building-walls', 'building-wizard-tower', 'building-mill',
  'building-house', 'building-cabin', 'building-village', 'building-farm',
  'building-market', 'building-sheep', 'building-mine', 'building-smelter',
  'building-archery', 'building-tower', 'building-port', 'building-dock',
  'building-watermill', 'unit-mill', 'unit-wall-tower'
];

const S = UNIT;
const OCEAN = 0x4f9fd4;

export function buildWorld7(c) {
  const R = c.rnd;
  const rand = (a, b) => a + (b - a) * R();
  const pick = arr => arr[Math.floor(R() * arr.length) % arr.length];
  const safe = (x, z, r = 9) => Math.hypot(x, z - 4) > r;

  // ------------------------------------------------- base + océano ---------
  const oceanMat = new THREE.MeshStandardMaterial({
    color: OCEAN, roughness: .55, metalness: 0, transparent: true, opacity: .95
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), oceanMat);
  ocean.rotation.x = -Math.PI / 2; ocean.position.y = -.55;
  ocean.receiveShadow = false; ocean.name = 'W7_ocean';
  c.root.add(ocean); c.stats.meshes++;
  // Disco base oscuro bajo la isla: disimula el junteo entre hexágonos.
  const base = new THREE.Mesh(new THREE.CircleGeometry(50, 40),
    new THREE.MeshStandardMaterial({ color: 0x4f7a48, roughness: .97, metalness: 0 }));
  base.rotation.x = -Math.PI / 2; base.position.y = -.2;
  base.receiveShadow = true; base.name = 'W7_island_base';
  c.root.add(base); c.stats.meshes++;

  // --------------------------------------------------- rejilla hexagonal ---
  // Paso y orientacion medidos con la caja delimitadora del GLB.
  const hw = c.sizeOf('grass').x * S, hd = c.sizeOf('grass').z * S;
  const pointy = hw <= hd;                        // hexágono con punta arriba
  const dx = pointy ? hw * 1.0 : hw * .78;
  const dz = pointy ? hd * .78 : hd * 1.0;
  const tiles = [];
  const ROWS = 26, COLS = 30;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = (col - (COLS - 1) / 2) * dx + (pointy && row % 2 ? dx * .5 : 0);
      const z = (row - (ROWS - 1) / 2) * dz + (!pointy && col % 2 ? dz * .5 : 0);
      const dist = Math.hypot(x, z * 1.05);
      const noise = Math.sin(x * .21 + 1.3) * 3 + Math.cos(z * .17 - .7) * 3;
      if (dist + noise > 58) continue;
      tiles.push({ x, z, dist, island: dist + noise < 41, row, col });
    }
  }
  // Ocupacion: una celda hexagonal = un edificio/arbol como maximo.
  const used = new Set();
  const keyOf = (x, z) => Math.round(x * 3) + '_' + Math.round(z * 3);
  const nearTile = (px, pz, maxD) => {
    let best = null, bd = 1e9;
    for (const t of tiles) {
      if (!t.island || used.has(keyOf(t.x, t.z))) continue;
      const d = Math.hypot(t.x - px, t.z - pz);
      if (d < bd) { bd = d; best = t; }
    }
    return bd <= maxD ? best : null;
  };

  // Asignación de biomas por celda.
  const types = new Map();
  for (const t of tiles) {
    let type = 'grass';
    const dMt = Math.hypot(t.x, t.z + 26);
    if (!t.island) type = t.dist < 46 ? 'sand' : 'water';
    else if (dMt < 9) type = 'stone-mountain';
    else if (dMt < 16) type = pick(['stone-hill', 'stone', 'stone-hill']);
    else if (t.z > 34 && t.dist > 30) type = 'sand';
    else if (Math.sin(t.x * .35) * Math.cos(t.z * .3) > .55) type = 'grass-forest';
    else if (Math.abs(t.x + 18) < 6 && t.z > -4 && t.z < 18) type = 'dirt';
    // Rio: columna de agua desde la montaña hasta la costa sur.
    const rx = 6 + Math.sin(t.z * .12) * 5;
    if (t.island && Math.abs(t.x - rx) < dx * .55 && t.z > -18) type = 'water';
    types.set(t, type);
  }
  // Caminos de tierra: dos rutas rectas-codificadas sobre celdas de hierba.
  const markRoad = (ax, az, bx, bz) => {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / (dx * .6));
    for (let k = 0; k <= steps; k++) {
      const t0 = tiles.find(t => Math.hypot(t.x - (ax + (bx - ax) * k / steps),
        t.z - (az + (bz - az) * k / steps)) < dx * .6 && t.island);
      if (!t0 || !safe(t0.x, t0.z, 8)) continue;
      const cur = types.get(t0);
      if (cur !== 'grass' && cur !== 'grass-forest' && cur !== 'dirt') continue;
      const a = Math.atan2(bz - az, bx - ax);
      const yaw = Math.round(a / (Math.PI / 3)) * (Math.PI / 3);
      types.set(t0, { path: yaw });
    }
  };
  markRoad(-8, 20, 8, -14);
  markRoad(0, 10, 10, 34);
  markRoad(-18, 6, -30, 16);

  // Instanciado por tipo de loseta.
  const batch = new Map();
  const push = (model, t) => {
    if (!batch.has(model)) batch.set(model, []);
    batch.get(model).push(t);
  };
  for (const t of tiles) {
    const type = types.get(t);
    const yaw = R() * 6.28;
    if (typeof type === 'object') {          // loseta de camino con orientacion
      push('path-straight', { x: t.x, y: 0, z: t.z, scale: S, yaw: type.yaw });
      continue;
    }
    const y = type === 'water' ? -.42 : (type === 'sand' ? -.12 : 0);
    const model = type === 'stone-mountain' ? 'stone-hill' : type;
    push(model, { x: t.x, y, z: t.z, scale: S, yaw });
    if (type === 'grass-forest' && R() < .5) {
      push('unit-tree', { x: t.x + rand(-.4, .4) * S, y: .05, z: t.z + rand(-.4, .4) * S,
        scale: S * rand(.8, 1.15), yaw });
      if (safe(t.x, t.z, 12)) c.solid(t.x, t.z, S * .3, S * .3, S * 1.5);
    }
    if (type === 'grass' && R() < .08) {
      push('grass-hill', { x: t.x, y: 0, z: t.z, scale: S, yaw });
      c.platform(t.x, t.z, S * .4, S * .4, c.sizeOf('grass-hill').y * S);
    }
    if (type === 'sand' && R() < .18) push('sand-rocks', { x: t.x, y: -.1, z: t.z, scale: S * .8, yaw });
    if (type === 'water' && R() < .12) push('water-rocks', { x: t.x, y: -.4, z: t.z, scale: S * .7, yaw });
    if (type === 'stone-hill' || type === 'stone') c.platform(t.x, t.z, S * .4, S * .4, c.sizeOf('stone-hill').y * S * .8);
    if (type === 'stone-mountain') c.platform(t.x, t.z, S * .45, S * .45, c.sizeOf('stone-hill').y * S);
  }
  for (const [model, ts] of batch) c.batch(model, ts);

  // Montaña nevada norte: roca grande sobre su clúster + plataformas.
  const mtH = c.sizeOf('stone-mountain').y * S * 1.7;
  c.one('stone-mountain', 0, 0, -26, { scale: S * 1.7, yaw: .4 });
  c.platform(0, -26, S * 1.1, S * 1.1, mtH);
  c.solid(0, -26, S * 1.2, S * 1.2, mtH);
  c.ramp(0, -18.5, S * .8, S * 1.6, 0, mtH * .8, 14, 'z');
  c.one('stone-rocks', 6, 0, -20, { scale: S, yaw: 1.1 });

  // Puente sobre el rio (celda de agua en la ruta del camino sur).
  const bridgeTile = nearTile(8, 22, dx * 1.5);
  if (bridgeTile) c.one('bridge', bridgeTile.x, -.1, bridgeTile.z, { scale: S * 1.1, yaw: Math.PI / 2 });
  c.platform(bridgeTile ? bridgeTile.x : 8, bridgeTile ? bridgeTile.z : 22, S * .5, S * .5, .5);

  // ------------------------------------------------------- edificios -------
  // SOLO sobre celdas libres de la isla: rejilla de ocupacion.
  const place = (model, px, pz, sc, yaw) => {
    const t = nearTile(px, pz, dx * 1.6);
    if (!t) return null;
    used.add(keyOf(t.x, t.z));
    const h = c.sizeOf(model).y * sc;
    c.one(model, t.x, 0, t.z, { scale: sc, yaw });
    const rot = Math.abs(Math.sin(yaw)) > .5;
    c.solid(t.x, t.z, (rot ? c.sizeOf(model).z : c.sizeOf(model).x) * sc * .45,
      (rot ? c.sizeOf(model).x : c.sizeOf(model).z) * sc * .45, h, yaw);
    return t;
  };
  // Castillo amurallado al noreste del centro.
  const castle = place('building-castle', 10, -12, S * 1.5, .5);
  if (castle) {
    for (const [ox, oz, yaw] of [[-S * 1.6, S * .8, 0], [S * 1.6, S * .8, 0], [-S * 1.6, -S * .8, 0], [S * 1.6, -S * .8, 0]]) {
      const t = nearTile(castle.x + ox, castle.z + oz, dx);
      if (!t) continue;
      used.add(keyOf(t.x, t.z));
      c.one('building-walls', t.x, 0, t.z, { scale: S * 1.2, yaw });
      c.solid(t.x, t.z, S * .8, S * .4, c.sizeOf('building-walls').y * S * 1.2, yaw);
    }
    c.one('unit-wall-tower', castle.x - S * 2.4, 0, castle.z, { scale: S * 1.1, yaw: 0 });
    c.one('unit-wall-tower', castle.x + S * 2.4, 0, castle.z, { scale: S * 1.1, yaw: 0 });
  }
  place('building-wizard-tower', -26, -8, S * 1.3, 1.2);
  place('building-wizard-tower', 26, 12, S * 1.3, -.6);
  place('building-mill', -32, 18, S * 1.2, .9);
  place('unit-mill', -28, 22, S * .9, 1.6);
  place('building-village', -6, 22, S * 1.15, .2);
  place('building-market', 2, 8, S * 1.05, -.3);
  place('building-farm', 18, -2, S * 1.1, .6);
  place('building-sheep', 24, 4, S * 1.0, 1.4);
  place('building-mine', 20, -22, S * 1.05, 2.0);
  place('building-smelter', 24, -18, S * .95, 2.4);
  place('building-archery', -20, 4, S * 1.0, .1);
  place('building-house', -14, 12, S * .95, .4);
  place('building-house', 12, 18, S * .95, 1.1);
  place('building-cabin', -8, -24, S * .9, -.8);
  place('building-cabin', -14, -30, S * .9, .5);
  place('building-tower', -36, -18, S * 1.0, 1.7);
  place('building-tower', 36, 22, S * 1.0, -.9);
  place('building-watermill', 12, 26, S * 1.1, .8);
  // Puerto y barcos en la costa sur (celdas de agua/arena).
  place('building-port', 12, 36, S * 1.1, 0);
  place('building-dock', 6, 38, S * 1.0, 0);
  const shipA = nearTile(16, 42, dx * 2), shipB = nearTile(24, 40, dx * 2);
  if (shipA) c.one('unit-ship', shipA.x, -.35, shipA.z, { scale: S * 1.05, yaw: 1.9 });
  if (shipB) c.one('unit-ship-large', shipB.x, -.35, shipB.z, { scale: S * 1.15, yaw: 2.4 });
  // Torres de vigilancia sueltas.
  for (const [x, z] of [[-40, 30], [40, -30]]) {
    const t = nearTile(x, z, dx * 2);
    if (t && safe(t.x, t.z, 14)) {
      used.add(keyOf(t.x, t.z));
      c.one('unit-tower', t.x, 0, t.z, { scale: S * .9, yaw: R() * 6.28 });
      c.solid(t.x, t.z, S * .4, S * .4, c.sizeOf('unit-tower').y * S * .9);
    }
  }

  // ------------------------------------------------------------- fondo ----
  // Reino flotante: islotes hexagonales suspendidos sobre el oceano (losetas
  // del kit + arbol/torre, mismos recursos del reino) y cumulus mate claros.
  // Decoracion pura: fuera de ±62, sin colision ni sombra util.
  const hexIsle = (a, r, y, sc, tile, prop) => {
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const hs = S * sc;
    const th = c.sizeOf(tile).y * hs;
    c.one(tile, x, y, z, { scale: hs, yaw: 0 });
    if (prop) c.one(prop, x + hs * .12, y + th, z - hs * .08,
      { scale: hs * .75, yaw: a * 2 });
  };
  hexIsle(0.9, 74, 14, 2.6, 'grass-forest', 'unit-tree');
  hexIsle(2.1, 88, 22, 3.2, 'grass', 'unit-tower');
  hexIsle(3.3, 70, 10, 2.0, 'stone-mountain', null);
  hexIsle(4.5, 92, 18, 2.8, 'grass-forest', 'unit-tree');
  hexIsle(5.4, 78, 12, 2.2, 'grass', 'unit-tree');
  c.clouds({ count: 12, y: 34, rMin: 64, rMax: 100, color: 0xf4f9fc, scale: 7.5 });
}
