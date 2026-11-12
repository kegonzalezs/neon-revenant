// MUNDO 3 — «MINIMERCADO» · Kenney Mini Shop
// ---------------------------------------------------------------------------
// Interior gigante de supermercado: los operadores tienen tamano de juguete.
// Paredes perimetrales con esquinas curvas, muros de refrigeradores, pasillos
// de estanterias (pasillos tacticos con cobertura real), zona de frutas,
// cajas registradoras, carritos, esquina de ropa y maquinas de caramelo.
//
// El fondo es INTERIOR CALIDO: niebla beige (nunca blanco puro) + un techo
// lejano que cierra el espacio. Todo el material pasa por el acabado mate
// del WorldManager; ACES + sombras PCFSoft + dispose() al cambiar de mundo.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { UNIT, ARENA } from './registry.js';

export const MODELS = [
  'floor', 'floor-wood', 'wall', 'wall-corner', 'wall-window', 'wall-door-rotate',
  'column', 'freezer', 'freezers-standing', 'shelf-bags', 'shelf-boxes', 'shelf-end',
  'display-fruit', 'display-bread', 'display-cans', 'display-flowers', 'display-small',
  'cash-register', 'cash-register-self', 'shopping-cart', 'shopping-basket',
  'clothing-rack', 'clothing-table', 'mannequin', 'gacha-machine', 'hand-truck',
  'bottle-return', 'fence', 'fence-door-rotate', 'character-employee'
];

const S = UNIT;

export function buildWorld3(c) {
  const R = c.rnd;
  const rand = (a, b) => a + (b - a) * R();
  const pick = arr => arr[Math.floor(R() * arr.length) % arr.length];
  const safe = (x, z, r = 9) => Math.hypot(x, z - 4) > r;   // hueco de spawn

  // ------------------------------------------------------------------ suelo
  // Loseta grande del mercado + zona de madera (inicio y zona de frutas) y
  // losetas grises sueltas: leen como dos materiales de suelo reales.
  c.platform(0, 0, ARENA, ARENA, 0);
  const base = new THREE.MeshStandardMaterial({ color: 0xa9a29a, roughness: .95, metalness: .02 });
  c.mesh(new THREE.PlaneGeometry(ARENA * 2 + 8, ARENA * 2 + 8), base, 0, .01, 0,
    { rotX: -Math.PI / 2, name: 'W3_shop_floor' });
  const grayTiles = [], woodTiles = [];
  for (let x = -43; x <= 43; x += S) for (let z = -43; z <= 43; z += S) {
    const t = { x, y: .02, z, scale: S, yaw: 0 };
    (x > 6 || (x > -34 && x < -20 && z > 10)) ? woodTiles.push(t) : grayTiles.push(t);
  }
  c.batch('floor', grayTiles);
  c.batch('floor-wood', woodTiles);

  // ------------------------------------------- techo y paredes perimetrales
  // Techo lejano (con la niebla beige se lee como profundidad del local) y
  // muro perimetral con esquinas, ventanas y puertas. Altura de muro real
  // segun la caja delimitadora del GLB.
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0xc4b29c, roughness: .96, metalness: 0, side: THREE.DoubleSide
  });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), ceilMat);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 15;
  ceil.receiveShadow = false; ceil.castShadow = false; ceil.name = 'W3_ceiling';
  c.root.add(ceil); c.stats.meshes++;
  const wallH = c.sizeOf('wall').y * S;
  const walls = [];
  for (let d = -44; d <= 44; d += S) {
    walls.push({ x: d, y: 0, z: -45.2, scale: S, yaw: 0 });
    walls.push({ x: d, y: 0, z: 45.2, scale: S, yaw: Math.PI });
    walls.push({ x: -45.2, y: 0, z: d, scale: S, yaw: Math.PI / 2 });
    walls.push({ x: 45.2, y: 0, z: d, scale: S, yaw: -Math.PI / 2 });
  }
  c.batch('wall', walls);
  for (const [cx, cz, yaw] of [[45.2, 45.2, Math.PI * .75], [-45.2, 45.2, Math.PI * .25],
    [45.2, -45.2, Math.PI * 1.25], [-45.2, -45.2, Math.PI * 1.75]]) {
    c.one('wall-corner', cx, 0, cz, { scale: S, yaw });
  }
  // Ventanas en la mitad norte y puertas-gira en el eje este/oeste.
  for (let d = -36; d <= 36; d += S * 4) {
    c.one('wall-window', d, 0, -45.2, { scale: S, yaw: 0 });
    c.one('wall-window', -45.2, 0, d, { scale: S, yaw: Math.PI / 2 });
  }
  c.one('wall-door-rotate', 45.2, 0, 0, { scale: S, yaw: -Math.PI / 2 });
  c.one('wall-door-rotate', -45.2, 0, 0, { scale: S, yaw: Math.PI / 2 });
  c.solid(0, -45.2, 45, 1.2, wallH);   // huella continua de los 4 muros
  c.solid(0, 45.2, 45, 1.2, wallH);
  c.solid(-45.2, 0, 1.2, 45, wallH);
  c.solid(45.2, 0, 1.2, 45, wallH);

  // Columnas estructurales hasta el techo: cobertura solida en el centro.
  for (const [x, z] of [[-16, -16], [16, -16], [-16, 18], [16, 18]]) {
    c.one('column', x, 0, z, { scale: S * 2.0, yaw: 0 });
    c.solid(x, z, S * .5, S * .5, 14);
  }

  // ------------------------------------------------ pasillos de estanterias
  // Cuatro pasillos dobles: cobertura total para kiting, con extremos de
  // estanteria y un pasillo central despejado alrededor del spawn.
  const shelfRows = [-20, -8, 8, 20];
  for (const z of shelfRows) {
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? -32 : 10;
      const x1 = side < 0 ? -10 : 32;
      const run = [];
      for (let x = x0; x <= x1; x += S * 1.05) {
        if (!safe(x, z, 7) && Math.abs(x) < 12) continue;
        run.push({ x, y: .04, z: z + side * S * .55, scale: S, yaw: 0 });
      }
      c.batch(pick(['shelf-bags', 'shelf-boxes']), run);
      c.batch('shelf-end', [
        { x: x0 - S * .6, y: .04, z: z + side * S * .55, scale: S, yaw: 0 },
        { x: x1 + S * .6, y: .04, z: z + side * S * .55, scale: S, yaw: 0 }
      ]);
      c.solid((x0 + x1) / 2, z + side * S * .55, (x1 - x0) / 2 + S * .8, S * .5, 2.6);
    }
  }

  // ------------------------------------------------ muro de refrigeradores
  // Franja oeste: neveras verticales + arcas, lectura de muro frio.
  const freezers = [], chests = [];
  for (let z = -34; z <= 34; z += S * 1.1) {
    freezers.push({ x: -40.5, y: .04, z, scale: S, yaw: Math.PI / 2 });
    if (Math.abs(z) > 12 && R() < .6) chests.push({ x: -37.5, y: .04, z: z + S * .5, scale: S * .9, yaw: Math.PI / 2 });
  }
  c.batch('freezers-standing', freezers);
  c.batch('freezer', chests);
  c.solid(-40.5, 0, 1.4, 35, 2.8);
  c.solid(-37.5, 0, 1.0, 22, 1.6);

  // ------------------------------------------------------------- fruteria
  // Zona de productos frescos sobre el suelo de madera, como la referencia.
  const produce = [
    ['display-fruit', -24, 24, .3], ['display-fruit', -19, 26, -.2],
    ['display-bread', -27, 18, .9], ['display-flowers', -22, 18, .1],
    ['display-small', -16, 24, .5], ['display-cans', 24, -26, -.4],
    ['display-small', 28, -22, .2]
  ];
  for (const [m, x, z, yaw] of produce) {
    c.one(m, x, .04, z, { scale: S, yaw });
    c.solid(x, z, S * .8, S * .6, 1.4, yaw);
  }
  // Empleado del kit como decoracion pasiva junto a la fruteria.
  c.one('character-employee', -21, .04, 21.5, { scale: S * .8, yaw: 2.4 });

  // ------------------------------------------------------- cajas y salida
  // Linea de cajas registradoras cerca de la puerta sur + autoservicio.
  const regs = [];
  for (let k = 0; k < 3; k++) regs.push({ x: -8 + k * S * 1.2, y: .04, z: 34, scale: S, yaw: Math.PI });
  c.batch('cash-register', regs);
  c.batch('cash-register-self', [
    { x: 8, y: .04, z: 34, scale: S, yaw: Math.PI },
    { x: 12, y: .04, z: 34, scale: S, yaw: Math.PI }
  ]);
  c.solid(-5, 34, S * 2.2, S * .5, 1.5);
  c.solid(10, 34, S * 1.6, S * .5, 1.5);
  c.one('bottle-return', 18, .04, 38, { scale: S * .9, yaw: Math.PI });
  c.solid(18, 38, S * .5, S * .5, 1.6);
  c.one('fence-door-rotate', 0, .04, 41, { scale: S * .8, yaw: 0 });

  // ------------------------------------------------------ esquina de ropa
  for (const [x, z, yaw] of [[30, 24, .4], [34, 18, 1.2], [27, 30, 2.2]]) {
    c.one('clothing-rack', x, .04, z, { scale: S, yaw });
    c.solid(x, z, S * .7, S * .4, 1.9, yaw);
  }
  c.batch('clothing-table', [
    { x: 33, y: .04, z: 28, scale: S, yaw: .2 }, { x: 38, y: .04, z: 24, scale: S, yaw: 1.1 }
  ]);
  c.batch('mannequin', [
    { x: 36, y: .04, z: 32, scale: S * .9, yaw: -.6 }, { x: 40, y: .04, z: 29, scale: S * .9, yaw: 1.4 }
  ]);

  // ------------------------------------------------ carritos y utileria
  const carts = [];
  for (let k = 0; k < 10; k++) {
    const x = rand(-30, 30), z = rand(-30, 30);
    if (!safe(x, z, 8)) continue;
    carts.push({ x, y: .04, z, scale: S * .85, yaw: R() * 6.28 });
  }
  c.batch('shopping-cart', carts);
  const baskets = [];
  for (let k = 0; k < 8; k++) {
    const x = rand(-24, 24), z = rand(-24, 24);
    if (!safe(x, z, 8)) continue;
    baskets.push({ x, y: .04, z, scale: S * .7, yaw: R() * 6.28 });
  }
  c.batch('shopping-basket', baskets);
  for (const [x, z, yaw] of [[-12, -34, .5], [20, 12, 2.1]]) {
    c.one('gacha-machine', x, .04, z, { scale: S * .95, yaw });
    c.solid(x, z, S * .45, S * .45, 1.8, yaw);
  }
  c.batch('hand-truck', [
    { x: 6, y: .04, z: -36, scale: S * .8, yaw: .3 }, { x: -30, y: .04, z: -12, scale: S * .8, yaw: 1.8 }
  ]);
  // Vallas de mantenimiento: coberturas bajas repartidas.
  for (const [x, z, yaw] of [[-6, -26, .2], [12, 26, 1.9], [-34, -28, 1.1]]) {
    c.one('fence', x, .04, z, { scale: S * .9, yaw });
    c.solid(x, z, S * .8, S * .25, 1.0, yaw);
  }

  // ------------------------------------------------------------- fondo ----
  // Techo con contenido: regletas de luz empotradas (emisivo suave, nada de
  // glare: intensidad baja + mate) y carteles colgantes sobre cada pasillo,
  // para que la vista general lea como interior real y no como vacio beige.
  const stripGeo = new THREE.BoxGeometry(56, .22, 1.5);
  const stripMat = new THREE.MeshStandardMaterial({
    color: 0xf3ead9, roughness: .9, metalness: 0,
    emissive: 0xffedc8, emissiveIntensity: .38
  });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8a7d6d, roughness: .95 });
  for (let k = -2; k <= 2; k++) {
    c.mesh(stripGeo, stripMat, 0, 14.55, k * 17, { name: 'W3_lightstrip' });
    // Railes de suspension por regleta (dos varillas finas).
    c.mesh(new THREE.BoxGeometry(.14, 2.2, .14), railMat, -22, 13.9, k * 17 - .6, { receive: false });
    c.mesh(new THREE.BoxGeometry(.14, 2.2, .14), railMat, 22, 13.9, k * 17 + .6, { receive: false });
  }
  // Carteles colgantes de pasillo: panel oscuro + marco del color del bioma.
  const signPanel = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: .9 });
  const signFrame = new THREE.MeshStandardMaterial({
    color: 0xc98a4b, roughness: .85, emissive: 0x8a5a2b, emissiveIntensity: .22
  });
  for (const z of shelfRows) {
    const g = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.7, .25), signPanel);
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(6.9, .3, .35), signFrame);
    frameTop.position.y = .95;
    const frameBot = new THREE.Mesh(new THREE.BoxGeometry(6.9, .3, .35), signFrame);
    frameBot.position.y = -.95;
    g.add(panel, frameTop, frameBot);
    for (const dx of [-2.6, 2.6]) {
      const wire = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.5, .08), railMat);
      wire.position.set(dx, 2.3, 0);
      g.add(wire);
    }
    g.position.set(0, 10.4, z);
    g.name = 'W3_aisle_sign';
    c.root.add(g);
    c.stats.meshes++;
  }
}
