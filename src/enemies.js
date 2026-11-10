// NEON//REVENANT — HOSTILES
// ---------------------------------------------------------------------------
// Cada hostil se construye a partir de DECENAS de piezas (placas, costillas,
// pistones, cables, sensores, sacos, tendones...) y luego se HORNEA en dos
// mallas: una opaca con color por vértice y otra emisiva con toneMapped=false
// (que es la que alimenta el bloom). Resultado: modelos mucho más ricos que los
// antiguos bloques, con MENOS draw calls que antes.
//
// Reglas de diseño:
//   · La silueta debe leerse a 30 m: cada tipo tiene una forma distinta.
//   · La facción se lee por anatomía, no por color: SYNTEK es maquinaria limpia
//     y angular; HIVE es química orgánica y asimétrica; UMBRA es tela y vacío.
//   · Nada de materiales por enemigo: se comparten por (facción, fantasma) y la
//     geometría se comparte por (tipo, facción, tramo). Un hostil nuevo cuesta
//     solo unos cuantos Object3D.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ------------------------------------------------------------------ paletas
const FAC = {
  SYNTEK: { armor: 0x4d5d68, plate: 0x7c8f99, dark: 0x141c22, trim: 0xff4d38, glow: 0xff4d38, hot: 0xffd9a0 },
  HIVE: { armor: 0x354624, plate: 0x546b30, dark: 0x11180c, trim: 0xb6ff3d, glow: 0xb6ff3d, hot: 0xe4ff9c },
  UMBRA: { armor: 0x342a4a, plate: 0x4c3d68, dark: 0x120c1c, trim: 0xb56bff, glow: 0xb56bff, hot: 0x9ff7ff }
};

const _matCache = new Map();
function factionMats(faction, ghost) {
  const key = faction + (ghost ? ':g' : '');
  let m = _matCache.get(key);
  if (m) return m;
  const P = FAC[faction] || FAC.SYNTEK;
  m = {
    // El emisivo nace apagado: es el que enciende `flashMaterial()` al golpear.
    s: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .44, metalness: .74, emissive: P.glow, emissiveIntensity: 0, envMapIntensity: 2.2 }),
    c: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: .06, emissive: P.glow, emissiveIntensity: 0, envMapIntensity: 1.4 }),
    g: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
  };
  if (ghost) {
    for (const k of ['s', 'c']) { m[k].transparent = true; m[k].opacity = .42; m[k].depthWrite = false; }
    m.g = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, opacity: .8 });
  }
  m.P = P;
  _matCache.set(key, m);
  return m;
}

// ------------------------------------------------------- caché de geometrías
const GC = new Map();
function gc(key, make) {
  let g = GC.get(key);
  if (!g) { g = make(); GC.set(key, g); }
  return g;
}
const gBox = (w, h, d, r = .04) => gc(`b${w}_${h}_${d}_${r}`, () => new RoundedBoxGeometry(w, h, d, 1, Math.min(r, Math.min(w, h, d) * .45)));
const gCyl = (rt, rb, h, s = 8) => gc(`c${rt}_${rb}_${h}_${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const gCone = (r, h, s = 6) => gc(`k${r}_${h}_${s}`, () => new THREE.ConeGeometry(r, h, s));
const gSph = (r, s = 10, t = 8) => gc(`s${r}_${s}_${t}`, () => new THREE.SphereGeometry(r, s, t));
const gTor = (r, t, s = 6, ts = 14) => gc(`t${r}_${t}_${s}_${ts}`, () => new THREE.TorusGeometry(r, t, s, ts));
const gOct = (r) => gc(`o${r}`, () => new THREE.OctahedronGeometry(r));
const gIco = (r, d = 0) => gc(`i${r}_${d}`, () => new THREE.IcosahedronGeometry(r, d));

// ------------------------------------------------------------------ horneado
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _col = new THREE.Color();

// Normaliza una geometría para que TODAS se puedan fusionar y le pinta el color
// por vértice. Acepta un hex o un [r,g,b] en HDR (>1) para las partes emisivas.
function prep(geo, color) {
  let out = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(out.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv') out.deleteAttribute(k);
  }
  if (!out.attributes.normal) out.computeVertexNormals();
  if (!out.attributes.uv) {
    out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
  }
  const n = out.attributes.position.count;
  const arr = new Float32Array(n * 3);
  if (Array.isArray(color)) { for (let i = 0; i < n; i++) { arr[i * 3] = color[0]; arr[i * 3 + 1] = color[1]; arr[i * 3 + 2] = color[2]; } }
  else { _col.setHex(color); for (let i = 0; i < n; i++) { arr[i * 3] = _col.r; arr[i * 3 + 1] = _col.g; arr[i * 3 + 2] = _col.b; } }
  out.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return out;
}
// Color HDR para las piezas emisivas. El factor global está calibrado para que
// el bloom encienda sin reventar la silueta.
const GLOW_GAIN = .74;
function hot(hex, k = 2.1) { _col.setHex(hex); const s = k * GLOW_GAIN; return [_col.r * s, _col.g * s, _col.b * s]; }

class Bake {
  constructor() { this.slots = new Map(); }
  _push(slot, geo, pos, rot, scl, color) {
    const g = prep(geo, color);
    _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
    _q.setFromEuler(_e);
    _v.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0);
    _s.set(scl ? scl[0] : 1, scl ? scl[1] : 1, scl ? scl[2] : 1);
    _m4.compose(_v, _q, _s);
    g.applyMatrix4(_m4);
    let list = this.slots.get(slot);
    if (!list) { list = []; this.slots.set(slot, list); }
    list.push(g);
    return this;
  }
  box(slot, w, h, d, pos, rot, color, r) { return this._push(slot, gBox(w, h, d, r === undefined ? .04 : r), pos, rot, null, color); }
  cyl(slot, rt, rb, h, pos, rot, color, seg) { return this._push(slot, gCyl(rt, rb, h, seg || 8), pos, rot, null, color); }
  cone(slot, r, h, pos, rot, color, seg) { return this._push(slot, gCone(r, h, seg || 6), pos, rot, null, color); }
  sph(slot, r, pos, rot, color, sc) { return this._push(slot, gSph(r), pos, rot, sc, color); }
  tor(slot, r, t, pos, rot, color, sc) { return this._push(slot, gTor(r, t), pos, rot, sc, color); }
  oct(slot, r, pos, rot, color, sc) { return this._push(slot, gOct(r), pos, rot, sc, color); }
  ico(slot, r, pos, rot, color, sc, det) { return this._push(slot, gIco(r, det || 0), pos, rot, sc, color); }
  // Segmento entre dos puntos: sirve para cables, tendones y puntales.
  strut(slot, a, b, r, color, seg) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz) || .001;
    const g = gCyl(r, r, len, seg || 5);
    const out = prep(g, color);
    _v.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
    _m4.compose(_v, _q, _s.set(1, 1, 1));
    out.applyMatrix4(_m4);
    let list = this.slots.get(slot);
    if (!list) { list = []; this.slots.set(slot, list); }
    list.push(out);
    return this;
  }
  bake(target, mats) {
    for (const [slot, list] of this.slots) {
      if (!list.length) continue;
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (list.length > 1) list.forEach(g => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mats[slot] || mats.s);
      mesh.castShadow = slot !== 'g';
      mesh.receiveShadow = slot === 's';
      target.add(mesh);
    }
    this.slots.clear();
  }
}

// Crea un grupo-pivote (pierna, brazo, ala) y registra su horneado pendiente.
function segment(root, pos, name) {
  const g = new THREE.Group();
  g.position.set(pos[0], pos[1], pos[2]);
  if (name) g.name = name;
  root.g.add(g);
  const seg = { g, B: new Bake() };
  root.pending.push(seg);
  return seg;
}

// ===========================================================================
//  CUERPO COMÚN — esqueleto mecánico que comparten los bípedos
// ===========================================================================
function bipedCore(B, P, o) {
  const hipY = o.hipY, w = o.width, d = o.depth;
  // Pelvis + faja + cadera: tres volúmenes para que no lea como una caja.
  B.box('s', w * .74, .22, d * .86, [0, hipY, 0], null, P.dark, .07);
  B.box('s', w * .62, .12, d * .74, [0, hipY + .14, .01], null, P.plate, .05);
  B.box('s', w * .86, .1, d * .5, [0, hipY + .04, -.02], null, P.armor, .04);
  // Pistones de cadera.
  for (const x of [-w * .34, w * .34]) B.strut('s', [x, hipY + .06, d * .22], [x * .82, hipY + .3, d * .06], .028, P.plate, 5);
  // Columna: dos vértebras visibles.
  B.box('s', w * .4, .16, d * .6, [0, hipY + .26, .01], null, P.dark, .04);
  B.box('s', w * .46, .14, d * .64, [0, hipY + .4, 0], [.04, 0, 0], P.armor, .04);
  // Torso.
  const torso = B.box('s', w, .44, d, [0, hipY + .62, -.01], [.05, 0, 0], P.armor, .08);
  // Peto frontal en dos planos (el bisel es lo que lo hace leer como armadura).
  B.box('s', w * .8, .26, d * .18, [0, hipY + .66, -d * .48], [.16, 0, 0], P.plate, .05);
  B.box('s', w * .52, .16, d * .12, [0, hipY + .5, -d * .52], [-.1, 0, 0], P.armor, .04);
  // Costillas / rejillas laterales.
  for (const x of [-1, 1]) {
    for (let i = 0; i < 3; i++) B.box('s', .05, .05, d * .5, [x * w * .46, hipY + .5 + i * .1, 0], null, P.dark, .02);
  }
  // Collarín.
  B.box('s', w * .44, .1, d * .56, [0, hipY + .86, .01], null, P.dark, .04);
  return torso;
}

function bipedHead(B, P, o) {
  const y = o.headY;
  const hw = o.headW, hd = o.headD;
  // Cráneo en cuña: base + frente + nuca.
  B.box('s', hw, hd * .9, hd, [0, y, 0], [.06, 0, 0], P.dark, .05);
  B.box('s', hw * .82, hd * .5, hd * .5, [0, y - hd * .3, -hd * .34], [.2, 0, 0], P.plate, .03);
  B.box('s', hw * .5, hd * .34, hd * .4, [0, y + hd * .44, hd * .1], null, P.armor, .03);
  // Visor: ranura horizontal + dos sensores laterales.
  B.box('g', hw * .78, .035, .05, [0, y + .01, -hd * .48], null, hot(P.glow, 2.4), .012);
  for (const x of [-1, 1]) B.box('g', .04, .05, .05, [x * hw * .44, y + .01, -hd * .42], null, hot(P.glow, 1.5), .01);
  // Cresta / antena.
  B.box('s', .035, .16, .2, [0, y + hd * .5, hd * .12], [-.2, 0, 0], P.plate, .012);
  return y;
}

// Añade los detalles de facción al torso. Es lo que hace que un mismo esqueleto
// se lea como tres especies distintas.
function factionTrim(B, P, o) {
  const hipY = o.hipY, w = o.width, d = o.depth;
  if (o.faction === 'SYNTEK') {
    // Mochila de energía con dos celdas y cableado limpio.
    B.box('s', w * .5, .3, .16, [0, hipY + .62, d * .56], null, P.plate, .04);
    for (const x of [-1, 1]) {
      B.cyl('s', .055, .055, .22, [x * w * .2, hipY + .64, d * .62], [0, 0, 0], P.dark, 6);
      B.cyl('g', .03, .03, .2, [x * w * .2, hipY + .64, d * .66], [0, 0, 0], hot(P.glow, 1.8), 6);
    }
    B.strut('s', [-w * .2, hipY + .56, d * .5], [-w * .42, hipY + .3, d * .2], .02, P.dark, 4);
    B.strut('s', [w * .2, hipY + .56, d * .5], [w * .42, hipY + .3, d * .2], .02, P.dark, 4);
  } else if (o.faction === 'HIVE') {
    // Sacos de bioquímica asimétricos + tendones que cruzan el pecho.
    B.sph('s', .16, [-w * .22, hipY + .58, d * .42], [0, 0, .3], P.plate, [1, 1.35, 1]);
    B.sph('g', .1, [-w * .22, hipY + .62, d * .5], [0, 0, .3], hot(P.glow, 1.2), [1, 1.4, 1]);
    B.sph('s', .11, [w * .24, hipY + .46, d * .4], [0, 0, -.2], P.plate, [1, 1.2, 1]);
    for (let i = 0; i < 3; i++) {
      B.strut('s', [-w * .34 + i * .06, hipY + .78 - i * .04, -d * .44], [w * .3, hipY + .5 - i * .06, -d * .3], .022, P.dark, 4);
    }
    // Espinas dorsales.
    for (let i = 0; i < 4; i++) B.cone('s', .05, .2, [0, hipY + .74 - i * .12, d * .48], [1.15, 0, 0], P.dark, 5);
  } else {
    // UMBRA: tela rasgada y fragmentos que levitan.
    B.box('c', w * .9, .7, .04, [0, hipY + .42, d * .52], [.12, 0, 0], P.dark, .01);
    for (const x of [-1, 1]) B.box('c', w * .28, .95, .03, [x * w * .3, hipY + .2, d * .46], [.1, 0, x * .12], P.dark, .01);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.6;
      B.oct('g', .035, [Math.cos(a) * .42, hipY + .55 + Math.sin(a * 1.7) * .18, Math.sin(a) * .42], null, hot(P.glow, 1.6));
    }
    B.tor('g', .3, .012, [0, hipY + .55, 0], [1.4, .2, 0], hot(P.glow, 1.3));
  }
}

// ===========================================================================
//  TIPOS
// ===========================================================================

// — ACECHADOR: bípedo ligero, inclinado, con hojas de antebrazo. ————————————
function buildChaser(root, P, o) {
  bipedCore(root.B, P, o);
  bipedHead(root.B, P, o);
  factionTrim(root.B, P, o);
  // Hombreras en cuña hacia delante.
  for (const x of [-1, 1]) {
    root.B.box('s', .2, .14, .28, [x * o.width * .62, o.hipY + .78, -.02], [0, 0, x * .22], P.plate, .04);
    root.B.box('g', .1, .02, .02, [x * o.width * .62, o.hipY + .83, -.14], null, hot(P.glow, 1.6), .008);
  }
  // Aletas dorsales.
  for (let i = 0; i < 2; i++) root.B.box('s', .04, .26, .12, [0, o.hipY + .82, o.depth * .4 + i * .12], [-.5, 0, 0], P.plate, .015);
  // Núcleo en el pecho: late.
  root.B.oct('g', .07, [0, o.hipY + .64, -o.depth * .58], null, hot(P.glow, 2.6));
}

function chaserLegs(root, P, o) {
  const out = [];
  for (const x of [-1, 1]) {
    const leg = segment(root, [x * o.width * .3, o.hipY - .04, 0], 'leg' + (x > 0 ? 1 : 0));
    const B = leg.B;
    B.box('s', .19, .34, .22, [0, -.17, -.01], null, P.armor, .05);          // muslo
    B.box('s', .16, .1, .2, [0, -.36, -.02], null, P.plate, .04);            // rodilla
    B.box('g', .09, .025, .02, [0, -.36, -.13], null, hot(P.glow, 1.5), .008);
    B.box('s', .15, .34, .18, [0, -.55, .01], [.05, 0, 0], P.dark, .04);     // espinilla
    B.box('s', .05, .22, .06, [0, -.5, -.08], null, P.plate, .02);           // tibia
    B.box('s', .17, .1, .3, [0, -.78, -.06], null, P.dark, .04);             // pie
    B.box('g', .1, .02, .03, [0, -.79, -.19], null, hot(P.glow, 1.2), .006);
    B.cone('s', .05, .16, [0, -.76, .14], [1.4, 0, 0], P.plate, 5);          // espolón
    out.push(leg);
  }
  return out;
}

function chaserArms(root, P, o) {
  const out = [];
  for (const x of [-1, 1]) {
    const arm = segment(root, [x * o.width * .52, o.hipY + .76, 0], 'arm' + (x > 0 ? 1 : 0));
    const B = arm.B;
    B.box('s', .18, .16, .2, [0, -.04, 0], null, P.plate, .05);              // hombro
    B.box('s', .15, .26, .17, [0, -.2, 0], null, P.armor, .04);              // bíceps
    B.box('s', .14, .1, .16, [0, -.35, 0], null, P.dark, .03);               // codo
    B.box('s', .13, .26, .15, [0, -.49, -.02], [.1, 0, 0], P.armor, .035);   // antebrazo
    B.box('s', .11, .1, .13, [0, -.64, -.03], null, P.dark, .03);            // mano
    // Hoja de plasma montada en el dorso del antebrazo.
    B.box('s', .035, .5, .1, [0, -.62, -.16], [.18, 0, 0], P.dark, .012);
    B.box('g', .05, .48, .028, [0, -.62, -.2], [.18, 0, 0], hot(P.glow, 2.2), .008);
    out.push(arm);
  }
  return out;
}

// — BRUTO: ancho, bajo, hombreras enormes y puños de pistón. ————————————————
function buildTank(root, P, o) {
  const w = o.width = o.width * 1.32;
  const d = o.depth = o.depth * 1.14;
  bipedCore(root.B, P, { ...o, width: w, depth: d });
  // Cabeza hundida: casi sin cuello.
  bipedHead(root.B, P, { ...o, headY: o.hipY + .84, headW: .3, headD: .3 });
  factionTrim(root.B, P, { ...o, width: w, depth: d });
  // Hombreras descomunales con pinchos y remaches.
  for (const x of [-1, 1]) {
    root.B.box('s', .42, .24, .52, [x * w * .7, o.hipY + .82, 0], [0, 0, x * .2], P.armor, .08);
    root.B.box('s', .36, .06, .44, [x * w * .76, o.hipY + .94, 0], [0, 0, x * .2], P.plate, .03);
    // Dos pinchos cortos hacia fuera: la punta apunta al aire, no hacia arriba.
    for (const k of [-1, 1]) root.B.cone('s', .05, .2, [x * w * .78, o.hipY + .96, k * .14], [0, 0, x * -.9], P.plate, 5);
    root.B.box('g', .2, .035, .03, [x * w * .7, o.hipY + .84, -.26], null, hot(P.glow, 1.8), .008);
  }
  // Rejilla-fragua en el pecho.
  for (let i = 0; i < 3; i++) root.B.box('g', .3 - i * .04, .028, .03, [0, o.hipY + .58 + i * .08, -d * .54], null, hot(P.glow, 1.5 + i * .3), .008);
  // Faldón blindado (esto es lo que se rompe al agotar la armadura).
  return null;
}

function tankPlates(root, P, o) {
  const B = new Bake();
  const w = o.width, d = o.depth;
  B.box('s', w * 1.02, .42, .1, [0, o.hipY - .1, -d * .44], [.12, 0, 0], P.plate, .04);
  for (const x of [-1, 1]) B.box('s', .16, .44, .34, [x * w * .56, o.hipY - .16, 0], [0, 0, x * .06], P.armor, .04);
  B.box('s', w * .9, .1, .34, [0, o.hipY - .32, 0], null, P.dark, .03);
  const g = new THREE.Group();
  g.name = 'plates';
  B.bake(g, { s: o.mats.s, c: o.mats.c, g: o.mats.g });
  root.g.add(g);
  return g;
}

function tankLegs(root, P, o) {
  const out = [];
  for (const x of [-1, 1]) {
    const leg = segment(root, [x * o.width * .3, o.hipY - .02, 0], 'leg' + (x > 0 ? 1 : 0));
    const B = leg.B;
    B.box('s', .28, .3, .3, [0, -.16, 0], null, P.armor, .07);
    B.box('s', .24, .1, .26, [0, -.33, -.01], null, P.plate, .05);
    B.box('s', .22, .3, .26, [0, -.5, .01], null, P.dark, .05);
    B.cyl('s', .05, .05, .2, [0, -.5, -.14], [0, 0, 0], P.plate, 6);
    B.box('s', .26, .14, .4, [0, -.7, -.07], null, P.dark, .05);
    B.box('g', .14, .02, .04, [0, -.73, -.24], null, hot(P.glow, 1.3), .008);
    out.push(leg);
  }
  return out;
}

function tankArms(root, P, o) {
  const out = [];
  for (const x of [-1, 1]) {
    const arm = segment(root, [x * o.width * .66, o.hipY + .72, 0], 'arm' + (x > 0 ? 1 : 0));
    const B = arm.B;
    B.box('s', .24, .22, .26, [0, -.06, 0], null, P.plate, .06);
    B.box('s', .2, .3, .22, [0, -.26, 0], null, P.armor, .05);
    B.box('s', .18, .1, .2, [0, -.44, 0], null, P.dark, .04);
    B.box('s', .22, .24, .24, [0, -.6, -.02], [.08, 0, 0], P.armor, .05);   // antebrazo-pistón
    B.cyl('s', .07, .07, .18, [0, -.58, -.16], [Math.PI / 2, 0, 0], P.plate, 8);
    B.box('s', .24, .2, .22, [0, -.76, -.03], null, P.dark, .06);            // puño
    for (let i = 0; i < 3; i++) B.box('g', .05, .03, .02, [-.07 + i * .07, -.8, -.15], null, hot(P.glow, 1.6), .006);
    out.push(arm);
  }
  return out;
}

// — TIRADOR: alto, delgado, óptica única y fusil integrado en el brazo. ————
function buildRanged(root, P, o) {
  o.width = o.width * .78;
  o.depth = o.depth * .82;
  bipedCore(root.B, P, o);
  bipedHead(root.B, P, { ...o, headY: o.hipY + .98, headW: .2, headD: .26 });
  factionTrim(root.B, P, o);
  // Óptica monocular montada en la sien.
  root.B.cyl('s', .075, .075, .1, [.11, o.hipY + 1.0, -.14], [Math.PI / 2, 0, 0], P.dark, 10);
  root.B.sph('g', .05, [.11, o.hipY + 1.0, -.2], null, hot(P.glow, 2.6));
  root.B.tor('g', .075, .012, [.11, o.hipY + 1.0, -.2], [0, 0, 0], hot(P.glow, 1.4));
  // Joroba de energía con antena.
  root.B.box('s', .26, .34, .2, [0, o.hipY + .74, o.depth * .5], [-.14, 0, 0], P.plate, .05);
  root.B.cyl('g', .02, .02, .26, [.1, o.hipY + .94, o.depth * .5], [.2, 0, .2], hot(P.glow, 1.8), 5);
  root.B.cyl('s', .04, .04, .3, [0, o.hipY + .78, o.depth * .62], [0, 0, 0], P.dark, 6);
  // Faldón largo de tirador.
  root.B.box('c', .3, .5, .03, [0, o.hipY + .1, o.depth * .5], [.14, 0, 0], P.dark, .01);
}

function rangedLegs(root, P, o) {
  const out = [];
  for (const x of [-1, 1]) {
    const leg = segment(root, [x * o.width * .28, o.hipY - .04, 0], 'leg' + (x > 0 ? 1 : 0));
    const B = leg.B;
    B.box('s', .15, .4, .17, [0, -.2, 0], null, P.armor, .04);
    B.box('s', .13, .09, .15, [0, -.42, 0], null, P.plate, .03);
    B.box('s', .12, .38, .14, [0, -.6, .01], null, P.dark, .03);
    B.box('s', .14, .09, .28, [0, -.84, -.05], null, P.dark, .03);
    B.box('g', .07, .02, .02, [0, -.42, -.09], null, hot(P.glow, 1.4), .006);
    out.push(leg);
  }
  return out;
}

function rangedArms(root, P, o) {
  const out = [];
  for (const x of [-1, 1]) {
    const arm = segment(root, [x * o.width * .48, o.hipY + .8, 0], 'arm' + (x > 0 ? 1 : 0));
    const B = arm.B;
    B.box('s', .14, .14, .16, [0, -.03, 0], null, P.plate, .04);
    B.box('s', .11, .24, .13, [0, -.17, 0], null, P.armor, .03);
    B.box('s', .1, .09, .12, [0, -.3, 0], null, P.dark, .025);
    B.box('s', .1, .24, .12, [0, -.42, -.02], null, P.armor, .03);
    B.box('s', .09, .09, .11, [0, -.55, -.03], null, P.dark, .025);
    if (x > 0) {
      // Fusil de precisión: cañón, guardamanos ventilado y bobinas.
      B.box('s', .09, .1, .62, [0, -.46, -.34], null, P.dark, .03);
      B.box('s', .07, .06, .3, [0, -.42, -.62], null, P.plate, .02);
      B.cyl('s', .022, .022, .26, [0, -.46, -.8], [Math.PI / 2, 0, 0], P.dark, 8);
      for (let i = 0; i < 3; i++) B.tor('g', .04, .008, [0, -.46, -.7 + i * .09], [0, 0, 0], hot(P.glow, 2));
      B.box('s', .05, .1, .14, [0, -.36, -.24], null, P.armor, .02);
      B.box('g', .02, .02, .16, [0, -.3, -.4], null, hot(P.glow, 1.6), .005);
    }
    out.push(arm);
  }
  return out;
}

// — ORBITADOR: flota, sin piernas; halo, vánelas y orbe. ————————————————
function buildSupport(root, P, o) {
  const B = root.B;
  const y = o.hipY + .5;
  // Torso suspendido, más compacto.
  B.box('s', .5, .34, .34, [0, y, 0], null, P.armor, .07);
  B.box('s', .4, .2, .1, [0, y + .02, -.19], [.1, 0, 0], P.plate, .04);
  B.box('g', .18, .03, .03, [0, y + .06, -.24], null, hot(P.glow, 1.8), .008);
  // Cabeza-obelisco sin rasgos.
  B.box('s', .2, .26, .2, [0, y + .3, 0], null, P.dark, .05);
  B.box('g', .14, .03, .02, [0, y + .32, -.11], null, hot(P.glow, 2.2), .006);
  // Halo superior.
  B.tor('g', .3, .014, [0, y + .5, 0], [Math.PI / 2, 0, 0], hot(P.glow, 1.5));
  B.tor('s', .34, .022, [0, y + .46, 0], [Math.PI / 2, 0, 0], P.dark);
  // Vánelas de sustentación.
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    B.box('s', .1, .06, .26, [Math.cos(a) * .26, y - .3, Math.sin(a) * .26], [0, a, .3], P.plate, .03);
    B.cone('g', .05, .18, [Math.cos(a) * .3, y - .4, Math.sin(a) * .3], [Math.PI, 0, 0], hot(P.glow, 1.5), 5);
  }
  // Núcleo y anillo que giran (nodos dinámicos).
  const orb = new THREE.Mesh(gOct(.11), o.mats.g);
  orb.position.set(0, y + .05, -.02);
  orb.name = 'orb';
  orb.geometry = prep(gOct(.11), hot(P.glow, 2.4));
  orb.material = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  root.g.add(orb);
  const ring = new THREE.Mesh(prep(gTor(.2, .012), hot(P.glow, 1.6)), orb.material);
  ring.position.set(0, y + .05, -.02);
  ring.name = 'ring';
  root.g.add(ring);
}

function supportArms(root, P, o) {
  const out = [];
  const y = o.hipY + .5;
  for (const x of [-1, 1]) {
    const arm = segment(root, [x * .26, y + .1, 0], 'arm' + (x > 0 ? 1 : 0));
    const B = arm.B;
    B.box('s', .1, .12, .12, [0, -.03, 0], null, P.plate, .03);
    B.box('s', .08, .26, .09, [0, -.18, 0], null, P.armor, .025);
    B.box('s', .08, .08, .09, [0, -.32, 0], null, P.dark, .02);
    B.sph('g', .06, [0, -.42, 0], null, hot(P.glow, 2));
    out.push(arm);
  }
  return out;
}

// — ACECHADOR ESPECTRAL: cuadrúpedo bajo, encapuchado, con dagas. ————————
function buildStalker(root, P, o) {
  const B = root.B;
  const y = o.hipY - .12;
  // Cuerpo horizontal, alargado.
  B.box('s', .34, .24, .72, [0, y, 0], [.1, 0, 0], P.armor, .06);
  B.box('s', .28, .12, .5, [0, y + .14, -.02], null, P.plate, .04);
  for (let i = 0; i < 3; i++) B.box('s', .3, .04, .06, [0, y + .1 - i * .02, -.18 + i * .18], null, P.dark, .02);
  // Capucha: cono abierto sobre una cabeza mínima.
  B.cone('s', .24, .42, [0, y + .22, -.16], [.3, 0, 0], P.dark, 7);
  B.box('c', .3, .34, .03, [0, y + .04, .12], [.5, 0, 0], P.dark, .01);
  // Dos ojos dentro de la capucha.
  for (const x of [-1, 1]) B.box('g', .045, .035, .02, [x * .055, y + .16, -.26], null, hot(P.glow, 2.8), .006);
  // Dagas gemelas en el frente.
  for (const x of [-1, 1]) {
    B.box('s', .05, .05, .34, [x * .16, y - .04, -.34], [-.1, 0, 0], P.plate, .012);
    B.box('g', .02, .02, .3, [x * .16, y - .03, -.36], [-.1, 0, 0], hot(P.glow, 2.2), .005);
  }
  // Fragmentos orbitando.
  for (let i = 0; i < 5; i++) {
    const a = i * 1.25;
    B.oct('g', .03, [Math.cos(a) * .38, y + .2 + Math.sin(a) * .16, Math.sin(a) * .38], null, hot(P.glow, 1.7));
  }
}

function stalkerLegs(root, P, o) {
  const out = [];
  const y = o.hipY - .18;
  for (const x of [-1, 1]) {
    const leg = segment(root, [x * .2, y, -.2], 'leg' + (x > 0 ? 1 : 0));
    const B = leg.B;
    B.box('s', .08, .3, .1, [0, -.15, 0], [.5, 0, x * .3], P.armor, .025);
    B.box('s', .07, .3, .09, [0, -.3, .18], [-.9, 0, 0], P.dark, .02);
    B.cone('s', .04, .14, [0, -.4, .3], [1.1, 0, 0], P.plate, 4);
    out.push(leg);
  }
  // Patas traseras: se reutilizan los mismos grupos (rotación invertida en el rig).
  for (const x of [-1, 1]) {
    const leg = segment(root, [x * .2, y, .24], 'leg' + (x > 0 ? 3 : 2));
    const B = leg.B;
    B.box('s', .09, .32, .11, [0, -.15, 0], [-.4, 0, x * .3], P.armor, .025);
    B.box('s', .07, .28, .09, [0, -.3, -.16], [.9, 0, 0], P.dark, .02);
    B.cone('s', .04, .14, [0, -.4, -.28], [-1.1, 0, 0], P.plate, 4);
    out.push(leg);
  }
  return out;
}

// — PLANEADOR: alas de dos tramos, cola y núcleo expuesto. ——————————————
function buildFlyer(root, P, o) {
  const B = root.B;
  const y = o.hipY + .3;
  B.box('s', .36, .26, .6, [0, y, 0], [.08, 0, 0], P.armor, .06);
  B.box('s', .28, .16, .2, [0, y + .14, -.24], null, P.plate, .04);
  B.box('g', .2, .03, .03, [0, y + .16, -.34], null, hot(P.glow, 2.2), .008);
  // Núcleo expuesto bajo el vientre.
  B.sph('g', .1, [0, y - .16, -.04], null, hot(P.glow, 2.4));
  B.tor('s', .14, .018, [0, y - .16, -.04], [Math.PI / 2, 0, 0], P.dark);
  // Cola articulada.
  B.box('s', .07, .07, .5, [0, y - .02, .5], [.2, 0, 0], P.dark, .02);
  B.box('g', .03, .03, .16, [0, y + .06, .74], null, hot(P.glow, 1.8), .008);
  // Garras plegadas.
  for (const x of [-1, 1]) {
    B.box('s', .08, .2, .1, [x * .16, y - .2, -.1], [.6, 0, 0], P.plate, .02);
    B.cone('s', .035, .12, [x * .16, y - .32, -.2], [1.4, 0, 0], P.dark, 4);
  }
  // Alas: dos tramos por lado, cada uno en su propio grupo para batir.
  for (const x of [-1, 1]) {
    const wing = segment(root, [x * .2, y + .06, 0], 'wing' + (x > 0 ? 'R' : 'L'));
    const Bw = wing.B;
    Bw.box('s', .5, .05, .3, [x * .26, 0, 0], [0, 0, x * -.1], P.armor, .02);
    Bw.box('g', .46, .015, .04, [x * .26, .005, -.1], null, hot(P.glow, 1.5), .006);
    Bw.box('s', .4, .04, .2, [x * .7, -.02, .04], [0, 0, x * -.22], P.plate, .015);
    Bw.cone('s', .04, .18, [x * .9, -.04, .06], [0, 0, x * -1.4], P.dark, 4);
  }
}

// — DRON: esfera con rotor, lente y tres vánelas. ————————————————————————
function buildDrone(root, P, o) {
  const B = root.B;
  const y = o.hipY + .45;
  B.sph('s', .3, [0, y, 0], null, P.armor, [1, .85, 1]);
  B.tor('s', .34, .05, [0, y, 0], [Math.PI / 2, 0, 0], P.plate);
  // Lente frontal en dos aros.
  B.cyl('s', .1, .12, .08, [0, y, -.3], [Math.PI / 2, 0, 0], P.dark, 12);
  B.cyl('g', .07, .07, .03, [0, y, -.35], [Math.PI / 2, 0, 0], hot(P.glow, 2.6), 12);
  B.tor('g', .11, .012, [0, y, -.34], [0, 0, 0], hot(P.glow, 1.5));
  // Vánelas estabilizadoras.
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + .5;
    B.box('s', .06, .05, .18, [Math.cos(a) * .3, y - .1, Math.sin(a) * .3], [0, a, .2], P.plate, .02);
    B.cone('g', .03, .1, [Math.cos(a) * .32, y - .2, Math.sin(a) * .32], [Math.PI, 0, 0], hot(P.glow, 1.4), 4);
  }
  // Rotor dinámico.
  const rotor = new THREE.Group();
  rotor.name = 'rotor';
  rotor.position.set(0, y + .26, 0);
  root.g.add(rotor);
  const rmat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const rim = new THREE.Mesh(prep(gTor(.4, .03, 5, 20), hot(P.glow, 1.7)), rmat);
  rim.rotation.x = Math.PI / 2;
  rotor.add(rim);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(prep(gBox(.62, .012, .07, .006), P.plate), o.mats.s);
    blade.rotation.y = i * Math.PI / 3;
    rotor.add(blade);
  }
  const core = new THREE.Mesh(prep(gOct(.09), hot(P.glow, 2.2)), rmat);
  core.name = 'core';
  core.position.set(0, y, -.02);
  root.g.add(core);
}

// ===========================================================================
//  SEGUNDA HORNADA DE HOSTILES
//  Cada uno se reconoce de lejos por la silueta antes que por el color:
//    ZAPADOR   · jorobado, con un mortero de espiga a la espalda.
//    BRUTO     · más ancho que alto, puños de pistón y placas.
//    CRÍA      · diminuto, cuatro patas, casi una mancha que corre.
//    CENTINELA · trípode anclado sin patas: no persigue, barre.
//    ESPECTRO  · alto, roto, partido por la mitad y translúcido.
// ===========================================================================
function buildSapper(root, P, o) {
  bipedCore(root.B, P, o);
  bipedHead(root.B, P, { ...o, headY: o.headY - .1, headW: .22, headD: .24 });
  factionTrim(root.B, P, o);
  // Joroba con el mortero de espiga a la espalda: la silueta lo delata.
  root.B.box('s', .38, .3, .34, [0, o.hipY + .78, o.depth * .62], [-.25, 0, 0], P.plate, .07);
  root.B.cyl('s', .11, .1, .5, [0, o.hipY + 1.0, o.depth * .78], [-.55, 0, 0], P.dark, 10);
  root.B.cyl('g', .13, .13, .07, [0, o.hipY + 1.22, o.depth * .95], [-.55, 0, 0], hot(P.glow, 2.4), 10);
  root.B.oct('g', .06, [0, o.hipY + 1.26, o.depth * 1.0], null, hot(P.glow, 2.8));
  // Tubos de refrigeración por los flancos.
  for (const x of [-1, 1]) root.B.cyl('s', .03, .03, .42, [x * o.width * .55, o.hipY + .6, o.depth * .3], [.3, 0, x * .2], P.plate, 6);
  root.B.box('g', .16, .03, .02, [0, o.hipY + .58, -o.depth * .6], null, hot(P.glow, 1.7), .008);
}
function buildBrute(root, P, o) {
  const w = o.width = o.width * 1.5;
  const d = o.depth = o.depth * 1.3;
  bipedCore(root.B, P, { ...o, width: w, depth: d });
  bipedHead(root.B, P, { ...o, headY: o.hipY + .72, headW: .34, headD: .32 });
  factionTrim(root.B, P, { ...o, width: w, depth: d });
  // Hombreras descomunales: ocupan más que la cabeza.
  for (const x of [-1, 1]) {
    root.B.box('s', .34, .26, .46, [x * w * .66, o.hipY + .74, -.04], [0, 0, x * .26], P.plate, .07);
    root.B.box('g', .16, .03, .04, [x * w * .66, o.hipY + .84, -.26], null, hot(P.glow, 1.8), .008);
    root.B.cone('s', .08, .24, [x * w * .7, o.hipY + .95, -.1], [-.6, 0, x * .3], P.dark, 5);
  }
  // Espina dorsal de placas.
  for (let i = 0; i < 4; i++) root.B.cone('s', .07, .22, [0, o.hipY + .7 - i * .04, d * .42 + i * .14], [-.7, 0, 0], P.plate, 4);
  root.B.oct('g', .1, [0, o.hipY + .5, -d * .6], null, hot(P.glow, 2.8));
}
function buildSwarmling(root, P, o) {
  const w = o.width = o.width * .74;
  const d = o.depth = o.depth * .8;
  // Cuerpo bajo y redondeado: casi una mancha que corre.
  root.B.sph('s', .3, [0, o.hipY - .1, 0], null, P.armor, [1.15, .8, 1.3]);
  root.B.sph('g', .12, [0, o.hipY + .06, -d * .7], null, hot(P.glow, 2.4), [1, .7, .8]);
  root.B.box('s', .1, .06, .18, [0, o.hipY - .02, -d * .95], null, P.dark, .03);
  // Mandíbulas.
  for (const x of [-1, 1]) root.B.cone('g', .04, .16, [x * .1, o.hipY - .06, -d * 1.05], [-1.5, 0, x * .3], hot(P.glow, 1.8), 4);
  // Tres pares de patas finas.
  for (let i = 0; i < 3; i++) {
    for (const x of [-1, 1]) {
      const leg = segment(root, [x * w * .42, o.hipY - .28, (i - 1) * d * .5], i === 0 ? 'leg' + (x > 0 ? 1 : 0) : null);
      const B = leg.B;
      B.box('s', .05, .05, .26, [0, -.04, 0], [0, x * .5, .5], P.plate, .02);
      B.box('s', .04, .04, .22, [0, -.16, -.06], [0, x * .5, -1.0], P.dark, .015);
    }
  }
}
function buildTurretEnemy(root, P, o) {
  // SIN patas: trípode anclado. La ausencia de piernas es su seña de identidad.
  root.B.cyl('s', .3, .34, .14, [0, o.hipY - .5, 0], null, P.plate, 10);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    root.B.box('s', .07, .07, .5, [Math.cos(a) * .26, o.hipY - .72, Math.sin(a) * .26], [0, a, .55], P.armor, .02);
    root.B.box('s', .1, .05, .14, [Math.cos(a) * .48, o.hipY - .95, Math.sin(a) * .48], [0, a, 0], P.dark, .03);
  }
  root.B.cyl('s', .26, .3, .34, [0, o.hipY - .28, 0], null, P.armor, 10);
  // Cabeza giratoria con cañón doble.
  const head = new THREE.Group(); head.name = 'orb';
  head.position.set(0, o.hipY + .06, 0);
  root.g.add(head);
  root.B.box('s', .34, .3, .36, [0, o.hipY + .06, 0], null, P.plate, .06);
  root.B.box('s', .26, .05, .06, [0, o.hipY + .2, -.2], null, P.dark, .02);
  root.B.oct('g', .09, [0, o.hipY + .04, -.24], null, hot(P.glow, 2.8));
  for (const x of [-1, 1]) {
    root.B.cyl('g', .06, .05, .42, [x * .13, o.hipY + .02, -.42], [Math.PI / 2, 0, 0], P.dark, 8);
    root.B.cyl('g', .075, .075, .06, [x * .13, o.hipY + .02, -.64], [Math.PI / 2, 0, 0], hot(P.glow, 2.2), 8);
  }
  // Antena de adquisición.
  root.B.cyl('s', .02, .02, .4, [0, o.hipY + .5, o.depth * .2], null, P.plate, 5);
  root.B.sph('g', .05, [0, o.hipY + .72, o.depth * .2], null, hot(P.glow, 2.6));
}
function buildWraithEnemy(root, P, o) {
  // Alto, estrecho y partido: el torso está roto en dos mitades separadas.
  bipedCore(root.B, P, { ...o, width: o.width * .82, depth: o.depth * .7 });
  bipedHead(root.B, P, { ...o, headY: o.headY + .12, headW: .2, headD: .22 });
  factionTrim(root.B, P, o);
  // Grieta central: un hueco real entre las dos mitades del pecho.
  root.B.box('s', .06, .5, .3, [0, o.hipY + .58, -o.depth * .2], null, P.dark, .02);
  root.B.oct('g', .11, [0, o.hipY + .58, -o.depth * .55], null, hot(P.glow, 3.2));
  root.B.oct('g', .07, [0, o.hipY + .3, -o.depth * .5], null, hot(P.glow, 2.4));
  // Jirones colgantes: la parte inferior se deshace.
  for (let i = 0; i < 4; i++) {
    const x = (i % 2 ? 1 : -1) * (.12 + (i >> 1) * .1);
    root.B.box('s', .07, .3 + (i % 3) * .12, .04, [x, o.hipY - .1 - (i % 2) * .06, (i % 2 ? -.1 : .12)], [.1, 0, x * .3], P.dark, .015);
  }
  // Cuernos espectrales.
  for (const x of [-1, 1]) root.B.cone('g', .045, .3, [x * .16, o.headY + .2, 0], [.2, 0, x * .5], hot(P.glow, 1.6), 4);
}
function sapperLegs(root, P, o) { return chaserLegs(root, P, { ...o, width: o.width }); }
function sapperArms(root, P, o) { return chaserArms(root, P, o); }
function bruteLegs(root, P, o) { return tankLegs(root, P, o); }
function bruteArms(root, P, o) { return tankArms(root, P, o); }
function wraithLegs(root, P, o) { return chaserLegs(root, P, o); }

// ===========================================================================
//  ENSAMBLADO POR TIPO
// ===========================================================================
const SPEC = {
  chaser: { hipY: 1.06, width: .62, depth: .4, headY: 1.94, headW: .26, headD: .3, build: buildChaser, legs: chaserLegs, arms: chaserArms },
  sapper: { hipY: 1.0, width: .66, depth: .44, headY: 1.86, headW: .22, headD: .26, build: buildSapper, legs: sapperLegs, arms: sapperArms },
  brute: { hipY: .96, width: .92, depth: .58, headY: 1.78, headW: .34, headD: .32, build: buildBrute, legs: bruteLegs, arms: bruteArms },
  swarmling: { hipY: .52, width: .42, depth: .3, headY: .6, headW: .18, headD: .18, build: buildSwarmling },
  turret: { hipY: 1.1, width: .5, depth: .44, headY: 1.5, headW: .24, headD: .24, build: buildTurretEnemy },
  wraith: { hipY: 1.14, width: .54, depth: .34, headY: 2.06, headW: .2, headD: .22, build: buildWraithEnemy, legs: wraithLegs },
  tank: { hipY: 1.02, width: .8, depth: .5, headY: 1.9, headW: .3, headD: .3, build: buildTank, legs: tankLegs, arms: tankArms, plates: tankPlates },
  ranged: { hipY: 1.04, width: .62, depth: .4, headY: 1.96, headW: .2, headD: .26, build: buildRanged, legs: rangedLegs, arms: rangedArms },
  support: { hipY: 1.0, width: .5, depth: .36, headY: 1.9, headW: .2, headD: .2, build: buildSupport, arms: supportArms },
  stalker: { hipY: .92, width: .42, depth: .4, headY: 1.1, headW: .2, headD: .2, build: buildStalker, legs: stalkerLegs },
  flyer: { hipY: 1.1, width: .5, depth: .44, headY: 1.6, headW: .22, headD: .24, build: buildFlyer },
  drone: { hipY: 1.0, width: .5, depth: .4, headY: 1.6, headW: .2, headD: .2, build: buildDrone }
};

function makeTemplate(type, faction, tier) {
  const spec = SPEC[type] || SPEC.chaser;
  const ghost = faction === 'UMBRA' && type === 'stalker';
  const mats = factionMats(faction, ghost);
  const P = mats.P;
  const root = { g: new THREE.Group(), B: new Bake(), pending: [] };
  const o = { ...spec, faction, mats, hipY: spec.hipY, width: spec.width, depth: spec.depth, headY: spec.headY, headW: spec.headW, headD: spec.headD };

  spec.build(root, P, o);
  if (spec.legs) spec.legs(root, P, o);
  if (spec.arms) spec.arms(root, P, o);
  if (spec.plates) spec.plates(root, P, o);

  // Adornos de tramo (la antigua applyTier, ahora horneada con el cuerpo).
  if (tier >= 1) {
    const trim = hot(P.glow, .85);
    for (const x of [-1, 1]) root.B.box('s', .16, .1, .3, [x * o.width * .62, o.hipY + .82, 0], [0, 0, x * .1], P.plate, .03);
    if (tier >= 2) { root.B.box('s', .3, .26, .14, [0, o.hipY + .6, o.depth * .58], null, P.plate, .04); root.B.box('g', .06, .2, .04, [0, o.hipY + .6, o.depth * .68], null, trim, .01); }
    if (tier >= 3) for (const x of [-1, 1]) root.B.box('g', .12, .03, .03, [x * o.width * .3, o.hipY + .3, -.12], null, trim, .008);
    if (tier >= 4) {
      root.B.tor('g', .26, .018, [0, o.hipY + 1.02, 0], [Math.PI / 2, 0, 0], hot(P.glow, 1.5));
      for (let i = 0; i < 3; i++) root.B.cone('g', .04, .16, [0, o.hipY + .9, o.depth * .4 + i * .1], [-1.1, 0, 0], hot(P.glow, 1.4), 4);
    }
  }

  root.B.bake(root.g, mats);
  for (const seg of root.pending) seg.B.bake(seg.g, mats);

  root.g.userData.__tpl = true;
  return root.g;
}

const TEMPLATES = new Map();

// Devuelve un grupo NUEVO que comparte geometría y materiales con la plantilla
// de su variante. Es lo que mantiene el coste por hostil en unos pocos Object3D.
export function buildEnemyModel(type, faction, tier = 0) {
  const key = `${type}|${faction}|${tier}`;
  let tpl = TEMPLATES.get(key);
  if (!tpl) { tpl = makeTemplate(type, faction, tier); TEMPLATES.set(key, tpl); }
  const g = tpl.clone(true);
  const find = (n) => g.getObjectByName(n);
  const legs = [];
  for (const n of ['leg0', 'leg1', 'leg2', 'leg3']) { const o = find(n); if (o) legs.push(o); }
  const arms = [];
  for (const n of ['arm0', 'arm1']) { const o = find(n); if (o) arms.push(o); }
  const plateGroup = find('plates');
  g.userData = {
    legs, arms,
    plates: plateGroup ? [plateGroup] : [],
    orb: find('orb'), ring: find('ring'), rotor: find('rotor'),
    core: find('core'), wingL: find('wingL'), wingR: find('wingR')
  };
  return g;
}

// Corona de élite: se construye aparte porque su color depende del afijo y solo
// la llevan unos pocos hostiles.
export function buildEliteCrown(colors) {
  const g = new THREE.Group();
  const geos = [];
  for (let i = 0; i < (colors.length ? colors.length : 1); i++) {
    const c = colors[i] || 0xff4d38;
    const tor = prep(gTor(.42 - i * .1, .05, 5, 14), hot(c, 1.9));
    _e.set(Math.PI / 2, 0, i * .4);
    _m4.compose(_v.set(0, 2.5 + i * .16, 0), _q.setFromEuler(_e), _s.set(1, 1, 1));
    tor.applyMatrix4(_m4);
    geos.push(tor);
  }
  const merged = mergeGeometries(geos, false);
  geos.forEach(x => x.dispose());
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  g.add(new THREE.Mesh(merged, mat));
  g.userData.mat = mat;
  return g;
}

// Limpieza explícita (solo al cerrar el juego).
export function disposeEnemyCache() {
  for (const tpl of TEMPLATES.values()) {
    tpl.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  }
  TEMPLATES.clear();
  for (const m of _matCache.values()) { m.s.dispose(); m.c.dispose(); m.g.dispose(); }
  _matCache.clear();
  for (const g of GC.values()) g.dispose();
  GC.clear();
}
