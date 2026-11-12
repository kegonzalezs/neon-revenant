// NEON//REVENANT — proyectiles 3D ligeros con Object Pooling.
//
// Tres familias construidas por código (sin GLB, sin fetch):
//   · arrow  : asta cilíndrica + punta cónica + dos planos cruzados de plumas.
//   · orb    : icosaedro low-poly emisivo violeta + núcleo blanco.
//   · laser  : cilindro largo de neón cian + alma blanca.
//
// Cada tipo tiene un banco fijo de mallas invisibles que se activan y reciclan.
// El daño se aplica en el impacto real (callback), no en el momento del disparo.

import * as THREE from 'three';

const CAP = 32;
const FORWARD = new THREE.Vector3(0, 0, -1);
const _v = new THREE.Vector3();

function additive(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false
  });
}

function makeArrow() {
  const g = new THREE.Group();
  const gold = new THREE.MeshBasicMaterial({ color: 0xffd068, side: THREE.DoubleSide, toneMapped: false });
  const white = additive(0xfff8dc);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.017, .017, .74, 5), gold);
  shaft.rotation.x = -Math.PI / 2;
  g.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.045, .15, 5), white);
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = -.44;
  g.add(tip);
  const featherGeo = new THREE.PlaneGeometry(.18, .13);
  const f1 = new THREE.Mesh(featherGeo, gold); f1.position.z = .31; f1.rotation.y = Math.PI / 2;
  const f2 = new THREE.Mesh(featherGeo, gold); f2.position.z = .31; f2.rotation.x = Math.PI / 2;
  g.add(f1, f2);
  return g;
}

function makeOrb() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.17, 0), additive(0xb56bff, .9)));
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.085, 0), additive(0xff8cf5)));
  return g;
}

function makeLaser() {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(.038, .038, 1.25, 6), additive(0x35d8ff, .8));
  outer.rotation.x = -Math.PI / 2;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(.013, .013, 1.3, 6), additive(0xe8ffff));
  core.rotation.x = -Math.PI / 2;
  g.add(outer, core);
  return g;
}

const BUILDERS = { arrow: makeArrow, orb: makeOrb, laser: makeLaser };

export class CombatProjectiles {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.banks = {};
    this.diag = { ok: true, spawned: 0, live: 0, pools: 0 };
    for (const [type, build] of Object.entries(BUILDERS)) {
      const entries = [];
      for (let i = 0; i < CAP; i++) {
        const mesh = build();
        mesh.visible = false;
        mesh.frustumCulled = false;
        mesh.userData.poolType = type;
        scene.add(mesh);
        entries.push({
          mesh, active: false, dir: new THREE.Vector3(), to: new THREE.Vector3(),
          speed: 60, life: 0, trailT: 0, characterId: 'vanta',
          onImpact: null, size: .34
        });
      }
      this.banks[type] = { entries, cursor: 0 };
      this.diag.pools++;
    }
    window.__NR_PROJECTILES = this.diag;
  }

  spawn(type, from, to, o = {}) {
    const bank = this.banks[type];
    if (!bank) return null;
    let slot = null;
    for (let k = 0; k < CAP; k++) {
      const i = (bank.cursor + k) % CAP;
      if (!bank.entries[i].active) { slot = bank.entries[i]; bank.cursor = (i + 1) % CAP; break; }
    }
    if (!slot) { slot = bank.entries[bank.cursor]; bank.cursor = (bank.cursor + 1) % CAP; }
    const p = slot;
    p.active = true;
    p.mesh.visible = true;
    p.mesh.position.copy(from);
    p.to.copy(to);
    p.dir.copy(_v.copy(to).sub(from));
    const dist = p.dir.length();
    if (dist < .001) p.dir.copy(FORWARD); else p.dir.divideScalar(dist);
    p.mesh.quaternion.setFromUnitVectors(FORWARD, p.dir);
    p.speed = o.speed ?? 80;
    p.life = Math.max(.12, Math.min(1.6, dist / p.speed + .05));
    p.trailT = 0;
    p.characterId = o.characterId || 'vanta';
    p.onImpact = o.onImpact || null;
    p.size = o.size ?? .34;
    p.mesh.scale.setScalar(o.scale ?? 1);
    this.diag.spawned++;
    return p;
  }

  update(dt) {
    let live = 0;
    for (const bank of Object.values(this.banks)) {
      for (const p of bank.entries) {
        if (!p.active) continue;
        const step = p.speed * dt;
        const left = _v.copy(p.to).sub(p.mesh.position);
        p.life -= dt;
        p.trailT -= dt;
        if (p.trailT <= 0) {
          p.trailT = .032;
          this.particles?.preset(p.characterId, 'trail', p.mesh.position, p.dir, { size: p.size });
        }
        if (left.length() <= step || p.life <= 0) {
          const at = p.mesh.position.clone();
          if (left.length() <= step) at.copy(p.to);
          const cb = p.onImpact;
          p.active = false; p.mesh.visible = false; p.onImpact = null;
          if (cb) cb(at);
          continue;
        }
        p.mesh.position.addScaledVector(p.dir, step);
        live++;
      }
    }
    this.diag.live = live;
  }

  clear() {
    for (const bank of Object.values(this.banks)) {
      for (const p of bank.entries) {
        p.active = false; p.mesh.visible = false; p.onImpact = null;
      }
    }
    this.diag.live = 0;
  }

  dispose() {
    this.clear();
    for (const bank of Object.values(this.banks)) {
      for (const p of bank.entries) {
        p.mesh.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
        p.mesh.removeFromParent();
      }
      bank.entries.length = 0;
    }
    this.banks = {};
  }
}
