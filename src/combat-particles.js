// NEON//REVENANT — partículas Kenney con Object Pooling + AdditiveBlending.
//
// Un InstancedMesh por sprite (≈19 draw calls en total), con CAP instancias
// reciclables cada uno. Nunca se crea ni se destruye un Mesh durante el combate:
// emitir solo escribe en un slot libre. Con blending aditivo el fundido se hace
// multiplicando el color de la instancia (negro = invisible), así que no hace
// falta clonar materiales por partícula.

import * as THREE from 'three';
import { WEAPON_DEFS } from './weapons.js';

const CAP = 96;
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _spin = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _col = new THREE.Color();

const USED = new Set(['circle_01.png']);
for (const def of Object.values(WEAPON_DEFS)) {
  const f = def.vfx || {};
  for (const key of ['flash', 'trail', 'impact', 'wave', 'smoke', 'melee', 'hit']) {
    for (const s of (f[key] || [])) USED.add(s);
  }
}
export const VFX_SPRITE_NAMES = [...USED];

class Pool {
  constructor(name, texture, scene) {
    this.name = name;
    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: texture, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        toneMapped: false
      }), CAP);
    this.mesh.name = 'vfx:' + name;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.slots = [];
    for (let i = 0; i < CAP; i++) {
      this.mesh.setMatrixAt(i, ZERO);
      this.mesh.setColorAt(i, _col.setRGB(1, 1, 1));
      this.slots.push({
        active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        target: null, life: 0, max: 1, sx: 1, sy: 1, spin: 0, angle: 0,
        gravity: 0, drag: 1, color: new THREE.Color(), homing: 0, onArrive: null
      });
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.cursor = 0;
    this.live = 0;
    scene.add(this.mesh);
  }

  take() {
    for (let k = 0; k < CAP; k++) {
      const i = (this.cursor + k) % CAP;
      if (!this.slots[i].active) { this.cursor = (i + 1) % CAP; return this.slots[i]; }
    }
    // Sin huecos: se reutiliza el más antiguo (el cursor apunta al siguiente).
    const p = this.slots[this.cursor];
    this.cursor = (this.cursor + 1) % CAP;
    return p;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.map?.dispose();
    this.mesh.material.dispose();
    this.mesh.removeFromParent();
  }
}

function loadTexture(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      resolve(t);
    };
    img.onerror = () => reject(new Error('sprite no legible'));
    img.src = dataUrl;
  });
}

export class CombatParticles {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.pools = new Map();
    this.ready = false;
    this.diag = { ok: false, sprites: [], pools: 0, live: 0, emitted: 0, error: null };
  }

  async init() {
    try {
      if (!window.desktop?.loadVfxSprites) throw new Error('puente IPC de sprites no disponible');
      const bank = await window.desktop.loadVfxSprites(VFX_SPRITE_NAMES);
      for (const name of USED) {
        const url = bank[name];
        if (!url) { this.diag.error = 'falta ' + name; continue; }
        const tex = await loadTexture(url);
        this.pools.set(name, new Pool(name, tex, this.scene));
        this.diag.sprites.push(name);
      }
      this.ready = this.pools.size > 0;
      this.diag.ok = this.ready;
      this.diag.pools = this.pools.size;
    } catch (err) {
      this.diag.error = String(err && err.message || err);
      console.log('VFX_SPRITES_ERROR: ' + this.diag.error);
    }
    window.__NR_VFX = this.diag;
    return this.diag;
  }

  emit(name, pos, o = {}) {
    const pool = this.pools.get(name);
    if (!pool) return;
    const count = o.count ?? 1;
    const c1 = new THREE.Color(o.color ?? 0xffffff);
    const c2 = new THREE.Color(o.color2 ?? o.color ?? 0xffffff);
    const dir = o.dir ? new THREE.Vector3().copy(o.dir) : new THREE.Vector3(0, 1, 0);
    for (let n = 0; n < count; n++) {
      const p = pool.take();
      const fresh = !p.active;
      if (fresh) pool.live++;
      p.active = true;
      p.pos.copy(pos);
      if (o.jitter) p.pos.add(new THREE.Vector3(
        (Math.random() - .5) * o.jitter, (Math.random() - .5) * o.jitter,
        (Math.random() - .5) * o.jitter));
      const speed = (o.speed ?? 1) * (.55 + Math.random() * .9);
      p.vel.copy(dir).multiplyScalar(speed);
      p.vel.x += (Math.random() - .5) * (o.spread ?? 1);
      p.vel.y += (Math.random() - .5) * (o.spread ?? 1);
      p.vel.z += (Math.random() - .5) * (o.spread ?? 1);
      p.max = p.life = (o.life ?? .45) * (.7 + Math.random() * .6);
      p.sx = (o.size ?? .5) * (.75 + Math.random() * .5) * (o.ratio ?? 1);
      p.sy = (o.size ?? .5) * (.75 + Math.random() * .5);
      p.angle = o.angle ?? Math.random() * Math.PI * 2;
      p.spin = o.spin ?? (Math.random() - .5) * 3;
      p.gravity = o.gravity ?? 0;
      p.drag = o.drag ?? 1.6;
      p.color.copy(c1).lerp(c2, Math.random());
      p.target = o.target ? o.target.clone() : null;
      p.homing = o.homing ?? 0;
      p.onArrive = o.onArrive || null;
      this.diag.emitted++;
    }
  }

  /** Eventos temáticos por héroe.
   *  `event`: shoot | melee | impact | hit | trail | lifesteal
   *  - `melee`: tajo del ataque primario de bárbaro/vampiro, en arco DELANTE
   *    del héroe (no en la punta del arma, donde quedaba oculto por el cuerpo).
   *  - `hit`: firma de partículas propia de cada héroe, solo al ACERTAR. */
  preset(characterId, event, pos, dir, opts = {}) {
    const def = WEAPON_DEFS[characterId] || WEAPON_DEFS.vanta;
    const f = def.vfx || {};
    const c = f.color ?? def.color, c2 = f.color2 ?? 0xffffff;
    const D = dir || new THREE.Vector3(0, 0, -1);

    if (event === 'shoot') {
      // Las armas de proyectil necesitan un fogonazo mayor: star_04 y
      // muzzle_04 son siluetas finas y a .55 unidades desaparecían en la
      // captura. Los tajos, en cambio, se contienen para no tapar al héroe.
      const projectile = !!def.projectile;
      for (const s of (f.flash || [])) {
        const slash = s.startsWith('slash_');
        this.emit(s, pos, {
          count: slash ? 2 : (projectile ? 5 : 3), color: c, color2: c2,
          life: slash ? .2 : .36, size: slash ? 1.2 : (projectile ? .95 : .7),
          ratio: slash ? 1.7 : 1, speed: slash ? 1.1 : .8,
          spread: slash ? .5 : 1.4, dir: D, jitter: .12, spin: slash ? 1.4 : 0,
          angle: slash ? -.5 : undefined
        });
      }
      // Un primer trazo de estela en la propia boca: el proyectil tarda un
      // frame en arrancar y sin esto el disparo parecía no tener salida.
      if (projectile && f.trail) {
        for (const s of f.trail) this.emit(s, pos, {
          count: 2, color: c, color2: c2, life: .26, size: .7,
          speed: 6, spread: .35, dir: D, drag: 4
        });
      }
      if (f.wave) {
        for (const s of f.wave) this.emit(s, pos, {
          count: 1, color: c, color2: c2, life: .34, size: 1.9,
          speed: 0, spin: .6, drag: 3, dir: D
        });
      }
      if (f.smoke) {
        for (const s of f.smoke) this.emit(s, pos, {
          count: 5, color: c, color2: c2, life: .75, size: 1.05,
          speed: .7, spread: 1.2, dir: D, gravity: .5, drag: 2.2
        });
      }
    } else if (event === 'melee') {
      // Los tajos se colocan en el arco de ataque y son MUCHO más grandes que
      // los fogonazos de disparo: el sprite de slash es una línea fina y con
      // AdditiveBlending a tamaño pequeño desaparecía en la captura.
      const heavy = !!opts.heavy, k = opts.lite ? .55 : 1, boost = f.meleeBoost ?? 1;
      for (const s of (f.melee || f.flash || [])) this.emit(s, pos, {
        count: Math.max(1, Math.round((heavy ? 3 : 2) * k * boost)), color: c, color2: c2,
        life: heavy ? .34 : .27, size: (heavy ? 1.85 : 1.45) * (.8 + k * .2) * boost,
        ratio: heavy ? 1.9 : 1.6, speed: heavy ? 1.5 : 2.1,
        spread: .6, dir: D, jitter: .22, spin: heavy ? 1.1 : 2.2,
        angle: heavy ? -.55 : .4, gravity: -.5, drag: 2.1
      });
      // Chispas de filo: garantizan un destello legible aunque el sprite del
      // tajo quede de canto respecto a la cámara en tercera persona.
      for (const s of (f.impact || []).slice(0, 1)) this.emit(s, pos, {
        count: Math.max(1, Math.round((heavy ? 10 : 7) * k * boost)), color: c, color2: c2,
        life: .3, size: .36 * boost, speed: 3.6, spread: 3.4, dir: D,
        gravity: -2.2, drag: 2.4, jitter: .3
      });
      if (!opts.lite) for (const s of (f.wave || [])) this.emit(s, pos, {
        count: 1, color: c, color2: c2, life: heavy ? .4 : .32,
        size: (heavy ? 2.1 : 1.5) * boost,
        speed: .3, spread: .2, dir: D, spin: .8, drag: 3
      });
    } else if (event === 'impact') {
      for (const s of (f.impact || [])) this.emit(s, pos, {
        count: s.startsWith('spark') ? 7 : 3, color: c, color2: c2,
        life: .38, size: s.startsWith('star') || s.startsWith('twirl') ? .95 : .42,
        speed: 4.6, spread: 5, dir: new THREE.Vector3(0, 1, 0),
        gravity: -3, drag: 2.4, jitter: .18
      });
    } else if (event === 'hit') {
      // Firma por personaje: sprites, color, tamaño, vida y gravedad salen de
      // `WEAPON_DEFS[id].vfx.hit` + `.hitStyle`. Se emite por enemigo ACERTADO,
      // a la altura del pecho/cabeza, no en el punto genérico de impacto.
      const st = f.hitStyle || {};
      for (const s of (f.hit || f.impact || [])) {
        const glow = /^(star|magic|twirl|light|circle)/.test(s);
        this.emit(s, pos, {
          count: Math.max(1, Math.round((st.count ?? 6) * (glow ? 1 : 1.25))),
          color: st.color ?? c, color2: st.color2 ?? c2,
          life: st.life ?? .5, size: (st.size ?? .55) * (glow ? 1.35 : .8),
          speed: st.speed ?? 3.4, spread: st.spread ?? 3.1,
          dir: new THREE.Vector3(0, 1, 0), gravity: st.gravity ?? -2,
          drag: st.drag ?? 2.2, jitter: st.jitter ?? .2, spin: st.spin ?? 2.2
        });
      }
    } else if (event === 'trail') {
      for (const s of (f.trail || [])) this.emit(s, pos, {
        count: 1, color: c, color2: c2, life: .3,
        size: opts.size ?? .34, speed: .3, spread: .25,
        dir: D, drag: 3
      });
    } else if (event === 'lifesteal') {
      const target = opts.target;
      if (!target) return;
      this.emit('circle_01.png', pos, {
        count: 8, color: 0xff2f45, color2: 0xff9aa5, life: .85,
        size: .34, speed: 1, spread: 2.2, target, homing: 15,
        dir: new THREE.Vector3(0, 1, 0), drag: .4
      });
    }
  }

  update(dt) {
    if (!this.ready) return;
    const cq = this.camera.getWorldQuaternion(_q);
    let live = 0;
    for (const pool of this.pools.values()) {
      let dirty = false, poolLive = 0;
      for (let i = 0; i < CAP; i++) {
        const p = pool.slots[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false; p.target = null; p.onArrive = null;
          pool.mesh.setMatrixAt(i, ZERO);
          pool.mesh.setColorAt(i, _col.setRGB(0, 0, 0));
          dirty = true;
          continue;
        }
        if (p.target && p.homing > 0) {
          const d = _v.copy(p.target).sub(p.pos);
          if (d.lengthSq() < .18) {
            const cb = p.onArrive; p.active = false; p.target = null; p.onArrive = null;
            pool.mesh.setMatrixAt(i, ZERO);
            pool.mesh.setColorAt(i, _col.setRGB(0, 0, 0));
            if (cb) cb();
            dirty = true;
            continue;
          }
          d.normalize().multiplyScalar(p.homing);
          p.vel.lerp(d, Math.min(1, dt * 9));
        }
        p.vel.y += p.gravity * dt;
        p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
        p.pos.addScaledVector(p.vel, dt);
        p.angle += p.spin * dt;
        const k = Math.min(1, p.life / p.max * 1.6);
        _spin.setFromAxisAngle(AXIS_Z, p.angle);
        _q2.copy(cq).multiply(_spin);
        _scale.set(p.sx * k, p.sy * k, 1);
        _m.compose(p.pos, _q2, _scale);
        pool.mesh.setMatrixAt(i, _m);
        pool.mesh.setColorAt(i, _col.copy(p.color).multiplyScalar(k));
        dirty = true;
        live++; poolLive++;
      }
      if (dirty) {
        pool.mesh.instanceMatrix.needsUpdate = true;
        if (pool.mesh.instanceColor) pool.mesh.instanceColor.needsUpdate = true;
      }
      pool.live = poolLive;
    }
    this.diag.live = live;
  }

  clear() {
    for (const pool of this.pools.values()) {
      for (let i = 0; i < CAP; i++) {
        const p = pool.slots[i];
        p.active = false; p.target = null; p.onArrive = null;
        pool.mesh.setMatrixAt(i, ZERO);
        pool.mesh.setColorAt(i, _col.setRGB(0, 0, 0));
      }
      pool.mesh.instanceMatrix.needsUpdate = true;
      if (pool.mesh.instanceColor) pool.mesh.instanceColor.needsUpdate = true;
      pool.live = 0;
    }
    this.diag.live = 0;
  }

  dispose() {
    for (const pool of this.pools.values()) pool.dispose();
    this.pools.clear();
    this.ready = false;
  }
}
