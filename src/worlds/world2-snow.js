// MUNDO 2 — «TUNDRA NEVADA» · Kenney Platformer Kit (piezas snow/ice)
// ---------------------------------------------------------------------------
// Diorama jugable inspirado en la referencia oficial: plataformas flotantes
// escalonadas con capa de nieve blanco-hueso MATE y laterales terracota,
// puentes de tablones, escaleras, rampas de hielo, pinos nevados, barriles,
// cajas, cofres, monedas y faroles de luz calida muy suave.
// Cerrado como maqueta: mar helado alrededor y falda de bloques de nieve que
// desciende por los 4 bordes.
//
// La nieve nunca es 0xffffff: applyMatteFinish(snow:true) limita cualquier
// baseColor con luminancia > .80 a SNOW_CAP (0xe9eef0) y ACES + exposicion .90
// evitan el blanco quemado.
//
// ANTI-ENCIAMADO: cada isla registra las celdas de bloque que REALMENTE
// existen (las esquinas se omiten para la silueta de diorama) y arboles/props
// se instancian SOLO sobre celdas libres, marcadas en una rejilla de
// ocupacion. Asi ningun arbol atraviesa bloques o cofres y ninguna pieza
// flota sobre una celda omitida. Las rampas se reservan antes de repartir.
//
// Colisiones: cada isla publica su plataforma; las rampas se discretizan en
// escalones < .65 para groundAt(). El valle a y=0 es continuo.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { UNIT, ARENA } from './registry.js';

export const MODELS = [
  // bloques de nieve
  'block-snow', 'block-snow-low', 'block-snow-large', 'block-snow-large-tall',
  'block-snow-narrow', 'block-snow-long', 'block-snow-low-large',
  'block-snow-low-long', 'block-snow-hexagon', 'block-snow-low-hexagon',
  'block-snow-corner', 'block-snow-edge', 'block-snow-curve',
  'block-snow-large-slope', 'block-snow-overhang-low',
  'block-snow-overhang-large', 'block-snow-overhang-edge', 'block-snow-overhang-corner',
  'block-grass-large-slope',
  // plataformas, puentes, escaleras
  'platform', 'platform-ramp', 'platform-overhang', 'platform-fortified',
  'poles', 'fence-straight', 'fence-low-straight', 'fence-rope', 'fence-corner',
  'ladder', 'ladder-long',
  // vegetacion invernal
  'tree-pine-snow', 'tree-pine-snow-small', 'tree-snow', 'tree-pine',
  'tree-pine-small',
  // utileria
  'barrel', 'crate', 'crate-strong', 'crate-item', 'rocks', 'stones',
  'sign', 'flag', 'chest', 'coin-gold', 'coin-silver',
  'block-moving-blue', 'spring', 'star', 'jewel'
];

const S = UNIT;
const SNOW_FLOOR = 0xe7ecee;
const ICE_SEA = 0xcfe2ec;

export function buildWorld2(c) {
  const R = c.rnd;
  const rand = (a, b) => a + (b - a) * R();
  const pick = arr => arr[Math.floor(R() * arr.length) % arr.length];
  const safe = (x, z, r = 10) => Math.hypot(x, z - 4) > r;

  // ------------------------------------------------------- valle nevado
  c.platform(0, 0, ARENA, ARENA, 0);
  const snowMat = new THREE.MeshStandardMaterial({
    color: SNOW_FLOOR, roughness: .95, metalness: .0
  });
  c.mesh(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2), snowMat, 0, .01, 0,
    { rotX: -Math.PI / 2, name: 'W2_snow_valley' });

  // ------------------------------------------ mar helado + falda de nieve --
  // Plano gigante de hielo pálido alrededor y TRES anillos de bloques que
  // descienden por los 4 bordes hasta el mar helado. Todo fuera de ±46.
  const seaMat = new THREE.MeshStandardMaterial({
    color: ICE_SEA, roughness: .6, metalness: 0, transparent: true, opacity: .95
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.y = -1.0;
  sea.receiveShadow = false; sea.name = 'W2_ice_sea';
  c.root.add(sea); c.stats.meshes++;
  const skirt = (dist, y) => {
    const ring = [];
    for (let d = -55; d <= 55; d += S) {
      ring.push({ x: d, y, z: -dist, scale: S, yaw: 0 });
      ring.push({ x: d, y, z: dist, scale: S, yaw: Math.PI });
      ring.push({ x: -dist, y, z: d, scale: S, yaw: Math.PI / 2 });
      ring.push({ x: dist, y, z: d, scale: S, yaw: -Math.PI / 2 });
    }
    c.batch('block-snow', ring);
  };
  skirt(47.5, -.2);
  skirt(50.6, -.2 - S * .55);
  skirt(53.7, -.2 - S * 1.1);
  for (const [cx, cz] of [[47.5, 47.5], [-47.5, 47.5], [47.5, -47.5], [-47.5, -47.5]]) {
    c.one('block-snow-corner', cx, -.2, cz,
      { scale: S, yaw: cx > 0 ? (cz > 0 ? 0 : Math.PI / 2) : (cz > 0 ? -Math.PI / 2 : Math.PI) });
  }

  // ------------------------------------------ islas escalonadas de nieve
  // Cada isla es una rejilla de bloques a una altura dada. Se dejan pasillos
  // entre islas para el kiting; las rampas conectan los niveles.
  // Cada isla guarda las celdas que EXISTEN (con esquinas omitidas incluidas)
  // para repartir arboles y props sin encimarlos.
  const islands = [
    { cx: -26, cz: -24, w: 6, d: 5, lvl: 1, cap: 'block-snow' },
    { cx: 24, cz: -26, w: 6, d: 6, lvl: 2, cap: 'block-snow' },
    { cx: 0, cz: -32, w: 5, d: 4, lvl: 3, cap: 'block-snow' },
    { cx: -28, cz: 20, w: 6, d: 5, lvl: 2, cap: 'block-snow' },
    { cx: 27, cz: 22, w: 6, d: 5, lvl: 1, cap: 'block-snow' },
    { cx: 0, cz: 30, w: 7, d: 4, lvl: 1, cap: 'block-snow' },
    { cx: -6, cz: 4, w: 4, d: 3, lvl: 1, cap: 'block-snow-low' }
  ];
  for (const is of islands) { is.cells = []; is.used = new Set(); }
  const caps = new Map();
  for (const is of islands) {
    const halfW = (is.w - 1) / 2, halfD = (is.d - 1) / 2;
    for (let i = 0; i < is.w; i++) for (let j = 0; j < is.d; j++) {
      const x = is.cx + (i - halfW) * S, z = is.cz + (j - halfD) * S;
      // Borde irregular: las esquinas se omiten para silueta de diorama.
      if ((i === 0 || i === is.w - 1) && (j === 0 || j === is.d - 1) && R() < .65) continue;
      const edge = i === 0 || j === 0 || i === is.w - 1 || j === is.d - 1;
      const model = edge ? pick(['block-snow', 'block-snow-edge', 'block-snow-corner']) : is.cap;
      if (!caps.has(model)) caps.set(model, []);
      caps.get(model).push({ x, y: (is.lvl - 1) * S, z, scale: S, yaw: 0 });
      c.platform(x, z, S * .52, S * .52, is.lvl * S);
      is.cells.push({ x, z });
    }
  }
  for (const [model, ts] of caps) c.batch(model, ts);

  // Rejilla de ocupacion: una celda = un occupant (arbol, prop, farol...).
  const takeCell = (is, jitter = true) => {
    if (!is.cells.length) return null;
    for (let t = 0; t < 10; t++) {
      const cell = is.cells[Math.floor(R() * is.cells.length)];
      const key = Math.round(cell.x * 4) + '_' + Math.round(cell.z * 4);
      if (!is.used.has(key)) {
        is.used.add(key);
        return {
          x: cell.x + (jitter ? rand(-.22, .22) * S : 0),
          z: cell.z + (jitter ? rand(-.22, .22) * S : 0)
        };
      }
    }
    return null;
  };

  // Coronas de hielo y voladizos: relieve de la referencia.
  const overhang = [];
  for (const is of islands) {
    for (let k = 0; k < 3; k++) {
      overhang.push({
        x: is.cx + rand(-is.w, is.w) * S * .4,
        y: is.lvl * S,
        z: is.cz + rand(-is.d, is.d) * S * .4,
        scale: S * .85, yaw: R() * 6.28
      });
    }
  }
  c.batch('block-snow-overhang-edge', overhang);

  // ---------------------------------------------- rampas transitables
  // Una rampa visual por isla + escalones de colision invisibles. Las rampas
  // se registran aqui para que el arbolado exterior nunca las invada.
  const rampRects = [];
  const slopes = [];
  for (const is of islands.slice(0, 6)) {
    const from = 0, to = is.lvl * S;
    const steps = Math.max(8, Math.round((to - from) / .325));
    const x0 = is.cx - is.w * S * .5 - S * 1.2;
    for (let k = 0; k < steps; k++) {
      const t = (k + 1) / steps;
      const y = from + (to - from) * t;
      c.platform(x0 + k * .62, is.cz, .36, S * .9, y);
    }
    slopes.push({ x: x0 + steps * .31, y: 0, z: is.cz, scale: S, yaw: Math.PI / 2 });
    rampRects.push({
      x0: x0 - 1.5, x1: x0 + steps * .62 + 1.5, z0: is.cz - S * 1.4, z1: is.cz + S * 1.4
    });
    // Escalera de madera apoyada en la pared de la isla.
    const [lx, lz] = [is.cx + is.w * S * .5, is.cz];
    c.one(is.lvl > 1 ? 'ladder-long' : 'ladder', lx, 0, lz, { scale: S * .9, yaw: -Math.PI / 2 });
  }
  c.batch('block-snow-large-slope', slopes);
  c.batch('block-grass-large-slope', slopes.map(p => ({ ...p, x: p.x + S * .5, y: -S * .02 })));
  const nearRamp = (x, z) => rampRects.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);

  // --------------------------------------------- puentes de tablones
  // El Platformer Kit no trae un bridge.glb: se compone con platform + poles
  // + barandillas de cuerda, exactamente el vocabulario modular del kit.
  const planks = [], posts = [], ropes = [];
  const bridges = [
    { ax: -26, az: -24, bx: 0, bz: -32, lvl: 2 },
    { ax: 0, az: -32, bx: 24, bz: -26, lvl: 3 },
    { ax: -28, az: 20, bx: 0, bz: 30, lvl: 2 },
    { ax: 0, az: 30, bx: 27, bz: 22, lvl: 1 }
  ];
  for (const b of bridges) {
    const len = Math.hypot(b.bx - b.ax, b.bz - b.az);
    const n = Math.max(5, Math.round(len / (S * .8)));
    const yaw = Math.atan2(b.bx - b.ax, b.bz - b.az);
    const y = b.lvl * S;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = b.ax + (b.bx - b.ax) * t, z = b.az + (b.bz - b.az) * t;
      planks.push({ x, y: y + .06, z, scale: S * .78, yaw });
      c.platform(x, z, S * .42, S * .42, y + .12);
      if (k % 3 === 0) {
        const ox = Math.cos(yaw) * S * .55, oz = -Math.sin(yaw) * S * .55;
        posts.push({ x: x + ox, y: y + .1, z: z + oz, scale: S * .8, yaw });
        posts.push({ x: x - ox, y: y + .1, z: z - oz, scale: S * .8, yaw });
        ropes.push({ x: x + ox, y: y + .35, z: z + oz, scale: S * .8, yaw });
        ropes.push({ x: x - ox, y: y + .35, z: z - oz, scale: S * .8, yaw });
      }
    }
  }
  c.batch('platform', planks);
  c.batch('poles', posts);
  c.batch('fence-rope', ropes);

  // ------------------------------------------------- pinos y arbolado
  // SOLO sobre celdas existentes de cada isla: ningun arbol atraviesa un
  // bloque, un cofre u otro arbol, y ninguno flota sobre una celda omitida.
  const trees = new Map();
  for (const is of islands) {
    const count = 6 + Math.floor(R() * 5);
    for (let k = 0; k < count; k++) {
      const cell = takeCell(is);
      if (!cell) break;
      const model = pick(['tree-pine-snow', 'tree-pine-snow-small', 'tree-snow', 'tree-pine', 'tree-pine-small']);
      const scale = S * rand(.85, 1.25);
      if (!trees.has(model)) trees.set(model, []);
      trees.get(model).push({ x: cell.x, y: is.lvl * S + .05, z: cell.z, scale, yaw: R() * 6.28 });
      c.solid(cell.x, cell.z, S * .32, S * .32, is.lvl * S + S * 1.4);
    }
  }
  // Anillo exterior de pinos nevados: limite natural del bioma. Se omite la
  // franja de las rampas para no tapar las subidas.
  for (let k = 0; k < 78; k++) {
    const a = k / 78 * Math.PI * 2 + rand(-.04, .04);
    const r = 39 + rand(-2.5, 3);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) > 44 || Math.abs(z) > 44 || nearRamp(x, z)) continue;
    const model = pick(['tree-pine-snow', 'tree-pine-snow-small', 'tree-snow']);
    if (!trees.has(model)) trees.set(model, []);
    trees.get(model).push({ x, y: .03, z, scale: S * rand(.9, 1.35), yaw: R() * 6.28 });
    if (safe(x, z, 20) && R() < .45) c.solid(x, z, S * .34, S * .34, S * 1.5);
  }
  for (const [model, ts] of trees) c.batch(model, ts);

  // ------------------------------- barriles, cajas, cofres, rocas, señales
  // Tambien sobre celdas libres: nada se apila sobre un arbol ni un cofre.
  const props = new Map();
  const add = (model, x, y, z, scale, yaw, solid) => {
    if (!props.has(model)) props.set(model, []);
    props.get(model).push({ x, y, z, scale, yaw });
    if (solid) c.solid(x, z, scale * .22, scale * .22, y + scale * .3, yaw);
  };
  for (const is of islands) {
    for (let k = 0; k < 7; k++) {
      const cell = takeCell(is);
      if (!cell) break;
      const y = is.lvl * S + .02;
      const model = pick(['barrel', 'crate', 'crate-strong', 'crate-item', 'chest', 'rocks', 'stones']);
      const scale = S * rand(.75, 1.15);
      add(model, cell.x, y, cell.z, scale, R() * 6.28, ['barrel', 'crate', 'crate-strong', 'chest'].includes(model));
    }
    const sCell = takeCell(is, false), fCell = takeCell(is, false);
    if (sCell) add('sign', sCell.x, is.lvl * S + .02, sCell.z, S * .8, 0, false);
    if (fCell) add('flag', fCell.x, is.lvl * S + .02, fCell.z, S * .9, 0, false);
  }
  for (const [model, ts] of props) c.batch(model, ts);

  // ------------------------------------------------- faroles de luz calida
  // Sin PointLight: la iluminacion global ya es suave. Solo un emisivo tenue
  // para que el farol se lea sin destellos ni coste de sombras. Sobre celda
  // libre de la isla, nunca encima de un arbol.
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xf2ddb4, emissive: 0xffcf8a, emissiveIntensity: .42,
    roughness: .95, metalness: 0
  });
  const lampGeo = new THREE.SphereGeometry(.20 * S, 8, 6);
  for (const is of islands) {
    for (const s of [-1, 1]) {
      const cell = takeCell(is, false);
      const x = cell ? cell.x : is.cx + s * is.w * S * .32;
      const z = cell ? cell.z : is.cz + is.d * S * .48;
      c.mesh(lampGeo, lampMat, x, is.lvl * S + .72 * S, z,
        { name: 'W2_lantern', receive: false });
      c.one('poles', x, is.lvl * S + .02, z, { scale: S * .55 });
    }
  }

  // ------------------------- bloques de hielo y monedas flotantes (adorno)
  const floats = [], coins = [];
  for (let k = 0; k < 18; k++) {
    const x = rand(-38, 38), z = rand(-38, 38);
    floats.push({ x, y: rand(1.2, 4.2) * S, z, scale: S * rand(.5, .9), yaw: R() * 6.28 });
    coins.push({ x: x + rand(-2, 2), y: rand(1.0, 3.6) * S, z: z + rand(-2, 2),
      scale: S * .55, yaw: R() * 6.28 });
  }
  c.batch('block-moving-blue', floats);
  c.batch('coin-gold', coins);
  c.batch('star', coins.filter((_, k) => k % 3 === 0).map(p => ({ ...p, y: p.y + S * .4 })));

  // Detalle de nieve suelta en el valle: rompe la superficie plana. Pocos y
  // pequeños: la piedra del kit es azulada y a gran densidad se leía como
  // grava azul sobre la nieve en vez de ventisca.
  const drift = [];
  for (let k = 0; k < 90; k++) {
    const x = rand(-42, 42), z = rand(-42, 42);
    if (!safe(x, z, 8)) continue;
    drift.push({ x, y: .02, z, scale: S * rand(.35, .7), yaw: R() * 6.28 });
  }
  c.batch('stones', drift);

  // ------------------------------------------------------------- fondo ----
  // Icebergs en el mar helado (bloques y curvas del kit, con pino nevado en
  // las cimas) y nubes frias a la vista. Decoracion pura: fuera de ±55,
  // sin colision; quedan fuera del frustum de sombras (±50).
  const iceberg = (a, r, sc) => {
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const bs = S * sc;
    const top = c.sizeOf('block-snow-large').y * bs;
    c.one('block-snow-large', x, -1.0, z, { scale: bs, yaw: a });
    c.one('block-snow-large-slope', x + bs * .5, -1.0, z + bs * .15, { scale: bs, yaw: a + 1.1 });
    c.one('block-snow-curve', x - bs * .4, -1.0, z + bs * .3, { scale: bs * .9, yaw: a - .6 });
    if (sc > 1.1) c.one('tree-pine-snow', x + bs * .1, -1.0 + top, z - bs * .1,
      { scale: bs * .55, yaw: a * 2 });
    c.one('rocks', x - bs * .7, -0.9, z - bs * .5, { scale: bs * .7, yaw: a * 3 });
  };
  iceberg(0.5, 62, 1.6);
  iceberg(1.35, 74, 2.1);
  iceberg(2.2, 66, 1.3);
  iceberg(3.0, 78, 2.4);
  iceberg(3.9, 64, 1.5);
  iceberg(4.7, 76, 1.9);
  iceberg(5.5, 70, 1.4);
  c.clouds({ count: 10, y: 30, rMin: 62, rMax: 95, color: 0xeef4f8, scale: 7 });
}
