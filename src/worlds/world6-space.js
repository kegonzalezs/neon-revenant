// MUNDO 6 — «COLONIA MARTE» · Kenney Space Kit
// ---------------------------------------------------------------------------
// Superficie marciana naranja mate con colinas transitables (terrain + rampas
// con plataformas por Box3), cráeres como calcomanías, rocas y cristales,
// monorraíl elevado con tren estacionado, módulos hangar blancos, antenas y
// estructuras solares, naves aparcadas, rovers y el COHETE CENTRAL apilado
// sección a sección usando la caja delimitadora de cada pieza.
//
// Cielo polvoriento #c96a4b (pastel desactivado en el registro) + niebla
// marciana. Acabado mate del gestor, ACES, PCFSoftShadowMap y dispose().
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { UNIT, ARENA } from './registry.js';

export const MODELS = [
  'terrain', 'terrain_ramp', 'terrain_rampLarge', 'terrain_side', 'terrain_sideCliff',
  'terrain_roadStraight', 'terrain_roadCorner', 'terrain_roadCross',
  'crater', 'craterLarge',
  'rock', 'rock_largeA', 'rock_largeB', 'rocks_smallA', 'rocks_smallB',
  'rock_crystals', 'rock_crystalsLargeA', 'meteor', 'meteor_detailed',
  'monorail_trackStraight', 'monorail_trackCornerLarge', 'monorail_trackSupport',
  'monorail_trainFront', 'monorail_trainBox', 'monorail_trainEnd',
  'rocket_baseA', 'rocket_fuelA', 'rocket_sidesA', 'rocket_fuelB',
  'rocket_sidesB', 'rocket_finsA', 'rocket_topA',
  'hangar_largeA', 'hangar_roundA', 'hangar_roundB', 'hangar_smallA',
  'machine_generator', 'machine_wireless', 'satelliteDish', 'satelliteDish_large',
  'structure', 'structure_closed', 'structure_detailed', 'supports_high',
  'craft_speederA', 'craft_speederB', 'craft_speederC', 'craft_cargoA',
  'craft_miner', 'rover',
  'turret_single', 'gate_simple', 'barrel', 'desk_computer'
];

const S = UNIT;
const MARS = 0xc97a54, MARS_DEEP = 0xa85f42;

export function buildWorld6(c) {
  const R = c.rnd;
  const rand = (a, b) => a + (b - a) * R();
  const pick = arr => arr[Math.floor(R() * arr.length) % arr.length];
  const safe = (x, z, r = 9) => Math.hypot(x, z - 4) > r;

  // ---------------------------------------------------------- superficie ---
  c.platform(0, 0, ARENA, ARENA, 0);
  const dust = new THREE.MeshStandardMaterial({ color: MARS, roughness: .96, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), dust);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.02;
  ground.receiveShadow = true; ground.name = 'W6_mars_surface';
  c.root.add(ground); c.stats.meshes++;

  // ------------------------------------------------- colinas transitables --
  // each mound: visual 'terrain' + plataforma con top REAL (Box3) + rampa
  // de terreno como acceso. Colinas bajas: la IA sube sin atascarse.
  const mounds = [
    { x: -28, z: -26, sc: S * 1.35 }, { x: 28, z: -30, sc: S * 1.2 },
    { x: -32, z: 24, sc: S * 1.15 }, { x: 30, z: 28, sc: S * 1.3 },
    { x: -8, z: -34, sc: S * 1.0 }, { x: 16, z: 14, sc: S * .9 }
  ];
  for (const m of mounds) {
    const th = c.sizeOf('terrain').y * m.sc;
    c.one('terrain', m.x, 0, m.z, { scale: m.sc, yaw: R() * 6.28 });
    c.platform(m.x, m.z, m.sc * .42, m.sc * .42, th);
    // Rampas de acceso desde el valle (escalones < step .65).
    c.ramp(m.x + m.sc * .5, m.z, m.sc * .3, m.sc * .5, 0, th, 14, 'x');
    c.one('terrain_rampLarge', m.x + m.sc * .72, 0, m.z,
      { scale: m.sc * .9, yaw: -Math.PI / 2 });
  }
  // Bordes de terreno en la corona: la meseta exterior cae en terrazas.
  const rimTiles = [];
  for (let k = 0; k < 26; k++) {
    const a = k / 26 * Math.PI * 2;
    const r = 44 + rand(-1, 1.5);
    rimTiles.push({ x: Math.cos(a) * r, y: -.35, z: Math.sin(a) * r, scale: S * rand(1.1, 1.4), yaw: a });
  }
  c.batch('terrain_sideCliff', rimTiles);

  // Caminos de polvo rojo del kit.
  const roads = [];
  for (let x = -36; x <= 36; x += S * 2.1) roads.push({ x, y: .04, z: -2, scale: S * 1.4, yaw: Math.PI / 2 });
  for (let z = -28; z <= 30; z += S * 2.1) roads.push({ x: -6, y: .04, z, scale: S * 1.4, yaw: 0 });
  c.batch('terrain_roadStraight', roads);
  c.one('terrain_roadCross', -6, .04, -2, { scale: S * 1.4, yaw: 0 });

  // ---------------------------------------------------------------- cráteres
  const craters = [];
  for (let k = 0; k < 9; k++) {
    const x = rand(-40, 40), z = rand(-40, 40);
    if (!safe(x, z, 10)) continue;
    craters.push({ x, y: .03, z, scale: S * rand(.8, 1.5), yaw: R() * 6.28 });
  }
  c.batch('craterLarge', craters);
  c.batch('crater', craters.filter((_, k) => k % 2 === 0)
    .map(p => ({ ...p, x: p.x + 3.2, scale: p.scale * .55 })));

  // --------------------------------------------------- rocas y cristales ---
  const rocks = new Map();
  for (let k = 0; k < 34; k++) {
    const x = rand(-42, 42), z = rand(-42, 42);
    if (!safe(x, z, 9)) continue;
    const model = pick(['rock_largeA', 'rock_largeB', 'rocks_smallA', 'rocks_smallB', 'rock_crystals']);
    if (!rocks.has(model)) rocks.set(model, []);
    rocks.get(model).push({ x, y: .04, z, scale: S * rand(.6, 1.2), yaw: R() * 6.28 });
    if (/large/.test(model)) c.solid(x, z, S * .55, S * .55, S * 1.1);
  }
  c.one('rock_crystalsLargeA', -20, .04, 34, { scale: S * 1.1, yaw: .6 });
  c.one('meteor_detailed', 36, .04, -6, { scale: S, yaw: 1.2 });
  c.solid(36, -6, S * .7, S * .7, S * 1.0);
  for (const [model, ts] of rocks) c.batch(model, ts);

  // ---------------------------------------------------- monorraíl elevado --
  // Viga este-oeste a y≈6 con soportes; el tren descansa sobre la vía.
  const TRACK_Y = 6.2, trackScale = S * 1.3;
  const trackTop = TRACK_Y + c.sizeOf('monorail_trackStraight').y * trackScale * .5;
  const tracks = [], supports = [];
  for (let x = -40; x <= 40; x += S * 1.3 * .96) {
    tracks.push({ x, y: TRACK_Y, z: -14, scale: trackScale, yaw: Math.PI / 2 });
    if (Math.round(x / 10) % 2 === 0 && Math.abs(x) > 6) {
      const sh = c.sizeOf('monorail_trackSupport').y * S * 1.35;
      supports.push({ x, y: 0, z: -14, scale: S * 1.35, yaw: 0 });
      c.solid(x, -14, S * .5, S * .5, sh);
    }
  }
  c.batch('monorail_trackStraight', tracks);
  c.batch('monorail_trackSupport', supports);
  c.one('monorail_trackCornerLarge', 42.5, TRACK_Y, -14, { scale: trackScale, yaw: 0 });
  // Tren estacionado al oeste: frente + vagones + cierre, medidos con Box3.
  const train = ['monorail_trainFront', 'monorail_trainBox', 'monorail_trainBox', 'monorail_trainEnd'];
  let ty = trackTop;
  train.forEach((m, k) => {
    const h = c.sizeOf(m).y * S * 1.1;
    c.one(m, -26 + k * c.sizeOf(m).z * S * 1.05, ty, -14, { scale: S * 1.1, yaw: Math.PI / 2 });
  });

  // --------------------------------------------------- cohete central ------
  // Secciones apiladas con la altura REAL de cada GLB (Box3): sin huecos ni
  // solapes entre etapas. Al norte del spawn, sin bloquear el cruce.
  const RX = 0, RZ = -20, RS = S * 1.35;
  let ry = 0;
  const stack = ['rocket_baseA', 'rocket_fuelA', 'rocket_sidesA', 'rocket_fuelB', 'rocket_sidesB', 'rocket_topA'];
  for (const m of stack) {
    const h = c.sizeOf(m).y * RS;
    c.one(m, RX, ry, RZ, { scale: RS, yaw: 0 });
    if (m === 'rocket_fuelB') {
      const fh = c.sizeOf('rocket_finsA').y * RS;
      c.one('rocket_finsA', RX, ry - fh * .55, RZ, { scale: RS, yaw: 0 });
    }
    ry += Math.max(.1, h - .15);
  }
  c.solid(RX, RZ, S * 1.5, S * 1.5, ry);
  c.one('gate_simple', RX, 0, RZ + S * 3.4, { scale: S * 1.1, yaw: 0 });

  // ----------------------------------------------- habitats y tecnología ---
  const hab = new Map();
  const place = (model, x, z, sc, yaw, solidHw) => {
    if (!hab.has(model)) hab.set(model, []);
    hab.get(model).push({ x, y: .04, z, scale: sc, yaw });
    if (solidHw) c.solid(x, z, solidHw, solidHw * .8, c.sizeOf(model).y * sc, yaw);
  };
  place('hangar_largeA', -22, 18, S * 1.2, .5, S * 1.3);
  place('hangar_roundA', 24, 6, S * 1.1, 1.9, S * 1.1);
  place('hangar_roundB', -34, -6, S * 1.0, -.7, S * 1.0);
  place('hangar_smallA', 14, 24, S * 1.0, 2.8, S * .9);
  place('machine_generator', -12, 12, S * .9, .3, S * .5);
  place('machine_wireless', 34, 30, S * 1.0, 1.1, S * .5);
  place('satelliteDish_large', -40, 8, S * 1.1, 2.2, S * .7);
  place('satelliteDish', 40, 20, S * .95, -.9, S * .6);
  place('structure', -16, -12, S * 1.0, .8, S * .8);
  place('structure_detailed', 10, -34, S * 1.0, 1.7, S * .8);
  place('structure_closed', 38, -36, S * 1.0, -.4, S * .8);
  place('supports_high', -42, -34, S * 1.0, 0, S * .5);
  for (const [model, ts] of hab) c.batch(model, ts);

  // Naves aparcadas y rovers.
  const craft = new Map();
  const addCraft = (model, x, z, yaw, solid) => {
    if (!craft.has(model)) craft.set(model, []);
    craft.get(model).push({ x, y: .05, z, scale: S * rand(.85, 1.1), yaw });
    if (solid) c.solid(x, z, S * 1.0, S * .7, S * .9, yaw);
  };
  addCraft('craft_speederA', 18, -18, .4, true);
  addCraft('craft_speederB', 24, -12, 1.1, true);
  addCraft('craft_speederC', -8, 30, 2.4, true);
  addCraft('craft_cargoA', -30, 34, -.6, true);
  addCraft('craft_miner', 12, 36, 1.8, false);
  addCraft('rover', -2, 14, .9, false);
  addCraft('rover', 30, -24, 2.7, false);
  for (const [model, ts] of craft) c.batch(model, ts);
  c.one('turret_single', 8, .04, -26, { scale: S * .9, yaw: 0 });
  c.solid(8, -26, S * .4, S * .4, S * 1.0);
  const barrels = [];
  for (let k = 0; k < 10; k++) {
    const x = rand(-36, 36), z = rand(-36, 36);
    if (!safe(x, z, 9)) continue;
    barrels.push({ x, y: .04, z, scale: S * .6, yaw: R() * 6.28 });
  }
  c.batch('barrel', barrels);
  c.one('desk_computer', -18, .04, -2, { scale: S * .8, yaw: 1.2 });

  // ------------------------------------------------------------- fondo ----
  // Horizonte marciano: mesas lejanas (terrenos del kit a gran escala, fuera
  // del area, sin colision) + dos lunas claras en el cielo polvoriento.
  // Cerca y grandes para que la niebla de Marte no las lave.
  const mesas = [];
  for (let k = 0; k < 15; k++) {
    const a = (k / 15) * Math.PI * 2 + (R() - .5) * .25;
    const r = 62 + R() * 22;
    mesas.push({
      x: Math.cos(a) * r, y: -2.2, z: Math.sin(a) * r,
      scale: S * rand(4.5, 8.0), yaw: R() * 6.28
    });
  }
  c.batch('terrain', mesas);
  c.batch('rock', mesas.filter((_, k) => k % 2 === 0).map(m => ({
    x: m.x * .82, y: -1.5, z: m.z * .82, scale: m.scale * .5, yaw: m.yaw * 2
  })));
  // Lunas dentro del encuadre estandar (pitch -.17 cubre ~+20° sobre el
  // horizonte; -Z es el frente de la vista): elevacion 9-13°, delante.
  c.sphere(-62, 30, -118, 13, 0xe8cdbb,
    { emissive: 0xd9a98a, emissiveIntensity: .62, name: 'W6_moon_phobos' });
  c.sphere(78, 26, -108, 6, 0xd6c8c0,
    { emissive: 0xb59d8e, emissiveIntensity: .62, name: 'W6_moon_deimos' });
}
