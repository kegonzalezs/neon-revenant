// NEON//REVENANT — OPERADORES
// Tres cuerpos construidos desde cero, no tres recoloreados del mismo maniquí.
// La regla de diseño es que cada uno se reconozca por su SILUETA a 30 metros:
//   VANTA  · vertical, estrecho, abrigo largo asimétrico y aletas flotantes.
//   KIRA   · inclinada hacia delante, piernas digitígradas y bufanda que arrastra.
//   ROOK   · ancho y bajo, sin cuello, hombreras enormes y escudo de placa.
// Todos exponen el mismo contrato de userData que consume game.js.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Caché de geometrías: los tres modelos comparten las mismas piezas base.
const geoCache = new Map();
function gbox(w, h, d, r = .04) {
  const key = 'b' + w.toFixed(3) + '_' + h.toFixed(3) + '_' + d.toFixed(3) + '_' + r.toFixed(3);
  let g = geoCache.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) * .4));
    g.userData.shared = true;
    geoCache.set(key, g);
  }
  return g;
}
function gcyl(r1, r2, h, seg = 8) {
  const key = 'c' + r1.toFixed(3) + '_' + r2.toFixed(3) + '_' + h.toFixed(3) + '_' + seg;
  let g = geoCache.get(key);
  if (!g) { g = new THREE.CylinderGeometry(r1, r2, h, seg); g.userData.shared = true; geoCache.set(key, g); }
  return g;
}
function gcone(r, h, seg = 6) {
  const key = 'k' + r.toFixed(3) + '_' + h.toFixed(3) + '_' + seg;
  let g = geoCache.get(key);
  if (!g) { g = new THREE.ConeGeometry(r, h, seg); g.userData.shared = true; geoCache.set(key, g); }
  return g;
}

function part(parent, geo, mat, pos, rot) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(parent, w, h, d, mat, pos, rot, r) { return part(parent, gbox(w, h, d, r === undefined ? .04 : r), mat, pos, rot); }
function cyl(parent, r1, r2, h, mat, pos, rot, seg) { return part(parent, gcyl(r1, r2, h, seg || 8), mat, pos, rot); }
function cone(parent, r, h, mat, pos, rot, seg) { return part(parent, gcone(r, h, seg || 6), mat, pos, rot); }

// Paleta común de cada operador (se recrea al cambiar de personaje).
function palette(color) {
  return {
    accent: new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(.22), emissive: color, emissiveIntensity: .9, roughness: .4, metalness: .5 }),
    secondary: new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(.5), emissive: color, emissiveIntensity: .5, roughness: .5, metalness: .4 }),
    armor: new THREE.MeshStandardMaterial({ color: 0x46545e, roughness: .38, metalness: .82, envMapIntensity: 2.4 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x161f25, roughness: .55, metalness: .8, envMapIntensity: 2.6 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x1d272e, roughness: .95, metalness: .05, envMapIntensity: 1.6 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0a0e11, roughness: .9, metalness: .15 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x08161a, emissive: color, emissiveIntensity: 1.45, roughness: .12, metalness: .7 }),
    // Acero de arma: más claro que la armadura para que el arma se lea contra el
    // cuerpo oscuro del operador.
    steel: new THREE.MeshStandardMaterial({ color: 0x76858f, roughness: .3, metalness: .92, envMapIntensity: 2.8 }),
    gunmetal: new THREE.MeshStandardMaterial({ color: 0x39454d, roughness: .42, metalness: .88, envMapIntensity: 2.4 })
  };
}

// ---------------------------------------------------------------------------
// VANTA — ESPECTRO TÁCTICO: vertical, limpio, abrigo asimétrico.
function buildVanta(P) {
  const g = new THREE.Group();
  box(g, .44, .26, .32, P.dark, [0, .98, 0], null, .06);
  box(g, .4, .2, .28, P.armor, [0, 1.16, 0], null, .05);
  const torso = box(g, .64, .56, .36, P.armor, [0, 1.6, 0], [-.04, 0, 0], .07);
  const chestPlate = box(g, .48, .3, .42, P.armor, [0, 1.63, -.02], null, .06);
  box(g, .3, .05, .44, P.secondary, [0, 1.4, -.01], null, .02);
  box(g, .16, .14, .05, P.accent, [0, 1.66, -.24], null, .02);
  // Cuello alto y cabeza estrecha con visor de una sola ranura.
  box(g, .34, .18, .3, P.dark, [0, 1.9, 0], null, .05);
  const head = box(g, .25, .29, .27, P.dark, [0, 2.13, 0], null, .07);
  const visor = box(g, .23, .05, .05, P.glass, [0, 2.16, -.145], null, .015);
  box(g, .04, .2, .09, P.accent, [0, 2.3, .02], null, .01);
  // Antena lateral con sensor.
  const ant = cyl(g, .008, .012, .34, P.accent, [.14, 2.34, .02], [0, 0, .38], 5);
  const sensor = part(g, new THREE.SphereGeometry(.028, 8, 6), P.accent, [.21, 2.5, .02]);
  // Aletas de hombro flotantes (no tocan el cuerpo: se leen como levitación).
  const shoulders = [];
  for (const x of [-.4, .4]) {
    const fin = box(g, .06, .3, .18, P.accent, [x, 1.86, .02], [0, 0, x > 0 ? -.22 : .22], .02);
    shoulders.push(fin);
  }
  // Abrigo asimétrico: panel izquierdo largo, derecho corto.
  const cloak = new THREE.Group(); g.add(cloak);
  const tailL = box(cloak, .22, 1.0, .03, P.cloth, [-.17, 1.05, .24], [.06, 0, .03], .01);
  const tailR = box(cloak, .2, .58, .03, P.cloth, [.18, 1.28, .23], [.06, 0, -.02], .01);
  box(cloak, .5, .1, .05, P.secondary, [0, 1.82, .24], null, .02);
  const scarf = box(g, .08, .62, .06, P.secondary, [-.3, 1.5, .2], [0, 0, -.12], .02);
  // Brazos.
  const arms = [];
  for (const x of [-.42, .42]) {
    const arm = new THREE.Group(); arm.position.set(x, 1.82, 0); g.add(arm);
    box(arm, .15, .34, .17, P.armor, [0, -.16, 0], null, .05);
    box(arm, .13, .3, .15, P.dark, [0, -.45, -.03], null, .04);
    box(arm, .15, .13, .17, P.rubber, [0, -.63, -.08], null, .04);
    arms.push(arm);
  }
  // Piernas largas.
  const legs = [];
  for (const x of [-.17, .17]) {
    const leg = new THREE.Group(); leg.position.set(x, .96, 0); g.add(leg);
    box(leg, .21, .44, .23, P.armor, [0, -.2, 0], null, .05);
    box(leg, .17, .4, .19, P.dark, [0, -.62, -.01], null, .04);
    box(leg, .19, .09, .19, P.accent, [0, -.5, -.1], null, .02);
    box(leg, .21, .13, .35, P.rubber, [0, -.84, -.06], null, .04);
    legs.push(leg);
  }
  const thrusters = new THREE.Group(); g.add(thrusters);
  for (const x of [-.15, .15]) {
    box(thrusters, .1, .13, .1, P.dark, [x, .82, .2], null, .03);
    const flame = part(thrusters, gcone(.075, .34, 6), P.accent, [x, .6, .2], [Math.PI, 0, 0]);
    flame.material = new THREE.MeshBasicMaterial({ color: P.accent.emissive.getHex(), transparent: true, opacity: .8 });
  }
  thrusters.visible = false;
  const core = detailKit(g, P, { coreY: 1.6, bodyW: .64, backZ: .26, thighY: .74, thighX: .17 });

  return {
    group: g, legs, arms, torso, chestPlate, head, visor, cloak, shoulders, scarf, thrusters,
    heavyArmor: new THREE.Group(), core,
    rest: { torsoY: 1.6, chestY: 1.63, gunZ: -.44, armL: -1.02, armR: -1.24 },
    bodyW: .64
  };
}

// ---------------------------------------------------------------------------
// KIRA — HOSTIGADORA: inclinada, piernas digitígradas, bufanda larga.
function buildKira(P) {
  const g = new THREE.Group();
  box(g, .36, .22, .28, P.dark, [0, 1.0, 0], [.06, 0, 0], .05);
  // Torso estrecho inclinado hacia delante: lee como depredadora.
  const torso = box(g, .48, .56, .32, P.armor, [0, 1.6, -.02], [.14, 0, 0], .06);
  const chestPlate = box(g, .36, .28, .36, P.armor, [0, 1.64, -.06], [.14, 0, 0], .05);
  box(g, .3, .04, .38, P.secondary, [0, 1.42, -.05], null, .015);
  box(g, .14, .12, .05, P.accent, [0, 1.68, -.23], null, .02);
  // Cabeza pequeña con visera de ala ancha y óptica circular.
  const neck = box(g, .2, .12, .2, P.dark, [0, 1.9, -.06], null, .03);
  const head = box(g, .23, .25, .25, P.dark, [0, 2.08, -.08], [.1, 0, 0], .06);
  const brim = box(g, .42, .035, .3, P.armor, [0, 2.16, -.14], [.06, 0, 0], .012);
  const visor = cyl(g, .055, .055, .04, P.glass, [0, 2.07, -.2], [Math.PI / 2, 0, 0], 12);
  box(g, .03, .1, .03, P.accent, [.1, 2.22, -.02], null, .01);
  // Bufanda: tres segmentos que arrastran hacia atrás.
  const scarfRoot = new THREE.Group(); scarfRoot.position.set(0, 1.86, .12); g.add(scarfRoot);
  const scarfSegs = [];
  let sParent = scarfRoot;
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? -.02 : -.02, i === 0 ? .06 : .26);
    sParent.add(seg);
    const w = .16 - i * .03;
    box(seg, w, .05, .28, i === 2 ? P.secondary : P.cloth, [0, 0, .1], null, .012);
    scarfSegs.push(seg); sParent = seg;
  }
  const scarf = scarfRoot;
  // Abrigo abierto: dos faldones largos a los lados.
  const cloak = new THREE.Group(); g.add(cloak);
  for (const x of [-.18, .18]) {
    box(cloak, .17, .92, .03, P.cloth, [x, 1.08, .22], [.1, 0, x > 0 ? .04 : -.04], .01);
  }
  box(cloak, .44, .08, .04, P.secondary, [0, 1.5, .2], null, .015);
  // Hombros afilados hacia arriba.
  const shoulders = [];
  for (const x of [-.34, .34]) {
    const sp = cone(g, .1, .22, P.accent, [x, 1.96, 0], [0, 0, x > 0 ? -.28 : .28], 5);
    shoulders.push(sp);
  }
  // Brazos finos.
  const arms = [];
  for (const x of [-.32, .32]) {
    const arm = new THREE.Group(); arm.position.set(x, 1.8, -.02); g.add(arm);
    box(arm, .11, .32, .13, P.armor, [0, -.15, 0], null, .04);
    box(arm, .1, .3, .11, P.dark, [0, -.44, -.03], null, .03);
    box(arm, .11, .1, .13, P.rubber, [0, -.6, -.07], null, .03);
    arms.push(arm);
  }
  // Piernas digitígradas: muslo al frente, espinilla atrás, metatarso al frente.
  const legs = [];
  for (const x of [-.15, .15]) {
    const leg = new THREE.Group(); leg.position.set(x, .98, 0); g.add(leg);
    box(leg, .17, .4, .19, P.armor, [0, -.18, -.04], [.28, 0, 0], .04);
    box(leg, .13, .38, .15, P.dark, [0, -.5, .04], [-.42, 0, 0], .035);
    box(leg, .13, .07, .1, P.accent, [0, -.36, -.1], null, .02);
    box(leg, .16, .1, .3, P.rubber, [0, -.72, -.1], [.16, 0, 0], .03);
    legs.push(leg);
  }
  const thrusters = new THREE.Group(); g.add(thrusters);
  for (const x of [-.12, .12]) {
    box(thrusters, .08, .1, .08, P.dark, [x, .86, .18], null, .02);
    const flame = part(thrusters, gcone(.06, .3, 6), P.accent, [x, .66, .18], [Math.PI, 0, 0]);
    flame.material = new THREE.MeshBasicMaterial({ color: P.accent.emissive.getHex(), transparent: true, opacity: .8 });
  }
  thrusters.visible = false;
  const core = detailKit(g, P, { coreY: 1.58, bodyW: .48, backZ: .22, thighY: .72, thighX: .15 });

  return {
    group: g, legs, arms, torso, chestPlate, head, visor, cloak, shoulders, scarf, thrusters,
    scarfSegs, brim, core,
    heavyArmor: new THREE.Group(),
    rest: { torsoY: 1.6, chestY: 1.64, gunZ: -.4, armL: -1.16, armR: -1.4 },
    bodyW: .48
  };
}

// ---------------------------------------------------------------------------
// ROOK — FORTALEZA DE ASALTO: ancho, sin cuello, hombreras y escudo.
function buildRook(P) {
  const g = new THREE.Group();
  box(g, .6, .3, .4, P.dark, [0, .96, 0], null, .07);
  box(g, .56, .22, .38, P.armor, [0, 1.16, 0], null, .06);
  const torso = box(g, .92, .58, .5, P.armor, [0, 1.58, 0], [.03, 0, 0], .09);
  const chestPlate = box(g, .78, .42, .16, P.armor, [0, 1.62, -.28], null, .05);
  box(g, .5, .06, .18, P.accent, [0, 1.78, -.34], null, .02);
  cyl(g, .2, .2, .1, P.secondary, [0, 1.5, -.36], [Math.PI / 2, 0, 0], 12);
  // Cabeza hundida entre las hombreras: casi no hay cuello.
  const head = box(g, .3, .28, .3, P.dark, [0, 2.0, -.02], null, .07);
  const visor = box(g, .27, .07, .05, P.glass, [0, 2.02, -.17], null, .02);
  box(g, .07, .1, .3, P.armor, [0, 2.16, 0], null, .02);
  // Hombreras gigantes con pinchos.
  const shoulders = [];
  for (const x of [-.62, .62]) {
    const pad = box(g, .42, .32, .52, P.armor, [x, 1.94, 0], [0, 0, x > 0 ? -.1 : .1], .08);
    box(g, .3, .05, .4, P.accent, [x, 2.1, 0], null, .02);
    cone(g, .07, .2, P.accent, [x, 2.22, 0], [0, 0, 0], 5);
    shoulders.push(pad);
  }
  // Placa pectoral / escudo de asalto en el antebrazo izquierdo.
  const shield = new THREE.Group(); g.add(shield);
  box(shield, .1, 1.0, .62, P.armor, [-.62, 1.34, -.34], [.08, 0, 0], .05);
  box(shield, .028, .6, .05, P.secondary, [-.66, 1.34, -.63], [.08, 0, 0], .012);
  box(shield, .1, .1, .02, P.accent, [-.62, 1.72, -.6], null, .01);
  box(shield, .12, .12, .2, P.secondary, [-.62, 1.86, -.34], null, .02);
  // Brazos gruesos.
  const arms = [];
  for (const x of [-.6, .6]) {
    const arm = new THREE.Group(); arm.position.set(x, 1.84, 0); g.add(arm);
    box(arm, .24, .38, .26, P.armor, [0, -.19, 0], null, .07);
    box(arm, .21, .34, .23, P.dark, [0, -.53, -.03], null, .05);
    box(arm, .23, .16, .25, P.rubber, [0, -.73, -.09], null, .05);
    arms.push(arm);
  }
  // Piernas cortas y muy anchas.
  const legs = [];
  for (const x of [-.26, .26]) {
    const leg = new THREE.Group(); leg.position.set(x, .94, 0); g.add(leg);
    box(leg, .3, .42, .32, P.armor, [0, -.2, 0], null, .07);
    box(leg, .26, .34, .28, P.dark, [0, -.58, 0], null, .05);
    cyl(leg, .06, .06, .3, P.secondary, [.14, -.4, -.12], [0, 0, 0], 6);
    box(leg, .3, .16, .42, P.rubber, [0, -.8, -.05], null, .05);
    legs.push(leg);
  }
  const thrusters = new THREE.Group(); g.add(thrusters);
  for (const x of [-.2, .2]) {
    box(thrusters, .14, .16, .14, P.dark, [x, .8, .24], null, .03);
    const flame = part(thrusters, gcone(.1, .3, 6), P.accent, [x, .6, .24], [Math.PI, 0, 0]);
    flame.material = new THREE.MeshBasicMaterial({ color: P.accent.emissive.getHex(), transparent: true, opacity: .8 });
  }
  thrusters.visible = false;
  const heavyArmor = new THREE.Group(); g.add(heavyArmor);
  box(heavyArmor, 1.06, .12, .56, P.armor, [0, 1.86, 0], null, .04);
  box(heavyArmor, .2, .5, .14, P.dark, [0, 1.5, .3], null, .03);

  const core = detailKit(g, P, { coreY: 1.56, bodyW: .92, backZ: .34, thighY: .7, thighX: .26 });

  return {
    group: g, legs, arms, torso, chestPlate, head, visor, cloak: new THREE.Group(), shoulders, scarf: box(g, .1, .5, .05, P.secondary, [.34, 1.4, .26], [0, 0, .1], .02), thrusters, heavyArmor, shield, core,
    rest: { torsoY: 1.58, chestY: 1.62, gunZ: -.46, armL: -1.0, armR: -1.22 },
    bodyW: .92
  };
}

// ---------------------------------------------------------------------------
// KIT DE DETALLE COMÚN
// Lo que separa un muñeco de un operador: costuras luminosas, placas de muslo,
// suela con tacos, brazales, cables de cuello y un núcleo dorsal que late con la
// sobrecarga. Se añade al final de cada cuerpo con sus propias medidas.
function detailKit(g, P, o) {
  const { coreY, bodyW, backZ, thighY, thighX } = o;
  // Núcleo dorsal: la fuente de luz del operador. game.js lo hace latir.
  const core = new THREE.Group();
  core.position.set(0, coreY, backZ);
  g.add(core);
  const socket = new THREE.Mesh(new THREE.TorusGeometry(.085, .018, 6, 14), P.armor);
  socket.rotation.x = Math.PI / 2; socket.castShadow = true; core.add(socket);
  const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(.055, 0), P.glass);
  core.add(bulb);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(.13, .006, 4, 20), P.accent);
  halo.rotation.x = Math.PI / 2; core.add(halo);
  core.userData.bulb = bulb; core.userData.halo = halo;
  // Costuras de energía: dos tiras finas por el pecho.
  for (const x of [-1, 1]) {
    box(g, .014, .3, .012, P.accent, [x * bodyW * .3, coreY - .02, -backZ * 1.15], [.06, 0, x * .05], .004);
  }
  // Cables de cuello.
  for (const x of [-1, 1]) {
    const c = cyl(g, .012, .012, .22, P.rubber, [x * .1, coreY + .24, -.05], [.3, 0, x * .25], 5);
    c.castShadow = false;
  }
  // Placas de muslo y suela con tacos.
  for (const x of [-1, 1]) {
    box(g, .1, .16, .04, P.plate, [x * thighX, thighY, -.16], [.1, 0, 0], .012);
    box(g, .015, .1, .012, P.accent, [x * thighX, thighY, -.185], [.1, 0, 0], .004);
  }
  return core;
}

// ---------------------------------------------------------------------------
// ARMAS
// Cada familia es un objeto distinto, no una caja con un cañón pegado: culata,
// cargador, guardamanos ventilado, óptica, bobinas y boca de fuego. Todas
// exponen el mismo contrato: { group, muzzle, bolt, glow }.
//   · bolt  → pieza que retrocede con el disparo (animación de retroceso real).
//   · glow  → material emisivo del arma, para que la cadencia se vea.
//   · muzzle→ punto de salida de la bala y del fogonazo.

function torus(parent, r, t, mat, pos, rot, seg, rseg) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, seg || 6, rseg || 14), mat);
  m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function buildWeapons(g, P, id) {
  const weapons = {};

  function make(kind) {
    const w = new THREE.Group();
    w.position.set(.34, 1.5, -.48);
    g.add(w);
    const muzzle = new THREE.Object3D();
    const bolt = new THREE.Group();
    w.add(bolt);

    if (kind === 'cannon') {
      // --- CAÑÓN ROTATIVO -------------------------------------------------
      box(w, .26, .3, .66, P.gunmetal, [0, 0, -.16], null, .05);
      box(w, .22, .16, .5, P.armor, [0, .2, -.2], null, .04);
      // Carcasa de refrigeración con ranuras.
      for (let i = 0; i < 5; i++) box(w, .27, .02, .05, P.plate, [0, .04, -.34 - i * .06], null, .008);
      // Tambor de munición lateral.
      cyl(w, .13, .13, .16, P.armor, [.2, -.06, .02], [0, 0, Math.PI / 2], 12);
      torus(w, .13, .022, P.plate, [.29, -.06, .02], [0, Math.PI / 2, 0], 6, 14);
      // Grupo de tres cañones.
      const spin = new THREE.Group(); spin.name = 'barrels'; spin.position.set(0, .02, -.58); w.add(spin);
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3;
        cyl(spin, .05, .05, .58, P.steel, [Math.cos(a) * .075, Math.sin(a) * .075, -.28], [Math.PI / 2, 0, 0], 8);
        torus(spin, .05, .012, P.accent, [Math.cos(a) * .075, Math.sin(a) * .075, -.5], [0, 0, 0], 5, 10);
      }
      cyl(w, .13, .11, .1, P.plate, [0, .02, -.9], [Math.PI / 2, 0, 0], 12);
      // Pistones de retroceso visibles a los lados.
      for (const x of [-.14, .14]) {
        cyl(w, .022, .022, .34, P.plate, [x, -.12, -.24], [Math.PI / 2, 0, 0], 6);
        torus(w, .03, .01, P.accent, [x, -.12, -.08], [0, 0, 0], 5, 10);
      }
      // Empuñadura y culata.
      box(w, .12, .26, .16, P.rubber, [0, -.24, .14], [.28, 0, 0], .04);
      box(w, .1, .14, .26, P.dark, [0, -.02, .32], null, .03);
      box(w, .12, .05, .2, P.accent, [0, .08, .3], null, .015);
      // Indicador de carga.
      const glow = box(bolt, .03, .03, .3, P.glass, [.14, .1, -.2], null, .01);
      box(bolt, .1, .1, .18, P.armor, [0, .02, -.1], null, .03);
      muzzle.position.set(0, .02, -1.05);
    } else if (kind === 'needle') {
      // --- LANZA DE AGUJA -------------------------------------------------
      box(w, .16, .18, .5, P.gunmetal, [0, 0, -.1], null, .04);
      box(w, .1, .06, .44, P.armor, [0, .13, -.12], null, .02);
      // Dos raíles paralelos con puentes.
      for (const x of [-.05, .05]) box(w, .024, .032, .86, P.steel, [x, .04, -.62], null, .006);
      for (let i = 0; i < 4; i++) box(w, .13, .025, .03, P.armor, [0, .04, -.3 - i * .2], null, .006);
      // Bobinas de aceleración.
      for (let i = 0; i < 3; i++) torus(w, .062, .014, P.accent, [0, .04, -.38 - i * .16], [Math.PI / 2, 0, 0], 5, 12);
      // Núcleo de energía entre los raíles.
      box(w, .03, .03, .62, P.glass, [0, .04, -.62], null, .006);
      // Bocas de descarga.
      for (const x of [-.06, .06]) cone(w, .03, .16, P.plate, [x, .04, -1.02], [-Math.PI / 2, 0, 0], 5);
      // Óptica y pantalla lateral.
      box(w, .08, .07, .16, P.dark, [0, .2, -.12], null, .02);
      box(w, .05, .05, .02, P.glass, [0, .2, -.21], null, .008);
      box(w, .02, .1, .2, P.accent, [.09, .02, -.06], null, .006);
      // Culata y empuñadura.
      box(w, .1, .12, .24, P.dark, [0, -.02, .28], null, .02);
      box(w, .1, .22, .1, P.rubber, [0, -.2, .1], [.3, 0, 0], .03);
      const glow = box(bolt, .04, .04, .2, P.glass, [0, .04, -.5], null, .008);
      box(bolt, .08, .08, .12, P.armor, [0, .04, -.16], null, .02);
      muzzle.position.set(0, .04, -1.14);
    } else if (kind === 'arcer') {
      // --- ARCO VX: bobina abierta con dos electrodos y arco entre medias --
      box(w, .2, .22, .58, P.gunmetal, [0, 0, -.12], null, .05);
      box(w, .12, .06, .4, P.armor, [0, .16, -.14], null, .02);
      // Dos electrodos que avanzan en paralelo.
      for (const x of [-.09, .09]) {
        box(w, .03, .03, .74, P.steel, [x, .05, -.55], null, .008);
        cone(w, .035, .18, P.plate, [x, .05, -1.0], [-Math.PI / 2, 0, 0], 5);
      }
      // Bobinas de inducción: el arco salta entre ellas.
      for (let i = 0; i < 4; i++) torus(w, .085, .016, P.accent, [0, .05, -.32 - i * .16], [Math.PI / 2, 0, 0], 5, 12);
      // Núcleo de plasma entre los electrodos.
      box(w, .035, .035, .5, P.glass, [0, .05, -.55], null, .008);
      // Depósito y empuñadura.
      cyl(w, .11, .11, .3, P.dark, [0, -.2, .04], [.2, 0, 0], 10);
      box(w, .1, .22, .11, P.rubber, [0, -.18, .14], [-.2, 0, 0], .03);
      box(w, .09, .1, .26, P.dark, [0, -.02, .32], null, .02);
      // Pantalla de carga lateral.
      box(w, .02, .12, .2, P.accent, [.11, .02, -.06], null, .006);
      const glow = box(bolt, .05, .05, .22, P.glass, [0, .05, -.52], null, .01);
      muzzle.position.set(0, .05, -1.06);
    } else if (kind === 'flamer') {
      // --- LANZALLAMAS: tanques gemelos y boquilla con piloto siempre vivo --
      box(w, .22, .2, .46, P.gunmetal, [0, 0, -.08], null, .05);
      // Dos tanques de combustible, uno a cada lado.
      for (const x of [-.13, .13]) {
        cyl(w, .09, .09, .5, P.armor, [x, .02, -.14], [Math.PI / 2, 0, 0], 10);
        torus(w, .09, .018, P.plate, [x, .02, -.38], [Math.PI / 2, 0, 0], 5, 12);
        torus(w, .09, .018, P.plate, [x, .02, .1], [Math.PI / 2, 0, 0], 5, 12);
      }
      // Tubería flexible hasta la boquilla.
      cyl(w, .04, .04, .38, P.dark, [0, -.04, -.5], [Math.PI / 2, 0, 0], 8);
      // Boquilla acampanada con piloto.
      cyl(w, .07, .12, .22, P.steel, [0, .01, -.74], [Math.PI / 2, 0, 0], 10);
      const pilot = torus(w, .1, .022, P.accent, [0, .01, -.86], [Math.PI / 2, 0, 0], 5, 14);
      pilot.name = 'pilot';
      // Mango y guardamanos.
      box(w, .1, .2, .1, P.rubber, [0, -.2, .12], [-.22, 0, 0], .03);
      box(w, .14, .1, .2, P.dark, [0, -.06, -.32], null, .03);
      box(w, .09, .12, .24, P.dark, [0, .02, .3], null, .02);
      box(w, .02, .1, .18, P.accent, [-.12, .02, -.02], null, .006);
      const glow = box(bolt, .07, .07, .12, P.glass, [0, .01, -.8], null, .014);
      muzzle.position.set(0, .01, -.92);
    } else if (kind === 'prism') {
      // --- PRISMA 3: tres cristales en abanico que refractan la luz --------
      box(w, .18, .2, .44, P.gunmetal, [0, 0, -.1], null, .045);
      // Tambor de tres lentes giratorias.
      const drums = new THREE.Group(); drums.name = 'drums'; drums.position.set(0, .05, -.4); w.add(drums);
      for (let i = 0; i < 3; i++) {
        const a = i * 2.094;
        const lens = new THREE.Mesh(new THREE.OctahedronGeometry(.085, 0), P.glass);
        lens.position.set(Math.cos(a) * .11, Math.sin(a) * .11, 0);
        drums.add(lens);
      }
      torus(w, .16, .02, P.accent, [0, .05, -.4], [0, 0, 0], 5, 16);
      // Cañón corto y anillo de dispersión.
      cyl(w, .05, .05, .34, P.steel, [0, .05, -.62], [Math.PI / 2, 0, 0], 8);
      torus(w, .11, .022, P.plate, [0, .05, -.78], [0, 0, 0], 5, 14);
      // Cuerpo y empuñadura.
      box(w, .1, .26, .12, P.armor, [0, -.24, -.02], [.14, 0, 0], .03);
      box(w, .1, .2, .11, P.rubber, [0, -.18, .14], [-.2, 0, 0], .03);
      box(w, .09, .12, .26, P.dark, [0, .02, .3], null, .02);
      // Mirilla de cristal.
      box(w, .07, .06, .14, P.dark, [0, .21, -.12], null, .015);
      box(w, .05, .04, .01, P.glass, [0, .21, -.2], null, .006);
      const glow = box(bolt, .06, .06, .14, P.glass, [0, .05, -.6], null, .012);
      muzzle.position.set(0, .05, -.86);
    } else if (kind === 'lance') {
      // --- LANZA LARGA: riel descomunal con freno de boca triple -----------
      box(w, .2, .24, .8, P.gunmetal, [0, 0, -.3], null, .05);
      box(w, .12, .07, .7, P.armor, [0, .16, -.34], null, .02);
      // Riel principal larguísimo con puentes.
      for (const x of [-.06, .06]) box(w, .028, .038, 1.34, P.steel, [x, .04, -.92], null, .007);
      for (let i = 0; i < 6; i++) box(w, .16, .028, .035, P.armor, [0, .04, -.38 - i * .22], null, .007);
      // Bobinas de aceleración de gran diámetro.
      for (let i = 0; i < 4; i++) torus(w, .085, .018, P.accent, [0, .04, -.5 - i * .24], [Math.PI / 2, 0, 0], 5, 14);
      // Núcleo y freno de boca triple.
      box(w, .035, .035, 1.05, P.glass, [0, .04, -.92], null, .008);
      for (const x of [-.07, 0, .07]) cone(w, .032, .2, P.plate, [x, .04, -1.54], [-Math.PI / 2, 0, 0], 5);
      // Culata pesada, bipode y óptica de francotirador.
      box(w, .12, .16, .34, P.dark, [0, -.02, .5], null, .03);
      box(w, .13, .24, .06, P.armor, [0, -.05, .68], null, .02);
      for (const x of [-.1, .1]) box(w, .025, .025, .3, P.steel, [x, -.16, -.6], [.5, 0, x * .3], .006);
      box(w, .09, .09, .3, P.dark, [0, .24, -.3], null, .02);
      box(w, .07, .07, .01, P.glass, [0, .24, -.46], null, .008);
      box(w, .1, .2, .11, P.rubber, [0, -.2, .18], [-.22, 0, 0], .03);
      const glow = box(bolt, .05, .05, .3, P.glass, [0, .04, -.8], null, .01);
      muzzle.position.set(0, .04, -1.62);
    } else {
      // --- SUBFUSIL COMPACTO ---------------------------------------------
      box(w, .19, .22, .62, P.gunmetal, [0, 0, -.14], null, .04);
      box(w, .15, .07, .5, P.armor, [0, .16, -.16], null, .02);
      // Riel picatinny.
      for (let i = 0; i < 6; i++) box(w, .13, .022, .035, P.plate, [0, .21, -.34 + i * .06], null, .006);
      // Guardamanos ventilado.
      box(w, .16, .15, .34, P.steel, [0, -.01, -.56], null, .03);
      for (let i = 0; i < 3; i++) box(w, .17, .04, .04, P.dark, [0, .0, -.44 - i * .09], null, .01);
      // Cañón y boca de fuego.
      cyl(w, .035, .035, .3, P.steel, [0, .02, -.86], [Math.PI / 2, 0, 0], 8);
      cyl(w, .055, .05, .09, P.plate, [0, .02, -1.0], [Math.PI / 2, 0, 0], 10);
      // Cargador curvado y empuñadura.
      box(w, .1, .3, .13, P.armor, [0, -.26, -.02], [.16, 0, 0], .03);
      box(w, .09, .06, .12, P.plate, [0, -.4, -.06], [.16, 0, 0], .02);
      box(w, .1, .2, .11, P.rubber, [0, -.19, .16], [-.22, 0, 0], .03);
      // Culata plegable.
      box(w, .08, .1, .3, P.dark, [0, -.01, .34], null, .02);
      box(w, .09, .18, .05, P.armor, [0, -.04, .48], null, .015);
      // Óptica holográfica.
      box(w, .07, .06, .12, P.dark, [0, .26, -.18], null, .015);
      box(w, .05, .04, .01, P.glass, [0, .26, -.25], null, .006);
      // Tira de estado y contador.
      box(w, .012, .022, .22, P.accent, [.1, .04, -.16], null, .004);
      box(w, .012, .022, .22, P.accent, [-.1, .04, -.16], null, .004);
      const glow = box(bolt, .06, .05, .16, P.armor, [0, .06, -.36], null, .02);
      box(bolt, .02, .02, .1, P.glass, [.08, .1, -.3], null, .005);
      muzzle.position.set(0, .02, -1.08);
    }

    w.add(muzzle);
    w.visible = false;
    return { group: w, muzzle, bolt, glow: P.glass };
  }

  weapons.smg = make('smg');
  weapons.cannon = make('cannon');
  weapons.needle = make('needle');
  weapons.arcer = make('arcer');
  weapons.flamer = make('flamer');
  weapons.prism = make('prism');
  weapons.lance = make('lance');
  return weapons;
}

// ===========================================================================
// SEGUNDA HORNADA DE OPERADORES
// La regla sigue siendo la silueta: cada uno se reconoce a 30 metros sin ver
// el color. Se reutilizan las mismas piezas base del caché de geometrías.
// ===========================================================================

// NYX — SABOTEADORA: agachada, huesuda, con capucha de cables y tres antenas.
function buildNyx(P) {
  const g = new THREE.Group();
  box(g, .38, .22, .28, P.dark, [0, .96, 0], null, .05);
  const torso = box(g, .52, .5, .3, P.armor, [0, 1.52, 0], [.1, 0, 0], .06);
  const chestPlate = box(g, .4, .26, .34, P.armor, [0, 1.56, -.02], null, .05);
  box(g, .26, .04, .36, P.secondary, [0, 1.34, -.01], null, .02);
  // Capucha de cables: no es tela, son líneas sueltas.
  const hood = new THREE.Group(); g.add(hood);
  box(hood, .3, .26, .3, P.dark, [0, 2.02, .02], [-.2, 0, 0], .07);
  for (let i = 0; i < 5; i++) cyl(hood, .008, .008, .3, P.accent, [-.12 + i * .06, 1.9, .16], [.3, 0, (i - 2) * .12], 5);
  const head = box(g, .22, .25, .24, P.dark, [0, 2.06, 0], null, .06);
  const visor = box(g, .2, .045, .05, P.glass, [0, 2.08, -.13], null, .014);
  // Tres antenas finas: la seña de identidad.
  for (const x of [-.16, 0, .16]) {
    cyl(g, .006, .008, .3 + Math.abs(x), P.accent, [x, 2.36, .04], [0, 0, x * 1.2], 5);
    part(g, new THREE.SphereGeometry(.024, 8, 6), P.accent, [x * 1.4, 2.5 + Math.abs(x) * .2, .04]);
  }
  const shoulders = [];
  for (const x of [-.34, .34]) shoulders.push(box(g, .05, .24, .16, P.accent, [x, 1.78, .02], [0, 0, x > 0 ? -.18 : .18], .02));
  const cloak = new THREE.Group(); g.add(cloak);
  box(cloak, .2, .8, .03, P.cloth, [-.15, 1.1, .2], [.04, 0, .04], .01);
  box(cloak, .18, .5, .03, P.cloth, [.15, 1.26, .2], [.04, 0, -.03], .01);
  const scarf = box(g, .07, .5, .05, P.secondary, [-.26, 1.44, .18], [0, 0, -.14], .02);
  const arms = [];
  for (const x of [-.36, .36]) {
    const arm = new THREE.Group(); arm.position.set(x, 1.74, 0); g.add(arm);
    box(arm, .13, .3, .15, P.armor, [0, -.15, 0], null, .045);
    box(arm, .11, .28, .13, P.dark, [0, -.42, -.03], null, .035);
    box(arm, .13, .11, .15, P.rubber, [0, -.58, -.08], null, .035);
    arms.push(arm);
  }
  const legs = [];
  for (const x of [-.15, .15]) {
    const leg = new THREE.Group(); leg.position.set(x, .94, 0); g.add(leg);
    box(leg, .18, .42, .2, P.armor, [0, -.19, 0], null, .045);
    box(leg, .15, .38, .17, P.dark, [0, -.6, -.01], null, .035);
    box(leg, .17, .08, .17, P.accent, [0, -.48, -.09], null, .02);
    box(leg, .19, .12, .32, P.rubber, [0, -.8, -.06], null, .035);
    legs.push(leg);
  }
  const thrusters = new THREE.Group(); g.add(thrusters);
  for (const x of [-.13, .13]) {
    box(thrusters, .09, .12, .09, P.dark, [x, .8, .18], null, .025);
    const flame = part(thrusters, gcone(.07, .32, 6), P.accent, [x, .58, .18], [Math.PI, 0, 0]);
    flame.material = new THREE.MeshBasicMaterial({ color: P.accent.emissive.getHex(), transparent: true, opacity: .8 });
  }
  thrusters.visible = false;
  const core = detailKit(g, P, { coreY: 1.52, bodyW: .52, backZ: .22, thighY: .72, thighX: .15 });
  return {
    group: g, legs, arms, torso, chestPlate, head, visor, cloak, shoulders, scarf, thrusters,
    heavyArmor: new THREE.Group(), core,
    rest: { torsoY: 1.52, chestY: 1.56, gunZ: -.4, armL: -1.06, armR: -1.3 }, bodyW: .52
  };
}

// PYRE — INCENDIARIA: tanques a la espalda, traje ignífugo y parrilla pectoral.
function buildPyre(P) {
  const g = new THREE.Group();
  box(g, .46, .26, .34, P.dark, [0, .98, 0], null, .06);
  const torso = box(g, .68, .58, .38, P.armor, [0, 1.6, 0], null, .07);
  const chestPlate = box(g, .5, .32, .44, P.armor, [0, 1.62, -.02], null, .06);
  // Parrilla pectoral: rendijas por las que se ve el calor.
  for (let i = 0; i < 4; i++) box(g, .34, .035, .05, P.accent, [0, 1.52 + i * .09, -.23], null, .008);
  box(g, .18, .14, .05, P.accent, [0, 1.7, -.25], null, .02);
  box(g, .36, .16, .32, P.dark, [0, 1.92, 0], null, .05);
  const head = box(g, .27, .28, .28, P.dark, [0, 2.14, 0], null, .07);
  // Máscara respiratoria: filtros gemelos delante de la boca.
  box(g, .24, .12, .1, P.armor, [0, 2.04, -.16], null, .03);
  for (const x of [-.08, .08]) cyl(g, .05, .05, .1, P.plate, [x, 2.04, -.22], [Math.PI / 2, 0, 0], 8);
  const visor = box(g, .24, .06, .05, P.glass, [0, 2.2, -.15], null, .015);
  // Dos tanques de combustible a la espalda con válvula.
  const shoulders = [];
  for (const x of [-.25, .25]) {
    cyl(g, .13, .13, .62, P.plate, [x, 1.7, .3], null, 10);
    torus(g, .13, .022, P.accent, [x, 1.98, .3], [Math.PI / 2, 0, 0], 5, 12);
    shoulders.push(box(g, .06, .26, .18, P.accent, [x * 1.7, 1.86, .04], [0, 0, x > 0 ? -.2 : .2], .02));
  }
  cyl(g, .035, .035, .2, P.steel, [0, 2.02, .3], null, 6);
  const cloak = new THREE.Group(); g.add(cloak);
  box(cloak, .26, .7, .04, P.cloth, [-.19, 1.16, .26], [.05, 0, .03], .01);
  const scarf = box(g, .09, .46, .06, P.secondary, [.3, 1.46, .24], [0, 0, .1], .02);
  const arms = [];
  for (const x of [-.45, .45]) {
    const arm = new THREE.Group(); arm.position.set(x, 1.84, 0); g.add(arm);
    box(arm, .17, .34, .18, P.armor, [0, -.16, 0], null, .05);
    box(arm, .15, .3, .16, P.dark, [0, -.46, -.03], null, .04);
    box(arm, .17, .13, .18, P.rubber, [0, -.64, -.08], null, .04);
    arms.push(arm);
  }
  const legs = [];
  for (const x of [-.19, .19]) {
    const leg = new THREE.Group(); leg.position.set(x, .96, 0); g.add(leg);
    box(leg, .23, .44, .25, P.armor, [0, -.2, 0], null, .05);
    box(leg, .19, .4, .21, P.dark, [0, -.62, -.01], null, .04);
    box(leg, .21, .09, .21, P.accent, [0, -.5, -.1], null, .02);
    box(leg, .23, .13, .37, P.rubber, [0, -.84, -.06], null, .04);
    legs.push(leg);
  }
  const thrusters = new THREE.Group(); g.add(thrusters);
  for (const x of [-.17, .17]) {
    box(thrusters, .11, .14, .11, P.dark, [x, .82, .22], null, .03);
    const flame = part(thrusters, gcone(.085, .38, 6), P.accent, [x, .58, .22], [Math.PI, 0, 0]);
    flame.material = new THREE.MeshBasicMaterial({ color: P.accent.emissive.getHex(), transparent: true, opacity: .85 });
  }
  thrusters.visible = false;
  const core = detailKit(g, P, { coreY: 1.6, bodyW: .68, backZ: .32, thighY: .74, thighX: .19 });
  return {
    group: g, legs, arms, torso, chestPlate, head, visor, cloak, shoulders, scarf, thrusters,
    heavyArmor: new THREE.Group(), core,
    rest: { torsoY: 1.6, chestY: 1.62, gunZ: -.46, armL: -1.0, armR: -1.22 }, bodyW: .68
  };
}

// AEGIS — BALUARTE: ancho, con escudo de torre y faldón de placas.
function buildAegis(P) {
  const g = new THREE.Group();
  box(g, .56, .3, .42, P.dark, [0, .96, 0], null, .07);
  const torso = box(g, .88, .62, .5, P.armor, [0, 1.58, 0], null, .08);
  const chestPlate = box(g, .64, .38, .56, P.armor, [0, 1.6, -.02], null, .07);
  box(g, .4, .06, .6, P.secondary, [0, 1.34, -.01], null, .025);
  box(g, .22, .18, .06, P.accent, [0, 1.64, -.31], null, .025);
  // Casco cerrado: un bloque con una sola ranura y cuello de placas.
  box(g, .4, .14, .34, P.plate, [0, 1.94, 0], null, .04);
  const head = box(g, .32, .3, .32, P.armor, [0, 2.14, 0], null, .07);
  const visor = box(g, .28, .05, .05, P.glass, [0, 2.16, -.17], null, .015);
  box(g, .06, .24, .1, P.accent, [0, 2.32, .02], null, .012);
  const shoulders = [];
  for (const x of [-.56, .56]) shoulders.push(box(g, .08, .32, .22, P.accent, [x, 1.84, .02], [0, 0, x > 0 ? -.2 : .2], .025));
  // Escudo de torre: se lleva en el brazo izquierdo y se lee de frente.
  const shield = new THREE.Group(); g.add(shield);
  box(shield, .1, 1.1, .78, P.armor, [-.72, 1.5, -.1], [0, 0, .06], .05);
  box(shield, .06, .9, .62, P.plate, [-.78, 1.5, -.1], [0, 0, .06], .03);
  box(shield, .04, .8, .07, P.accent, [-.82, 1.5, -.1], [0, 0, .06], .015);
  // Faldón de placas hasta media pierna.
  const cloak = new THREE.Group(); g.add(cloak);
  for (let i = 0; i < 3; i++) box(cloak, .6 + i * .06, .22, .04, P.plate, [0, 1.2 - i * .2, .26 - i * .02], [.06, 0, 0], .02);
  const scarf = box(g, .12, .4, .06, P.secondary, [-.36, 1.42, .28], [0, 0, -.1], .02);
  const arms = [];
  for (const x of [-.56, .56]) {
    const arm = new THREE.Group(); arm.position.set(x, 1.8, 0); g.add(arm);
    box(arm, .2, .36, .2, P.armor, [0, -.17, 0], null, .055);
    box(arm, .17, .32, .18, P.dark, [0, -.48, -.03], null, .045);
    box(arm, .19, .14, .2, P.rubber, [0, -.68, -.08], null, .045);
    arms.push(arm);
  }
  const legs = [];
  for (const x of [-.24, .24]) {
    const leg = new THREE.Group(); leg.position.set(x, .94, 0); g.add(leg);
    box(leg, .27, .44, .29, P.armor, [0, -.2, 0], null, .055);
    box(leg, .22, .4, .24, P.dark, [0, -.62, -.01], null, .045);
    box(leg, .25, .1, .25, P.accent, [0, -.5, -.1], null, .022);
    box(leg, .27, .15, .42, P.rubber, [0, -.84, -.06], null, .045);
    legs.push(leg);
  }
  const thrusters = new THREE.Group(); g.add(thrusters);
  for (const x of [-.22, .22]) {
    box(thrusters, .13, .16, .13, P.dark, [x, .8, .26], null, .03);
    const flame = part(thrusters, gcone(.1, .34, 6), P.accent, [x, .58, .26], [Math.PI, 0, 0]);
    flame.material = new THREE.MeshBasicMaterial({ color: P.accent.emissive.getHex(), transparent: true, opacity: .8 });
  }
  thrusters.visible = false;
  const heavyArmor = new THREE.Group(); g.add(heavyArmor);
  box(heavyArmor, .96, .12, .5, P.armor, [0, 1.86, 0], null, .04);
  const core = detailKit(g, P, { coreY: 1.58, bodyW: .88, backZ: .3, thighY: .7, thighX: .24 });
  return {
    group: g, legs, arms, torso, chestPlate, head, visor, cloak, shoulders, scarf, thrusters,
    heavyArmor, shield, core,
    rest: { torsoY: 1.58, chestY: 1.6, gunZ: -.48, armL: -.96, armR: -1.18 }, bodyW: .88
  };
}

// GLITCH — ANOMALÍA: el cuerpo se desplaza en capas, como una señal que salta.
function buildGlitch(P) {
  const g = new THREE.Group();
  box(g, .4, .24, .3, P.dark, [0, .96, 0], null, .05);
  // Torso partido en tres capas desplazadas: la silueta "vibra" sola.
  const torso = box(g, .58, .2, .34, P.armor, [0, 1.72, 0], [0, 0, .04], .06);
  box(g, .56, .2, .32, P.plate, [0, 1.52, -.02], [0, 0, -.05], .06);
  box(g, .54, .2, .3, P.armor, [0, 1.32, .01], [0, 0, .03], .06);
  const chestPlate = box(g, .44, .16, .38, P.armor, [0, 1.72, -.02], null, .05);
  box(g, .16, .12, .05, P.accent, [0, 1.74, -.22], null, .02);
  const head = box(g, .26, .28, .26, P.dark, [0, 2.14, 0], null, .06);
  // Dos visores desalineados: uno por ojo, a distinta altura.
  const visor = box(g, .11, .05, .05, P.glass, [-.06, 2.16, -.14], null, .012);
  box(g, .11, .05, .05, P.glass, [.07, 2.1, -.14], null, .012);
  const shoulders = [];
  for (const x of [-.38, .38]) shoulders.push(box(g, .05, .26, .16, P.accent, [x, 1.84, .02], [0, 0, x > 0 ? -.25 : .25], .02));
  // Fragmentos flotando alrededor: la anomalía se desprende pedazos.
  const cloak = new THREE.Group(); g.add(cloak);
  for (let i = 0; i < 5; i++) {
    const a = i * 1.256;
    const f = part(cloak, new THREE.OctahedronGeometry(.07, 0), P.accent,
      [Math.cos(a) * .48, 1.4 + Math.sin(a * 2) * .4, Math.sin(a) * .48]);
    f.name = 'frag' + i;
  }
  const scarf = box(g, .08, .5, .05, P.secondary, [-.28, 1.46, .2], [0, 0, -.16], .02);
  const arms = [];
  for (const x of [-.4, .4]) {
    const arm = new THREE.Group(); arm.position.set(x, 1.82, 0); g.add(arm);
    box(arm, .14, .16, .16, P.armor, [0, -.07, 0], null, .045);
    box(arm, .12, .16, .14, P.dark, [0, -.24, -.03], null, .035);
    box(arm, .13, .14, .15, P.armor, [0, -.4, .02], null, .04);
    box(arm, .13, .11, .15, P.rubber, [0, -.58, -.06], null, .035);
    arms.push(arm);
  }
  const legs = [];
  for (const x of [-.16, .16]) {
    const leg = new THREE.Group(); leg.position.set(x, .94, 0); g.add(leg);
    box(leg, .19, .22, .21, P.armor, [0, -.1, 0], null, .045);
    box(leg, .16, .22, .18, P.dark, [0, -.32, -.01], null, .035);
    box(leg, .18, .08, .18, P.accent, [0, -.46, -.09], null, .02);
    box(leg, .19, .12, .33, P.rubber, [0, -.78, -.06], null, .035);
    legs.push(leg);
  }
  const thrusters = new THREE.Group(); g.add(thrusters);
  for (const x of [-.14, .14]) {
    box(thrusters, .09, .12, .09, P.dark, [x, .8, .2], null, .025);
    const flame = part(thrusters, gcone(.07, .32, 6), P.accent, [x, .58, .2], [Math.PI, 0, 0]);
    flame.material = new THREE.MeshBasicMaterial({ color: P.accent.emissive.getHex(), transparent: true, opacity: .8 });
  }
  thrusters.visible = false;
  const core = detailKit(g, P, { coreY: 1.6, bodyW: .58, backZ: .24, thighY: .72, thighX: .16 });
  return {
    group: g, legs, arms, torso, chestPlate, head, visor, cloak, shoulders, scarf, thrusters,
    heavyArmor: new THREE.Group(), core,
    rest: { torsoY: 1.62, chestY: 1.72, gunZ: -.42, armL: -1.04, armR: -1.28 }, bodyW: .58
  };
}

// SERAPH — SOPORTE: esbelto, con halo de sensores y tres nodos médicos.
function buildSeraph(P) {
  const g = new THREE.Group();
  box(g, .4, .24, .3, P.dark, [0, .98, 0], null, .05);
  const torso = box(g, .54, .54, .32, P.armor, [0, 1.58, 0], null, .06);
  const chestPlate = box(g, .42, .3, .36, P.armor, [0, 1.6, -.02], null, .055);
  box(g, .28, .05, .4, P.secondary, [0, 1.36, -.01], null, .02);
  // cruz médica en el pecho: se lee a distancia.
  box(g, .06, .2, .04, P.accent, [0, 1.58, -.19], null, .01);
  box(g, .2, .06, .04, P.accent, [0, 1.58, -.19], null, .01);
  box(g, .34, .16, .3, P.dark, [0, 1.92, 0], null, .05);
  const head = box(g, .24, .28, .26, P.dark, [0, 2.14, 0], null, .065);
  const visor = box(g, .22, .05, .05, P.glass, [0, 2.16, -.14], null, .014);
  // Halo de sensores sobre la cabeza.
  const halo = torus(g, .3, .018, P.accent, [0, 2.48, 0], [Math.PI / 2, 0, 0], 5, 18);
  halo.name = 'halo';
  for (let i = 0; i < 3; i++) part(g, new THREE.SphereGeometry(.026, 8, 6), P.accent, [Math.cos(i * 2.09) * .3, 2.48, Math.sin(i * 2.09) * .3]);
  const shoulders = [];
  for (const x of [-.36, .36]) shoulders.push(box(g, .05, .26, .16, P.accent, [x, 1.8, .02], [0, 0, x > 0 ? -.2 : .2], .02));
  // Túnica larga: cae hasta el tobillo.
  const cloak = new THREE.Group(); g.add(cloak);
  box(cloak, .3, .95, .04, P.cloth, [-.16, 1.06, .22], [.05, 0, .03], .015);
  box(cloak, .28, .8, .04, P.cloth, [.16, 1.14, .22], [.05, 0, -.03], .015);
  box(cloak, .46, .1, .05, P.secondary, [0, 1.84, .22], null, .02);
  const scarf = box(g, .08, .54, .05, P.secondary, [.28, 1.46, .2], [0, 0, .12], .02);
  const arms = [];
  for (const x of [-.38, .38]) {
    const arm = new THREE.Group(); arm.position.set(x, 1.78, 0); g.add(arm);
    box(arm, .14, .32, .16, P.armor, [0, -.15, 0], null, .045);
    box(arm, .12, .3, .14, P.dark, [0, -.44, -.03], null, .035);
    box(arm, .14, .12, .16, P.rubber, [0, -.62, -.08], null, .035);
    arms.push(arm);
  }
  const legs = [];
  for (const x of [-.16, .16]) {
    const leg = new THREE.Group(); leg.position.set(x, .96, 0); g.add(leg);
    box(leg, .19, .42, .21, P.armor, [0, -.2, 0], null, .045);
    box(leg, .16, .38, .18, P.dark, [0, -.6, -.01], null, .035);
    box(leg, .18, .08, .18, P.accent, [0, -.48, -.09], null, .02);
    box(leg, .2, .12, .34, P.rubber, [0, -.82, -.06], null, .035);
    legs.push(leg);
  }
  const thrusters = new THREE.Group(); g.add(thrusters);
  for (const x of [-.14, .14]) {
    box(thrusters, .09, .12, .09, P.dark, [x, .82, .2], null, .025);
    const flame = part(thrusters, gcone(.07, .32, 6), P.accent, [x, .6, .2], [Math.PI, 0, 0]);
    flame.material = new THREE.MeshBasicMaterial({ color: P.accent.emissive.getHex(), transparent: true, opacity: .85 });
  }
  thrusters.visible = false;
  const core = detailKit(g, P, { coreY: 1.58, bodyW: .54, backZ: .24, thighY: .74, thighX: .16 });
  return {
    group: g, legs, arms, torso, chestPlate, head, visor, cloak, shoulders, scarf, thrusters,
    heavyArmor: new THREE.Group(), core,
    rest: { torsoY: 1.58, chestY: 1.6, gunZ: -.42, armL: -1.06, armR: -1.3 }, bodyW: .54
  };
}

// RONIN — ESPADACHÍN: inclinado, katana a la espalda y hombrera de un solo lado.
function buildRonin(P) {
  const g = new THREE.Group();
  box(g, .42, .24, .32, P.dark, [0, .96, 0], [-.06, 0, 0], .05);
  const torso = box(g, .58, .54, .34, P.armor, [0, 1.58, 0], [-.1, 0, 0], .06);
  const chestPlate = box(g, .46, .3, .38, P.armor, [0, 1.6, -.02], [-.06, 0, 0], .055);
  box(g, .3, .05, .42, P.secondary, [0, 1.36, -.01], null, .02);
  box(g, .34, .16, .3, P.dark, [0, 1.9, 0], null, .05);
  const head = box(g, .25, .28, .26, P.dark, [0, 2.12, 0], null, .065);
  // Máscara de oni: media cara, con colmillos hacia abajo.
  box(g, .24, .16, .06, P.plate, [0, 2.06, -.14], null, .02);
  for (const x of [-.07, .07]) cone(g, .022, .07, P.accent, [x, 1.98, -.17], [Math.PI, 0, 0], 4);
  const visor = box(g, .23, .05, .05, P.glass, [0, 2.18, -.14], null, .014);
  // Una sola hombrera enorme: asimetría total.
  const shoulders = [];
  shoulders.push(box(g, .1, .34, .26, P.plate, [-.42, 1.84, 0], [0, 0, .22], .03));
  shoulders.push(box(g, .05, .22, .14, P.accent, [.38, 1.82, .02], [0, 0, -.2], .02));
  // Katana a la espalda: la silueta se delata por la línea diagonal.
  const cloak = new THREE.Group(); g.add(cloak);
  box(cloak, .035, .95, .05, P.steel, [.18, 1.7, .26], [0, 0, .55], .012);
  box(cloak, .05, .18, .05, P.dark, [.05, 1.24, .32], [0, 0, .55], .015);
  box(cloak, .14, .05, .05, P.plate, [.26, 2.16, .2], [0, 0, .55], .015);
  box(cloak, .22, .9, .04, P.cloth, [-.17, 1.1, .24], [.06, 0, .04], .015);
  const scarf = box(g, .08, .58, .05, P.secondary, [-.3, 1.44, .2], [0, 0, -.18], .02);
  const arms = [];
  for (const x of [-.4, .4]) {
    const arm = new THREE.Group(); arm.position.set(x, 1.8, 0); g.add(arm);
    box(arm, .15, .32, .16, P.armor, [0, -.15, 0], null, .045);
    box(arm, .13, .3, .14, P.dark, [0, -.44, -.03], null, .035);
    box(arm, .15, .12, .16, P.rubber, [0, -.62, -.08], null, .035);
    arms.push(arm);
  }
  const legs = [];
  for (const x of [-.17, .17]) {
    const leg = new THREE.Group(); leg.position.set(x, .94, 0); g.add(leg);
    box(leg, .2, .42, .22, P.armor, [0, -.2, 0], null, .045);
    box(leg, .17, .38, .19, P.dark, [0, -.6, -.01], null, .035);
    box(leg, .19, .08, .19, P.accent, [0, -.48, -.09], null, .02);
    box(leg, .21, .12, .35, P.rubber, [0, -.82, -.06], null, .035);
    legs.push(leg);
  }
  const thrusters = new THREE.Group(); g.add(thrusters);
  for (const x of [-.15, .15]) {
    box(thrusters, .1, .13, .1, P.dark, [x, .8, .22], null, .028);
    const flame = part(thrusters, gcone(.075, .34, 6), P.accent, [x, .58, .22], [Math.PI, 0, 0]);
    flame.material = new THREE.MeshBasicMaterial({ color: P.accent.emissive.getHex(), transparent: true, opacity: .82 });
  }
  thrusters.visible = false;
  const core = detailKit(g, P, { coreY: 1.56, bodyW: .58, backZ: .28, thighY: .72, thighX: .17 });
  return {
    group: g, legs, arms, torso, chestPlate, head, visor, cloak, shoulders, scarf, thrusters,
    heavyArmor: new THREE.Group(), core,
    rest: { torsoY: 1.58, chestY: 1.6, gunZ: -.44, armL: -1.08, armR: -1.32 }, bodyW: .58
  };
}

// CIPHER — FRANCOTIRADOR: alto, estático, con mira integrada y abrigo largo.
function buildCipher(P) {
  const g = new THREE.Group();
  box(g, .4, .26, .3, P.dark, [0, 1.0, 0], null, .05);
  const torso = box(g, .56, .6, .34, P.armor, [0, 1.64, 0], [.03, 0, 0], .06);
  const chestPlate = box(g, .44, .32, .38, P.armor, [0, 1.66, -.02], null, .055);
  box(g, .3, .05, .42, P.secondary, [0, 1.4, -.01], null, .02);
  box(g, .34, .18, .3, P.dark, [0, 1.98, 0], null, .05);
  const head = box(g, .24, .3, .26, P.dark, [0, 2.22, 0], null, .065);
  // Mira integrada: un monoculo enorme que ocupa media cara.
  cyl(g, .075, .085, .16, P.plate, [.08, 2.24, -.18], [Math.PI / 2, 0, 0], 10);
  const visor = box(g, .2, .05, .05, P.glass, [.08, 2.24, -.27], null, .014);
  box(g, .05, .22, .1, P.accent, [-.1, 2.4, .02], null, .012);
  const shoulders = [];
  for (const x of [-.38, .38]) shoulders.push(box(g, .05, .28, .16, P.accent, [x, 1.9, .02], [0, 0, x > 0 ? -.22 : .22], .02));
  // Abrigo de tirador: muy largo, tapa las piernas casi enteras.
  const cloak = new THREE.Group(); g.add(cloak);
  box(cloak, .28, 1.25, .04, P.cloth, [-.15, 1.0, .24], [.04, 0, .03], .015);
  box(cloak, .26, 1.05, .04, P.cloth, [.16, 1.1, .24], [.04, 0, -.03], .015);
  box(cloak, .5, .1, .05, P.secondary, [0, 1.92, .24], null, .02);
  for (let i = 0; i < 3; i++) box(cloak, .07, .5, .03, P.plate, [-.2 + i * .2, .5, .28], null, .01);
  const scarf = box(g, .08, .6, .05, P.secondary, [-.3, 1.5, .2], [0, 0, -.14], .02);
  const arms = [];
  for (const x of [-.4, .4]) {
    const arm = new THREE.Group(); arm.position.set(x, 1.86, 0); g.add(arm);
    box(arm, .14, .36, .16, P.armor, [0, -.17, 0], null, .045);
    box(arm, .12, .34, .14, P.dark, [0, -.5, -.03], null, .035);
    box(arm, .14, .12, .16, P.rubber, [0, -.7, -.08], null, .035);
    arms.push(arm);
  }
  const legs = [];
  for (const x of [-.16, .16]) {
    const leg = new THREE.Group(); leg.position.set(x, .98, 0); g.add(leg);
    box(leg, .19, .46, .21, P.armor, [0, -.22, 0], null, .045);
    box(leg, .16, .42, .18, P.dark, [0, -.66, -.01], null, .035);
    box(leg, .18, .08, .18, P.accent, [0, -.53, -.09], null, .02);
    box(leg, .2, .12, .34, P.rubber, [0, -.9, -.06], null, .035);
    legs.push(leg);
  }
  const thrusters = new THREE.Group(); g.add(thrusters);
  for (const x of [-.14, .14]) {
    box(thrusters, .09, .12, .09, P.dark, [x, .84, .2], null, .025);
    const flame = part(thrusters, gcone(.07, .3, 6), P.accent, [x, .64, .2], [Math.PI, 0, 0]);
    flame.material = new THREE.MeshBasicMaterial({ color: P.accent.emissive.getHex(), transparent: true, opacity: .8 });
  }
  thrusters.visible = false;
  const core = detailKit(g, P, { coreY: 1.64, bodyW: .56, backZ: .26, thighY: .76, thighX: .16 });
  return {
    group: g, legs, arms, torso, chestPlate, head, visor, cloak, shoulders, scarf, thrusters,
    heavyArmor: new THREE.Group(), core,
    rest: { torsoY: 1.64, chestY: 1.66, gunZ: -.44, armL: -1.06, armR: -1.3 }, bodyW: .56
  };
}

const BUILDERS = {
  vanta: buildVanta, kira: buildKira, rook: buildRook,
  nyx: buildNyx, pyre: buildPyre, aegis: buildAegis, glitch: buildGlitch,
  seraph: buildSeraph, ronin: buildRonin, cipher: buildCipher
};

// Construye el operador completo. Devuelve un grupo listo para la escena con
// todos los puntos de anclaje que usa la lógica de animación.
export function buildOperator(id, colorHex) {
  const P = palette(colorHex);
  const build = BUILDERS[id] || BUILDERS.vanta;
  const body = build(P);
  const g = body.group;

  const weapons = buildWeapons(g, P, id);
  const gun = weapons.smg.group;
  gun.visible = true;

  // El modelo de cuerpo a cuerpo se engancha a la mano izquierda.
  const hand = new THREE.Group();
  hand.position.set(0, -.7, -.12);
  body.arms[0].add(hand);

  g.userData = {
    legs: body.legs, arms: body.arms, torso: body.torso, chestPlate: body.chestPlate,
    head: body.head, visor: body.visor, cloak: body.cloak, shoulders: body.shoulders,
    scarf: body.scarf, thrusters: body.thrusters, heavyArmor: body.heavyArmor,
    scarfSegs: body.scarfSegs || null, shield: body.shield || null, brim: body.brim || null,
    weapons, gun, muzzle: weapons.smg.muzzle, hand,
    pAccent: P.accent, pSecondary: P.secondary, palette: P,
    rest: body.rest, bodyW: body.bodyW, operator: id, core: body.core || null
  };
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function disposeOperator(g) {
  if (!g) return;
  g.traverse(o => {
    if (o.material && !o.material.userData?.shared) {
      // Los materiales de paleta son exclusivos de este operador.
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material.dispose();
    }
  });
}
