// NEON//REVENANT — arsenal de apoyo: modelos de cuerpo a cuerpo, utilidad y
// el gato robot. Solo construyen mallas; la lógica de combate vive en game.js.

import * as THREE from 'three';

function glowMat(color, i = 1.2) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: .35, metalness: .4 });
}
function darkMat(color = 0x121a1e) {
  return new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .8 });
}
function rbox(parent, size, pos, material, radius = .04) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  if (radius > 0) {
    const inner = [Math.max(.001, size[0] - radius * 2), Math.max(.001, size[1] - radius * 2), Math.max(.001, size[2] - radius * 2)];
    const rg = new THREE.Mesh(new THREE.BoxGeometry(inner[0], inner[1], inner[2]), material);
    g.add(rg);
  }
  g.position.set(pos[0], pos[1], pos[2]);
  parent.add(g); return g;
}

// ---------------------------------------------------------------------------
// Modelos de armas cuerpo a cuerpo: se enganchan a la mano del jugador.
// userData.blade apunta a la pieza que brilla al golpear.
export function buildMeleeModel(id, accentHex = 0x6ef7e7) {
  const g = new THREE.Group();
  const dark = darkMat(), grip = new THREE.MeshStandardMaterial({ color: 0x0b0f12, roughness: .85 });
  const glow = glowMat(accentHex, 1.35);
  if (id === 'hammer') {
    rbox(g, [.07, .34, .07], [0, -.12, 0], grip);
    rbox(g, [.3, .2, .2], [0, .12, 0], dark, .05);
    rbox(g, [.34, .07, .24], [0, .12, 0], glow, .02);
    g.userData.blade = g.children[2];
  } else if (id === 'lance') {
    rbox(g, [.06, .5, .06], [0, -.2, 0], grip);
    const shaft = rbox(g, [.05, 1.0, .05], [0, .32, 0], dark, .02);
    rbox(g, [.09, .16, .09], [0, .82, 0], glow, .02);
    const tip = rbox(g, [.04, .3, .04], [0, 1.02, 0], glow, .015);
    tip.rotation.z = 0;
    g.userData.blade = tip; g.userData.shaft = shaft;
  } else if (id === 'claws') {
    rbox(g, [.1, .18, .1], [0, -.1, 0], grip);
    for (const [x, z] of [[-.06, -.08], [.06, -.08], [-.05, .02], [.05, .02]]) {
      const claw = rbox(g, [.02, .22, .02], [x, .1, z], glow, .01);
      claw.rotation.x = -.5;
    }
    rbox(g, [.16, .06, .16], [0, 0, 0], dark, .02);
    g.userData.blade = g.children[1];
  } else { // blade — hoja de fase
    rbox(g, [.06, .3, .06], [0, -.12, 0], grip);
    rbox(g, [.03, .3, .03], [0, .1, 0], dark, .015);
    const blade = rbox(g, [.035, .85, .1], [0, .62, 0], glow, .015);
    blade.rotation.x = 0;
    g.userData.blade = blade;
  }
  return g;
}

// ---------------------------------------------------------------------------
// El gato robot: orejas de antena, cola segméntica, ojos LED. Camina con las
// patas (userData.legs) y mueve la cola (userData.tail).
export function buildCatModel(accentHex = 0xffd34d) {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0x2b3338, roughness: .5, metalness: .75 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x12181c, roughness: .6, metalness: .6 });
  const glow = glowMat(accentHex, 1.6);
  const glow2 = glowMat(0xff4d38, 1.3);

  // cuerpo
  const body = rbox(g, [.5, .34, .72], [0, .46, 0], shell, .06);
  rbox(g, [.44, .1, .6], [0, .62, -.04], dark, .04);
  // cabeza
  const head = new THREE.Group(); head.position.set(0, .74, -.42); g.add(head);
  rbox(head, [.34, .28, .3], [0, 0, 0], shell, .05);
  // orejas-antena
  for (const x of [-.12, .12]) {
    const ear = rbox(head, [.09, .12, .04], [x, .2, -.06], dark, .01);
    ear.rotation.x = -.2;
    rbox(head, [.05, .05, .02], [x, .2, -.09], glow, .01);
  }
  // ojos LED
  const eyes = [];
  for (const x of [-.09, .09]) {
    const eye = rbox(head, [.06, .045, .02], [x, .02, -.16], glow, .008);
    eyes.push(eye);
  }
  rbox(head, [.1, .02, .02], [0, -.08, -.16], glow2, .005);
  // cola: tres segmentos encadenados
  const tail = new THREE.Group(); tail.position.set(0, .56, .34); g.add(tail);
  let seg = tail;
  const tailSegs = [];
  for (let i = 0; i < 3; i++) {
    const child = new THREE.Group(); child.position.set(0, i === 0 ? .08 : .18, .04);
    rbox(seg, [.06, .2, .06], [0, .08, 0], i === 2 ? glow : dark, .02);
    seg.add(child); tailSegs.push(child); seg = child;
  }
  // patas
  const legs = [];
  for (const [x, z] of [[-.18, -.24], [.18, -.24], [-.18, .24], [.18, .24]]) {
    const leg = new THREE.Group(); leg.position.set(x, .34, z); g.add(leg);
    rbox(leg, [.09, .3, .09], [0, -.16, 0], dark, .02);
    rbox(leg, [.11, .06, .13], [0, -.32, .02], shell, .02);
    legs.push(leg);
  }
  // proyector de patas traseras (turbo al esquivar)
  rbox(g, [.4, .06, .1], [0, .3, .38], glow, .02);
  // anillo de invocación
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.55, .025, 6, 22), glowMat(accentHex, 1.6));
  ring.material.transparent = true;
  ring.rotation.x = Math.PI / 2; ring.position.y = .06; g.add(ring);

  g.userData.legs = legs; g.userData.tail = tail; g.userData.tailSegs = tailSegs;
  g.userData.head = head; g.userData.eyes = eyes; g.userData.ring = ring;
  g.userData.body = body;
  return g;
}

// ---------------------------------------------------------------------------
// Objetos de utilidad desplegados en el mundo: granada, botiquín, torreta.
export function buildUtilityProp(id, accentHex = 0xffbf47) {
  const g = new THREE.Group();
  const glow = glowMat(accentHex, 1.2);
  const shell = darkMat(0x1c2429);
  if (id === 'medkit') {
    rbox(g, [.5, .34, .5], [0, .2, 0], shell, .05);
    rbox(g, [.3, .06, .08], [0, .38, 0], glowMat(0x6ef7e7, 1.4), .01);
    rbox(g, [.08, .06, .3], [0, .38, 0], glowMat(0x6ef7e7, 1.4), .01);
  } else if (id === 'pylon') {
    rbox(g, [.3, .1, .3], [0, .06, 0], shell, .03);
    rbox(g, [.12, .8, .12], [0, .45, 0], shell, .03);
    rbox(g, [.3, .16, .3], [0, .92, 0], glow, .03);
    const eye = rbox(g, [.1, .1, .1], [0, .92, .18], glowMat(0xff4d38, 1.8), .02);
    g.userData.eye = eye;
  } else { // granada (proyectil)
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.16, 0), glow);
    g.add(core);
    rbox(g, [.06, .06, .06], [0, .16, 0], shell, .01);
  }
  return g;
}
