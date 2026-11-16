// NEON//REVENANT — FÁBRICA DE JEFES CON MODELOS REALES (Fase 3)
// ---------------------------------------------------------------------------
// Sustituye íntegramente los nueve jefes de primitivas por los 21 jefes de
// BossDatabase.js. Hay DOS formas de cuerpo, ambas con archivos reales:
//
//   · `spec`  -> modeloanimado de Quaternius/Kenney: CreatureVisual gestiona
//                AnimationMixer, roles idle/move/attack/hit/death, flash y sombra.
//   · `parts` -> kitbash de piezas GLB reales de los kits de los propios mundos
//                (carro, contenedores, cargo, plato parabólico, cohete...), con
//                altura y transform declarados y giro/flotación procedurales.
//
// CERO geometrías sintéticas: el contador de primitivas de bossDiagnostics()
// es 0 por construcción. Este archivo no crea ninguna geometría de Three.js,
// solo clona escenas glTF ya parseadas por la fábrica de criaturas.

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import {
  instantiateCreature, getCreatureTemplateSync, loadCreatureTemplate,
  creatureDiagnostics
} from './CreatureModels.js';
import {
  ALL_BOSSES, WORLD_BOSSES, BOSS_ABILITIES, WORLD_IDS,
  bossesForWorld, randomBossForWorld, allBossSpecs, bossDiagnostics
} from './BossDatabase.js';

// Compatibilidad: game.js/códigox siguen leyendo `BOSSES` y `bossFor`.
export {
  ALL_BOSSES as BOSSES, WORLD_BOSSES, BOSS_ABILITIES,
  bossesForWorld, randomBossForWorld, allBossSpecs, bossDiagnostics
};
export function bossFor(worldIdOrFaction, index = 0) {
  const list = bossesForWorld(worldIdOrFaction);
  if (list.length) return list[Math.max(0, Math.min(list.length - 1, index | 0))];
  return ALL_BOSSES[Math.max(0, Math.min(ALL_BOSSES.length - 1, index | 0))];
}

// Los eventos del modelo (impacto, ataque, humo, muerte) los traduce game.js
// a partículas reales y SFX con pitch variable.
let bossEventHandler = () => {};
export function setBossEventHandler(fn) {
  bossEventHandler = typeof fn === 'function' ? fn : () => {};
}
function bossOpts(kind) {
  return {
    targetHeight: kind.height,
    onEvent: (evt, pos) => {
      try { bossEventHandler(evt, pos, kind); } catch { /* un VFX nunca tumba al jefe */ }
    }
  };
}

/** Clona UNA pieza real del kit. El template ya fue precargado por el boot. */
function clonePart(part) {
  const tpl = getCreatureTemplateSync(part.spec);
  if (!tpl) return null;
  const node = cloneSkinned(tpl.scene);
  // La altura declarada es la altura FINAL en el mundo. El template puede venir
  // en cualquier unidad (Kenney usa metros, Quaternius su propia escala).
  const scale = Math.max(.01, (Number(part.size) || 1) / Math.max(.01, tpl.height));
  node.scale.setScalar(scale);
  const p = part.pos || [0, 0, 0];
  node.position.set(p[0] || 0, p[1] || 0, p[2] || 0);
  const r = part.rot || [0, 0, 0];
  node.rotation.set(r[0] || 0, r[1] || 0, r[2] || 0);
  node.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = false; o.receiveShadow = false;
    // Las geometrías/materiales son compartidos por TODAS las copias del kit:
    // CreatureModels ya los marcó, pero un GLB servido por otra ruta puede
    // venir sin marca. La liberación la hace disposeAllCreatureTemplates().
    if (o.geometry) { o.geometry.userData.nrCreature = true; o.geometry.userData.shared = true; }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m) m.userData.nrCreature = true;
  });
  return node;
}

/**
 * Construye el grupo del jefe. SINCRÓNICO: todas las plantillas se precargan
 * durante el boot junto con las de los enemigos, igual que en la Fase 2.
 */
export function buildBossMesh(kind) {
  const g = new THREE.Group();
  g.name = 'boss:' + kind.id;
  g.userData.bossKind = kind.id;
  g.userData.accent = kind.color;
  g.userData.floats = !!kind.flyer;
  g.userData.legs = [];
  g.userData.pulses = [];
  g.userData.kitParts = [];

  if (kind.spec) {
    const cv = instantiateCreature(kind.spec, bossOpts(kind));
    if (cv) {
      g.add(cv.root);
      g.userData.creature = cv;
      cv.visual.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      if (cv.shadowCaster) cv.shadowCaster.castShadow = true;
    }
  } else if (kind.parts && kind.parts.length) {
    let caster = null, bestR = -1;
    for (const part of kind.parts) {
      const node = clonePart(part);
      if (!node) continue;
      g.add(node);
      const entry = {
        node,
        base: node.position.clone(),
        rot: node.rotation.clone(),
        spin: Number(part.spin) || 0,
        bob: Number(part.bob) || 0,
        phase: Math.random() * Math.PI * 2
      };
      g.userData.kitParts.push(entry);
      node.traverse(o => {
        if (!o.isMesh || !o.geometry) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const r = (o.geometry.boundingSphere?.radius || 0) * (o.scale?.x || 1);
        if (r > bestR) { bestR = r; caster = o; }
      });
    }
    if (caster) caster.castShadow = true;
    g.userData.shadowCaster = caster;
  }
  return g;
}

/** Animación de las piezas de kitbash (la del modelo animado la hace su mixer). */
export function animateBossKitbash(g, time, dt, casting = false) {
  const parts = g?.userData?.kitParts;
  if (!parts || !parts.length) return 0;
  let n = 0;
  for (const p of parts) {
    if (!p.node) continue;
    if (p.spin) p.node.rotation.y = p.rot.y + time * p.spin * (casting ? 2.1 : 1);
    if (p.bob) p.node.position.y = p.base.y + Math.sin(time * 1.8 + p.phase) * p.bob * (casting ? 1.8 : 1);
    n++;
  }
  return n;
}

export function bossModelDiagnostics() {
  const lib = creatureDiagnostics();
  return {
    bosses: ALL_BOSSES.length, worlds: WORLD_IDS.length,
    animated: ALL_BOSSES.filter(b => !!b.spec).length,
    kitbash: ALL_BOSSES.filter(b => !!(b.parts && b.parts.length)).length,
    db: bossDiagnostics(), lib
  };
}
