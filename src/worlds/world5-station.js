// MUNDO 5 — «ESTACIÓN ORBITAL» · Kenney Space Station Kit
// ---------------------------------------------------------------------------
// Plataforma industrial sci-fi: suelo de paneles metálicos gris/naranja,
// muros perimetrales con ventanillas, entreplanta con barandillas y escaleras
// transitables, tuberías gigantes aéreas, clusters de consolas con sillas,
// contenedores de carga apilados (por Box3) y barreras estructurales.
//
// Fondo: ESPACIO PROFUNDO #0b1021 con estrellas procedurales (Points sin
// textura, fog:false para que no se deslaven). Materiales mate del gestor,
// ACES, PCFSoftShadowMap y dispose() completo al cambiar de mundo.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { UNIT, ARENA } from './registry.js';

export const MODELS = [
  'floor-panel', 'floor-panel-straight', 'floor-panel-corner', 'floor-panel-end',
  'floor-corner', 'floor-detail', 'floor',
  'wall', 'wall-corner', 'wall-corner-round', 'wall-window', 'wall-door',
  'wall-detail', 'wall-switch',
  'balcony-floor', 'balcony-floor-corner', 'balcony-rail', 'balcony-rail-corner',
  'stairs-small-edges', 'stairs-small-edge', 'stairs', 'stairs-ramp',
  'rail', 'rail-narrow',
  'pipe', 'pipe-bend', 'pipe-ring', 'pipe-end', 'wall-pillar',
  'table', 'table-large', 'computer', 'computer-wide', 'computer-screen',
  'chair', 'chair-cushion',
  'container', 'container-wide', 'container-tall', 'container-flat',
  'structure', 'structure-barrier', 'structure-panel',
  'display-wall', 'door-double',
  'skip', 'skip-rocks', 'rocks'
];

const S = UNIT;

export function buildWorld5(c) {
  const R = c.rnd;
  const rand = (a, b) => a + (b - a) * R();
  const pick = arr => arr[Math.floor(R() * arr.length) % arr.length];
  const safe = (x, z, r = 9) => Math.hypot(x, z - 4) > r;

  // ------------------------------------------------------ estrellas --------
  // Points procedurales en una esfera lejana: cero texturas, un draw call.
  const starGeo = new THREE.BufferGeometry();
  const N = 700, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = R() * Math.PI * 2, ph = Math.acos(R() * 2 - 1), r = 170 + R() * 60;
    pos[i * 3] = Math.sin(ph) * Math.cos(a) * r;
    pos[i * 3 + 1] = Math.abs(Math.cos(ph)) * r * .8 + 4;
    pos[i * 3 + 2] = Math.sin(ph) * Math.sin(a) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xcfe0ff, size: 1.5, sizeAttenuation: true,
    transparent: true, opacity: .85, fog: false, depthWrite: false
  }));
  stars.name = 'W5_stars';
  c.root.add(stars); c.stats.meshes++;

  // ---------------------------------------------------------- cubierta -----
  c.platform(0, 0, ARENA, ARENA, 0);
  const deck = new THREE.MeshStandardMaterial({ color: 0x77828a, roughness: .92, metalness: .06 });
  c.mesh(new THREE.PlaneGeometry(ARENA * 2 + 6, ARENA * 2 + 6), deck, 0, .01, 0,
    { rotX: -Math.PI / 2, name: 'W5_station_deck' });
  const panels = [];
  for (let x = -44; x <= 44; x += S) for (let z = -44; z <= 44; z += S) {
    if (Math.hypot(x, z) > 44) continue;
    panels.push({ x, y: .02, z, scale: S, yaw: (Math.abs(x) < 2 || Math.abs(z) < 2) ? 0 : (R() < .5 ? 0 : Math.PI / 2) });
  }
  c.batch('floor-panel', panels);
  const details = [];
  for (let k = 0; k < 40; k++) {
    const x = rand(-40, 40), z = rand(-40, 40);
    if (!safe(x, z, 8)) continue;
    details.push({ x, y: .03, z, scale: S, yaw: R() * 6.28 });
  }
  c.batch('floor-detail', details);

  // ---------------------------------------------------- muros perimetrales -
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
    c.one('wall-corner-round', cx, 0, cz, { scale: S, yaw });
  }
  for (let d = -40; d <= 40; d += S * 4) {
    c.one('wall-window', d, 0, -45.2, { scale: S, yaw: 0 });
    c.one('wall-window', d, 0, 45.2, { scale: S, yaw: Math.PI });
    c.one('wall-detail', -45.2, 0, d, { scale: S, yaw: Math.PI / 2 });
    c.one('wall-switch', 45.2, 0, d, { scale: S, yaw: -Math.PI / 2 });
  }
  c.one('wall-door', 0, 0, -45.2, { scale: S, yaw: 0 });
  c.one('door-double', 0, 0, 45.2, { scale: S, yaw: Math.PI });
  const wallH = c.sizeOf('wall').y * S;
  c.solid(0, -45.2, 45, 1.2, wallH); c.solid(0, 45.2, 45, 1.2, wallH);
  c.solid(-45.2, 0, 1.2, 45, wallH); c.solid(45.2, 0, 1.2, 45, wallH);

  // -------------------------------------------------- entreplanta norte ----
  // Franja elevada a y=S con barandillas y escaleras transitables: altura de
  // las piezas medida con Box3 para apoyar cada tramo exactamente.
  const MEZZ = S;
  const bfloor = [];
  for (let x = -40; x <= 40; x += S) for (let z = -43; z <= -27; z += S) {
    bfloor.push({ x, y: MEZZ, z, scale: S, yaw: 0 });
    c.platform(x, z, S * .48, S * .48, MEZZ + .1);
  }
  c.batch('balcony-floor', bfloor);
  const rails = [], railCorners = [];
  for (let x = -40; x <= 40; x += S) {
    rails.push({ x, y: MEZZ, z: -26.5, scale: S, yaw: 0 });
    if (Math.abs(x) > 20) rails.push({ x, y: MEZZ, z: -43.5, scale: S, yaw: Math.PI });
  }
  for (const [x, z, yaw] of [[-40, -26.5, Math.PI * .75], [40, -26.5, Math.PI * .25]]) {
    railCorners.push({ x, y: MEZZ, z, scale: S, yaw });
  }
  c.batch('balcony-rail', rails);
  c.batch('balcony-rail-corner', railCorners);
  c.solid(0, -26.5, 41, .35, MEZZ + 1.1);
  // Escalera de subida en el flanco oeste de la entreplanta.
  const stepH = (MEZZ + .1) / 10;
  for (let k = 0; k < 10; k++) {
    c.platform(-34, -24.5 + k * 1.6, 1.6, .8, stepH * (k + 1));
  }
  c.batch('stairs-small-edges', [{ x: -34, y: 0, z: -17.2, scale: S * 1.05, yaw: Math.PI }]);
  c.ramp(-34, -17.5, 1.7, 7.5, 0, MEZZ + .1, 12, 'z');

  // ------------------------------------------- tuberías gigantes aéreas ----
  // Dos ramales a y=7.5/9.5 con codos, anillos y soportes verticales altos.
  const pipeRun = (z, y, x0, x1, scale) => {
    const segs = [];
    for (let x = x0; x <= x1; x += S * scale * .96) {
      segs.push({ x, y, z, scale: S * scale, yaw: Math.PI / 2 });
      if (Math.round(x / (S * 3)) % 2 === 0) {
        c.one('pipe-ring', x, y, z, { scale: S * scale * 1.05, yaw: Math.PI / 2 });
      }
    }
    c.batch('pipe', segs);
    c.one('pipe-bend', x1 + S * scale * .5, y, z, { scale: S * scale, yaw: 0 });
    c.one('pipe-end', x0 - S * scale * .5, y, z, { scale: S * scale, yaw: 0 });
    for (let x = x0 + S * 2; x < x1; x += S * 9) {
      // Soporte: pilar real del kit escalado hasta la cota de la tuberia.
      const psc = y / c.sizeOf('wall-pillar').y;
      c.one('wall-pillar', x, 0, z + 1.2, { scale: psc, yaw: 0 });
      c.solid(x, z + 1.2, S * .45, S * .45, y);
    }
  };
  pipeRun(-8, 7.5, -36, 34, 1.4);
  pipeRun(12, 9.5, -28, 40, 1.15);

  // ----------------------------------------------- consolas y estaciones ---
  // Tres clusters de control: mesa + consolas + sillas, con huella solida.
  const cluster = (cx, cz, yaw0) => {
    const items = [];
    for (let k = -1; k <= 1; k++) {
      const a = yaw0 + k * .55;
      const x = cx + Math.cos(a) * S * 1.1, z = cz + Math.sin(a) * S * 1.1;
      items.push({ x, y: .04, z, scale: S, yaw: a + Math.PI / 2 });
      c.solid(x, z, S * .55, S * .45, 1.8, a);
      const sx = cx + Math.cos(a) * S * 2.2, sz = cz + Math.sin(a) * S * 2.2;
      c.one(pick(['chair', 'chair-cushion']), sx, .04, sz,
        { scale: S * .85, yaw: a + Math.PI });
    }
    c.batch('table', items);
    for (let k = -1; k <= 1; k++) {
      const a = yaw0 + k * .55;
      const x = cx + Math.cos(a) * S * 1.1, z = cz + Math.sin(a) * S * 1.1;
      c.one(pick(['computer-wide', 'computer', 'computer-screen']), x, c.sizeOf('table').y * S + .02, z,
        { scale: S * .8, yaw: a + Math.PI / 2 });
    }
  };
  cluster(-30, 14, -.4); cluster(26, -8, 2.6); cluster(12, 28, 1.2);

  // ------------------------------------- contenedores de carga (por Box3) --
  // Pila de dos niveles medida con la caja delimitadora: cobertura sólida.
  const stack = (x, z, list) => {
    let y = .04;
    for (const [model, sc, yaw] of list) {
      const h = c.sizeOf(model).y * sc;
      c.one(model, x, y, z, { scale: sc, yaw });
      y += h;
    }
    c.solid(x, z, S * 1.1, S * .8, y, list[0][2] || 0);
  };
  stack(-26, -30, [['container-wide', S, 0], ['container', S * .95, .1]]);
  stack(32, 16, [['container-tall', S * .9, .2], ['container-flat', S, 0]]);
  stack(22, 36, [['container', S * .9, 1.5], ['container-wide', S * .85, 1.6]]);
  stack(-36, 30, [['container-flat', S, .8], ['container', S * .9, .7]]);

  // Barreras estructurales y restos de carga: coberturas sueltas.
  for (const [x, z, yaw] of [[-10, -20, .3], [14, 8, 2.0], [-20, 2, 1.1]]) {
    c.one('structure-barrier', x, .04, z, { scale: S * .9, yaw });
    c.solid(x, z, S * .7, S * .3, 1.3, yaw);
  }
  c.batch('structure', [
    { x: 38, y: .04, z: -30, scale: S, yaw: .4 }, { x: -40, y: .04, z: -12, scale: S, yaw: 2.2 }
  ]);
  c.batch('skip', [
    { x: 8, y: .04, z: -38, scale: S * .9, yaw: .5 }, { x: -14, y: .04, z: 38, scale: S * .9, yaw: 2.6 }
  ]);
  c.batch('skip-rocks', [
    { x: 10.5, y: .04, z: -37, scale: S * .7, yaw: 0 }, { x: -12, y: .04, z: 37, scale: S * .7, yaw: 1 }
  ]);
  const rocks = [];
  for (let k = 0; k < 10; k++) {
    const x = rand(-38, 38), z = rand(-38, 38);
    if (!safe(x, z, 9)) continue;
    rocks.push({ x, y: .04, z, scale: S * rand(.4, .8), yaw: R() * 6.28 });
  }
  c.batch('rocks', rocks);
  // Pantalla de exposición junto a la puerta norte: referencia del kit.
  c.one('display-wall', -8, .04, -44, { scale: S, yaw: 0 });

  // ------------------------------------------------------------- fondo ----
  // Planeta anillado gigante + luna menor + cinturon de asteroides (rocas
  // del kit a la deriva): el cielo deja de ser estrellas solas. El planeta
  // lleva emissive tenue para leerse contra el espacio profundo.
  // Planeta frente a la vista estandar (yaw 0 mira a -Z), lo bastante claro
  // para leerse contra el espacio profundo sin romper el mate.
  const planet = c.sphere(-18, 54, -158, 30, 0x7fa3c2,
    { emissive: 0x35506b, emissiveIntensity: 1.0, name: 'W5_planet' });
  planet.rotation.z = .35;
  const ring = new THREE.Mesh(new THREE.RingGeometry(40, 54, 64),
    new THREE.MeshStandardMaterial({
      color: 0xaebfd0, roughness: .95, metalness: 0,
      side: THREE.DoubleSide, transparent: true, opacity: .6
    }));
  ring.position.set(-18, 54, -158);
  ring.rotation.set(1.25, .4, .2);
  ring.receiveShadow = false; ring.name = 'W5_planet_ring';
  c.root.add(ring); c.stats.meshes++;
  c.sphere(96, 58, 88, 9, 0xcdd5db, { emissive: 0x8a9096, emissiveIntensity: .8, name: 'W5_moon' });
  const belt = [];
  for (let k = 0; k < 14; k++) {
    const a = R() * 6.28, r = 110 + R() * 55;
    belt.push({
      x: Math.cos(a) * r, y: -25 + R() * 105, z: Math.sin(a) * r,
      scale: S * rand(1.0, 3.0), yaw: R() * 6.28
    });
  }
  c.batch('rocks', belt);
}
