// NEON//REVENANT — HOSTILES (Fase 2)
// ---------------------------------------------------------------------------
// ANTES: este archivo horneaba docenas de BoxGeometry/SphereGeometry/
// CylinderGeometry por hostil, con mergeGeometries y materiales por facción.
// AHORA: cada hostil es un .glb/.gltf REAL de los packs de Quaternius, Kenney
// o KayKit, clonado desde una plantilla cacheada y animado con AnimationMixer.
// CERO primitivas de Three.js generan cuerpo de enemigo.
//
// La IA, las colisiones, el daño y los afijos siguen viviendo en game.js: este
// módulo solo cambia la CAPA VISUAL. `buildEnemyModel()` mantiene la misma
// firma ampliada (worldId, variant) y devuelve un THREE.Group con el mismo
// `userData` de siempre (legs/arms/plates...), para no tocar la lógica.
//
// Nota de integración: la fábrica de plantillas es asíncrona (IPC + parseo
// glTF) pero spawnWave() es síncrono. Por eso `instantiateCreature()` clona en
// caliente desde `resolved` (plantillas precargadas al arrancar). Si una llega
// tarde, `attachCreatureWhenReady()` rellena el grupo sin bloquear el juego.

import * as THREE from 'three';
import {
  instantiateCreature, getCreatureTemplateSync, loadCreatureTemplate,
  creatureDiagnostics, disposeAllCreatureTemplates
} from './CreatureModels.js';
import { specForEnemy, archetypeForType, allRosterSpecs } from './EnemyRoster.js';

// Accesorio REAL para la corona de élite (antes un TorusGeometry).
const CROWN_SPEC = {
  root: 'bosses',
  file: 'kenney-fantasy-town/Models/GLB format/banner-red.glb',
  height: .55
};

// SOMBRA PROYECTADA = sombreado real del DirectionalLight. `softenMaterials()`
// ya marca castShadow=true en cada malla GLB y todos los suelos de los 7 mundos
// tienen receiveShadow=true. Al volar a Y=1.8 la sombra cae sola sobre el piso:
// CERO decales falsos, CERO PlaneGeometry, CERO primitivas inventadas.
export function initEnemyShadows() {
  return Promise.resolve(true);
}
export function makeGroundShadow() { return null; }

// Un único manejador de eventos para TODAS las criaturas: game.js lo instala
// al arrancar y así cada flash/ataque/muerte dispara los SFX y partículas
// reales sin plomería por instancia.
let creatureEventHandler = () => {};
export function setCreatureEventHandler(fn) {
  creatureEventHandler = typeof fn === 'function' ? fn : () => {};
}
function creatureOpts(extra = {}) {
  return {
    ...extra,
    onEvent: (kind, pos) => { try { creatureEventHandler(kind, pos, extra); } catch { /* un VFX nunca tumba la IA */ } }
  };
}

/** Modelos extra que deben precargarse además del roster (corona de élite). */
export function extraEnemySpecs() { return [CROWN_SPEC]; }
export function allEnemySpecs() { return [...allRosterSpecs(), CROWN_SPEC]; }

function emptyUserData() {
  return {
    legs: [], arms: [], plates: [], orb: null, ring: null, rotor: null,
    core: null, wingL: null, wingR: null, creature: null, shadowDecal: null
  };
}

/** Monta una criatura real dentro del grupo lógico del hostil. */
function mount(g, cv) {
  if (!cv) return;
  g.add(cv.root);
  g.userData.creature = cv;
  // No tocamos g.scale: lo gobierna el spawn/hitAnim de updateEnemies().
}

/**
 * @param {string} type    tipo lógico heredado (chaser/ranged/tank/flyer/...)
 * @param {string} faction SYNTEK | HIVE | UMBRA (ya no tiñe: el color lo da el kit)
 * @param {number} tier    tramo de ronda (se usa como variante de modelo)
 * @param {string} worldId world1_nature .. world7_hexagon
 * @param {number} variant desempate para no clonar 30 veces el mismo modelo
 */
export function buildEnemyModel(type, faction, tier = 0, worldId = 'world1_nature', variant = 0, opts = {}) {
  const g = new THREE.Group();
  g.userData = emptyUserData();
  const archetype = archetypeForType(type);
  const spec = opts.spec || specForEnemy(worldId, archetype, (tier + variant) | 0, type);
  // game.js escala el GRUPO (tanque 1.8x) para radio, knockback y presencia.
  // Compensamos aquí la altura objetivo para no duplicar esa escala sobre el
  // modelo GLB: el resultado final en pantalla sigue siendo `spec.height`.
  const groupScale = Math.max(.4, Number(opts.groupScale) || 1);
  const cv = instantiateCreature(spec, creatureOpts({
    targetHeight: (spec.height || 2.0) / groupScale,
    worldId, archetype
  }));
  if (cv) mount(g, cv);
  else attachCreatureWhenReady(g, spec, opts); // llega tarde: se rellena al vuelo
  g.userData.archetype = archetype;
  g.userData.spec = spec;
  g.userData.worldId = worldId;
  return g;
}

/** Fallback de carga fría: nunca deja un hostil invisible ni bloquea el spawn. */
export function attachCreatureWhenReady(g, spec, opts = {}) {
  if (!g || !spec) return;
  loadCreatureTemplate(spec).then(() => {
    if (g.userData.creature || g.userData.detached) return;
    const gs = Math.max(.4, Number(opts.groupScale) || 1);
    const cv = instantiateCreature(spec, creatureOpts({ targetHeight: (spec.height || 2.0) / gs }));
    if (cv) mount(g, cv);
  }).catch(() => { /* el diagnóstico ya registró el error */ });
}

/** Corona de élite construida con una pieza GLB real (antes TorusGeometry). */
export function buildEliteCrown(colors) {
  const g = new THREE.Group();
  const cv = instantiateCreature(CROWN_SPEC, creatureOpts({ targetHeight: .55, crown: true }));
  if (cv) {
    cv.root.position.y = 2.45;
    cv.root.rotation.y = Math.PI;
    g.add(cv.root);
    g.userData.creature = cv;
  }
  // El color del afijo se conserva como dato: lo consume el HUD/anuncio.
  g.userData.colors = (colors || []).slice();
  return g;
}

/** Diagnóstico para el QC de la Fase 2. */
export function enemyModelDiagnostics() {
  return {
    crownReady: !!getCreatureTemplateSync(CROWN_SPEC),
    groundShadow: 'realtime (DirectionalLight, sin primitivas)',
    lib: creatureDiagnostics()
  };
}

/** Liberación completa al cerrar o cambiar de mundo. */
export function disposeEnemyCache() {
  disposeAllCreatureTemplates();
}
