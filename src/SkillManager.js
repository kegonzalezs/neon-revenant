// ===========================================================================
// NEON//REVENANT — SkillManager
// ---------------------------------------------------------------------------
// Motor de la progresión unificada. No conoce el DOM ni el `state` del juego:
// todo lo que necesita llega por `host` (inyectado desde game.js). Así el
// futuro mapa de nodos por salas podrá entregar recompensas llamando solo a
// `grant(id)` sin tocar los menús.
//
// Responsabilidades:
//   * 6 slots de habilidad (niveles 1-5), reliquias y pactos ilimitados.
//   * Sinergias: 2 requisitos -> concesión automática al abrir un cofre.
//   * `mods` resueltos (suma de modificadores por nivel) y `flags`.
//   * Object Pooling: partículas Kenney (InstancedMesh + AdditiveBlending) y
//     geometrías 3D procedurales (anillos, esferas, conos, cilindros).
//   * SFX con pitch variable (0.9-1.1; 0.65 en pactos).
//   * XP: orbes agrupados que vuelan al héroe y disparan la subida de nivel.
//   * Cooldowns SOLO mientras hay enemigos vivos; onRoomClear() limpia todo.
// ===========================================================================

import * as THREE from 'three';
import { playSfx } from './sfx.js';
import {
  MAX_SLOTS, MAX_LEVEL, RARITY, HERO_THEME, SFX, PARTICLES,
  SKILLS, RELIC_LIST, PACT_LIST, SYNERGIES, STAT_UPGRADES,
  itemById, skillsFor, synergyFor, synergyReady, describe, catalogDiagnostics
} from './SkillsDatabase.js';

// Temporales de módulo: LOS POOLS NO DEBEN ASIGNAR OBJETOS POR FRAME.
// Con 90 orbes + ~24 formas activas, crear Matrix4/Quaternion/Vector3 en cada
// write() dispararía cientos de asignaciones por frame y rompería los 60 FPS.
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _c = new THREE.Color();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s3 = new THREE.Vector3();
const _e = new THREE.Euler();
const _up = new THREE.Vector3(0, 1, 0);
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);

// ---------------------------------------------------------------------------
// Pool genérico de mallas 3D: NUNCA se crea ni destruye geometry/material
// durante el combate. Se agrupa por (forma, color) para poder teñir sin
// clonar materiales compartidos.
// ---------------------------------------------------------------------------
const GEOS = {
  ring:     () => new THREE.RingGeometry(.78, 1, 28),
  sphere:   () => new THREE.SphereGeometry(1, 14, 10),
  cone:     () => new THREE.ConeGeometry(.6, 2, 8),
  cylinder: () => new THREE.CylinderGeometry(.5, .5, 1, 8, 1, true),
  dark:     () => new THREE.SphereGeometry(1, 16, 12)
};

class ShapePool {
  constructor(scene, kind, color, cap = 24) {
    this.kind = kind; this.color = color;
    this.material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color), transparent: true, opacity: .6,
      depthWrite: false, side: THREE.DoubleSide,
      blending: kind === 'dark' ? THREE.NormalBlending : THREE.AdditiveBlending,
      toneMapped: false
    });
    if (kind === 'dark') { this.material.opacity = .92; this.material.color.set(0x120a22); }
    this.geometry = GEOS[kind]();
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, cap);
    this.mesh.name = `skillfx:${kind}:${color}`;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cap = cap;
    this.slots = [];
    for (let i = 0; i < cap; i++) {
      this.mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
      this.slots.push({ i, active: false });
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.mesh);
  }
  take() { for (const s of this.slots) if (!s.active) { s.active = true; return s; } return null; }
  write(s, pos, scale, rotY, grow, opacity) {
    _e.set(this.kind === 'ring' ? -Math.PI / 2 : 0, rotY || 0, 0);
    _q.setFromEuler(_e);
    _s3.set(scale, scale, scale);
    _m.compose(pos, _q, _s3);
    this.mesh.setMatrixAt(s.i, _m);
    this.mesh.instanceMatrix.needsUpdate = true;
    s.grow = grow || 0; s.opacity = opacity;
  }
  hide(s) {
    s.active = false;
    this.mesh.setMatrixAt(s.i, ZERO_M);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose(scene) { scene.remove(this.mesh); this.geometry.dispose(); this.material.dispose(); }
}

// ---------------------------------------------------------------------------
// Pool de orbes de XP: octaedros mate que vuelan al héroe dentro del radio imán.
// ---------------------------------------------------------------------------
class XpOrbPool {
  constructor(scene, cap = 90) {
    this.geometry = new THREE.OctahedronGeometry(.26, 0);
    this.material = new THREE.MeshBasicMaterial({ color: 0x8fe3c0, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, cap);
    this.mesh.name = 'skill:xp-orbs';
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cap = cap; this.orbs = [];
    for (let i = 0; i < cap; i++) {
      this.mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
      this.orbs.push({ i, active: false });
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.mesh);
  }
  spawn(pos, value) {
    let o = this.orbs.find(x => !x.active);
    if (!o) { // recicla el más antiguo para no perder XP en hordas grandes
      o = this.orbs[0]; this.orbs.push(this.orbs.shift());
    }
    o.active = true; o.value = value; o.t = 0;
    o.pos = new THREE.Vector3(pos.x + (Math.random() - .5) * 1.4, .8, pos.z + (Math.random() - .5) * 1.4);
    o.vel = new THREE.Vector3((Math.random() - .5) * 3, 3 + Math.random() * 2, (Math.random() - .5) * 3);
    return o;
  }
  write(o, scale) {
    _e.set(o.t * 2.1, o.t * 3.2, 0);
    _q.setFromEuler(_e);
    _s3.set(scale, scale, scale);
    _m.compose(o.pos, _q, _s3);
    this.mesh.setMatrixAt(o.i, _m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  hide(o) {
    o.active = false;
    this.mesh.setMatrixAt(o.i, ZERO_M);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { for (const o of this.orbs) if (o.active) this.hide(o); }
  dispose(scene) { scene.remove(this.mesh); this.geometry.dispose(); this.material.dispose(); }
}

// ===========================================================================
export class SkillManager {
  /**
   * @param {object} host adaptador del juego (ver game.js: SKILL_HOST)
   */
  constructor(host = {}) {
    this.host = host;
    this.reset(host.hero || 'vanta');
    this._initPools(host.scene);
  }

  // ------------------------------------------------------------------ estado
  reset(hero = 'vanta') {
    this.hero = hero;
    this.slots = new Map();          // id -> nivel (1..5), máximo 6 entradas
    this.relics = new Set();
    this.pacts = new Set();
    this.synergies = new Set();
    this.flags = new Set();
    this.mods = {};
    this.timers = new Map();         // cooldown por habilidad periódica
    this.xp = 0; this.level = 1; this.xpNext = 12;
    this.levelPending = false;
    this.reviveUsed = false;
    this._hpMult = 1; this._hpFlat = 0;
    this._combatTime = 0;
    this._killStreak = 0;
    this._idleTime = 0;
    this._shieldCharges = 0;
    this._lastRoomClear = 0;
    if (this.orbs) this.orbs.clear();
    if (this.shapes) this.clearShapes();
    this._recompute();
  }

  _initPools(scene) {
    if (!scene) return;
    this.orbs = new XpOrbPool(scene);
    this.shapes = new Map();         // "kind|color" -> ShapePool
    this.activeShapes = [];
  }

  // --------------------------------------------------------------- propiedad
  has(id) { return this.slots.has(id) || this.relics.has(id) || this.pacts.has(id) || this.synergies.has(id); }
  levelOf(id) { return this.slots.get(id) || 0; }
  hasFlag(f) { return this.flags.has(f); }
  mod(key) { return this.mods[key] || 0; }
  get slotCount() { return this.slots.size; }
  get maxSlots() { return Math.max(1, MAX_SLOTS - Math.floor(this.mod('slotLock') || 0)); }
  get ownedCount() { return this.slots.size + this.relics.size + this.pacts.size; }

  snapshot() {
    return {
      hero: this.hero, level: this.level, xp: Math.floor(this.xp), xpNext: this.xpNext,
      slots: [...this.slots].map(([id, lv]) => ({ id, level: lv, name: itemById(id)?.name, icon: itemById(id)?.icon })),
      relics: [...this.relics], pacts: [...this.pacts], synergies: [...this.synergies],
      maxSlots: this.maxSlots, mods: { ...this.mods }, flags: [...this.flags]
    };
  }

  // --------------------------------------------------------------- concesión
  /** Entrega un objeto del catálogo. Devuelve { ok, reason, leveled, item }. */
  grant(id, opts = {}) {
    const it = itemById(id);
    if (!it) return { ok: false, reason: 'unknown', item: null };
    if (it.type === 'skill') {
      if (it.hero !== this.hero && !opts.force) return { ok: false, reason: 'wrong-hero', item: it };
      const cur = this.slots.get(id) || 0;
      if (cur >= MAX_LEVEL) return { ok: false, reason: 'max-level', item: it };
      if (!cur && this.slots.size >= this.maxSlots) return { ok: false, reason: 'no-slots', item: it };
      this.slots.set(id, cur + 1);
      this.timers.set(id, this._interval(it, cur + 1));
      this._recompute();
      this._fxGrant(it, '#f0c65a');
      return { ok: true, leveled: cur + 1, item: it };
    }
    if (it.type === 'relic' || it.type === 'pact_relic') {
      const bag = it.type === 'relic' ? this.relics : this.pacts;
      if (bag.has(id)) return { ok: false, reason: 'duplicate', item: it };
      bag.add(id);
      this._recompute();
      this._applyPermanent(it);
      this._fxGrant(it, it.type === 'pact_relic' ? '#b3354b' : '#9a8ce8');
      return { ok: true, leveled: 1, item: it };
    }
    if (it.type === 'synergy') {
      if (this.synergies.has(id)) return { ok: false, reason: 'duplicate', item: it };
      this.synergies.add(id);
      this._recompute();
      this._fxGrant(it, '#f0c65a');
      return { ok: true, leveled: 1, item: it };
    }
    return { ok: false, reason: 'bad-type', item: it };
  }

  _interval(it, level) {
    if (!it.power) return 0;
    let base = it.power.every;
    // Las habilidades periódicas mejoran su cadencia con el nivel.
    if (base > 2) base = Math.max(.8, base - (level - 1) * .45);
    return base * (1 - Math.min(.7, this.mod('cooldown')));
  }

  _applyPermanent(it) {
    const s = this.host.getState?.(); if (!s) return;
    if (it.type === 'pact_relic' && this.mod('noShields')) s.shield = 0;
    if (it.id === 'pct_glass') s.shield = 0;
  }

  /** Cambios de maxHp que deben sobrevivir a las mejoras de estadísticas. */
  _syncHp() {
    const s = this.host.getState?.(); if (!s) return;
    const targetMult = Math.max(.05, 1 + (this.mod('maxHpMult') || 0));
    const targetFlat = this.mod('maxHp') || 0;
    if (targetMult !== this._hpMult || targetFlat !== this._hpFlat) {
      const base = s.maxHp / this._hpMult - this._hpFlat;
      s.maxHp = Math.max(1, Math.round((base + targetFlat) * targetMult));
      s.hp = Math.min(s.hp, s.maxHp);
      this._hpMult = targetMult; this._hpFlat = targetFlat;
    }
  }

  _recompute() {
    const m = {};
    const flags = new Set();
    const add = (k, v) => { if (typeof v === 'number') m[k] = (m[k] || 0) + v; };
    const collect = (it, levels) => {
      for (const [k, v] of Object.entries(it.mods || {})) add(k, v * levels);
      for (const [k, v] of Object.entries(it.curseMods || {})) add(k, v);
      for (const f of it.flags || []) flags.add(f);
    };
    for (const [id, lv] of this.slots) { const it = itemById(id); if (it) collect(it, lv); }
    for (const id of this.relics) { const it = itemById(id); if (it) collect(it, 1); }
    for (const id of this.pacts) { const it = itemById(id); if (it) collect(it, 1); }
    for (const id of this.synergies) { const it = itemById(id); if (it) collect(it, 1); }
    // Coleccionista Maldito: escala con cada reliquia/pacto equipado.
    if (m.collector) add('damage', m.collector * (this.relics.size + this.pacts.size));
    this.mods = m; this.flags = flags;
    this._syncHp();
    // Recalcular cooldowns restantes con la nueva reducción.
    for (const [id, t] of this.timers) {
      const it = itemById(id);
      if (it?.power) this.timers.set(id, Math.min(t, this._interval(it, this.levelOf(id) || 1)));
    }
    // El pacto del Solitario puede dejar slots ocupados de más: se respetan
    // los que ya están, simplemente se bloquean nuevas adquisiciones.
  }

  // ------------------------------------------------------------------- cartas
  _weightedPick(pool, taken = new Set()) {
    const rareBonus = 1 + (this.mod('rare') || 0);
    const entries = pool.map(it => {
      const r = RARITY[it.rarity] || RARITY.COMUN;
      let w = r.weight;
      if (it.rarity === 'RARA' || it.rarity === 'EPICA') w *= rareBonus;
      if (taken.has(it.id)) w = 0;
      return { it, w };
    });
    const total = entries.reduce((n, e) => n + e.w, 0);
    if (total <= 0) return null;
    let roll = (this.host.rand?.() ?? Math.random()) * total;
    for (const e of entries) { roll -= e.w; if (roll <= 0) return e.it; }
    return entries[entries.length - 1]?.it || null;
  }

  /** 3 cartas de HABILIDAD, solo las 10 del héroe activo. */
  rollSkillCards(n = 3) {
    const pool = skillsFor(this.hero).filter(it => {
      const lv = this.levelOf(it.id);
      if (lv >= MAX_LEVEL) return false;
      if (!lv && this.slots.size >= this.maxSlots) return false;
      return true;
    });
    const out = [], taken = new Set();
    for (let i = 0; i < n && pool.length > taken.size; i++) {
      const it = this._weightedPick(pool, taken);
      if (!it) break;
      taken.add(it.id);
      out.push({ ...it, nextLevel: this.levelOf(it.id) + 1, kind: 'skill' });
    }
    // Relleno: si el héroe ya tiene 6 slots, ofrece subir de nivel las que tiene.
    if (!out.length) {
      const owned = [...this.slots.keys()].filter(id => this.levelOf(id) < MAX_LEVEL);
      for (const id of owned.slice(0, n)) out.push({ ...itemById(id), nextLevel: this.levelOf(id) + 1, kind: 'skill' });
    }
    return out;
  }

  /** 3 cartas de COFRE: mezcla 20 reliquias + 10 pactos. */
  rollChestCards(n = 3) {
    const pool = [...RELIC_LIST, ...PACT_LIST].filter(it => !this.has(it.id));
    // Al menos un pacto en la oferta si quedan disponibles (borde carmesí).
    const out = [], taken = new Set();
    const pacts = pool.filter(x => x.type === 'pact_relic');
    if (pacts.length && (this.host.rand?.() ?? Math.random()) < .55) {
      const p = this._weightedPick(pacts, taken);
      if (p) { taken.add(p.id); out.push({ ...p, nextLevel: 1, kind: 'pact_relic' }); }
    }
    while (out.length < n && taken.size < pool.length) {
      const it = this._weightedPick(pool, taken);
      if (!it) break;
      taken.add(it.id);
      out.push({ ...it, nextLevel: 1, kind: it.type });
    }
    return out;
  }

  /** Sinergia pendiente: 2 requisitos cumplidos y aún no concedida. */
  pendingSynergy() {
    const syn = synergyFor(this.hero);
    if (!syn || this.synergies.has(syn.id)) return null;
    const levels = Object.fromEntries(this.slots);
    return synergyReady(syn, levels) ? syn : null;
  }

  describeCard(card) { return describe(card, card.nextLevel || 1); }

  // ----------------------------------------------------------------------- XP
  get xpInfo() { return { level: this.level, xp: Math.floor(this.xp), next: this.xpNext, pct: Math.min(1, this.xp / this.xpNext) }; }

  addXp(amount, pos) {
    const gain = amount * (1 + (this.mod('xp') || 0));
    if (pos && this.orbs) {
      const chunks = Math.min(6, Math.max(1, Math.round(gain / 6)));
      for (let i = 0; i < chunks; i++) this.orbs.spawn(pos, gain / chunks);
    } else this._creditXp(gain);
  }

  _creditXp(gain) {
    this.xp += gain;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.round(this.xpNext * 1.32 + 4);
      this.levelPending = true;
      this.host.onLevelUp?.(this.level);
    }
  }

  // --------------------------------------------------------------------- SFX
  play(kind, opts = {}) {
    const list = Array.isArray(kind) ? kind : (SFX[kind] || kind);
    if (!list) return;
    // Pitch variable 0.9-1.1 lo aplica sfx.js; los pactos bajan a 0.65.
    const o = { volume: opts.volume ?? .5, ...opts };
    if (opts.grave) { o.rate = .65; o.pitch = false; }
    playSfx(list, o);
  }

  _fxGrant(it, color) {
    const pos = this.host.getPlayer?.()?.position;
    if (pos && this.host.emitParticles) {
      const sprite = (it.particle || PARTICLES.object)[0] + '.png';
      this.host.emitParticles(sprite, pos.clone().add(new THREE.Vector3(0, 1.2, 0)),
        { count: 14, color, size: .8, speed: 3.4, life: .7, spread: 3 });
    }
    if (it.type === 'pact_relic') this.play('pact', { grave: true, volume: .6 });
    else if (it.type === 'synergy') this.play('synergy', { volume: .65 });
    else this.play(it.sfx || 'levelUp', { volume: .55 });
    this.host.flash?.(it.type === 'pact_relic' ? '#7a1526' : color, .16, 220);
  }

  // ----------------------------------------------------------- VFX con pooling
  /** Anillo / esfera / cono / cilindro emisivo efímero (sin crear geometría). */
  shape(kind, pos, o = {}) {
    if (!this.shapes || !this.host.scene) return null;
    const color = o.color || '#8fd8ff';
    const key = kind + '|' + color;
    let pool = this.shapes.get(key);
    if (!pool) { pool = new ShapePool(this.host.scene, kind, color); this.shapes.set(key, pool); }
    const slot = pool.take(); if (!slot) return null;
    const life = o.life ?? .5;
    const fx = { pool, slot, kind, pos: pos.clone(), scale: o.scale ?? 1,
                 grow: o.grow ?? 2.4, life, max: life, rotY: o.rotY ?? 0 };
    pool.write(slot, fx.pos, fx.scale, fx.rotY, fx.grow);
    this.activeShapes.push(fx);
    return fx;
  }

  clearShapes() {
    if (!this.activeShapes) return;
    for (const fx of this.activeShapes) fx.pool.hide(fx.slot);
    this.activeShapes.length = 0;
  }

  _burst(theme, pos, o = {}) {
    const names = PARTICLES[theme] || PARTICLES.object;
    const sprite = (o.sprite || names[Math.floor(Math.random() * names.length)]) + '.png';
    this.host.emitParticles?.(sprite, pos, {
      count: o.count ?? 8, color: o.color ?? 0xffffff, size: o.size ?? .7,
      speed: o.speed ?? 2, life: o.life ?? .5, spread: o.spread ?? 2, gravity: o.gravity ?? 0
    });
  }

  /** Cadena de relámpagos / prisma: cilindros emisivos entre dos puntos. */
  beam(from, to, o = {}) {
    if (!this.shapes) return;
    const mid = from.clone().add(to).multiplyScalar(.5);
    const len = from.distanceTo(to);
    const fx = this.shape('cylinder', mid, { color: o.color || '#8ad8ff', scale: o.width ?? .12, life: o.life ?? .22, grow: 0 });
    if (!fx) return;
    const slot = fx.slot, pool = fx.pool;
    const w = o.width ?? .12;
    _v2.copy(to).sub(from).normalize();
    _q.setFromUnitVectors(_up, _v2);
    _s3.set(w, len, w);
    _m.compose(mid, _q, _s3);
    pool.mesh.setMatrixAt(slot.i, _m);
    pool.mesh.instanceMatrix.needsUpdate = true;
  }

  // -------------------------------------------------------------- HOOKS (emit)
  /**
   * Punto único de entrada para los eventos de combate. Devuelve un objeto con
   * modificadores que el llamador aplica (daño, proyectiles, etc.).
   */
  emit(event, p = {}) {
    const m = this.mods;
    switch (event) {
      case 'shoot': {
        const r = {
          pellets: Math.floor(m.pellets || 0), pierce: Math.floor(m.pierce || 0),
          bounce: Math.floor(m.bounce || 0), projScale: 1 + (m.projScale || 0),
          damage: 1 + (m.damage || 0), spread: m.spread || 0,
          range: 1 + (m.range || 0), knockback: 1 + (m.knockback || 0),
          haste: 1 - Math.min(.75, m.haste || 0), homing: m.homing || 0,
          poison: this.hasFlag('poison'), explosive: this.hasFlag('explosiveShot')
        };
        if (this.hasFlag('elementalChaos')) r.elemental = true;
        if (this.hasFlag('tailwind')) { this._tailwind = 1.5; }
        if (this.hasFlag('whetstone')) { this._shotSeq = (this._shotSeq || 0) + 1; }
        if (this.hasFlag('bloodFrenzy')) {
          const bleeding = (this.host.getEnemies?.() || []).filter(e => !e.dead && e.bleed > 0).length;
          r.haste *= (1 - Math.min(.6, bleeding * (m.hastePerBleed || 0)));
        }
        if (this.hasFlag('berserkerFury')) {
          const s = this.host.getState?.();
          if (s && s.hp < s.maxHp * .5) r.haste *= (1 - (m.lowHpHaste || 0));
        }
        if (this.hasFlag('furyTotem') && this._idleTime > 1.5) {
          r.damage *= 1 + (m.idleBonus || 0); r.haste *= 1 - (m.idleBonus || 0);
        }
        if (this.hasFlag('blindBerserker') && (this.host.rand?.() ?? Math.random()) < .5) {
          // dispersión aleatoria del Caos/Berserker ciego
          r.spread += .04;
        }
        if (this.hasFlag('missiles')) {
          this._shotSeq = (this._shotSeq || 0) + 1;
          if (this._shotSeq % Math.max(3, 6 - Math.ceil(this.levelOf('bot_missile'))) === 0) {
            this._runPower('missiles', this.levelOf('bot_missile') || 1, p);
          }
        }
        if (this.hasFlag('explosiveShot') && (this.host.getState?.().shotCount || 0) % Math.max(2, 5 - (this.levelOf('arr_explosive') || 0)) === 0) {
          this._pendingExplosive = true;
        }
        this._idleTime = 0;
        return r;
      }
      case 'hit': {
        const e = p.enemy; if (!e) return {};
        const pos = e.group?.position || p.pos;
        let mult = 1;
        if (this.hasFlag('weaken')) { e.vulnerable = 4; mult *= 1 + (m.vulnerable || 0); }
        if (this.hasFlag('poison') && pos) {
          this.host.applyDot?.(e, 2 + (m.poisonDps || 0), 2 + (m.poisonTime || 0), 0x74d47a);
          this._burst('arrow', pos, { color: 0x74d47a, count: 4, sprite: 'magic_01' });
        }
        if (this.hasFlag('chain') && pos) this._chainLightning(e, pos);
        if (this.hasFlag('fireGround') && pos) this._groundFire(pos);
        if (this.hasFlag('lavaPillar') && p.crit) this._lava(pos);
        if (this.hasFlag('elementalChaos')) {
          const states = ['fire', 'poison', 'shock', 'bleed'];
          this.host.addStatus?.(e, states[Math.floor(Math.random() * 4)]);
        }
        if (this.hasFlag('bloodPact')) e.bleed = 3;
        if (m.burnDps) this.host.applyDot?.(e, m.burnDps, 2, 0xf08a42);
        if (this.hasFlag('battleThirst')) this._hasteStack = Math.min(.5, (this._hasteStack || 0) + (m.hasteOnHit || 0));
        if (this.hasFlag('stake') && (this.host.getState?.().shotCount || 0) % 4 === 0) this._runPower('stake', this.levelOf('vam_stake') || 1, p);
        if (this.hasFlag('flyingDaggers')) this._runPower('daggers', this.levelOf('vam_daggers') || 1, p);
        if (this.hasFlag('axeThrow')) this._runPower('axes', this.levelOf('bar_throw') || 1, p);
        if (this.hasFlag('whirlwind') || this.hasFlag('magmaCyclone')) {
          this._meleeSeq = (this._meleeSeq || 0) + 1;
          if (this._meleeSeq % (this.hasFlag('magmaCyclone') ? 1 : 3) === 0) this._runPower('whirl', this.levelOf('bar_whirl') || 1, p);
        }
        return { mult };
      }
      case 'kill': {
        const pos = p.enemy?.group?.position || p.pos;
        if (this.hasFlag('bloodPool') && pos) this.shape('ring', pos, { color: '#a52a3c', scale: 1.2, life: 2.4, grow: .35 });
        if (this.hasFlag('explosiveEcho') && Math.random() < (m.explode || 0) && pos)
          this.host.damageArea?.(pos, 4.5 + (m.area || 0), m.killExplodeDmg || 35, { stun: .4 });
        if (this.hasFlag('hematicBurst') && p.enemy?.bleed > 0 && pos)
          this._spikeBurst(pos, 8, m.burstDmg || 10);
        if (this.hasFlag('minorVamp') && Math.random() < (m.healOnKill || 0)) this.host.heal?.(2);
        if (this.hasFlag('coreOverload')) { this._killStreak++; if (this._killStreak >= 15) { this._killStreak = 0; this._overloadT = 3; } }
        if (this.hasFlag('glassCannon') === false && this.mod('noHeal') === 0) { /* sin efecto */ }
        if (this.hasFlag('nightLord') && pos) this.host.heal?.(1);
        return {};
      }
      case 'hurt': {
        let mult = 1 + (m.dmgTaken || 0);
        const pos = this.host.getPlayer?.()?.position;
        if (this.hasFlag('stoneSkin') && pos) this.host.damageArea?.(pos, 3, m.thornsFlat || 8, {});
        if (this.hasFlag('thornMail') && pos) this.host.damageArea?.(pos, 4, p.amount * (m.thorns || 1), {});
        if (this.hasFlag('brokenHourglass') && pos) this.host.slowEnemies?.(pos, 9, .5, m.slowOnHurt || 2.5);
        if (this.hasFlag('warCry') && pos) this._warCry(pos);
        if (this.hasFlag('energyShield') && this._shieldCharges > 0) {
          this._shieldCharges--;
          this.host.flash?.('#63c8ee', .2, 180);
          if (pos) this.host.damageArea?.(pos, 5, 24, { stun: .3 });
          return { mult: 0, absorbed: true };
        }
        if (this.hasFlag('darkPhoenix') && !this.reviveUsed && (this.host.getState?.().hp || 1) - p.amount <= 0) {
          this.reviveUsed = true;
          this.host.revive?.(.5, pos);
          return { mult: 0, revived: true };
        }
        return { mult };
      }
      case 'dash': {
        const from = p.from, to = p.to;
        if (this.hasFlag('caltrops') && to) this._caltrops(to);
        if (this.hasFlag('blinkNova')) { if (from) this._nova(from, m.blinkDmg || 10, 3.5); if (to) this._nova(to, m.blinkDmg || 10, 3.5); }
        if (this.hasFlag('mistForm')) this._mistDash(from, to);
        if (this.hasFlag('thrusterBoots') && from && to) this._fireTrail(from, to);
        return {};
      }
      case 'chest': {
        if (this.hasFlag('scrapMagnet') && p.pos) this._spikeBurst(p.pos, 6, 22);
        if (this.hasFlag('overloadCore') && p.pos) {
          this.host.damageArea?.(p.pos, 8, m.coreBurst || 45, { stun: 1 });
          this.shape('ring', p.pos, { color: '#7fd8ff', scale: 2, life: .6, grow: 6 });
        }
        return {};
      }
      case 'levelup': {
        if (this.hasFlag('overloadCore') && p.pos) this.host.damageArea?.(p.pos, 9, m.coreBurst || 45, { stun: .8 });
        return {};
      }
      default: return {};
    }
  }

  /** Modificador de daño global leído por damageEnemy(). */
  damageMult() {
    let d = 1 + (this.mods.damage || 0);
    const s = this.host.getState?.();
    if (this.hasFlag('bottomlessBag') && s) d += Math.min(.4, Math.floor((s.chips || 0) / 25) * (this.mods.goldDamage || 0));
    if (this.hasFlag('furyTotem') && this._idleTime > 1.5) d *= 1 + (this.mods.idleBonus || 0);
    return d;
  }

  critBonus() {
    let c = this.mods.crit || 0;
    if (this.hasFlag('sniper')) c += (this.mods.critRange || 0) * .5;
    if (this.hasFlag('whetstone') && this._shotSeq && this._shotSeq % 5 === 0) c += 10;
    return c;
  }

  magnetRadius() { return 6 * (1 + (this.mods.magnet || 0)); }
  fireRateMult() {
    let h = 1 - Math.min(.75, this.mods.haste || 0);
    if (this._overloadT > 0) h *= 1 - (this.mods.overloadHaste || 0) * 3;
    if (this._hasteStack) h *= 1 - this._hasteStack;
    const s = this.host.getState?.();
    if (this.hasFlag('berserkerFury') && s && s.hp < s.maxHp * .5) h *= 1 - (this.mods.lowHpHaste || 0);
    if (this.hasFlag('furyTotem') && this._idleTime > 1.5) h *= 1 - (this.mods.idleBonus || 0);
    return Math.max(.2, h);
  }
  moveSpeedMult() {
    let s = 1 + (this.mods.speed || 0);
    if (this._tailwind > 0) s *= 1 + (this.mods.speedOnShot || 0) * 3;
    return Math.max(.35, s);
  }
  cooldownMult() { return 1 - Math.min(.8, this.mods.cooldown || 0); }
  areaMult() { return 1 + (this.mods.area || 0); }
  dashCooldownMult() { return 1 - Math.min(.7, this.mods.dashCd || 0); }
  blocksShields() { return (this.mods.noShields || 0) > 0; }
  blocksHealing() { return (this.mods.noHeal || 0) > 0; }
  enemySpeedBonus() { return this.mods.enemySpeed || 0; }
  eliteHpBonus() { return this.mods.eliteHp || 0; }
  chestBonus() { return this.mods.chest || 0; }
  goldBonus() { return 1 + (this.mods.gold || 0); }

  // ------------------------------------------------------- poderes periódicos
  _spellCost() {
    const cost = this.mods.spellCost || 0;
    if (!cost) return true;
    const s = this.host.getState?.(); if (!s) return true;
    s.hp = Math.max(1, s.hp - cost);
    return s.hp > 1;
  }

  _runPower(kind, lv = 1, p = {}) {
    const s = this.host.getState?.(); if (!s || s.mode !== 'playing') return;
    const pos = this.host.getPlayer?.()?.position;
    if (!pos) return;
    const enemies = this.host.getEnemies?.() || [];
    const alive = enemies.filter(e => !e.dead);
    const dmg = (base, per) => (base + (per || 0) * lv);
    const theme = HERO_THEME[this.hero]?.theme || 'object';

    switch (kind) {
      case 'arrowRain': {
        const target = this._densest(alive) || pos;
        for (let i = 0; i < 2 + lv; i++) {
          const at = target.clone().add(new THREE.Vector3((Math.random() - .5) * 5, 6, (Math.random() - .5) * 5));
          this._burst('arrow', at, { color: 0x9ade86, sprite: 'spark_01', count: 6, gravity: -8 });
          this.shape('cone', at, { color: '#9ade86', scale: .5, life: .4, grow: 1.5 });
        }
        this.host.damageArea?.(target, 4 * this.areaMult(), dmg(18, 9), {});
        this.play('physical'); break;
      }
      case 'quake':
        this.shape('ring', pos, { color: '#f2964b', scale: 1, life: .7, grow: 14 });
        this.host.damageArea?.(pos, 8 * this.areaMult(), dmg(14, 10), { stun: 1 + lv * .3 });
        this.play('physical'); break;
      case 'singularity': {
        const at = this._densest(alive) || pos;
        this.shape('dark', at.clone().add(new THREE.Vector3(0, 1.4, 0)), { scale: 2.2, life: 3.2, grow: .6 });
        this.shape('ring', at, { color: '#bd93ef', scale: 3, life: 3.2, grow: -.4 });
        this.host.pullArea?.(at, 11 * this.areaMult(), 3.2);
        this.host.damageArea?.(at, 5 * this.areaMult(), dmg(20, 15), { dot: 3 });
        this.play('spell'); break;
      }
      case 'nova': this._nova(pos, 14 + (this.mods.novaDmg || 0) * lv, (3 + lv) * this.areaMult()); break;
      case 'familiar': {
        const e = this.host.nearestEnemy?.(pos, 30);
        if (e) {
          const from = pos.clone().add(new THREE.Vector3(1.2, 2.2, 0));
          this.beam(from, e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), { color: '#bd93ef', width: .07, life: .16 });
          this.host.damageEnemy?.(e, dmg(8, 5));
        } break;
      }
      case 'meteor': {
        for (let i = 0; i < Math.max(1, lv); i++) {
          const at = (alive[Math.floor(Math.random() * alive.length)]?.group.position || pos).clone();
          this.shape('cone', at.clone().add(new THREE.Vector3(0, 8, 0)), { color: '#c78cf0', scale: 1.2, life: .5, grow: 2 });
          this.host.damageArea?.(at, 4.5 * this.areaMult(), dmg(30, 18), { stun: .4 });
        }
        this.play('spell'); break;
      }
      case 'drone': {
        for (let i = 0; i < Math.max(1, lv); i++) {
          const e = this.host.nearestEnemy?.(pos, 34);
          if (!e) break;
          const from = pos.clone().add(new THREE.Vector3(1.5, 2.6, 0));
          this.beam(from, e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), { color: '#6ad2e8', width: .06, life: .14 });
          this.host.damageEnemy?.(e, dmg(9, 6));
        } break;
      }
      case 'emp':
        this.shape('ring', pos, { color: '#7fd8ff', scale: 1, life: .8, grow: 12 });
        this.host.damageArea?.(pos, (3 + lv) * this.areaMult(), dmg(10, 8), { stun: 1 + lv * .3 });
        this.play('energy'); break;
      case 'turret':
        this.shape('cylinder', pos.clone().add(new THREE.Vector3(0, .8, 0)), { color: '#6ad2e8', scale: .9, life: 8, grow: 0 });
        this.host.deployTurret?.(8 + (this.mods.turretDmg || 0) * lv, 8);
        this.play('energy'); break;
      case 'bats': {
        const count = 1 + lv;
        for (let i = 0; i < count; i++) {
          const e = alive[Math.floor(Math.random() * alive.length)];
          if (!e) break;
          this.beam(pos.clone().add(new THREE.Vector3(0, 1.6, 0)), e.group.position.clone().add(new THREE.Vector3(0, 1, 0)),
            { color: '#e06078', width: .09, life: .3 });
          this.host.damageEnemy?.(e, dmg(6, 5));
          this.host.heal?.(1, true);
        } break;
      }
      case 'staticAura':
        this.shape('ring', pos, { color: '#8fd8ff', scale: 2.5, life: .45, grow: 1.6 });
        this.host.damageArea?.(pos, 4.5 * this.areaMult(), dmg(12, 0), {});
        break;
      case 'missiles': {
        const e = this.host.nearestEnemy?.(pos, 40);
        if (e) { this.beam(pos.clone().add(new THREE.Vector3(0, 1.4, 0)), e.group.position, { color: '#ffb46a', width: .16, life: .3 }); this.host.damageArea?.(e.group.position, 3.4, dmg(20, 12), { stun: .2 }); }
        this.play('energy'); break;
      }
      case 'whirl': {
        const fire = this.hasFlag('magmaCyclone');
        this.shape('ring', pos, { color: fire ? '#f06a32' : '#f2964b', scale: 1, life: .5, grow: 9 });
        this.host.damageArea?.(pos, (3.5 + lv * .4) * this.areaMult(), dmg(20, 12), { knockback: 1 });
        if (fire) for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          this._burst('blade', pos.clone().add(new THREE.Vector3(Math.cos(a) * 2, 1, Math.sin(a) * 2)),
            { color: 0xf06a32, sprite: 'spark_03', count: 3 });
        }
        this.play('physical'); break;
      }
      case 'axes': case 'daggers': case 'stake': {
        const e = this.host.nearestEnemy?.(pos, 32);
        if (!e) break;
        const col = kind === 'stake' ? '#e06078' : kind === 'axes' ? '#f2964b' : '#d7586e';
        this.beam(pos.clone().add(new THREE.Vector3(0, 1.3, 0)), e.group.position.clone().add(new THREE.Vector3(0, 1, 0)),
          { color: col, width: kind === 'stake' ? .3 : .12, life: .2 });
        this.host.damageEnemy?.(e, dmg(kind === 'stake' ? 25 : 8, kind === 'stake' ? 18 : 6));
        this.play('physical'); break;
      }
      default: break;
    }
  }

  _densest(alive) {
    if (!alive.length) return null;
    let best = alive[0].group.position.clone(), bestN = -1;
    for (const e of alive.slice(0, 30)) {
      let n = 0;
      for (const f of alive) if (f.group.position.distanceToSquared(e.group.position) < 36) n++;
      if (n > bestN) { bestN = n; best = e.group.position.clone(); }
    }
    return best;
  }

  _chainLightning(from, pos) {
    const alive = (this.host.getEnemies?.() || []).filter(e => !e.dead && e !== from);
    const jumps = Math.min(alive.length, 1 + Math.floor(this.mods.chain || 0));
    let cur = pos.clone();
    for (let i = 0; i < jumps; i++) {
      const next = this.host.nearestEnemy?.(cur, 12, alive.slice(0, 0));
      const e = next || alive[i]; if (!e) break;
      this.beam(cur, e.group.position.clone().add(new THREE.Vector3(0, 1, 0)),
        { color: '#c9a4ff', width: .09, life: .24 });
      this.host.damageEnemy?.(e, (12 + (this.mods.chainDmg || 0)));
      cur = e.group.position.clone().add(new THREE.Vector3(0, 1, 0));
    }
    this.play('energy', { volume: .35 });
  }

  _nova(pos, dmg, radius) {
    this.shape('ring', pos, { color: '#bd93ef', scale: .8, life: .65, grow: radius * 3 });
    this.host.damageArea?.(pos, radius, dmg, { stun: .25 });
    this._burst('magic', pos, { color: 0xbd93ef, sprite: 'magic_01', count: 10 });
    this.play('spell');
  }

  _groundFire(pos) {
    this.shape('ring', pos, { color: '#f08a42', scale: .9, life: 2, grow: .5 });
    this.host.damageArea?.(pos, 2.4 * this.areaMult(), (6 + (this.mods.burnDps || 0)), { dot: 2 });
  }

  _lava(pos) {
    this.shape('cone', pos, { color: '#f06a32', scale: 1.2, life: .8, grow: 1.4 });
    this.host.damageArea?.(pos, 3 * this.areaMult(), (20 + (this.mods.lavaDmg || 0)), {});
  }

  _spikeBurst(pos, n, dmg) {
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n;
      const at = pos.clone().add(new THREE.Vector3(Math.cos(a) * 3, .6, Math.sin(a) * 3));
      this.beam(pos.clone().add(new THREE.Vector3(0, .6, 0)), at, { color: '#d33c55', width: .1, life: .3 });
    }
    this.host.damageArea?.(pos, 4.5 * this.areaMult(), dmg, {});
  }

  _caltrops(pos) {
    this.shape('ring', pos, { color: '#9ade86', scale: 1.4, life: 5, grow: .2 });
    this.host.addHazard?.(pos, 3, 5, (8 + (this.mods.trapDmg || 0)), .55);
  }

  _warCry(pos) {
    this.shape('ring', pos, { color: '#f2964b', scale: 1, life: .6, grow: 12 });
    this.host.damageArea?.(pos, 8, (10 + (this.mods.warCry || 0)), { knockback: 3 });
  }

  _mistDash(from, to) {
    if (!from || !to) return;
    this.beam(from.clone().add(new THREE.Vector3(0, 1, 0)), to.clone().add(new THREE.Vector3(0, 1, 0)),
      { color: '#a9324c', width: .7, life: .45 });
    this.host.damageArea?.(to, 3.5, (10 + (this.mods.mistDmg || 0)), {});
    this.host.heal?.(1 + this.levelOf('vam_mist'), true);
  }

  _fireTrail(from, to) {
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const at = from.clone().lerp(to, i / steps);
      this._burst('blade', at, { color: 0xf08a42, sprite: 'flame_01', count: 3, life: .8 });
    }
    this.host.addHazard?.(from, 3, 2.5, (this.mods.trailDps || 14), 0);
  }

  // -------------------------------------------------------------------- bucle
  /**
   * @param {number} dt  delta de simulación
   * @param {number} aliveCount  enemigos vivos: si es 0 los cooldowns NO avanzan
   */
  update(dt, aliveCount = 0) {
    const s = this.host.getState?.();
    const inCombat = aliveCount > 0 && s?.mode === 'playing';
    this._combatTime += inCombat ? dt : 0;
    this._tailwind = Math.max(0, (this._tailwind || 0) - dt);
    this._overloadT = Math.max(0, (this._overloadT || 0) - dt);
    this._hasteStack = Math.max(0, (this._hasteStack || 0) - dt * .18);
    if (inCombat) this._idleTime = Math.max(0, this._idleTime - dt * 2);
    else this._idleTime += dt;

    // Regeneración pasiva (Corazón de Titán) respetando Muerte Súbita.
    if (inCombat && this.mods.regen && !this.blocksHealing()) this.host.heal?.(this.mods.regen * dt, true);
    // Escudo de Energía: recarga una capa cada 13s de combate.
    if (inCombat && this.hasFlag('energyShield')) {
      this._shieldTimer = (this._shieldTimer || 0) + dt;
      const every = Math.max(5, 13 - this.levelOf('bot_shield'));
      if (this._shieldTimer >= every) {
        this._shieldTimer = 0;
        this._shieldCharges = Math.min(this.levelOf('bot_shield'), this._shieldCharges + 1);
        if (this._shieldCharges > 0) this.shape('sphere', this.host.getPlayer().position.clone().add(new THREE.Vector3(0, 1.2, 0)),
          { color: '#63c8ee', scale: 1.7, life: .7, grow: .2 });
      }
    }

    // Cooldowns: SOLO con enemigos vivos en combate.
    if (inCombat) {
      for (const [id, t] of this.timers) {
        const it = itemById(id);
        if (!it?.power || t <= 0) continue;
        const nt = t - dt;
        if (nt <= 0) {
          if (this._spellCost()) this._runPower(it.power.kind, this.levelOf(id) || 1);
          this.timers.set(id, this._interval(it, this.levelOf(id) || 1));
        } else this.timers.set(id, nt);
      }
      // Auras permanentes de sinergia.
      if (this.hasFlag('teslaStorm') || this.hasFlag('orbitalPrism') || this.hasFlag('nightLord')) {
        this._auraT = (this._auraT || 0) + dt;
        if (this._auraT > .55) {
          this._auraT = 0;
          const pos = this.host.getPlayer?.()?.position;
          if (pos) {
            this.shape('ring', pos, { color: this.hasFlag('nightLord') ? '#a9324c' : '#8fd8ff', scale: 2, life: .5, grow: 2 });
            this.host.damageArea?.(pos, 6 * this.areaMult(), (this.mods.teslaDps || 18) * .55, {});
          }
        }
      }
    }

    this._updateShapes(dt);
    this._updateOrbs(dt, s);
  }

  _updateShapes(dt) {
    if (!this.activeShapes) return;
    for (let i = this.activeShapes.length - 1; i >= 0; i--) {
      const fx = this.activeShapes[i];
      fx.life -= dt;
      if (fx.life <= 0) { fx.pool.hide(fx.slot); this.activeShapes.splice(i, 1); continue; }
      const k = 1 - fx.life / fx.max;
      const scale = Math.max(.01, fx.scale + fx.grow * k);
      fx.pool.write(fx.slot, fx.pos, scale, fx.rotY, fx.grow);
    }
  }

  _updateOrbs(dt, s) {
    if (!this.orbs || !s) return;
    const player = this.host.getPlayer?.(); if (!player) return;
    const magnet = this.magnetRadius();
    for (const o of this.orbs.orbs) {
      if (!o.active) continue;
      o.t += dt;
      const d = player.position.distanceTo(o.pos);
      if (d < magnet) {
        _v.copy(player.position).sub(o.pos).normalize().multiplyScalar(9 + (magnet - d) * 2.2);
        o.vel.lerp(_v, Math.min(1, dt * 7));
      } else {
        o.vel.y -= 11 * dt;
        // Atracción débil pasados 1.2 s: así el XP de bajas lejanas llega en
        // pocos segundos en lugar de esperar al rescate de 22 s.
        if (o.t > 1.2) {
          _v.copy(player.position).sub(o.pos).normalize().multiplyScalar(3.4);
          o.vel.lerp(_v, Math.min(1, dt * 1.15));
        }
      }
      o.pos.addScaledVector(o.vel, dt);
      if (o.pos.y < .55) { o.pos.y = .55; o.vel.y = Math.abs(o.vel.y) * .25; o.vel.x *= .8; o.vel.z *= .8; }
      if (d < 1.6) {
        this._creditXp(o.value);
        this.orbs.hide(o);
        this.play('relic', { volume: .18, throttle: .06 });
        continue;
      }
      if (o.t > 22) { this._creditXp(o.value); this.orbs.hide(o); continue; }
      this.orbs.write(o, 1 + Math.sin(o.t * 7) * .12);
    }
  }

  // --------------------------------------------------------------- fin de sala
  /** Limpia proyectiles, reinicia cooldowns y elimina escudos temporales. */
  onRoomClear() {
    this.orbs?.clear();
    this.clearShapes();
    this.host.clearProjectiles?.();
    for (const [id] of this.timers) {
      const it = itemById(id);
      if (it?.power) this.timers.set(id, this._interval(it, this.levelOf(id) || 1));
    }
    this._shieldCharges = 0;
    this._tailwind = 0; this._overloadT = 0; this._hasteStack = 0;
    this._killStreak = 0; this._auraT = 0; this._idleTime = 0;
    const s = this.host.getState?.();
    if (s && this.blocksShields()) s.shield = 0;
    this._lastRoomClear = this._combatTime;
    this.host.onRoomCleared?.();
    return { cleared: true, cooldowns: this.timers.size, projectiles: 0 };
  }

  // -------------------------------------------------------------- diagnóstico
  diagnostics() {
    return {
      catalog: catalogDiagnostics(),
      hero: this.hero, level: this.level, xp: Math.floor(this.xp), xpNext: this.xpNext,
      slots: this.slots.size, maxSlots: this.maxSlots,
      relics: this.relics.size, pacts: this.pacts.size, synergies: this.synergies.size,
      activeShapes: this.activeShapes?.length || 0,
      activeOrbs: this.orbs?.orbs.filter(o => o.active).length || 0,
      pools: this.shapes?.size || 0,
      combatTime: +this._combatTime.toFixed(1),
      timers: [...this.timers].map(([id, t]) => [id, +t.toFixed(2)]),
      snapshot: this.snapshot()
    };
  }

  dispose() {
    if (this.orbs && this.host.scene) this.orbs.dispose(this.host.scene);
    if (this.shapes && this.host.scene) for (const p of this.shapes.values()) p.dispose(this.host.scene);
    this.shapes?.clear(); this.activeShapes = [];
    this.orbs = null;
  }
}
