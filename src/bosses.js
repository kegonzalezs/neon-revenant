// NEON//REVENANT — los nueve jefes (3 por facción).
// Cada uno tiene silueta propia, tres habilidades diferenciadas y dos umbrales
// de fase. Las habilidades se ejecutan en game.js; aquí solo vive el dato y
// la construcción de la malla, para no mezclar geometría con lógica de combate.

import * as THREE from 'three';

// Geometrías compartidas (marcadas para que el recolector no las libere).
const boxCache = new THREE.BoxGeometry(1, 1, 1);
const cylCache = new THREE.CylinderGeometry(.5, .5, 1, 12);
const sphCache = new THREE.SphereGeometry(.5, 14, 10);
const coneCache = new THREE.ConeGeometry(.5, 1, 8);
const torCache = new THREE.TorusGeometry(.5, .06, 6, 20);
const octCache = new THREE.OctahedronGeometry(.5, 0);
for (const g of [boxCache, cylCache, sphCache, coneCache, torCache, octCache]) g.userData.shared = true;

function mat(color, rough = .55, metal = .6) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
function glow(color, i = 1.1) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: .35, metalness: .3 });
}
function box(p, m, s, pos, rot) {
  const o = new THREE.Mesh(boxCache, m);
  o.scale.set(s[0], s[1], s[2]); o.position.set(pos[0], pos[1], pos[2]);
  if (rot) o.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  p.add(o); return o;
}
function cyl(p, m, r, h, pos, rot) {
  const o = new THREE.Mesh(cylCache, m);
  o.scale.set(r * 2, h, r * 2); o.position.set(pos[0], pos[1], pos[2]);
  if (rot) o.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  p.add(o); return o;
}
function sph(p, m, r, pos) {
  const o = new THREE.Mesh(sphCache, m);
  o.scale.setScalar(r * 2); o.position.set(pos[0], pos[1], pos[2]);
  p.add(o); return o;
}
function cone(p, m, r, h, pos, rot) {
  const o = new THREE.Mesh(coneCache, m);
  o.scale.set(r * 2, h, r * 2); o.position.set(pos[0], pos[1], pos[2]);
  if (rot) o.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  p.add(o); return o;
}
function ring(p, m, r, pos, rot) {
  const o = new THREE.Mesh(torCache, m);
  o.scale.set(r * 2, r * 2, 1); o.position.set(pos[0], pos[1], pos[2]);
  if (rot) o.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  p.add(o); return o;
}
function oct(p, m, r, pos) {
  const o = new THREE.Mesh(octCache, m);
  o.scale.setScalar(r * 2); o.position.set(pos[0], pos[1], pos[2]);
  p.add(o); return o;
}
// Registro de piezas animadas: el bucle de juego las mueve sin conocer el modelo.
function spinner(g, o, axis, speed) { (g.userData.spinners || (g.userData.spinners = [])).push({ o, axis, speed }); }
function bobber(g, o, amp, speed) { (g.userData.bobbers || (g.userData.bobbers = [])).push({ o, amp, speed, base: o.position.y }); }

// ------------------------------------------------------------------ SYNTEK
// Paleta: acero frío + cian corporativo. Siluetas de maquinaria pesada.
function buildWarden(g, A, D, S) {
  // Alcaide: bípedo acorazado con escudo antidisturbios y cañón de hombro.
  box(g, S, [1.5, 1.1, .8], [0, 1.6, 0]);                 // torso
  box(g, D, [1.62, .22, .86], [0, 2.16, 0], null);         // hombreras
  box(g, A, [1.1, .1, .84], [0, 1.72, -.02]);              // franja de núcleo
  box(g, D, [.52, .34, .5], [0, 2.65, 0]);                 // cabeza
  box(g, A, [.44, .09, .06], [0, 2.7, -.26]);              // visor
  const shield = box(g, S, [1.15, 1.5, .16], [-1.05, 1.5, -.35]);
  box(g, A, [1.0, .12, .1], [-1.05, 1.9, -.45]);
  box(g, D, [.34, .3, 1.2], [.95, 2.05, -.1]);             // cañón
  cyl(g, D, .17, .8, [.95, 2.05, -.85], [Math.PI / 2, 0, 0]);
  g.userData.cannon = g.children[g.children.length - 1];
  for (const x of [-.42, .42]) {
    const leg = new THREE.Group(); leg.position.set(x, .95, 0); g.add(leg);
    box(leg, S, [.38, .95, .42], [0, -.45, 0]);
    box(leg, D, [.44, .18, .62], [0, -.9, -.08]);
    (g.userData.legs || (g.userData.legs = [])).push(leg);
  }
  for (const x of [-1.1, 1.1]) box(g, D, [.2, .9, .2], [x, 3.0, .1]);  // antenas
  g.userData.shieldMesh = shield;
}
function buildArbiter(g, A, D, S) {
  // Árbitro: tetraedro flotante con tres halos en rotación.
  const core = oct(g, D, .62, [0, 1.9, 0]);
  box(g, A, [.7, .12, .7], [0, 1.9, 0], [0, Math.PI / 4, 0]);
  const eye = sph(g, glow(A.color, 1.6), .22, [0, 1.9, -.5]);
  bobber(g, core, .18, 1.4); bobber(g, eye, .18, 1.4);
  const halos = [];
  for (let i = 0; i < 3; i++) {
    const r = ring(g, A, .95 + i * .3, [0, 1.9, 0], [Math.PI / 2, 0, i * .7]);
    spinner(g, r, i % 2 ? 'x' : 'z', .5 + i * .35); halos.push(r);
  }
  g.userData.halos = halos;
  // Maza de sentencia: brazo largo que desciende al golpear.
  const arm = new THREE.Group(); arm.position.set(0, 2.6, 0); g.add(arm);
  cyl(arm, S, .1, 1.3, [0, -.6, 0]);
  box(arm, D, [.5, .5, .5], [0, -1.3, 0]);
  box(arm, A, [.54, .1, .54], [0, -1.05, 0]);
  g.userData.arm = arm;
  const skirt = cone(g, S, .55, 1.2, [0, .95, 0], [Math.PI, 0, 0]);
  bobber(g, skirt, .12, 1.1);
}
function buildOverseer(g, A, D, S) {
  // Supervisor: núcleo cúbico con cuatro anillos ortogonales y pods orbitando.
  const core = box(g, D, [1.15, 1.15, 1.15], [0, 2.1, 0]);
  box(g, A, [1.2, .16, 1.2], [0, 2.1, 0]);
  box(g, A, [1.2, 1.2, .16], [0, 2.1, 0]);
  bobber(g, core, .22, .9);
  for (let i = 0; i < 4; i++) {
    const r = ring(g, i < 2 ? A : glow(A.color, .7), 1.5, [0, 2.1, 0], [i < 2 ? Math.PI / 2 : 0, i * .8, i < 2 ? i * .9 : 0]);
    spinner(g, r, i < 2 ? 'x' : 'y', .45 + i * .22);
  }
  const pods = [];
  for (let i = 0; i < 4; i++) {
    const pod = new THREE.Group(); pod.position.set(Math.cos(i * 1.57) * 2.0, 2.1, Math.sin(i * 1.57) * 2.0); g.add(pod);
    oct(pod, S, .22, [0, 0, 0]); oct(pod, A, .1, [0, -.2, 0]);
    spinner(g, pod, 'y', 2.2); pods.push(pod);
  }
  g.userData.pods = pods;
  cyl(g, S, .35, 1.4, [0, .8, 0]);                          // pedestal
  cone(g, D, .8, .9, [0, .45, 0], [Math.PI, 0, 0]);
}

// ------------------------------------------------------------------ HIVE
// Paleta: quitina oscura + ácido. Siluetas orgánicas, asimétricas, bajas y anchas.
function buildMatriarch(g, A, D, S) {
  // Matriarca: abdomen hinchado, seis patas, sacos de huevos.
  const abd = sph(g, D, .95, [0, 1.35, .55]); abd.scale.set(1.7, 1.3, 2.1);
  box(g, S, [1.0, .8, .9], [0, 1.6, -.55]);                 // tórax
  box(g, A, [.8, .1, .7], [0, 1.75, -.6]);
  const head = cone(g, D, .42, .95, [0, 1.95, -1.15], [-1.3, 0, 0]);
  for (const x of [-.22, .22]) sph(g, glow(0xb6ff3d, 1.8), .1, [x, 2.05, -1.3]);
  // Sacos: se iluminan antes de soltar cría (telegrafía visual).
  const sacs = [];
  for (const x of [-.85, 0, .85]) { const s = sph(g, glow(0x9fd44a, .5), .42, [x, 1.1, 1.5]); s.scale.set(1, 1.35, 1); sacs.push(s); }
  g.userData.sacs = sacs;
  for (let i = 0; i < 6; i++) {
    const a = (i / 5 - .5) * 2.2;
    const leg = new THREE.Group(); leg.position.set(Math.sin(a) * .8, 1.15, Math.cos(a) * .5); g.add(leg);
    cyl(leg, S, .09, 1.1, [0, -.3, -.4], [-.9, Math.sin(a) * .6, 0]);
    cyl(leg, S, .07, 1.0, [0, -.55, -.8], [.8, Math.sin(a) * .6, 0]);
    (g.userData.legs || (g.userData.legs = [])).push(leg);
  }
  for (let i = 0; i < 5; i++) {                              // cresta dorsal
    const sp = cone(g, A, .1, .5, [0, 2.2 - i * .06, -.2 - i * .3], [-.5, 0, 0]);
  }
  g.userData.head = head;
}
function buildCrucible(g, A, D, S) {
  // Crisol: masa de cuerpos fusionados, sin cabeza clara, brazos múltiples.
  const bodies = [[0, 1.5, 0, 1.0], [-.7, 1.1, .3, .8], [.75, 1.25, -.2, .85], [.1, 2.15, .35, .62]];
  let i = 0;
  for (const [x, y, z, r] of bodies) {
    const b = sph(g, i === 3 ? D : S, r * .8, [x, y, z]); b.scale.set(1.15, 1, .9);
    bobber(g, b, .12 + i * .04, 1.6 + i * .4);
    i++;
  }
  for (const [x, y, z] of [[-.35, 2.6, -.1], [.4, 2.45, -.3], [0, 2.75, .3]]) {
    sph(g, glow(0xb6ff3d, 1.7), .12, [x, y, z]);              // ojos repartidos
  }
  const arms = [];
  for (const [x, z, ry] of [[-1.15, .2, .5], [1.2, -.1, -.5], [-.9, -.6, -.9], [1.0, .6, 1.0]]) {
    const arm = new THREE.Group(); arm.position.set(x, 1.9, z); arm.rotation.y = ry; g.add(arm);
    cyl(arm, S, .16, 1.0, [0, -.5, 0]);
    sph(arm, A, .26, [0, -1.05, 0]);
    bobber(g, arm, .16, 2.2); arms.push(arm);
  }
  g.userData.arms = arms;
  // Charco de residuo: marca el suelo bajo el jefe (lectura de área peligrosa).
  const pool = cyl(g, glow(0x9fd44a, .35), 1.9, .04, [0, .05, 0]);
  pool.material.transparent = true; pool.material.opacity = .5;
}
function buildHydra(g, A, D, S) {
  // Hidra: cuerpo segmentado anclado al suelo con tres cuellos.
  let prev = 1.0;
  for (let i = 0; i < 5; i++) {
    const y = .5 + i * .45, r = .75 - i * .09;
    const seg = sph(g, i % 2 ? D : S, r, [Math.sin(i * .9) * .35, y, i * .5]);
    seg.scale.set(1, .8, 1.1);
    bobber(g, seg, .1, 1.3 + i * .2);
    prev = y;
  }
  const heads = [];
  for (const [dx, dz] of [[-.85, 0], [0, -.2], [.85, 0]]) {
    const neck = new THREE.Group(); neck.position.set(dx, 2.3, 2.6 + dz); g.add(neck);
    cyl(neck, S, .16, 1.0, [0, .4, -.2], [-.4, 0, 0]);
    const hd = cone(neck, D, .34, .95, [0, 1.05, -.6], [-1.15, 0, 0]);
    sph(neck, glow(0xb6ff3d, 1.9), .1, [0, 1.0, -.85]);
    bobber(g, neck, .16, 1.5 + Math.abs(dx));
    heads.push(neck);
  }
  g.userData.heads = heads;
  for (let i = 0; i < 4; i++) {                              // espinas dorsales
    cone(g, A, .12, .45, [Math.sin(i) * .3, .8 + i * .45, i * .5], [-.3, 0, 0]);
  }
}

// ------------------------------------------------------------------ UMBRA
// Paleta: violeta + negro. Siluetas altas, flotantes, espectrales.
function buildHerald(g, A, D, S) {
  // Heraldo: figura alta y encapuchada que flota, con báculo largo.
  const cloak = cone(g, D, 1.05, 3.2, [0, 1.5, 0], [Math.PI, 0, 0]);
  cloak.material.transparent = true; cloak.material.opacity = .92;
  box(g, S, [.9, .7, .5], [0, 2.6, 0]);                     // hombros
  const hood = cone(g, D, .5, .8, [0, 3.05, 0]);
  sph(g, glow(A.color, 2.2), .14, [0, 2.95, -.4]);           // ojo único
  bobber(g, cloak, .16, .8); bobber(g, hood, .1, .8);
  const staff = new THREE.Group(); staff.position.set(.85, 2.2, -.3); g.add(staff);
  cyl(staff, S, .07, 3.4, [0, .3, 0]);
  const orb = oct(staff, glow(A.color, 1.6), .3, [0, 2.1, 0]);
  spinner(g, orb, 'y', 1.6);
  ring(staff, A, .5, [0, 2.1, 0], [Math.PI / 2, 0, 0]);
  g.userData.staff = staff; g.userData.orb = orb;
  for (let i = 0; i < 3; i++) {                              // jirones de túnica
    const t = box(g, D, [.18, .9, .05], [(i - 1) * .5, .6, .35], [.2, (i - 1) * .3, 0]);
    t.material.transparent = true; t.material.opacity = .55;
    bobber(g, t, .12, 1.2 + i * .3);
  }
  const base = cyl(g, glow(A.color, .5), 1.2, .05, [0, .06, 0]);
  base.material.transparent = true; base.material.opacity = .45;
}
function buildEcho(g, A, D, S) {
  // Eco: humanoide de fragmentos de espejo flotantes.
  const shards = [];
  const layout = [[0, 2.7, 0, .3, 'head'], [0, 1.9, 0, .55, 'chest'], [0, 1.2, 0, .4, 'hip'],
  [-.75, 2.1, 0, .32, 'arm'], [.75, 2.1, 0, .32, 'arm'], [-.35, .8, 0, .3, 'leg'], [.35, .8, 0, .3, 'leg']];
  for (const [x, y, z, r, kind] of layout) {
    const s = oct(g, kind === 'head' ? glow(A.color, .8) : D, r, [x, y, z]);
    s.scale.set(1, kind === 'leg' ? 1.4 : 1, .7);
    bobber(g, s, .1 + r * .1, 1.4 + r * 3); spinner(g, s, 'y', .8);
    shards.push(s);
    if (kind === 'chest') { const c = oct(g, A, r * .5, [x, y, z - .1]); spinner(g, c, 'x', -1.4); }
  }
  g.userData.shards = shards;
  const mask = box(g, S, [.5, .6, .08], [0, 2.72, -.3]);
  box(g, glow(A.color, 1.4), [.4, .07, .05], [0, 2.78, -.36]);
  const mirrorRings = [];
  for (let i = 0; i < 2; i++) {
    const r = ring(g, A, 1.3 + i * .5, [0, 1.9, 0], [Math.PI / 2, 0, i]);
    spinner(g, r, 'y', i ? -.5 : .7); mirrorRings.push(r);
  }
  g.userData.rings = mirrorRings;
}
function buildAnomaly(g, A, D, S) {
  // Anomalía: ojo del vacío, esfera oscura con iris y tres fragmentos en órbita.
  const shell = sph(g, mat(0x0a0a12, .3, .1), 1.1, [0, 2.3, 0]);
  const iris = ring(g, glow(A.color, 1.9), .62, [0, 2.3, -1.0], [0, 0, 0]);
  const pupil = sph(g, mat(0x000000, .2, 0), .3, [0, 2.3, -1.05]);
  pupil.scale.set(1, 1, .4);
  bobber(g, shell, .2, .7); bobber(g, iris, .2, .7); bobber(g, pupil, .2, .7);
  spinner(g, iris, 'z', .9);
  for (let i = 0; i < 3; i++) {
    const sh = oct(g, D, .34, [Math.cos(i * 2.1) * 1.9, 2.3, Math.sin(i * 2.1) * 1.9]);
    spinner(g, sh, 'y', 1.4); bobber(g, sh, .3, 1.1 + i * .3);
  }
  const halo = ring(g, glow(A.color, .6), 2.0, [0, 2.3, 0], [Math.PI / 2, 0, 0]);
  spinner(g, halo, 'y', -.35);
  g.userData.halo = halo;
  const cone1 = cone(g, mat(0x0a0a12, .4, .1), 1.3, 2.2, [0, 1.1, 0], [Math.PI, 0, 0]);
  cone1.material.transparent = true; cone1.material.opacity = .8;
  bobber(g, cone1, .15, .7);
}

// ------------------------------------------------------------------ HELIX
// Paleta: menta bioluminiscente + quitina clara. Siluetas orgánicas que crecen.
function buildBloom(g, A, D, S) {
  // Floración: bulbo central con pétalos que se abren y raíces que caminan.
  const bulb = sph(g, D, 1.0, [0, 2.4, 0]); bulb.scale.set(1, 1.25, 1);
  bobber(g, bulb, .22, .9);
  const petals = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const p = new THREE.Group(); p.position.set(0, 2.4, 0); p.rotation.y = a; g.add(p);
    const blade = cone(p, S, .34, 1.5, [0, .2, -.9], [-1.15, 0, 0]);
    box(p, A, [.12, 1.1, .04], [0, .25, -.55], [-.35, 0, 0]);
    p.userData.open = .35; petals.push(p);
  }
  g.userData.petals = petals;
  const eye = sph(g, glow(A.color, 2.4), .3, [0, 2.5, -.85]);
  bobber(g, eye, .18, .9);
  for (const x of [-.55, .55]) sph(g, glow(0x3dffb0, 1.2), .12, [x, 2.9, -.5]);
  // Raíces: tres apoyos que se turnan al caminar.
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    const root = new THREE.Group(); root.position.set(Math.cos(a) * .55, 1.5, Math.sin(a) * .55); g.add(root);
    cyl(root, S, .13, 1.4, [0, -.6, -.25], [-.35, 0, 0]);
    cyl(root, S, .1, 1.2, [0, -1.1, -.7], [.5, 0, 0]);
    (g.userData.legs || (g.userData.legs = [])).push(root);
  }
  cyl(g, S, .5, 1.4, [0, .8, 0]);
  const skirt = cone(g, A, .8, .5, [0, .35, 0], [Math.PI, 0, 0]);
  bobber(g, skirt, .08, 1.3);
}
function buildWeaver(g, A, D, S) {
  // Tejedora: abdomen ovillado sobre ocho patas finísimas.
  const abd = sph(g, D, .85, [0, 2.2, .35]); abd.scale.set(1.1, 1.15, 1.3);
  bobber(g, abd, .16, 1.1);
  for (let i = 0; i < 3; i++) ring(g, A, .95 - i * .12, [0, 2.2, .35], [i * .7, i * .5, 0]);
  const spool = cyl(g, glow(A.color, .8), .3, .7, [0, 2.2, -1.0], [Math.PI / 2, 0, 0]);
  spinner(g, spool, 'x', 3.2);
  box(g, S, [.7, .55, .6], [0, 2.5, -.75]);
  for (const x of [-.2, .2]) sph(g, glow(0x3dffb0, 2.2), .1, [x, 2.6, -1.05]);
  for (const x of [-.35, 0, .35]) sph(g, glow(0x3dffb0, 1.4), .07, [x * 2, 2.75, -1.0]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const leg = new THREE.Group(); leg.position.set(Math.cos(a) * .6, 1.9, Math.sin(a) * .6); g.add(leg);
    cyl(leg, S, .055, 1.5, [0, -.35, -.55], [-1.0, a * .5, 0]);
    cyl(leg, S, .04, 1.6, [0, -.5, -1.35], [.7, a * .5, 0]);
    (g.userData.legs || (g.userData.legs = [])).push(leg);
  }
  const web = cyl(g, glow(A.color, .35), 2.2, .04, [0, .05, 0]);
  web.material.transparent = true; web.material.opacity = .38;
  spinner(g, web, 'y', .35);
}
function buildHelixPrime(g, A, D, S) {
  // Hélice primaria: doble hélice que gira alrededor de un eje luminoso.
  const axis = cyl(g, glow(A.color, 1.4), .16, 4.6, [0, 2.3, 0]);
  spinner(g, axis, 'y', 2.4);
  const strands = [];
  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < 12; i++) {
      const t = i / 12, a = t * Math.PI * 4 + s * Math.PI;
      const r = .85 + Math.sin(t * Math.PI * 2) * .25;
      const n = sph(g, s ? A : S, .17, [Math.cos(a) * r, .6 + t * 3.4, Math.sin(a) * r]);
      (g.userData.strandNodes || (g.userData.strandNodes = [])).push({ o: n, t, s });
    }
  }
  const core = oct(g, glow(A.color, 2.2), .45, [0, 2.3, 0]);
  bobber(g, core, .3, 1.0); spinner(g, core, 'y', -1.8);
  for (let i = 0; i < 4; i++) {
    const r = ring(g, i % 2 ? A : S, 1.4 + i * .22, [0, 2.3, 0], [Math.PI / 2, 0, i * .8]);
    spinner(g, r, 'y', (i % 2 ? -.6 : .8) + i * .1);
  }
  cone(g, S, 1.0, 1.2, [0, .55, 0], [Math.PI, 0, 0]);
  cyl(g, D, .7, .6, [0, .3, 0]);
}

// ------------------------------------------------------------------ PYRE
// Paleta: naranja fundido + negro de fundición. Siluetas de maquinaria de asedio.
function buildForge(g, A, D, S) {
  // Forja: horno bípedo con fuelle, núcleo al rojo y brazos de yunque.
  const body = box(g, D, [1.5, 1.5, 1.1], [0, 1.9, 0]);
  bobber(g, body, .1, .8);
  const core = box(g, glow(0xff7a2f, 2.6), [.9, .5, .2], [0, 1.85, -.6]);
  box(g, A, [1.1, .12, .9], [0, 2.55, 0]);
  box(g, D, [.6, .4, .55], [0, 2.85, 0]);
  box(g, glow(0xffcf6b, 2.2), [.5, .08, .06], [0, 2.9, -.3]);
  for (const x of [-.95, .95]) {
    const arm = new THREE.Group(); arm.position.set(x, 2.2, 0); g.add(arm);
    box(arm, S, [.32, .9, .32], [0, -.45, 0]);
    box(arm, D, [.45, .5, .5], [0, -.95, 0]);
    box(arm, A, [.5, .1, .5], [0, -.7, 0]);
    (g.userData.arms || (g.userData.arms = [])).push(arm);
  }
  for (const x of [-.5, .5]) {
    const leg = new THREE.Group(); leg.position.set(x, 1.1, 0); g.add(leg);
    box(leg, S, [.42, 1.1, .45], [0, -.5, 0]);
    box(leg, D, [.5, .2, .7], [0, -1.0, -.1]);
    (g.userData.legs || (g.userData.legs = [])).push(leg);
  }
  for (const x of [-.75, .75]) {                     // chimeneas
    cyl(g, S, .16, 1.2, [x, 3.3, .35]);
    const flame = cone(g, glow(0xff7a2f, 2.4), .2, .5, [x, 4.0, .35]);
    bobber(g, flame, .14, 3.4);
  }
  const pool = cyl(g, glow(0xff7a2f, .6), 2.1, .05, [0, .06, 0]);
  pool.material.transparent = true; pool.material.opacity = .5;
}
function buildCinder(g, A, D, S) {
  // Rescoldo: enjambre de brasas que dibuja un humanoide. Sin cuerpo sólido.
  const embers = [];
  const layout = [[0, 3.0, 0, .3], [0, 2.35, 0, .55], [0, 1.55, 0, .42],
  [-.85, 2.4, 0, .28], [.85, 2.4, 0, .28], [-.4, .85, 0, .26], [.4, .85, 0, .26]];
  for (const [x, y, z, r] of layout) {
    const c = sph(g, glow(0xff7a2f, 1.6), r, [x, y, z]);
    c.material.transparent = true; c.material.opacity = .85;
    bobber(g, c, .12 + r * .18, 1.6 + r * 3); embers.push(c);
  }
  g.userData.embers = embers;
  for (let i = 0; i < 10; i++) {
    const a = rndAngle(i), rr = 1.1 + (i % 3) * .35;
    const m = sph(g, glow(i % 2 ? 0xffcf6b : 0xff7a2f, 2.2), .1, [Math.cos(a) * rr, 1.2 + i * .18, Math.sin(a) * rr]);
    (g.userData.motes || (g.userData.motes = [])).push({ o: m, a, rr, i });
  }
  const mask = box(g, D, [.45, .5, .1], [0, 3.05, -.28]);
  box(g, glow(0xffcf6b, 2.6), [.34, .07, .05], [0, 3.12, -.34]);
  bobber(g, mask, .1, 1.1);
  const pyre = cyl(g, glow(0xff7a2f, .5), 1.5, .05, [0, .05, 0]);
  pyre.material.transparent = true; pyre.material.opacity = .55;
}
function buildMagna(g, A, D, S) {
  // Magna: plataforma de asedio con cañón de ánima enorme y ruedas de oruga.
  box(g, S, [2.0, .9, 2.2], [0, 1.2, 0]);                   // chasis
  box(g, D, [2.1, .18, 2.3], [0, 1.66, 0]);
  for (const x of [-1.05, 1.05]) {
    const tread = box(g, D, [.45, .8, 2.4], [x, .6, 0]);
    for (let i = 0; i < 4; i++) cyl(g, S, .32, .2, [x, .6, -.9 + i * .6], [0, 0, Math.PI / 2]);
  }
  const turret = new THREE.Group(); turret.position.set(0, 1.9, 0); g.add(turret);
  box(turret, S, [1.1, .7, 1.1], [0, .2, 0]);
  const barrel = cyl(turret, D, .3, 2.4, [0, .35, -1.5], [Math.PI / 2, 0, 0]);
  const muzzle = ring(turret, glow(0xff7a2f, 2.6), .42, [0, .35, -2.7], [0, 0, 0]);
  spinner(g, muzzle, 'z', 2.2);
  g.userData.cannon = barrel; g.userData.turret = turret;
  box(turret, A, [1.15, .1, 1.15], [0, .55, 0]);
  box(g, D, [.55, .35, .5], [.75, 2.2, .3]);                 // cabina
  box(g, glow(0xffcf6b, 2.0), [.45, .08, .05], [.75, 2.28, .02]);
  for (const x of [-.9, .9]) cyl(g, S, .12, 1.6, [x, 2.6, .8]);
}

// ------------------------------------------------------------------ NULL
// Paleta: blanco azulado + negro. Siluetas imposibles, geometría que no cuadra.
function buildWraith0(g, A, D, S) {
  // Espectro cero: humanoide de alambre que parpadea y deja copias.
  const frame = new THREE.Group(); g.add(frame);
  const layout = [[0, 2.8, 0, .26], [0, 2.05, 0, .5], [0, 1.3, 0, .34],
  [-.8, 2.2, 0, .24], [.8, 2.2, 0, .24], [-.35, .75, 0, .26], [.35, .75, 0, .26]];
  for (const [x, y, z, r] of layout) {
    const o = oct(frame, D, r, [x, y, z]);
    const cage = ring(frame, A, r * 1.5, [x, y, z], [Math.PI / 2, .5, 0]);
    spinner(g, cage, 'y', 1.2 + r * 2);
    bobber(g, o, .1 + r * .1, 1.5 + r * 2.4);
  }
  box(frame, A, [.42, .06, .05], [0, 2.85, -.22]);
  for (let i = 0; i < 3; i++) {                       // ecos que se desvanecen
    const echo = new THREE.Group(); echo.position.set(0, 0, 0); g.add(echo);
    box(echo, A, [.6, 2.6, .3], [0, 1.6, 0]);
    echo.material = null;
    echo.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = .1; } });
    (g.userData.echoes || (g.userData.echoes = [])).push(echo);
  }
  const base = ring(g, glow(A.color, .7), 1.5, [0, .08, 0], [Math.PI / 2, 0, 0]);
  spinner(g, base, 'y', -.5);
}
function buildParadox(g, A, D, S) {
  // Paradoja: dos mitades especulares girando en sentidos opuestos.
  const halves = [];
  for (let h = 0; h < 2; h++) {
    const half = new THREE.Group(); half.position.set(h ? .55 : -.55, 2.2, 0); g.add(half);
    box(half, h ? D : S, [.85, 2.4, .7], [0, 0, 0]);
    box(half, A, [.9, .12, .74], [0, .5, 0]);
    box(half, A, [.9, .12, .74], [0, -.7, 0]);
    const eye = box(half, glow(A.color, 2.4), [.5, .1, .05], [0, .95, -.36]);
    spinner(g, half, 'y', h ? -1.1 : 1.1);
    bobber(g, half, .18, h ? 1.3 : .9);
    halves.push(half);
  }
  g.userData.halves = halves;
  const seam = cyl(g, glow(A.color, 1.8), .06, 3.0, [0, 2.2, 0]);
  spinner(g, seam, 'y', 4.0);
  for (let i = 0; i < 6; i++) {
    const sh = box(g, i % 2 ? A : D, [.2, .2, .2], [Math.cos(i * 1.05) * 1.8, 2.2 + Math.sin(i * .8) * .6, Math.sin(i * 1.05) * 1.8]);
    spinner(g, sh, 'x', 1.4 + i * .2); bobber(g, sh, .22, 1.2 + i * .2);
  }
  cone(g, D, .9, 1.4, [0, .7, 0], [Math.PI, 0, 0]);
}
function buildOmega(g, A, D, S) {
  // Omega: cubo dentro de cubo, con capas que se separan al enfurecer.
  const shells = [];
  for (let i = 0; i < 3; i++) {
    const sh = box(g, i === 1 ? D : S, [1.9 - i * .55, 1.9 - i * .55, 1.9 - i * .55], [0, 2.4, 0]);
    sh.material = sh.material.clone(); sh.material.transparent = true; sh.material.opacity = .92;
    spinner(g, sh, i % 2 ? 'x' : 'z', (i % 2 ? -1 : 1) * (.5 + i * .35));
    shells.push(sh);
  }
  g.userData.shells = shells;
  const core = oct(g, glow(A.color, 2.8), .42, [0, 2.4, 0]);
  spinner(g, core, 'y', -3.0); bobber(g, core, .18, 1.6);
  for (let i = 0; i < 4; i++) {
    const r = ring(g, A, 1.8 + i * .3, [0, 2.4, 0], [i * .9, i * .6, i * .4]);
    spinner(g, r, i % 2 ? 'x' : 'z', .4 + i * .3);
  }
  for (let i = 0; i < 8; i++) {                        // fragmentos de error
    const a = i / 8 * Math.PI * 2;
    const f = box(g, A, [.16, .5, .16], [Math.cos(a) * 2.3, 1.6 + (i % 3) * .6, Math.sin(a) * 2.3], [0, a, .3]);
    (g.userData.frag || (g.userData.frag = [])).push({ o: f, a, i });
  }
  const plinth = cyl(g, D, 1.2, 1.0, [0, .5, 0]);
  cyl(g, A, 1.25, .12, [0, 1.02, 0]);
}
function rndAngle(i) { return i * 2.399963; }

// ------------------------------------------------------------------ catálogo
// `abilities` se ejecutan en rotación; `phases` son los umbrales de vida.
export const BOSSES = [
  // ---- SYNTEK ---------------------------------------------------------------
  {
    id: 'warden', faction: 'SYNTEK', name: 'WARDEN-01', title: 'UNIDAD DE CONTENCIÓN',
    desc: 'Acorazado bípedo de orden público. Escudo frontal, cargas de contención.',
    scale: 1.85, hp: 1500, speed: 2.7, touch: 30, build: buildWarden,
    abilities: ['barrage', 'charge', 'shieldWall'], telegraph: 1.1
  },
  {
    id: 'arbiter', faction: 'SYNTEK', name: 'ÁRBITRO PRIME', title: 'JUEZ DE SECTOR',
    desc: 'Tetraedro flotante rodeado de halos. Dicta sentencia sobre el terreno.',
    scale: 1.95, hp: 2100, speed: 2.4, touch: 26, build: buildArbiter,
    abilities: ['laserCross', 'verdict', 'summon'], telegraph: 1.3
  },
  {
    id: 'overseer', faction: 'SYNTEK', name: 'OVERSEER AXIOM', title: 'SUPERVISOR CENTRAL',
    desc: 'Núcleo cúbico con anillos ortogonales. Barre la zona con haces giratorios.',
    scale: 2.15, hp: 2900, speed: 2.0, touch: 32, build: buildOverseer,
    abilities: ['beamSweep', 'summon', 'verdict'], telegraph: 1.4
  },
  // ---- HIVE -----------------------------------------------------------------
  {
    id: 'matriarch', faction: 'HIVE', name: 'MATRIARCA', title: 'MADRE DE LA CAMADA',
    desc: 'Abdomen preñado de sacos. Escupe ácido y suelta cría sin descanso.',
    scale: 1.9, hp: 1650, speed: 2.5, touch: 28, build: buildMatriarch,
    abilities: ['spitVolley', 'summon', 'acidPool'], telegraph: 1.0
  },
  {
    id: 'crucible', faction: 'HIVE', name: 'CRISOL', title: 'MASA EN FUSIÓN',
    desc: 'Cuerpos soldados en uno solo. Anillos de langostas y embestidas ciegas.',
    scale: 2.0, hp: 2300, speed: 2.9, touch: 34, build: buildCrucible,
    abilities: ['locustRing', 'charge', 'summon'], telegraph: 1.2
  },
  {
    id: 'hydra', faction: 'HIVE', name: 'HIDRA DE POLÍGONO', title: 'CUERPO SERPEANTE',
    desc: 'Tres cuellos que escupen a la vez. Su cuerpo bloquea el paso del muelle.',
    scale: 2.2, hp: 3100, speed: 1.9, touch: 36, build: buildHydra,
    abilities: ['spitVolley', 'laserCross', 'acidPool'], telegraph: 1.3
  },
  // ---- UMBRA ----------------------------------------------------------------
  {
    id: 'herald', faction: 'UMBRA', name: 'HERALDO', title: 'MENSAJERO DEL VACÍO',
    desc: 'Figura encapuchada que flota. Abre grietas y lanza proyectiles teledirigidos.',
    scale: 1.95, hp: 1800, speed: 2.8, touch: 30, build: buildHerald,
    abilities: ['homingBolts', 'voidRift', 'verdict'], telegraph: 1.2
  },
  {
    id: 'echo', faction: 'UMBRA', name: 'ECO', title: 'REFLEJO DEL MUELLE',
    desc: 'Humanoide de espejos rotos. Se multiplica y embiste desde las sombras.',
    scale: 1.9, hp: 2400, speed: 3.1, touch: 32, build: buildEcho,
    abilities: ['mirrorClones', 'charge', 'barrage'], telegraph: 1.0
  },
  {
    id: 'anomaly', faction: 'UMBRA', name: 'ANOMALÍA', title: 'EL SIN NOMBRE',
    desc: 'Un ojo que no debería existir. Tira de ti y colapsa todo lo que hay cerca.',
    scale: 2.25, hp: 3300, speed: 2.2, touch: 38, build: buildAnomaly,
    abilities: ['gravityWell', 'collapse', 'beamSweep'], telegraph: 1.5
  },
  // ---- HELIX ----------------------------------------------------------------
  {
    id: 'bloom', faction: 'HELIX', name: 'FLORACIÓN', title: 'BULBO MADRE',
    desc: 'Abre sus pétalos para escupir polen corrosivo y camina sobre raíces.',
    scale: 1.9, hp: 1900, speed: 2.6, touch: 30, build: buildBloom,
    abilities: ['spitVolley', 'locustRing', 'summon'], telegraph: 1.1
  },
  {
    id: 'weaver', faction: 'HELIX', name: 'TEJEDORA', title: 'HILANDERA DE SEDA',
    desc: 'Ocho patas finísimas y un ovillo que gira sin parar. Teje la trampa.',
    scale: 2.0, hp: 2500, speed: 3.0, touch: 32, build: buildWeaver,
    abilities: ['laserCross', 'summon', 'acidPool'], telegraph: 1.2
  },
  {
    id: 'helix', faction: 'HELIX', name: 'HÉLICE PRIMARIA', title: 'CADENA ORIGINAL',
    desc: 'Doble hélice de nodos que gira. Barre la arena con haces trenzados.',
    scale: 2.2, hp: 3200, speed: 2.1, touch: 34, build: buildHelixPrime,
    abilities: ['beamSweep', 'laserCross', 'verdict'], telegraph: 1.4
  },
  // ---- PYRE -----------------------------------------------------------------
  {
    id: 'forge', faction: 'PYRE', name: 'FORJA', title: 'HORNO ANDANTE',
    desc: 'Un horno con brazos de yunque. Cada golpe deja el suelo ardiendo.',
    scale: 2.05, hp: 2200, speed: 2.5, touch: 36, build: buildForge,
    abilities: ['barrage', 'charge', 'acidPool'], telegraph: 1.2
  },
  {
    id: 'cinder', faction: 'PYRE', name: 'RESCOLDO', title: 'ENJAMBRE DE BRASAS',
    desc: 'No tiene cuerpo: es un millar de brasas con forma de persona.',
    scale: 1.95, hp: 2600, speed: 3.3, touch: 30, build: buildCinder,
    abilities: ['homingBolts', 'locustRing', 'voidRift'], telegraph: 1.0
  },
  {
    id: 'magna', faction: 'PYRE', name: 'MAGNA', title: 'PLATAFORMA DE ASEDIO',
    desc: 'Cañón de ánima sobre orugas. Dispara andanadas que arrasan el sector.',
    scale: 2.35, hp: 3500, speed: 1.8, touch: 40, build: buildMagna,
    abilities: ['barrage', 'beamSweep', 'collapse'], telegraph: 1.5
  },
  // ---- NULL -----------------------------------------------------------------
  {
    id: 'wraith0', faction: 'NULL', name: 'ESPECTRO CERO', title: 'PRIMER ERROR',
    desc: 'Humanoide de alambre que parpadea. Detrás de él quedan copias.',
    scale: 1.9, hp: 2000, speed: 3.4, touch: 32, build: buildWraith0,
    abilities: ['mirrorClones', 'charge', 'homingBolts'], telegraph: .95
  },
  {
    id: 'paradox', faction: 'NULL', name: 'PARADOJA', title: 'DOS MITADES',
    desc: 'Sus mitades giran en sentidos opuestos. Ningún disparo la atraviesa igual.',
    scale: 2.1, hp: 2700, speed: 2.9, touch: 34, build: buildParadox,
    abilities: ['laserCross', 'verdict', 'voidRift'], telegraph: 1.25
  },
  {
    id: 'omega', faction: 'NULL', name: 'OMEGA', title: 'FIN DEL REGISTRO',
    desc: 'Cubo dentro de cubo dentro de cubo. Las capas se separan al enfurecer.',
    scale: 2.3, hp: 3600, speed: 2.3, touch: 42, build: buildOmega,
    abilities: ['collapse', 'gravityWell', 'barrage'], telegraph: 1.6
  }
];

// Descripción de cada habilidad para el códex y el aviso en pantalla.
export const BOSS_ABILITIES = {
  barrage:       { name: 'ANDANADA', icon: '✳', desc: 'Doce proyectiles radiales desde el jefe.' },
  charge:        { name: 'EMBESTIDA', icon: '⇉', desc: 'Se telegrafía y cruza la arena en línea recta.' },
  shieldWall:    { name: 'MURO DE ESCUDO', icon: '⛨', desc: 'Despliega un escudo frontal que absorbe daño.' },
  laserCross:    { name: 'CRUZ LÁSER', icon: '✚', desc: 'Cuatro haces giratorios sobre el suelo.' },
  verdict:       { name: 'SENTENCIA', icon: '◎', desc: 'Marca un círculo bajo tus pies: detona al momento.' },
  beamSweep:     { name: 'BARRIDO', icon: '⩙', desc: 'Un haz vertical que gira alrededor del jefe.' },
  summon:        { name: 'INVOCACIÓN', icon: '⋔', desc: 'Añade hostiles de apoyo a la ronda.' },
  spitVolley:    { name: 'ESCUPIDA ÁCIDA', icon: '≡', desc: 'Cono de proyectiles de ácido.' },
  acidPool:      { name: 'CHARCO ÁCIDO', icon: '◍', desc: 'Deja charcos que quitan vida al pisarlos.' },
  locustRing:    { name: 'ANILLO DE LANGOSTAS', icon: '◌', desc: 'Un anillo dañino se expande desde el jefe.' },
  homingBolts:   { name: 'RAYOS GUIADOS', icon: '⌖', desc: 'Proyectiles que te persiguen.' },
  voidRift:      { name: 'GRIETA', icon: '◈', desc: 'Se teletransporta y abre una grieta dañina.' },
  mirrorClones:  { name: 'REFLEJOS', icon: '⋙', desc: 'Crea copias espectrales que desaparecen al golpearlas.' },
  gravityWell:   { name: 'POZO DE GRAVEDAD', icon: '⊙', desc: 'Tira de ti hacia él durante unos segundos.' },
  collapse:      { name: 'COLAPSO', icon: '✹', desc: 'Implosión: sal del radio o recibes el golpe.' }
};

// Paleta por facción: acento, oscuro y estructura.
const PALETTES = {
  SYNTEK: { accent: 0x8fd8e8, dark: 0x1c2a30, solid: 0x465a63 },
  HIVE:   { accent: 0xb6ff3d, dark: 0x24301c, solid: 0x4d5c3a },
  UMBRA:  { accent: 0xb56bff, dark: 0x1d1526, solid: 0x3d3350 },
  HELIX:  { accent: 0x3dffb0, dark: 0x16302a, solid: 0x3f6b5c },
  PYRE:   { accent: 0xff9a3d, dark: 0x2a1610, solid: 0x6b3a22 },
  NULL:   { accent: 0xd8e6ff, dark: 0x101319, solid: 0x5a6474 }
};

export function bossFor(faction, index) {
  const list = BOSSES.filter(b => b.faction === faction);
  return list[clampIndex(index, list.length - 1)] || list[0];
}
function clampIndex(i, max) { return Math.max(0, Math.min(max, i | 0)); }

// Construye la malla del jefe y devuelve el grupo (con userData.legs si camina).
// Además de la silueta, TODOS los jefes reciben:
//   · un anillo de fase en el suelo que crece y cambia de color por fase,
//   · seis fragmentos en órbita que sólo aparecen al entrar en fase 2,
//   · un latido de emisivo que se acelera con la furia.
export function buildBossMesh(kind) {
  const pal = PALETTES[kind.faction] || PALETTES.SYNTEK;
  const A = glow(pal.accent, .9), D = mat(pal.dark, .62, .45), S = mat(pal.solid, .55, .7);
  const g = new THREE.Group();
  kind.build(g, A, D, S);
  g.userData.legs = g.userData.legs || [];

  // --- anillo de fase ------------------------------------------------------
  const ringMat = new THREE.MeshBasicMaterial({
    color: pal.accent, transparent: true, opacity: .32,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const phaseRing = new THREE.Mesh(new THREE.RingGeometry(.88, 1, 64), ringMat);
  phaseRing.rotation.x = -Math.PI / 2;
  phaseRing.position.y = .07;
  phaseRing.scale.setScalar(2.2);
  g.add(phaseRing);
  const ring2Mat = ringMat.clone(); ring2Mat.opacity = .16;
  const phaseRing2 = new THREE.Mesh(new THREE.RingGeometry(.72, .78, 48), ring2Mat);
  phaseRing2.rotation.x = -Math.PI / 2; phaseRing2.position.y = .06; phaseRing2.scale.setScalar(2.9);
  g.add(phaseRing2);

  // --- fragmentos de órbita: ocultos hasta la fase 2 ------------------------
  const shards = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(octCache, A.clone());
    m.scale.setScalar(.22);
    m.visible = false;
    g.add(m); shards.push(m);
  }
  g.userData.phaseRing = phaseRing;
  g.userData.phaseRing2 = phaseRing2;
  g.userData.orbitShards = shards;
  g.userData.accent = pal.accent;

  // Registro de materiales emisivos para el latido de furia.
  const pulses = [];
  g.traverse(o => {
    if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.emissive) {
      pulses.push({ m: o.material, base: o.material.emissiveIntensity });
    }
  });
  g.userData.pulses = pulses;

  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
