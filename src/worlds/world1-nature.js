// MUNDO 1 — «VALLE TURQUESA» · Kenney Nature Kit
// ---------------------------------------------------------------------------
// Diorama jugable inspirado en la referencia oficial: isla irregular de
// cantiles terracota, mesetas de hierba turquesa, rio con cascada, puentes de
// madera, senderos de tierra, campamento y bosque denso en los bordes.
// Cerrada como maqueta: océano turquesa alrededor y falda de cantiles que
// desciende por los 4 bordes hasta el agua.
//
// Reglas de diseno (roguelike de hordas):
//  · Suelo continuo y transitable en todo el area: ningun hueco donde la IA
//    pueda atascarse. El relieve es VISUAL + plataformas alcanzables.
//  · ALINEACION POR Box3: makeTemplate centra cada modelo con su base en y=0
//    y expone su tamano real (sizeOf). Con el calculamos el grosor REAL de la
//    loseta de hierba y apoyamos rio/caminos/cultivos LIMPIAMENTE sobre la
//    hierba (base ~Y=.05) en vez de semienterrarlos.
//  · Solo los elementos grandes (arboles, rocas, tienda) tienen huella solida.
//  · Las mesetas se suben por rampas discretizadas en escalones < step .65.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { UNIT, ARENA } from './registry.js';

export const MODELS = [
  // suelo y relieve
  'ground_grass', 'ground_pathStraight', 'ground_pathBend', 'ground_pathCorner',
  'ground_pathCross', 'ground_riverStraight', 'ground_riverBend', 'ground_riverCorner',
  'cliff_block_rock', 'cliff_block_stone', 'cliff_top_rock', 'cliff_large_rock',
  'cliff_corner_rock', 'cliff_steps_rock', 'cliff_waterfallTop_rock',
  'cliff_waterfall_rock', 'platform_grass',
  // puentes y campamento
  'bridge_center_wood', 'bridge_side_wood', 'bridge_wood',
  'tent_detailedOpen', 'campfire_logs', 'campfire_stones',
  'log', 'log_stack', 'stump_round', 'sign',
  // arbolado
  'tree_pineTallA', 'tree_pineDefaultA', 'tree_pineRoundA', 'tree_pineSmallA',
  'tree_oak', 'tree_default', 'tree_detailed', 'tree_fat', 'tree_tall',
  'tree_plateau', 'tree_palm', 'tree_palmTall', 'tree_small', 'tree_cone',
  // rocas y detalle
  'rock_largeA', 'rock_largeB', 'rock_largeC', 'rock_smallA', 'rock_smallB',
  'rock_smallC', 'stone_largeA',
  'plant_bush', 'plant_bushLarge', 'plant_bushSmall', 'grass', 'grass_large',
  'flower_redA', 'flower_yellowA', 'flower_purpleA', 'mushroom_red', 'mushroom_tan',
  'crops_dirtRow', 'crops_dirtDoubleRow', 'crops_cornStageA', 'crops_wheatStageB',
  'fence_simple', 'fence_planks', 'fence_corner', 'path_wood', 'lily_small'
];

const HALF = 17;                       // rejilla 35x35 -> ±45.5 u.
const G = (i, j) => [(i - HALF) * UNIT, (j - HALF) * UNIT];
const WATER = 0x63cdd6;
const OCEAN = 0x45b8cc;

export function buildWorld1(c) {
  const R = c.rnd;
  const rand = (a, b) => a + (b - a) * R();
  const pick = arr => arr[Math.floor(R() * arr.length) % arr.length];
  const S = UNIT;                    // escala de bloque
  const safe = (x, z, r = 9) => Math.hypot(x, z - 4) > r;   // hueco de spawn

  // ------------------------------------------------ ALINEACION POR Box3 ----
  // Grosor REAL de la loseta de hierba y de los cantiles, medido con la caja
  // delimitadora del GLB (sizeOf). Con esto ninguna pieza queda semienterrada.
  const gt = c.sizeOf('ground_grass').y * S;
  const TOP = .02 + gt;                          // superficie del prado
  const REST = Math.max(.05, TOP + .008);        // apoyo limpio sobre la hierba
  const FLORA = TOP + .004;                      // hierba/flores/rocas pequeñas

  // ------------------------------------------------------------------ suelo
  c.platform(0, 0, ARENA, ARENA, 0);
  const ground = new THREE.MeshStandardMaterial({ color: 0x49a98f, roughness: .95, metalness: .02 });
  c.mesh(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2), ground, 0, .012, 0,
    { rotX: -Math.PI / 2, name: 'W1_valley_floor' });

  // Loseta de hierba del kit, escalada, para dar relieve al prado sin texturas.
  const grassTiles = [];
  for (let i = 1; i < 34; i++) for (let j = 1; j < 34; j++) {
    const [x, z] = G(i, j);
    if (Math.hypot(x, z) > 43) continue;
    grassTiles.push({ x, y: .02, z, scale: S, yaw: 0 });
  }
  c.batch('ground_grass', grassTiles);

  // ------------------------------------------- océano + falda de cantiles --
  // Plano gigante de agua turquesa alrededor de la isla y TRES anillos de
  // cantiles que descienden por los 4 bordes hasta sumergirse: la maqueta se
  // lee como isla flotante completa desde cualquier ángulo. Todo fuera del
  // área jugable (±46): sin colisión.
  const oceanMat = new THREE.MeshStandardMaterial({
    color: OCEAN, roughness: .55, metalness: 0, transparent: true, opacity: .96
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), oceanMat);
  ocean.rotation.x = -Math.PI / 2; ocean.position.y = -1.05;
  ocean.receiveShadow = false; ocean.name = 'W1_ocean';
  c.root.add(ocean); c.stats.meshes++;
  const skirt = (dist, y) => {
    const ring = [];
    for (let d = -55; d <= 55; d += S) {
      ring.push({ x: d, y, z: -dist, scale: S, yaw: 0 });
      ring.push({ x: d, y, z: dist, scale: S, yaw: Math.PI });
      ring.push({ x: -dist, y, z: d, scale: S, yaw: Math.PI / 2 });
      ring.push({ x: dist, y, z: d, scale: S, yaw: -Math.PI / 2 });
    }
    c.batch('cliff_block_rock', ring);
  };
  skirt(47.5, -.2);              // borde de la isla (corona el prado)
  skirt(50.6, -.2 - S * .55);    // primer escalón sumergido
  skirt(53.7, -.2 - S * 1.1);    // último escalón antes del océano
  for (const [cx, cz] of [[47.5, 47.5], [-47.5, 47.5], [47.5, -47.5], [-47.5, -47.5]]) {
    c.one('cliff_corner_rock', cx, -.2, cz,
      { scale: S, yaw: cx > 0 ? (cz > 0 ? 0 : Math.PI / 2) : (cz > 0 ? -Math.PI / 2 : Math.PI) });
  }

  // -------------------------------------------------- rio turquesa + cascada
  // Recorrido en S de norte a sur, con un ensanchamiento en el centro.
  // Las losetas de rio se APOYAN sobre la hierba (REST), no enterradas.
  const river = [];
  for (let j = 2; j <= 32; j++) {
    const t = (j - 2) / 30;
    const i = Math.round(12 + Math.sin(t * Math.PI * 1.7) * 3.2 - t * 3.2);
    const [x, z] = G(i, j);
    river.push({ i, j, x, z });
  }
  c.batch('ground_riverStraight', river.map(({ x, z }) => ({ x, y: REST, z, scale: S, yaw: 0 })));
  // Lamina de agua continua: evita que el rio se lea como losetas sueltas.
  const waterMat = new THREE.MeshStandardMaterial({
    color: WATER, roughness: .42, metalness: .0,
    transparent: true, opacity: .90, depthWrite: false
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2.0 * S, 31 * S), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(-6.2 * S, REST + .05, 0);
  water.receiveShadow = false;
  c.root.add(water);
  c.stats.meshes++;
  for (let k = 0; k < 14; k++) {
    const { x, z } = river[Math.floor(rand(2, river.length - 2))];
    c.one('lily_small', x + rand(-.7, .7) * S, REST + .02, z + rand(-.7, .7) * S, { scale: S * .7, yaw: R() * 6.28 });
  }

  // -------------------------------------- meseta norte + acantilado/cascada
  // Dos niveles de cantil (2.6 y 5.2 u.) en la franja norte; la cascada cae
  // desde el nivel alto hasta el rio.
  const cliff = [];
  for (let i = 8; i <= 21; i++) {
    for (let j = 1; j <= 5; j++) {
      const [x, z] = G(i, j);
      const lvl = j <= 2 ? 2 : 1;
      cliff.push({ x, y: (lvl - 1) * S, z, scale: S, yaw: 0 });
    }
  }
  c.batch('cliff_block_rock', cliff);
  // Coronacion y esquinas para que el borde no sea un cubo perfecto.
  const cap = [];
  for (let i = 8; i <= 21; i++) {
    const [x0, z0] = G(i, 5);
    cap.push({ x: x0, y: S, z: z0, scale: S, yaw: 0 });
  }
  c.batch('cliff_top_rock', cap);
  for (const [i, j] of [[8, 5], [21, 5], [8, 1], [21, 1]]) {
    const [x, z] = G(i, j);
    c.one('cliff_corner_rock', x, (j <= 2 ? S : 0), z, { scale: S, yaw: i < 15 ? 0 : Math.PI / 2 });
  }
  // Suavizado del borde de la meseta: piezas de esquina a lo largo de los
  // flancos (columnas 8/21 y filas 1/5) para romper la arista recta.
  const rimCH = c.sizeOf('cliff_corner_rock').y * S;
  const rim = [];
  for (let j = 1; j <= 5; j++) for (const i of [8, 21]) {
    const [x, z] = G(i, j);
    const top = (j <= 2 ? 3 : 2) * S;
    rim.push({ x, y: Math.max(0, top - rimCH + .1), z, scale: S, yaw: i === 8 ? Math.PI : 0 });
  }
  for (let i = 9; i <= 20; i++) for (const j of [1, 5]) {
    const [x, z] = G(i, j);
    const top = (j <= 2 ? 3 : 2) * S;
    rim.push({ x, y: Math.max(0, top - rimCH + .1), z, scale: S, yaw: j === 1 ? Math.PI / 2 : -Math.PI / 2 });
  }
  c.batch('cliff_corner_rock', rim);
  // Cascada: pieza del kit + lamina vertical de agua.
  const [wx, wz] = G(14, 2);
  c.one('cliff_waterfallTop_rock', wx, 2 * S, wz - S * .5, { scale: S });
  c.one('cliff_waterfall_rock', wx, S, wz - S * .5, { scale: S });
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(.82 * S, 2.1 * S),
    new THREE.MeshStandardMaterial({ color: 0xbdeef0, roughness: .55, metalness: 0,
      transparent: true, opacity: .82, side: THREE.DoubleSide }));
  fall.position.set(wx, 1.15 * S, wz - .52 * S);
  c.root.add(fall); c.stats.meshes++;

  // Plataformas de la meseta + rampas de subida (escalones invisibles).
  for (let i = 8; i <= 21; i++) for (let j = 1; j <= 5; j++) {
    const [x, z] = G(i, j);
    const top = (j <= 2 ? 3 : 2) * S;
    c.platform(x, z, S * .48, S * .48, top);
  }
  c.ramp(G(7, 4)[0], G(7, 4)[1], S * 1.5, S * 2.4, 0, 2 * S, 16, 'x');
  const steps = [];
  for (let k = 0; k < 8; k++) {
    const [x, z] = G(7 + k, 6);
    steps.push({ x, y: 0, z, scale: S, yaw: Math.PI / 2 });
  }
  c.batch('cliff_steps_rock', steps);
  // Rocas sobre la meseta: rompe la superficie plana del nivel alto.
  for (let k = 0; k < 10; k++) {
    const i = 9 + Math.floor(rand(0, 12)), j = 1 + Math.floor(rand(0, 4));
    const [x, z] = G(i, j);
    const top = (j <= 2 ? 3 : 2) * S;
    c.one(pick(['rock_smallA', 'rock_smallB', 'rock_smallC', 'rock_largeA']),
      x + rand(-.5, .5) * S, top, z + rand(-.5, .5) * S,
      { scale: S * rand(.45, .8), yaw: R() * 6.28 });
  }

  // ---------------------------------------------------- puentes de madera
  // Dos pasos sobre el rio, con centro + laterales del kit. La cubierta
  // descansa sobre la hierba, no flotando a media altura.
  for (const j of [11, 23]) {
    const i = Math.round(12 + Math.sin((j - 2) / 30 * Math.PI * 1.7) * 3.2 - (j - 2) / 30 * 3.2);
    const [x, z] = G(i, j);
    const deckY = REST + .28;
    const bridge = [];
    for (let d = -2; d <= 2; d++) {
      bridge.push({ x: x + d * S, y: deckY, z, scale: S, yaw: 0 });
    }
    c.batch('bridge_center_wood', bridge);
    c.batch('bridge_side_wood', [
      { x: x - 2 * S, y: deckY, z, scale: S }, { x: x + 2 * S, y: deckY, z, scale: S }
    ]);
    c.platform(x, z, S * 2.6, S * .5, deckY + .3);
  }

  // -------------------------------------------------------- senderos / cultivos
  // Caminos y cultivos APOYADOS sobre la hierba (REST).
  const path = [];
  for (let k = 0; k < 26; k++) {
    const a = k / 26 * Math.PI * 2;
    const x = Math.cos(a) * 20, z = 4 + Math.sin(a) * 16;
    if (!safe(x, z, 7)) continue;
    path.push({ x, y: REST, z, scale: S, yaw: a + Math.PI / 2 });
  }
  c.batch('ground_pathStraight', path);
  const crop = [];
  for (let i = 22; i <= 27; i++) for (let j = 19; j <= 24; j++) {
    const [x, z] = G(i, j);
    crop.push({ x, y: REST, z, scale: S, yaw: 0 });
  }
  c.batch('crops_dirtRow', crop);
  c.batch('crops_cornStageA', crop.filter((_, k) => k % 3 === 0).map(p => ({ ...p, y: REST + .04, scale: S * .8 })));
  c.batch('crops_wheatStageB', crop.filter((_, k) => k % 4 === 1).map(p => ({ ...p, y: REST + .04, scale: S * .8 })));

  // Campamento: tienda, fogata, troncos y cartel.
  const [tx, tz] = G(20, 26);
  c.one('tent_detailedOpen', tx, REST, tz, { scale: S * 1.5, yaw: -.4 });
  c.one('campfire_logs', tx - S * 2, REST, tz + S * .6, { scale: S * .8 });
  c.one('campfire_stones', tx - S * 2.6, REST, tz - S * .4, { scale: S * .7 });
  c.one('log_stack', tx + S * 2, REST, tz + S * .4, { scale: S * .9 });
  c.one('stump_round', tx + S * 1.2, REST, tz - S * 1.2, { scale: S * .9 });
  c.one('sign', tx - S * 3.6, REST, tz + S * 1.4, { scale: S * .8 });
  c.solid(tx, tz, S * 1.0, S * .8, S * 1.2, -.4);

  // ------------------------------------------------------------- arbolado
  // Tres anillos perimetrales: pinos al norte, frondosas al sur, palmeras al
  // este. Los grandes tienen huella solida; los pequenos no estorban a la IA.
  const pines = [], broadleaf = [], palms = [], smallTrees = [];
  const PINE = ['tree_pineTallA', 'tree_pineDefaultA', 'tree_pineRoundA', 'tree_pineSmallA'];
  const LEAF = ['tree_oak', 'tree_default', 'tree_detailed', 'tree_fat', 'tree_tall', 'tree_plateau'];
  for (let ring = 0; ring < 3; ring++) {
    const radius = 33 + ring * 4.6;
    const count = 34 + ring * 10;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + rand(-.05, .05);
      const rr = radius + rand(-2.2, 2.2);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (Math.abs(x) > 44 || Math.abs(z) > 44) continue;
      const scale = S * rand(.95, 1.35);
      const yaw = R() * Math.PI * 2;
      if (z < -12) pines.push({ model: pick(PINE), t: { x, y: z < -30 ? 2 * S : FLORA, z, scale, yaw } });
      else if (x > 24) palms.push({ model: R() < .5 ? 'tree_palm' : 'tree_palmTall', t: { x, y: FLORA, z, scale, yaw } });
      else broadleaf.push({ model: pick(LEAF), t: { x, y: FLORA, z, scale, yaw } });
      // Cobertura tactica solo en el anillo interior y fuera del spawn.
      if (ring === 0 && safe(x, z, 16) && R() < .55) c.solid(x, z, S * .42, S * .42, S * 1.8, yaw);
    }
  }
  const byModel = new Map();
  for (const { model, t } of [...pines, ...broadleaf, ...palms]) {
    if (!byModel.has(model)) byModel.set(model, []);
    byModel.get(model).push(t);
  }
  for (const [model, ts] of byModel) c.batch(model, ts);

  // Arboles dispersos en el interior (islas de cobertura con pasillos).
  for (let k = 0; k < 26; k++) {
    const x = rand(-30, 30), z = rand(-30, 30);
    if (!safe(x, z, 13)) continue;
    const model = pick(LEAF);
    smallTrees.push({ x, y: FLORA, z, scale: S * rand(.8, 1.1), yaw: R() * 6.28 });
    c.solid(x, z, S * .38, S * .38, S * 1.6);
  }
  c.batch('tree_small', smallTrees);

  // ------------------------------------------------------- rocas y detalle
  const BIG_ROCK = ['rock_largeA', 'rock_largeB', 'rock_largeC', 'stone_largeA'];
  const SMALL_ROCK = ['rock_smallA', 'rock_smallB', 'rock_smallC'];
  const detail = [
    ['grass', 520, .7, 1.5], ['grass_large', 240, .8, 1.4],
    ['plant_bush', 150, .9, 1.4], ['plant_bushLarge', 90, 1.0, 1.5],
    ['plant_bushSmall', 180, .8, 1.3],
    ['flower_redA', 90, .8, 1.2], ['flower_yellowA', 90, .8, 1.2],
    ['flower_purpleA', 80, .8, 1.2],
    ['mushroom_red', 50, .8, 1.2], ['mushroom_tan', 45, .8, 1.2]
  ];
  for (const [model, count, lo, hi] of detail) {
    const ts = [];
    for (let k = 0; k < count; k++) {
      // Agrupado en manchas, no uniforme: ritmo visual de prado.
      const cx = rand(-40, 40), cz = rand(-40, 40);
      const a = R() * 6.28, r = Math.sqrt(R()) * 3.6;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (Math.abs(x) > 43 || Math.abs(z) > 43) continue;
      ts.push({ x, y: FLORA, z, scale: S * rand(lo, hi), yaw: R() * 6.28 });
    }
    c.batch(model, ts);
  }
  const rocks = new Map();
  for (let k = 0; k < 60; k++) {
    const x = rand(-40, 40), z = rand(-40, 40);
    if (!safe(x, z, 11)) continue;
    const big = R() < .35;
    const model = pick(big ? BIG_ROCK : SMALL_ROCK);
    if (!rocks.has(model)) rocks.set(model, []);
    rocks.get(model).push({ x, y: FLORA, z, scale: S * (big ? rand(1.0, 1.5) : rand(.7, 1.1)), yaw: R() * 6.28 });
    if (big) c.solid(x, z, S * .55, S * .55, S * 1.1);
  }
  for (const [model, ts] of rocks) c.batch(model, ts);

  // Cerca perimetral baja: limite natural sin colision (el juego ya limita
  // al jugador a ±45 y los enemigos aparecen dentro del area).
  const fences = [];
  for (let i = 2; i <= 32; i += 2) {
    const [x, z] = G(i, 1); fences.push({ x, y: FLORA, z, scale: S, yaw: 0 });
    const [x2, z2] = G(i, 33); fences.push({ x: x2, y: FLORA, z: z2, scale: S, yaw: 0 });
  }
  for (let j = 2; j <= 32; j += 2) {
    const [x, z] = G(1, j); fences.push({ x, y: FLORA, z, scale: S, yaw: Math.PI / 2 });
    const [x2, z2] = G(33, j); fences.push({ x: x2, y: FLORA, z: z2, scale: S, yaw: Math.PI / 2 });
  }
  c.batch('fence_simple', fences);

  // ------------------------------------------------------------- fondo ----
  // Islotes flotantes en el oceano (roca + pradera + arboles, con la misma
  // paleta del valle) y anillo de nubes mate. Todo decorativo: sin colision
  // ni sombras, fuera del area jugable.
  const islet = (a, r, y, sc) => {
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const rs = S * sc;
    const gh = c.sizeOf('ground_grass').y * rs;
    c.one('cliff_block_rock', x, y - rs * .55, z, { scale: rs, yaw: a });
    c.one('ground_grass', x, y, z, { scale: rs, yaw: a * .7 });
    c.one('tree_oak', x + rs * .3, y + gh, z + rs * .15,
      { scale: rs * .8, yaw: a * 2 });
    c.one('tree_cone', x - rs * .35, y + gh, z - rs * .2,
      { scale: rs * .9, yaw: a });
  };
  islet(0.7, 72, 7.5, 2.4);
  islet(2.6, 84, 12.5, 3.0);
  islet(4.4, 70, 5.5, 1.9);
  c.clouds({ count: 11, y: 30, rMin: 64, rMax: 96, color: 0xfafcff, scale: 7 });
}
