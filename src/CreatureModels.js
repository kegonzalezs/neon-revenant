// NEON//REVENANT — FÁBRICA DE CRIATURAS GLB/GLTF (Fase 1)
// ---------------------------------------------------------------------------
// Sustituye el "efecto estatua": cada hostil carga un modelo REAL de
// assets/enemies o assets/bosses y, si trae clips, los reproduce con un
// AnimationMixer propio. Las piezas rígidas de Kenney reciben animación
// procedural (balanceo de extremidades, bobbing, carga, hit flash y muerte).
//
// Reglas de integración:
//   * El renderer de Electron está aislado (file:// sin fetch). Los bytes llegan
//     por el puente `nr:load-model-pack`, con validación de rutas en main.cjs.
//   * Una SOLA plantilla parseada por archivo, compartida por todas sus
//     instancias (SkeletonUtils.clone + mixer por instancia). Sin esto, 40
//     enemigos = 40 parses y 40 copias de atlas 1024² en GPU.
//   * Los .gltf de Quaternius traen buffer + textura embebidos en base64; los
//     de KayKit referencian .bin/.png hermanos. Un URLModifier del
//     LoadingManager resuelve esos hermanos como data: URL (no blob:, porque
//     las texturas cargan de forma asíncrona DESPUÉS de parseAsync).
//   * Cero primitivas: este módulo NUNCA crea geometría, solo clona escenas
//     glTF. El único material sintético es el flash blanco de 0.08 s, que es un
//     efecto, no un cuerpo.
//
// API:
//   loadCreatureTemplate({root,file,rig?}) -> Promise<template>
//   createCreature({root,file,rig?}, {targetHeight,onEvent}) -> Promise<CreatureVisual>
//   creatureDiagnostics() / disposeAllCreatureTemplates()

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const ROOT_DIR = { enemies: 'assets/enemies/', bosses: 'assets/bosses/', worlds: 'assets/worlds/' };
const templates = new Map();   // key -> Promise<tpl>
const resolved = new Map();    // key -> tpl (para instanciación SÍNCRONA)
const diag = { loads: 0, cacheHits: 0, instances: 0, fallbacks: 0, retargets: 0, errors: [], parsed: [] };

// Un único material compartido para el hit flash: cambiar el material de cada
// mesh durante 0.08 s es mucho más barato que clonar materiales por enemigo.
const FLASH_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff, toneMapped: false, side: THREE.DoubleSide, fog: false
});
FLASH_MAT.userData.shared = true;

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const isBin = (rel) => /\.(glb|gltf)$/i.test(rel);

function bytesToDataUrl(bytes, mime) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
  let raw = '';
  for (let i = 0; i < u8.length; i += 8192) raw += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  return 'data:' + mime + ';base64,' + btoa(raw);
}
function toArrayBuffer(v) {
  if (v instanceof ArrayBuffer) return v;
  const u8 = v instanceof Uint8Array ? v : new Uint8Array(v);
  return u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength
    ? u8.buffer
    : u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

async function readPack(root, names) {
  if (window.desktop?.loadModelPack) return await window.desktop.loadModelPack(root, names) || {};
  // Fallback HTTP para herramientas de captura que sirvan el proyecto por URL.
  const out = {};
  for (const n of names) {
    try {
      const res = await fetch(encodeURI(ROOT_DIR[root] + n));
      if (res.ok) out[n] = new Uint8Array(await res.arrayBuffer());
    } catch { /* sin servidor: el error se registra en el parseo */ }
  }
  return out;
}

// ------------------------------------------------------------- clips por rol
// Orden de prioridad: el primer patrón que casa gana. Así "Idle" no se confunde
// con "Flying_Idle" y "Walk" se prefiere a "Walking_B" cuando ambos existen.
const ROLE_PATTERNS = {
  idle: [/^idle$/, /^static$/, /^idle_[ab]$/, /^flying_idle$/],
  move: [/^walk$/, /^walking_[ab]$/, /^run$/, /^running_[ab]$/, /^sprint$/, /^walk/, /^run/],
  fly: [/^flying$/, /^fast_flying$/, /^flying_idle$/],
  attack: [/^bite_front$/, /^bite_inplace$/, /^punch$/, /^headbutt$/,
    /^attack_melee_right$/, /^attack_melee_left$/, /^attack_kick_right$/, /^attack/, /^interact/],
  hit: [/^hitrecieve$/, /^hitreact$/, /^hit_[ab]$/],
  death: [/^death$/, /^die$/, /^death_[ab]$/]
};

function pickRoles(clips) {
  const out = {};
  for (const [role, patterns] of Object.entries(ROLE_PATTERNS)) {
    for (const re of patterns) {
      const clip = clips.find(c => re.test(norm(c.name)));
      if (clip) { out[role] = clip; break; }
    }
  }
  // Un modelo que solo tiene "Flying" debe poder moverse con ese clip.
  if (!out.move && out.fly) out.move = out.fly;
  if (!out.idle && out.move) out.idle = out.move;
  return out;
}

/** Conserva solo los clips cuyas pistas apuntan a nodos que existen en el
 *  esqueleto destino. Es el retargeting de KayKit: los 23 huesos del rig y del
 *  Skeleton_Warrior comparten nombre, así que las pistas se aplican tal cual. */
function filterClipsFor(clips, root) {
  const names = new Set();
  root.traverse(o => { if (o.name) names.add(norm(o.name)); });
  return clips.filter(clip => {
    if (!clip.tracks.length) return false;
    let hits = 0;
    for (const t of clip.tracks) {
      const dot = t.name.lastIndexOf('.');
      if (dot < 0) continue;
      if (names.has(norm(t.name.slice(0, dot)))) hits++;
    }
    return hits / clip.tracks.length >= .8;
  });
}

function softenMaterials(scene) {
  scene.traverse(o => {
    if (!o.isMesh) return;
    // Fase 2 (60 FPS con hordas): UNA sola malla por criatura proyecta sombra
    // real (la de mayor radio, elegida en CreatureVisual). Las demás se
    // dibujan igual en el pase principal pero NO en el de sombras: con 30
    // hostiles evitamos ~90 draws extra por frame sin perder la sombra en el
    // suelo. Además las criaturas no NECESITAN recibir sombra (luz hemisférica
    // + direccional), lo que quita un fetch de shadow map por píxel.
    o.castShadow = false;
    o.receiveShadow = false;
    // Con skinning la caja de la malla es la del reposo: el frustum la
    // descartaría a media animación. Las piezas rígidas SÍ se pueden cullar.
    o.frustumCulled = !o.isSkinnedMesh;
    // Fase 2: SkeletonUtils.clone comparte geometría y materiales entre TODAS
    // las instancias. `disposeObject3D()` de game.js barre el grupo al morir un
    // hostil; sin esta marca liberaría los recursos de los otros 39. La
    // liberación real ocurre una sola vez en disposeAllCreatureTemplates().
    if (o.geometry) { o.geometry.userData.nrCreature = true; o.geometry.userData.shared = true; }
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) {
      if (!m) continue;
      m.userData.nrCreature = true;
      // Acabado mate coherente con los 7 mundos Kenney (anti fatiga visual).
      if ('envMapIntensity' in m) m.envMapIntensity = .45;
      if ('roughness' in m && typeof m.roughness === 'number') m.roughness = Math.max(m.roughness, .55);
      if ('specularIntensity' in m) m.specularIntensity = Math.min(m.specularIntensity ?? 1, .3);
      if (m.specularColor) {
        const s = m.specularColor;
        s.setRGB(Math.min(1, s.r), Math.min(1, s.g), Math.min(1, s.b));
      }
    }
  });
}

function makeTemplate(key, gltf, rigClips) {
  const scene = gltf.scene;
  softenMaterials(scene);
  let clips = Array.isArray(gltf.animations) ? gltf.animations.slice() : [];
  let retargeted = 0;
  if (!clips.length && rigClips && rigClips.length) {
    clips = filterClipsFor(rigClips, scene);
    retargeted = clips.length;
    diag.retargets += retargeted;
  }
  const roles = pickRoles(clips);
  const box = new THREE.Box3().setFromObject(scene, true);
  const height = Number.isFinite(box.max.y - box.min.y) ? Math.max(.01, box.max.y - box.min.y) : 1.8;
  const minY = Number.isFinite(box.min.y) ? box.min.y : 0;
  let meshes = 0;
  scene.traverse(o => { if (o.isMesh) meshes++; });
  const tpl = {
    key, scene, clips, roles, height, minY, meshes,
    animated: clips.length > 0, retargeted,
    sourceClips: clips.map(c => c.name)
  };
  diag.parsed.push({ key, clips: clips.length, roles: Object.keys(roles), meshes,
    height: +height.toFixed(2), retargeted });
  return tpl;
}

async function parseOne(root, file, payload, rigClips) {
  const bytes = payload[file];
  if (!bytes) throw new Error('modelo no servido por IPC: ' + file);
  const urls = new Map();
  for (const [rel, data] of Object.entries(payload)) {
    if (!isBin(rel)) {
      const mime = /\.jpe?g$/i.test(rel) ? 'image/jpeg' : 'image/png';
      const du = bytesToDataUrl(data, mime);
      urls.set(rel, du);
      urls.set(rel.split('/').pop(), du);
      urls.set(decodeURIComponent(rel), du);
    }
  }
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (urls.has(url)) return urls.get(url);
    let dec = url;
    try { dec = decodeURIComponent(url); } catch { /* url ya plana */ }
    if (urls.has(dec)) return urls.get(dec);
    const base = dec.split('/').pop();
    return urls.get(base) || url;
  });
  const loader = new GLTFLoader(manager);
  let data;
  if (/\.gltf$/i.test(file)) {
    data = new TextDecoder('utf-8').decode(toArrayBuffer(bytes));
  } else {
    data = toArrayBuffer(bytes);
  }
  const gltf = await loader.parseAsync(data, '');
  return makeTemplate(root + '/' + file, gltf, rigClips);
}

function templateKey(spec) {
  const root = MODEL_ROOTS_SET.has(spec.root) ? spec.root : 'enemies';
  const file = String(spec.file || '');
  const rig = Array.isArray(spec.rig) ? spec.rig.filter(Boolean) : [];
  return { root, file, rig, key: root + '/' + file + (rig.length ? '|rig:' + rig.join(',') : '') };
}
const MODEL_ROOTS_SET = new Set(['enemies', 'bosses', 'worlds']);

/** Carga (y cachea) una plantilla. `rig` es una lista opcional de archivos de
 *  animación cuyos clips se aplicarán a un modelo sin clips propios. */
export function loadCreatureTemplate(spec) {
  const { root, file, rig, key } = templateKey(spec);
  if (templates.has(key)) { diag.cacheHits++; return templates.get(key); }
  const job = (async () => {
    // Los rigs se parsean primero y se quedan solo con sus AnimationClip.
    let rigClips = [];
    if (rig.length) {
      const rigPayload = await readPack(root, rig);
      const collected = new Map();
      for (const rf of rig) {
        const rb = rigPayload[rf];
        if (!rb) continue;
        try {
          const g = await new GLTFLoader().parseAsync(toArrayBuffer(rb), '');
          for (const c of (g.animations || [])) if (!collected.has(c.name)) collected.set(c.name, c);
        } catch (e) { diag.errors.push('rig ' + rf + ': ' + (e?.message || e)); }
      }
      rigClips = [...collected.values()];
    }
    const payload = await readPack(root, [file]);
    const tpl = await parseOne(root, file, payload, rigClips);
    resolved.set(key, tpl);
    diag.loads++;
    return tpl;
  })().catch(e => {
    templates.delete(key);
    resolved.delete(key);
    diag.errors.push(key + ': ' + (e?.message || e));
    throw e;
  });
  templates.set(key, job);
  return job;
}

// ------------------------------------------------------------ extremidades
// Para modelos sin clips: se buscan nodos con nombre de brazo/pierna/aleta y
// se guarda su rotación de reposo. Si el GLB no tiene jerarquía articulada
// (ej. `cart.glb`), se balancea el grupo raíz completo.
function collectLimbs(visual) {
  const limbs = [];
  visual.traverse(o => {
    if (!o.name || o === visual) return;
    const n = norm(o.name);
    if (!/(arm|leg|foot|hand|wing|pierna|brazo)/.test(n)) return;
    const left = /(left|\.l|^l|izq)/.test(n);
    limbs.push({ node: o, rest: o.rotation.x, sign: left ? 1 : -1,
      amp: /(leg|foot|pierna)/.test(n) ? .42 : .30 });
  });
  return limbs;
}

// ------------------------------------------------------------- Visual vivo
export class CreatureVisual {
  constructor(tpl, opts = {}) {
    this.tpl = tpl;
    this.root = new THREE.Group();
    this.root.name = 'creature:' + tpl.key.split('/').pop().replace(/\.(glb|gltf)$/i, '');
    this.visual = cloneSkinned(tpl.scene);
    this.root.add(this.visual);

    // Escala por altura objetivo y apoyo exacto en y = 0 (groundAt del juego).
    const target = Number(opts.targetHeight) > 0 ? Number(opts.targetHeight) : 2.2;
    this.baseScale = target / tpl.height;
    this.root.scale.setScalar(this.baseScale);
    this.visual.position.y = -tpl.minY;
    this.baseY = 0;

    this.onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
    this.time = 0;
    this.dead = false;
    this.hidden = false;
    this.flashT = 0;
    this.chargeT = 0;
    this.chargeDur = .25;
    this.onStrike = null;
    this.deathT = 0;
    this.deathDur = .7;
    this.smokeDone = false;
    this.lungeT = 0;
    this.baseKey = 'idle';
    this._role = null;      // rol lógico pedido: idle | move | fly
    this._desired = null;
    this._hold = 0;
    this.baseAction = null;
    this.oneShotAction = null;
    this.oneShotT = 0;
    this.procedural = !tpl.animated;
    this.limbs = this.procedural ? collectLimbs(this.visual) : [];

    // Pares (mesh, material original) para el flash blanco sin clonar nada.
    this.meshes = [];
    this.visual.traverse(o => {
      if (o.isMesh) this.meshes.push({ mesh: o, material: o.material });
    });
    // Selecciona la malla más grande como ÚNICA emisora de sombra real.
    let caster = null, bestR = -1;
    for (const { mesh } of this.meshes) {
      const g = mesh.geometry;
      if (!g) continue;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const r = (g.boundingSphere?.radius || 0) * (mesh.scale?.x || 1);
      if (r > bestR) { bestR = r; caster = mesh; }
    }
    if (caster) caster.castShadow = true;
    this.shadowCaster = caster;

    this.mixer = null;
    this.actions = {};
    if (tpl.animated) {
      this.mixer = new THREE.AnimationMixer(this.visual);
      for (const [role, clip] of Object.entries(tpl.roles)) {
        const a = this.mixer.clipAction(clip);
        a.setLoop(THREE.LoopRepeat, Infinity);
        this.actions[role] = a;
      }
      this._playBase('idle', 0);
    } else {
      diag.fallbacks++;
    }
    diag.instances++;
  }

  _playBase(key, fade = .18) {
    if (!this.mixer) return;
    // `actual` es el rol REAL disponible en este modelo. Guardarlo evita el
    // bug de Fase 1: si el GLB no trae clip 'idle', key='idle' resolvía al
    // clip 'move' pero baseKey quedaba 'idle', así que el frame siguiente
    // volvía a resetear la acción... y así 60 veces por segundo y por hostil.
    let actual = key;
    if (!this.actions[actual]) {
      actual = this.actions.idle ? 'idle' : Object.keys(this.actions)[0];
    }
    const next = this.actions[actual];
    if (!next) return;
    this._role = key;
    this.baseKey = actual;
    if (this.baseAction === next) { if (!next.isRunning()) next.play(); return; }
    const prev = this.baseAction || this.oneShotAction;
    if (prev) prev.fadeOut(fade);
    next.reset().setLoop(THREE.LoopRepeat, Infinity)
      .setEffectiveTimeScale(1).setEffectiveWeight(fade ? 0 : 1).play();
    if (fade) next.fadeIn(fade);
    this.baseAction = next;
  }

  _playOneShot(role) {
    const a = this.actions[role];
    if (!a || !this.mixer) return false;
    if (this.oneShotAction) this.oneShotAction.stop();
    if (this.baseAction) this.baseAction.fadeOut(.06);
    a.reset().setLoop(THREE.LoopOnce, 1).clampWhenFinished = true;
    a.setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(.06).play();
    this.oneShotAction = a;
    this.oneShotT = Math.min(2.5, Math.max(.12, a.getClip().duration));
    return true;
  }

  /** Bucle de movimiento/carrera/vuelo. Llamar una vez por frame. */
  update(dt, motion = {}) {
    if (this.hidden) return;
    dt = Math.min(.05, Math.max(0, dt));
    this.time += dt;

    // --- hit flash blanco 0.08 s -----------------------------------------
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) {
        for (const { mesh, material } of this.meshes) mesh.material = material;
      }
    }
    // --- gesto de carga 0.25 s antes del golpe ----------------------------
    if (this.chargeT > 0) {
      this.chargeT -= dt;
      const p = 1 - Math.max(0, this.chargeT) / this.chargeDur;
      this.visual.rotation.x = -.20 * Math.sin(p * Math.PI);
      this.root.scale.setScalar(this.baseScale * (1 + .045 * Math.sin(p * Math.PI)));
      if (this.chargeT <= 0) {
        this.visual.rotation.x = 0;
        this.root.scale.setScalar(this.baseScale);
        const cb = this.onStrike; this.onStrike = null;
        if (cb) cb();
      }
    }
    // --- estocada de ataque procedural ------------------------------------
    if (this.lungeT > 0) {
      this.lungeT -= dt;
      const p = Math.max(0, this.lungeT) / .22;
      this.visual.rotation.x = .34 * Math.sin(p * Math.PI);
    } else if (!this.dead) {
      this.visual.rotation.x = 0;
    }
    // --- muerte ------------------------------------------------------------
    if (this.dead && this.deathT > 0) {
      this.deathT -= dt;
      if (this.tpl.roles.death) {
        // El clip real manda; solo se encoge en el último tramo.
        if (this.deathT < .22) this.root.scale.setScalar(this.baseScale * Math.max(0, this.deathT / .22));
      } else {
        const p = 1 - Math.max(0, this.deathT) / this.deathDur;
        this.root.scale.setScalar(this.baseScale * Math.max(0, 1 - p));
        this.root.rotation.y += dt * 9;
        this.root.position.y = this.baseY + p * .45;
      }
      if (this.deathT <= 0) { this.hidden = true; this.root.visible = false; }
    }

    // --- animación REAL (AnimationMixer) ----------------------------------
    if (this.mixer) {
      if (this.dead) {
        // Fase 2: el clip de muerte debe AVANZAR mientras el cadáver se
        // encoge. Antes el mixer se congelaba al marcar `dead` y el modelo se
        // quedaba en el primer fotograma de la animación.
        this.mixer.update(dt);
      } else {
        if (this.oneShotT > 0) {
          this.oneShotT -= dt;
          if (this.oneShotT <= 0) {
            if (this.oneShotAction) this.oneShotAction.fadeOut(.16);
            this.oneShotAction = null;
            this._playBase('idle', .16);
          }
        } else {
          let key = 'idle';
          if (motion.flying && this.actions.fly) key = 'fly';
          else if (motion.moving && this.actions.move) key = 'move';
          // Histéresis de 0.12 s: `moved` parpadea en el límite de velocidad
          // y antes provocaba reset()+fadeIn() en CADA frame de cada mixer.
          if (key !== this._desired) { this._desired = key; this._hold = .12; }
          else this._hold = Math.max(0, (this._hold || 0) - dt);
          if (this._hold <= 0 && key !== this._role) this._playBase(key);
        }
        const speed = Math.max(.4, Math.min(2.2, Number(motion.speedScale) || 1));
        this.mixer.update(dt * speed);
      }
    }

    // --- animación PROCEDURAL de respaldo ---------------------------------
    if (this.procedural && !this.dead) {
      const moving = !!motion.moving;
      const rate = (Number(motion.speed) || 5) * 1.15;
      const s = Math.sin(this.time * rate);
      for (const l of this.limbs) l.node.rotation.x = l.rest + s * l.sign * l.amp * (moving ? 1 : .18);
      if (!this.limbs.length) this.visual.rotation.z = s * (moving ? .055 : .012);
      this.visual.position.y = -this.tpl.minY +
        (moving ? Math.abs(Math.sin(this.time * rate)) * .055 : Math.sin(this.time * 2) * .012);
      this.root.rotation.z = moving ? s * .018 : 0;
    }
  }

  /** Anticipación visible antes de un golpe; `cb` se dispara al terminar. */
  charge(cb) { this.chargeT = this.chargeDur; this.onStrike = cb || null; }

  /** Dispara el clip de ataque (o estocada procedural) y avisa al host. */
  attack() {
    if (this.dead) return false;
    const played = this._playOneShot('attack');
    if (!played) this.lungeT = .22;
    this.onEvent('attack', this.worldPosition());
    return played;
  }

  /** Recibe daño: clip de reacción (si existe), flash blanco y sonido. */
  hit() {
    if (this.dead) return;
    if (!this._playOneShot('hit')) this.lungeT = .16;
    this.flashT = .08;
    for (const { mesh } of this.meshes) mesh.material = FLASH_MAT;
    this.onEvent('hit', this.worldPosition());
  }

  /** Muerte: clip real o encogimiento giratorio; emite humo smoke_07.png. */
  die() {
    if (this.dead) return;
    this.dead = true;
    this.chargeT = 0;
    const pos = this.worldPosition();
    if (!this.smokeDone) { this.smokeDone = true; this.onEvent('smoke', pos); }
    this.onEvent('death', pos);
    if (this.tpl.roles.death) {
      this._playOneShot('death');
      this.oneShotT = 999; // el clip manda hasta que expire deathT
      this.deathT = .9;
      this.deathDur = .9;
    } else {
      this.deathT = this.deathDur = .7;
    }
  }

  worldPosition() {
    return this.root.getWorldPosition(new THREE.Vector3());
  }

  get clipRoles() { return Object.keys(this.tpl.roles); }
  get usesMixer() { return !!this.mixer && this.tpl.animated; }

  dispose() {
    if (this.mixer) {
      this.mixer.stopAllAction();
      for (const a of Object.values(this.actions)) this.mixer.uncacheAction(a.getClip(), this.visual);
      this.mixer.uncacheRoot(this.visual);
    }
    this.visual.traverse(o => { if (o.skeleton) o.skeleton.dispose(); });
    if (this.root.parent) this.root.parent.remove(this.root);
    this.root.clear();
    diag.instances = Math.max(0, diag.instances - 1);
  }
}

export async function createCreature(spec, opts = {}) {
  const tpl = await loadCreatureTemplate(spec);
  return new CreatureVisual(tpl, opts);
}

// --- API SÍNCRONA para el juego --------------------------------------------
// game.js crea los hostiles dentro de spawnWave(), que es síncrono y se llama
// decenas de veces por oleada. No se puede esperar un await ahí sin reescribir
// toda la IA. Solución: precargar las plantillas al arrancar y clonarlas aquí
// de forma síncrona; si aún no está lista, devolvemos null y el llamador usa
// un grupo vacío que se rellena en cuanto llega la plantilla.
export function getCreatureTemplateSync(spec) {
  return resolved.get(templateKey(spec).key) || null;
}

export function instantiateCreature(spec, opts = {}) {
  const tpl = getCreatureTemplateSync(spec);
  return tpl ? new CreatureVisual(tpl, opts) : null;
}

/** Precarga en paralelo todos los modelos del roster. Se llama una sola vez
 *  al arrancar la partida; devuelve el diagnóstico para el QC. */
export async function preloadCreatureRoster(specs) {
  const list = Array.isArray(specs) ? specs : [];
  const results = await Promise.allSettled(list.map(s => loadCreatureTemplate(s)));
  const failed = results.filter(r => r.status === 'rejected').length;
  return { requested: list.length, loaded: resolved.size, failed, errors: diag.errors.slice() };
}

export function creatureDiagnostics() {
  return {
    templates: diag.parsed.length,
    parsed: diag.parsed,
    instances: diag.instances,
    cacheHits: diag.cacheHits,
    fallbacks: diag.fallbacks,
    retargetedClips: diag.retargets,
    errors: diag.errors.slice()
  };
}

export function creatureTemplateCount() { return templates.size; }

/** Libera las plantillas al cambiar de mundo / cerrar el juego. Las instancias
 *  vivas deben haberse liberado antes con su dispose(). */
export function disposeAllCreatureTemplates() {
  const names = new Set();
  for (const job of templates.values()) {
    Promise.resolve(job).then(tpl => {
      if (!tpl) return;
      tpl.scene.traverse(o => {
        // Las geometrías están marcadas `shared` para que disposeObject3D() no
        // las libere al morir UN hostil; aquí sí se liberan (una sola vez).
        if (o.geometry) { o.geometry.dispose(); names.add(o.geometry.uuid); }
        if (o.skeleton) o.skeleton.dispose();
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of list) {
          if (!m || m.userData?.shared) continue;
          for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
          m.dispose();
        }
      });
      tpl.scene.clear();
    }).catch(() => {});
  }
  templates.clear();
  resolved.clear();
  diag.parsed.length = 0;
  diag.loads = 0; diag.retargets = 0; diag.fallbacks = 0;
  THREE.Cache.clear();
}
