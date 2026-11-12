// NEON//REVENANT — CARGADOR DE PERSONAJE GLB (visual style v3)
// ---------------------------------------------------------------------------
// Sustituye al generador procedural de cuerpos voxel. Cada héroe del roster
// tiene su propio .glb: malla, texturas embebidas, esqueleto Mixamo (32 joints)
// y clips Running / Walking / Boxing_Practice / Triple_Combo_Attack.
// Solo hay UNA plantilla + UNA instancia viva. Cambiar de personaje libera
// mixer, geometrías y texturas GPU antes de parsear el binario siguiente: con
// cinco GLB de 8-35 MB no se puede mantener todo residente en Electron.
//
// Decisiones de integración:
//  * El renderer de Electron está aislado y sirve desde file://, así que el
//    binario se lee en el proceso principal vía IPC (lista blanca de nombres)
//    y se parsea con GLTFLoader.parseAsync(). Cero fetch/XHR, cero CORS.
//  * loadTemplate() cachea el binario activo: volver a seleccionar el mismo
//    héroe solo reparenta el visual. Un héroe distinto dispara teardown+parse.
//  * Los clips traen root motion en mixamorig:Hips (hasta 1.1 u. en los
//    ataques). Se neutraliza X/Z y se limita el bob en Y para que el modelo no
//    se desplace respecto a las colisiones y físicas de suelo existentes.
//  * No hay clip idle ni de salto embebidos: se sintetizan a partir de la pose
//    de reposo del esqueleto. Los clips constantes NO reescriben los huesos
//    (PropertyMixer.apply() solo escribe cuando el valor cambia), por eso la
//    capa procedural de apuntado es ABSOLUTA: restaura la pose limpia del
//    mixer antes de cada update y aplica el delta partiendo siempre de ella.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// Un GLB por héroe. Los ids coinciden con CHARACTERS / ROSTER_ART del juego.
const CHARACTER_ASSETS = {
  seraph: 'assets/characters/arquero.glb',
  ronin:  'assets/characters/barbaro.glb',
  glitch: 'assets/characters/bruja.glb',
  vanta:  'assets/characters/robot_voxel_mixamo.glb',
  kira:   'assets/characters/vampiro.glb'
};
const DEFAULT_ASSET = CHARACTER_ASSETS.vanta;
const assetFor = id => CHARACTER_ASSETS[id] || DEFAULT_ASSET;
let GLB_ASSET = DEFAULT_ASSET;      // activo: diagnóstico + fallback HTTP

// Altura nativa del GLB (accessor POSITION min/max: 0 .. 1.70) y altura del
// maniquí anterior (cabeza ~2.3 u.). El fit mantiene la silueta, el ancla de
// cámara (1.45) y la boca de fuego (y=1.5) en las mismas coordenadas lógicas.
const NATIVE_HEIGHT = 1.70;
const TARGET_HEIGHT = 2.30;
const FIT_SCALE = TARGET_HEIGHT / NATIVE_HEIGHT; // 1.3529
// Mixamo exporta mirando +Z; el juego dispara/avanza hacia -Z.
const FACING_YAW = Math.PI;

const loader = new GLTFLoader();
let templatePromise = null;
let template = null;
let instance = null;
let activeAsset = DEFAULT_ASSET;
let loadEpoch = 0;
let attachTicket = 0;

// El estado del mixer NO vive en userData: Object3D.clone() hace
// JSON.stringify(userData) y un AnimationMixer es circular (habilidad
// "señuelo espectral"). Un WeakMap evita el ciclo y se libera solo con el rig.
const RIG_STATE = new WeakMap();
function stateOf(root) {
  let s = RIG_STATE.get(root);
  if (!s) { s = { instance: null, alive: true, ready: false, tint: undefined }; RIG_STATE.set(root, s); }
  return s;
}

const IDLE_MOTION = {
  moving: false, grounded: true, dashing: 0, slide: 0, meleeSwing: 0,
  meleeSeq: 0, meleeStyle: null,
  reloading: 0, ads: false, speed: 8, overdrive: 0, frenzy: 0, vy: 0, landT: 0
};

// GLTFLoader sanea los nombres de nodo ("mixamorig:Hips" -> "mixamorigHips")
// y las pistas usan ese mismo nombre saneado. Normalizando ambos lados podemos
// localizar huesos sin depender de cómo se exportó el .glb.
const normName = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
function nodeIndex(root) {
  const map = new Map();
  root.traverse(o => { if (o.name && !map.has(normName(o.name))) map.set(normName(o.name), o); });
  return map;
}
function findBone(root, ...names) {
  const wanted = names.map(normName);
  let found = null;
  root.traverse(o => {
    if (found || !o.name) return;
    if (wanted.includes(normName(o.name))) found = o;
  });
  return found;
}
const GUN_BASE = new THREE.Vector3(.34, 1.5, -.48); // posición original del arma en operators.js
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
// La pose de reposo del esqueleto trae la cabeza inclinada ~13.5° hacia abajo
// (Hips -8.9°, Spine +28.3°, Spine1 -29.9°, Spine2 +9°, Head -13.5°). Se
// compensa en la capa de apuntado para que el idle mire al frente.
const HEAD_REST_CORRECTION = .235;
// Huesos que la capa procedural gobierna DESPUÉS del mixer.
const POSE_KEYS = ['rightArm', 'leftArm', 'head'];
// Huesos Mixamo sobre los que se construyen las poses sintéticas de salto.
const POSE_BONES = {
  hip: 'mixamorighips',
  spine: 'mixamorigspine', spine1: 'mixamorigspine1', spine2: 'mixamorigspine2',
  neck: 'mixamorigneck', head: 'mixamorighead',
  armL: 'mixamorigleftarm', armR: 'mixamorigrightarm',
  foreL: 'mixamorigleftforearm', foreR: 'mixamorigrightforearm',
  upLegL: 'mixamorigleftupleg', upLegR: 'mixamorigrightupleg',
  legL: 'mixamorigleftleg', legR: 'mixamorigrightleg',
  footL: 'mixamorigleftfoot', footR: 'mixamorigrightfoot'
};
const ONE_SHOT = new Set(['attack', 'takeoff', 'fall', 'land']);
const AIR_KEYS = new Set(['takeoff', 'fall']);

// ------------------------------------------------------------------ lectura
async function readGLBBytes(asset) {
  if (window.desktop?.loadCharacterGLB) {
    const data = await window.desktop.loadCharacterGLB(asset);
    const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    return u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength
      ? u8.buffer
      : u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  }
  // Fallback para servir el juego por HTTP (herramientas de captura / preview).
  const res = await fetch(asset);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' al leer ' + asset);
  return await res.arrayBuffer();
}

// ------------------------------------------------------------ clips / Mixamo
// Los nombres de pista vienen saneados por GLTFLoader (p. ej.
// "mixamorigHips.position"), por eso se buscan por coincidencia parcial.
function neutralizeRootMotion(clip, hipsRest) {
  for (const track of clip.tracks) {
    if (!/hips/i.test(track.name) || !/\.(position|translation)$/i.test(track.name)) continue;
    const v = track.values;
    for (let i = 0; i < v.length; i += 3) {
      v[i] = hipsRest.x;
      v[i + 1] = hipsRest.y + THREE.MathUtils.clamp(v[i + 1] - hipsRest.y, -0.035, 0.035);
      v[i + 2] = hipsRest.z;
    }
  }
  return clip;
}

// Pose estática + respiración: el GLB no trae idle. Se construye a partir de la
// POSE DE REPOSO del esqueleto (transformaciones de los nodos al cargar), no del
// primer fotograma de Walking: usar ese frame dejaba al robot congelado a media
// zancada. El resultado es la postura neutral del arte conceptual, brazos caídos.
function makeIdleClip(source, hipsRest, scene) {
  const D = 3.2;
  const nodes = nodeIndex(scene);
  const tracks = [];
  for (const track of source.tracks) {
    const dot = track.name.lastIndexOf('.');
    if (dot < 0) continue;
    const key = track.name.slice(0, dot);
    const prop = track.name.slice(dot + 1);
    const node = nodes.get(normName(key));
    const n = track.getValueSize();
    let pose = Array.from(track.values.slice(0, n)); // fallback si no hay nodo
    if (node) {
      if (prop === 'quaternion') pose = node.quaternion.toArray();
      else if (prop === 'position') pose = node.position.toArray();
      else if (prop === 'scale') pose = node.scale.toArray();
    }
    const t = track.clone();
    t.times = new Float32Array([0, D]);
    t.values = new Float32Array([...pose, ...pose]);
    tracks.push(t);
  }
  // Respiración procedural en la columna, partiendo del cuaternión de reposo.
  const spine = source.tracks.find(t => /spine[12]/i.test(normName(t.name)) && /quaternion/i.test(t.name));
  if (spine) {
    const key = spine.name.slice(0, spine.name.lastIndexOf('.'));
    const node = nodes.get(normName(key));
    const rest = node ? node.quaternion.clone() : new THREE.Quaternion().fromArray(spine.values.slice(0, 4));
    const times = [0, D * .25, D * .5, D * .75, D];
    const values = [];
    const delta = new THREE.Quaternion();
    for (let i = 0; i < times.length; i++) {
      const s = Math.sin(i / (times.length - 1) * Math.PI * 2);
      delta.setFromEuler(new THREE.Euler(.008 * s, .014 * s, 0));
      const q = rest.clone().multiply(delta);
      values.push(q.x, q.y, q.z, q.w);
    }
    const sway = new THREE.QuaternionKeyframeTrack(spine.name, times, values);
    const idx = tracks.findIndex(t => t.name === spine.name);
    if (idx >= 0) tracks[idx] = sway; else tracks.push(sway);
  }
  const clip = new THREE.AnimationClip('Idle', D, tracks);
  clip.userData = { hipsRest: hipsRest.toArray(), synthetic: true };
  return clip;
}

// ------------------------------------------------ clips sintéticos de salto
// Rotación alrededor del eje X LÓGICO del personaje. El visual lleva yaw=180°,
// así que el cuaternión de reposo world (yaw · world del nodo) conjuga la
// rotación al espacio local del hueso exactamente igual que applyAimDelta().
// Convención: ángulo + = el hueso apunta hacia delante (-Z del juego), ángulo
// - = hacia atrás. Permite describir el salto en grados "de animación" sin
// conocer la orientación local de cada joint de Mixamo.
const pose = (o = {}) => Object.assign({
  hip: 0, spine: 0, spine1: 0, spine2: 0, neck: 0, head: 0,
  armL: 0, armR: 0, foreL: 0, foreR: 0,
  upLegL: 0, upLegR: 0, legL: 0, legR: 0, footL: 0, footR: 0
}, o);

// Despegue: agacharse -> explosión -> recogida de piernas, brazos arriba.
// Se mantiene en la última pose (clamp) mientras vy sigue subiendo.
const TAKEOFF = [
  { t: 0, hip: -.075, pose: pose({ spine: -.14, spine1: -.05, head: .12,
    upLegL: .26, upLegR: -.16, legL: -.44, legR: -.32, footL: .16, footR: .12,
    armL: -.26, armR: -.32, foreL: -.30, foreR: -.30 }) },
  { t: .09, hip: .045, pose: pose({ spine: .10, spine1: .04, head: -.09,
    upLegL: -.16, upLegR: .10, legL: .10, legR: .06, footL: -.20, footR: -.20,
    armL: .78, armR: .88, foreL: -.26, foreR: -.26 }) },
  { t: .22, hip: .010, pose: pose({ spine: -.05, head: .05,
    upLegL: .58, upLegR: .44, legL: -.88, legR: -.80, footL: .26, footR: .24,
    armL: .95, armR: 1.02, foreL: -.40, foreR: -.40 }) },
  { t: .34, hip: 0, pose: pose({ spine: -.03, head: .03,
    upLegL: .52, upLegR: .40, legL: -.80, legR: -.74, footL: .22, footR: .20,
    armL: .88, armR: .96, foreL: -.38, foreR: -.38 }) }
];
// Caída: se estiran las piernas buscando el suelo y se abren los brazos para
// equilibrar. Empieza exactamente en la pose final del despegue (continuidad).
const FALL = [
  { t: 0, hip: 0, pose: TAKEOFF[3].pose },
  { t: .28, hip: -.025, pose: pose({ spine: .06, head: -.05,
    upLegL: .16, upLegR: -.10, legL: -.20, legR: -.14, footL: -.12, footR: -.10,
    armL: .52, armR: .60, foreL: -.24, foreR: -.24 }) }
];
// Aterrizaje: compresión profunda de rodillas/caderas y recuperación a reposo.
const LAND = [
  { t: 0, hip: -.025, pose: FALL[1].pose },
  { t: .07, hip: -.085, pose: pose({ spine: -.22, spine1: -.08, head: .20,
    upLegL: .50, upLegR: .46, legL: -1.00, legR: -.96, footL: .30, footR: .28,
    armL: .30, armR: .36, foreL: -.55, foreR: -.55 }) },
  { t: .17, hip: -.030, pose: pose({ spine: -.08, head: .06,
    upLegL: .20, upLegR: .18, legL: -.40, legR: -.36, footL: .10, footR: .10,
    armL: .12, armR: .16, foreL: -.20, foreR: -.20 }) },
  { t: .30, hip: 0, pose: pose() }
];

function makePoseClip(idle, scene, name, frames, hipsRest) {
  const D = frames[frames.length - 1].t;
  const nodes = nodeIndex(scene);
  scene.updateMatrixWorld(true);
  const yaw = new THREE.Quaternion().setFromAxisAngle(AXIS_Y, FACING_YAW);

  const rot = new Map(); // clave corta -> pista + cuaterniones de reposo
  for (const [short, key] of Object.entries(POSE_BONES)) {
    const track = idle.tracks.find(t =>
      /\.quaternion$/.test(t.name) &&
      normName(t.name.slice(0, t.name.lastIndexOf('.'))) === key);
    const node = track && nodes.get(key);
    if (!track || !node) continue;
    rot.set(short, {
      name: track.name,
      local: node.quaternion.clone(),
      world: yaw.clone().multiply(node.getWorldQuaternion(new THREE.Quaternion())),
      times: [], values: []
    });
  }

  const hipTimes = [], hipValues = [];
  for (const f of frames) {
    for (const [short, info] of rot) {
      const angle = Number(f.pose[short] || 0);
      const r = new THREE.Quaternion().setFromAxisAngle(AXIS_X, angle);
      const delta = info.world.clone().invert().multiply(r).multiply(info.world);
      const q = info.local.clone().multiply(delta).normalize();
      info.times.push(f.t);
      info.values.push(q.x, q.y, q.z, q.w);
    }
    hipTimes.push(f.t);
    hipValues.push(hipsRest.x, hipsRest.y + (f.hip || 0), hipsRest.z);
  }

  const tracks = [];
  for (const info of rot.values()) {
    tracks.push(new THREE.QuaternionKeyframeTrack(info.name, info.times, info.values));
  }
  const hipsTrack = idle.tracks.find(t => /hips/i.test(t.name) && /\.position$/.test(t.name));
  if (hipsTrack) tracks.push(new THREE.VectorKeyframeTrack(hipsTrack.name, hipTimes, hipValues));
  // El resto de huesos se fija a su pose de reposo: así el crossfade desde
  // walk/run no deja manos, hombros o dedos en la zancada anterior.
  for (const t of idle.tracks) {
    if (tracks.some(x => x.name === t.name)) continue;
    const c = t.clone();
    const n = c.getValueSize();
    c.times = new Float32Array([0, D]);
    c.values = new Float32Array([...c.values.slice(0, n), ...c.values.slice(0, n)]);
    tracks.push(c);
  }
  const clip = new THREE.AnimationClip(name, D, tracks);
  clip.userData = { hipsRest: hipsRest.toArray(), synthetic: true };
  return clip;
}

async function loadTemplate(asset = DEFAULT_ASSET) {
  if (templatePromise && activeAsset === asset) return templatePromise;
  // Cambio de héroe: se descarta por completo la plantilla anterior para no
  // acumular 5 esqueletos + 15 texturas de 2048² en la GPU de Electron.
  teardownCurrent();
  const epoch = ++loadEpoch;
  activeAsset = asset;
  GLB_ASSET = asset;
  templatePromise = (async () => {
    const bytes = await readGLBBytes(asset);
    const gltf = await loader.parseAsync(bytes, '');
    // Llegó tarde: ya se pidió otro héroe. Se libera el grafo parseado para
    // que un cambio rápido de personaje no deje texturas huérfanas en GPU.
    if (epoch !== loadEpoch) { disposeSubtree(gltf.scene); return null; }
    const hips = findBone(gltf.scene, 'mixamorig:Hips', 'mixamorigHips');
    const hipsRest = hips ? hips.position.clone() : new THREE.Vector3(.0033, .8002, -.0432);

    const find = (...keys) => {
      for (const key of keys) {
        const clip = gltf.animations.find(c => c.name.toLowerCase().includes(key));
        if (clip) return neutralizeRootMotion(clip, hipsRest);
      }
      return null;
    };
    const raw = {
      walk: find('walking'),
      run: find('running'),
      guard: find('boxing'),
      attack: find('combo')
    };
    const clips = {};
    for (const [key, clip] of Object.entries(raw)) if (clip) clips[key] = clip;
    // "Triple_Combo_Attack" dura 4.33 s. Con el clip entero a 3× y una
    // ventana de melé de .31 s solo se veía la PREPARACIÓN del primer golpe:
    // el héroe se quedaba a medio levantar el arma. Se recorta al primer
    // tajo (~1.4 s) para que la animación arranque, cruce y recupere limpia.
    if (clips.attack && clips.attack.duration > 1.6) {
      const strike = THREE.AnimationUtils.subclip(clips.attack, 'MeleeStrike', 0, 42, 30);
      if (strike.tracks.length && strike.duration > .3) clips.attack = strike;
    }
    const base = clips.walk || clips.run || Object.values(clips)[0] || gltf.animations[0];
    clips.idle = makeIdleClip(base, hipsRest, gltf.scene);
    clips.takeoff = makePoseClip(clips.idle, gltf.scene, 'JumpTakeoff', TAKEOFF, hipsRest);
    clips.fall = makePoseClip(clips.idle, gltf.scene, 'JumpFall', FALL, hipsRest);
    clips.land = makePoseClip(clips.idle, gltf.scene, 'JumpLand', LAND, hipsRest);

    template = { scene: gltf.scene, clips, asset };
    window.__NR_GLB_STATUS = {
      ok: true, asset, clips: Object.keys(clips),
      embedded: gltf.animations.map(a => a.name), fitScale: FIT_SCALE,
      textures: countTextures(gltf.scene)
    };
    console.log('GLTF_LOADED:', JSON.stringify(window.__NR_GLB_STATUS));
    return template;
  })().catch(err => {
    if (epoch === loadEpoch) templatePromise = null; // permite reintentar
    window.__NR_GLB_STATUS = { ok: false, asset, error: String(err?.message || err) };
    console.warn('GLTF_LOAD_FAIL:', err);
    throw err;
  });
  return templatePromise;
}

function countTextures(root) {
  const set = new Set();
  root.traverse(o => {
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m) continue;
      for (const v of Object.values(m)) if (v && v.isTexture) set.add(v.uuid);
    }
  });
  return set.size;
}

// ------------------------------------------------------------- instancia GLB
function createInstance(tpl) {
  const visual = cloneSkinned(tpl.scene);
  visual.name = 'GLBCharacter';

  // Materiales y texturas propios de la instancia: así dispose() puede liberar
  // todos los recursos GPU sin invalidar la plantilla cacheada.
  const materials = [];
  visual.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    // La caja de la malla es estática: con skinning el frustum la descartaría
    // en mitad de una animación.
    o.frustumCulled = false;
    const src = Array.isArray(o.material) ? o.material : [o.material];
    const owned = src.map(m => {
      if (!m) return m;
      const cm = m.clone();
      for (const key of Object.keys(cm)) {
        const value = cm[key];
        if (value && value.isTexture) { cm[key] = value.clone(); cm[key].needsUpdate = true; }
      }
      if (cm.envMap) { cm.envMap = cm.envMap.clone(); cm.envMap.needsUpdate = true; }
      // El GLB trae KHR_materials_specular con specularColorFactor = [2,2,2],
      // fuera del rango 0..1 que define la especificación. Con las tres luces
      // que siguen al jugador eso quema los paneles blancos a saturación total.
      if (cm.specularColor) {
        const s = cm.specularColor;
        s.setRGB(Math.min(1, s.r), Math.min(1, s.g), Math.min(1, s.b));
      }
      if ('specularIntensity' in cm) cm.specularIntensity = Math.min(cm.specularIntensity ?? 1, .30);
      // Acabado mate coherente con los mundos Kenney: el 0.85 anterior, junto
      // con environmentIntensity 1.5, era el mayor foco de deslumbramiento.
      cm.envMapIntensity = .42;
      materials.push(cm);
      return cm;
    });
    o.material = Array.isArray(o.material) ? owned : owned[0];
  });

  visual.scale.setScalar(FIT_SCALE);
  visual.rotation.y = FACING_YAW;

  // Alineación con el suelo: se mide la caja real (precisa, con skinning) y se
  // compensa para que el vértice más bajo quede exactamente en y = 0, que es
  // donde groundAt()/state.py colocan al jugador. No se toca player.position.
  const box = new THREE.Box3().setFromObject(visual, true);
  const groundOffset = Number.isFinite(box.min.y) ? -box.min.y : 0;
  visual.position.y = groundOffset;

  // Huesos para la capa de apuntado y para anclar armas a las manos reales.
  // Los cuaterniones de reposo se guardan en espacio del jugador (el visual ya
  // tiene escala + yaw de 180°) para conjugar el eje X lógico al hueso.
  visual.updateMatrixWorld(true);
  const bones = {
    rightArm: findBone(visual, 'mixamorigRightArm', 'mixamorig:RightArm'),
    leftArm: findBone(visual, 'mixamorigLeftArm', 'mixamorig:LeftArm'),
    rightHand: findBone(visual, 'mixamorigRightHand', 'mixamorig:RightHand'),
    leftHand: findBone(visual, 'mixamorigLeftHand', 'mixamorig:LeftHand'),
    head: findBone(visual, 'mixamorigHead', 'mixamorig:Head')
  };
  const armRest = {};
  for (const key of POSE_KEYS) {
    const bone = bones[key];
    armRest[key] = bone ? bone.getWorldQuaternion(new THREE.Quaternion()) : null;
  }

  const mixer = new THREE.AnimationMixer(visual);
  const actions = {};
  for (const [key, clip] of Object.entries(tpl.clips)) {
    const action = mixer.clipAction(clip);
    const oneShot = ONE_SHOT.has(key);
    action.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = oneShot;
    actions[key] = action;
  }

  return {
    visual, mixer, actions, materials, groundOffset, bones, armRest,
    currentKey: 'idle', currentAction: null, pendingMotion: { ...IDLE_MOTION },
    currentRoot: null, time: 0, carrierReady: false,
    // Pose limpia que escribió el mixer (sin la capa procedural).
    animatedPose: null, idleRef: null, idleSettle: 0,
    // Máquina de estados del salto y del tajo melé.
    wasGrounded: true, wasAir: false, prevVy: 0, airFrames: 0, landHold: 0,
    lastMeleeSeq: 0
  };
}

function speedFor(key, m) {
  switch (key) {
    case 'walk': return THREE.MathUtils.clamp((m.speed || 8) / 8, .9, 1.5);
    case 'run': return THREE.MathUtils.clamp((m.speed || 9) / 9, 1, 1.55) * (m.dashing > 0 ? 1.4 : 1);
    case 'guard': return .7;
    // El valor real se calcula en updateCharacterGLB() a partir de la
    // duración del clip recortado y del estilo (hacha lenta / espada rápida).
    case 'attack': return m.meleeStyle === 'heavy' ? 2.8 : 3.6;
    case 'land': return 1.15;
    default: return 1;
  }
}

function fadeTo(inst, key, motion) {
  const next = inst.actions[key] || inst.actions.idle;
  if (!next || inst.currentAction === next) {
    if (next) next.setEffectiveTimeScale(speedFor(inst.currentKey, motion));
    return;
  }
  const fade = key === 'attack' ? .045 : (key === 'takeoff' || key === 'land') ? .07 : (key === 'fall' ? .12 : .2);
  if (inst.currentAction) inst.currentAction.fadeOut(fade);
  next.reset().setEffectiveWeight(1).setEffectiveTimeScale(speedFor(key, motion)).fadeIn(fade).play();
  inst.currentAction = next;
  inst.currentKey = key;
}

/** Reinicia un one-shot desde el frame 0 (doble salto / nuevo aterrizaje).
 *  Se hace un corte seco para que la anticipación no se pierda en un fade. */
function hardSwitch(inst, key) {
  const next = inst.actions[key];
  if (!next) return;
  for (const [k, a] of Object.entries(inst.actions)) if (k !== key) a.stop();
  next.reset().setEffectiveWeight(1).setEffectiveTimeScale(speedFor(key, inst.pendingMotion || IDLE_MOTION)).play();
  inst.currentAction = next;
  inst.currentKey = key;
}

// ------------------------------------------ capa superior: postura de disparo
// updatePlayer() sigue escribiendo ud.arms[*].rotation.x (≈ -1.05 / -1.28 rad)
// para recoger los brazos del maniquí procedural. Reutilizamos ESA MISMA señal
// lógica para inclinar los huesos Mixamo y después colgar el arma en la mano
// derecha real: reculada, deslizamiento, ADS y golpe melé siguen gobernando el
// modelo nuevo sin tocar las funciones de control del juego.
function aimAngleFrom(rot, fallback) {
  const v = -Number(rot || 0);
  return Math.abs(v) > .08 ? THREE.MathUtils.clamp(v, .65, 1.95) : fallback;
}

// Los clips sintéticos son CONSTANTES, y PropertyMixer.apply() solo escribe un
// binding cuando el valor acumulado cambia entre frames. Si el mixer no
// reescribe cabeza/brazos, un `bone.quaternion.multiply(delta)` por frame se
// acumula sin límite (temblor del idle). Solución: snapshot de la pose limpia
// justo después del mixer y deltas ABSOLUTOS desde esa pose, restaurándola
// antes del siguiente update. El mixer vuelve a ser el único dueño del hueso.
function snapshotPose(inst) {
  const base = inst.animatedPose || (inst.animatedPose = {});
  for (const key of POSE_KEYS) {
    const b = inst.bones[key];
    if (!b) continue;
    (base[key] || (base[key] = new THREE.Quaternion())).copy(b.quaternion);
  }
}
function restorePose(inst) {
  const base = inst.animatedPose;
  if (!base) return;
  for (const key of POSE_KEYS) {
    const b = inst.bones[key], q = base[key];
    if (b && q) b.quaternion.copy(q);
  }
}
function applyAimDelta(inst, key, angle) {
  const bone = inst.bones[key], rest = inst.armRest[key], base = inst.animatedPose?.[key];
  if (!bone || !rest || !base) return;
  const rot = new THREE.Quaternion().setFromAxisAngle(AXIS_X, angle);
  // q_mundo_nuevo = Rx(angle) · q_mundo  =>  delta conjugado al espacio del hueso
  const delta = rest.clone().invert().multiply(rot).multiply(rest);
  bone.quaternion.copy(base).multiply(delta).normalize();
}

function alignWeaponAnchors(root, inst, dt) {
  const ud = root.userData || {};
  const carrier = ud.weaponCarrier;
  if (!carrier && !ud.hand) return;
  const arms = ud.arms || [];
  applyAimDelta(inst, 'rightArm', aimAngleFrom(arms[1]?.rotation.x, 1.28));
  applyAimDelta(inst, 'leftArm', aimAngleFrom(arms[0]?.rotation.x, 1.05));
  if (inst.bones.head && inst.armRest.head) {
    const pitch = THREE.MathUtils.clamp(Number(ud.head?.rotation.x || 0), -.32, .3);
    applyAimDelta(inst, 'head', HEAD_REST_CORRECTION + pitch);
  }
  // Las manos ya están en la postura final: se convierten a coordenadas del
  // rig lógico y se usan para mover el portador de armas y la mano del melé.
  root.updateWorldMatrix(true, true);
  const k = Math.min(1, dt * 20);
  const p = new THREE.Vector3();
  if (carrier && inst.bones.rightHand) {
    inst.bones.rightHand.getWorldPosition(p); root.worldToLocal(p);
    p.sub(ud.gunBase || GUN_BASE);
    if (inst.carrierReady) carrier.position.lerp(p, k); else carrier.position.copy(p);
  }
  if (ud.hand && inst.bones.leftHand) {
    inst.bones.leftHand.getWorldPosition(p); root.worldToLocal(p);
    if (inst.carrierReady) ud.hand.position.lerp(p, k); else ud.hand.position.copy(p);
  }
  inst.carrierReady = true;
}

// Diagnóstico ligero y permanente: deriva máxima del idle (debe ser ~0) y
// secuencia real de clips durante el salto. Lo imprime ANIM_TEST en el smoke
// test de Electron, así una regresión del temblor se detecta automáticamente.
function trackIdleDrift(inst, key) {
  const d = window.__NR_GLB_DIAG || (window.__NR_GLB_DIAG = {
    idleFrames: 0, idleDrift: 0, jumpSeq: [], keys: [], lastKey: null
  });
  if (d.lastKey !== key) {
    d.keys.push(key);
    if (d.keys.length > 24) d.keys.shift();
  }
  if (key === 'takeoff' && d.lastKey !== 'takeoff') d.jumpSeq = [];
  if (AIR_KEYS.has(key) || key === 'land') {
    if (d.jumpSeq[d.jumpSeq.length - 1] !== key) {
      d.jumpSeq.push(key);
      if (d.jumpSeq.length > 8) d.jumpSeq.shift();
    }
  }
  d.lastKey = key;

  if (key !== 'idle') { inst.idleRef = null; inst.idleSettle = 0; return; }
  // Tras un tajo melé el crossfade attack -> idle dura ~.2 s. Si se mide
  // durante la mezcla, la pose intermedia se contabiliza como "temblor del
  // idle": se espera a que la acción de reposo tenga peso completo.
  if (inst.currentAction !== inst.actions.idle ||
      inst.currentAction.getEffectiveWeight() < .995) {
    inst.idleRef = null; inst.idleSettle = 0; return;
  }
  if (++inst.idleSettle < 12) return; // deja cerrar el crossfade de entrada
  d.idleFrames++;
  const qh = inst.bones.head?.quaternion;
  if (!qh) return;
  if (!inst.idleRef) {
    inst.idleRef = {
      head: qh.clone(),
      rightArm: inst.bones.rightArm?.quaternion.clone(),
      leftArm: inst.bones.leftArm?.quaternion.clone()
    };
    return;
  }
  for (const [k, q] of [
    ['head', qh],
    ['rightArm', inst.bones.rightArm?.quaternion],
    ['leftArm', inst.bones.leftArm?.quaternion]
  ]) {
    if (q && inst.idleRef[k]) d.idleDrift = Math.max(d.idleDrift, inst.idleRef[k].angleTo(q));
  }
}

// ------------------------------------------------------------------- API
export function preloadCharacterGLB(characterId) {
  return loadTemplate(assetFor(characterId)).catch(() => null);
}

/** Cuelga el GLB del héroe elegido en el rig lógico. Si el personaje no cambió
 *  se reparenta la instancia viva (sin recargar); si cambió, loadTemplate()
 *  libera la anterior y parsea el binario nuevo. */
export function attachCharacterGLB(root, characterId) {
  if (!root) return Promise.resolve(null);
  const s = stateOf(root);
  const asset = assetFor(characterId);
  if (instance && activeAsset === asset) {
    mount(root, instance);
    return Promise.resolve(instance);
  }
  // Mientras se parsea el GLB nuevo, el rig viejo sigue en escena. Se desliga
  // su estado del mixer YA (la instancia anterior está a punto de destruirse)
  // para que updateCharacterGLB() no intente animar un grafo liberado.
  s.instance = null;
  s.ready = false;
  const ticket = ++attachTicket;
  return loadTemplate(asset).then(tpl => {
    if (!s.alive || ticket !== attachTicket || !tpl) return null;
    if (!instance || activeAsset !== asset) instance = createInstance(tpl);
    mount(root, instance);
    return instance;
  }).catch(() => null);
}

function mount(root, inst) {
  if (inst.currentRoot && inst.currentRoot !== root) {
    const prev = RIG_STATE.get(inst.currentRoot);
    if (prev) { prev.instance = null; prev.ready = false; }
  }
  if (inst.visual.parent) inst.visual.parent.remove(inst.visual);
  root.add(inst.visual);
  const s = stateOf(root);
  s.instance = inst; s.ready = true;
  inst.currentRoot = root;
  inst.carrierReady = false; // el rig nuevo trae portadores nuevos
  inst.animatedPose = null; inst.idleRef = null; inst.idleSettle = 0;
  if (s.tint !== undefined) applyCharacterTint(root, s.tint);
  fadeTo(inst, 'idle', IDLE_MOTION);
}

/** Mapea las banderas lógicas de updatePlayer() a los clips de Mixamo. */
export function setCharacterMotion(root, motion) {
  const s = root && RIG_STATE.get(root);
  if (s?.instance) s.instance.pendingMotion = motion;
}

/** Avanza el mixer una vez por frame (también en menú/hub, para el idle). */
export function updateCharacterGLB(root, dt) {
  const s = root && RIG_STATE.get(root);
  const inst = s?.instance;
  if (!inst || !s.ready) return;
  const m = inst.pendingMotion || IDLE_MOTION;

  // --- máquina de estados del salto, alimentada por la física existente ----
  // vy > 0 con transición suelo->aire = despegue; un salto doble se detecta
  // por el salto positivo de vy en pleno aire. El aterrizaje por flanco de
  // grounded dispara la compresión aunque no sea una caída "dura".
  const air = !m.grounded;
  const vy = Number(m.vy || 0);
  const newJump = air && vy > 1 && (inst.wasGrounded || vy - inst.prevVy > 4);
  const prevAirFrames = inst.airFrames;
  inst.airFrames = air ? prevAirFrames + 1 : 0;
  const landed = !air && inst.wasAir && prevAirFrames >= 3;

  if (newJump) hardSwitch(inst, 'takeoff');
  if (landed) { inst.landHold = .32; hardSwitch(inst, 'land'); }
  else inst.landHold = Math.max(0, inst.landHold - dt);
  inst.wasAir = air;
  inst.wasGrounded = !air;
  inst.prevVy = vy;

  let key = 'idle';
  if (air) key = (vy > 1.2 || newJump) ? 'takeoff' : 'fall';
  else if (inst.landHold > 0) key = 'land';
  else if (m.meleeSwing > 0) key = 'attack';
  else if (m.dashing > 0 || m.slide > .05) key = 'run';
  else if (m.moving) key = (m.speed > 9.2 || m.overdrive > 0 || m.frenzy > 0) ? 'run' : 'walk';
  else if (m.ads || m.reloading > 0) key = 'guard';
  // Cada tajo reinicia el one-shot desde el frame 0 (`meleeSeq` lo incrementa
  // game.js). Sin esto, mantener pulsado el clic dejaba la acción clamped en
  // la última pose del combo y el héroe parecía congelado a medio golpe.
  if (!air && m.meleeSwing > 0 && m.meleeSeq !== undefined && m.meleeSeq !== inst.lastMeleeSeq) {
    inst.lastMeleeSeq = m.meleeSeq;
    hardSwitch(inst, 'attack');
    key = 'attack';
  }
  fadeTo(inst, key, m);
  if (inst.currentKey === 'attack' && inst.currentAction) {
    // El clip recortado cabe EXACTO en la ventana de melé: .52 s el hacha y
    // .38 s la espada. Se deriva de la duración real, así funciona también
    // si un GLB trae un combo de longitud distinta.
    const want = m.meleeStyle === 'heavy' ? .52 : .38;
    const dur = inst.currentAction.getClip()?.duration || want;
    inst.currentAction.setEffectiveTimeScale(Math.min(4.2, Math.max(1, dur / want)));
  } else {
    inst.currentAction?.setEffectiveTimeScale(speedFor(inst.currentKey, m));
  }

  // Orden crítico: restaurar la pose limpia -> mixer -> snapshot -> deltas
  // absolutos. Ningún quaternion procedural sobrevive al siguiente frame.
  restorePose(inst);
  inst.time += dt;
  inst.mixer.update(dt);
  snapshotPose(inst);

  // Respiración y inclinación aérea a nivel de grupo: no pisan las rotaciones
  // que el AnimationMixer escribe en los huesos.
  const breathe = key === 'idle' ? Math.sin(inst.time * 1.7) * .012 : 0;
  inst.visual.position.y = inst.groundOffset + breathe;
  const lean = key === 'takeoff' ? -.075 : key === 'fall' ? .085 : key === 'land' ? -.045 : 0;
  inst.visual.rotation.x += (lean - inst.visual.rotation.x) * Math.min(1, dt * 10);

  // Capa procedural de apuntado + anclaje de armas a las manos del esqueleto.
  alignWeaponAnchors(root, inst, dt);
  trackIdleDrift(inst, key);
  // Si updatePlayer() no se ejecutó (menú/hub), el estado por defecto es reposo.
  inst.pendingMotion = { ...IDLE_MOTION };
}

/** Tiñe el acento del operador sin destruir las texturas PBR del GLB. */
export function applyCharacterTint(root, colorHex) {
  if (!root) return;
  const s = stateOf(root);
  s.tint = colorHex;
  const inst = s.instance;
  const c = new THREE.Color(colorHex);
  // La contraluz también cambia de color: es el único punto de luz ligado al
  // operador, y se busca por etiqueta para no guardar Object3D en userData.
  const rim = root.children.find(o => o.isPointLight && o.userData.isRim);
  if (rim) rim.color.copy(c);
  if (!inst) return;
  for (const m of inst.materials) {
    if (!m.emissive) continue;
    m.emissive.copy(c).multiplyScalar(.10);
    m.emissiveIntensity = .30;
  }
}

/** Clon ligero para el señuelo espectral: usa SkeletonUtils (no Object3D.clone,
 *  que serializaría userData y rompería el skinning) y comparte geometría. */
export function cloneCharacterGhost(root) {
  const ghost = new THREE.Group();
  ghost.rotation.order = root.rotation.order;
  ghost.position.copy(root.position);
  ghost.rotation.copy(root.rotation);
  ghost.scale.copy(root.scale);
  if (instance) {
    const body = cloneSkinned(instance.visual);
    body.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    ghost.add(body);
  }
  const gun = root.userData.gun;
  if (gun && gun.visible) {
    const copy = gun.clone(true);
    // El arma cuelga de un portador que sigue a la mano derecha del esqueleto;
    // el clon debe conservar ese desplazamiento para no quedar flotando.
    const carrier = root.userData.weaponCarrier;
    if (carrier) copy.position.add(carrier.position);
    ghost.add(copy);
  }
  return ghost;
}

/** Libera el esqueleto clonado de un señuelo al expirar. */
export function disposeCharacterGhost(ghost) {
  if (!ghost) return;
  ghost.traverse(o => { if (o.skeleton) o.skeleton.dispose(); });
  ghost.clear();
}

// ------------------------------------------------------- liberación de memoria
const TEXTURE_HINT = (v) => v && v.isTexture;

function disposeSubtree(root) {
  if (!root) return;
  const geos = new Set(), mats = new Set(), texs = new Set(), skeletons = new Set();
  root.traverse(o => {
    if (o.geometry && !o.geometry.userData?.shared) geos.add(o.geometry);
    if (o.skeleton) skeletons.add(o.skeleton);
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) {
      if (!m || m.userData?.shared) continue;
      mats.add(m);
      for (const value of Object.values(m)) if (TEXTURE_HINT(value)) texs.add(value);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (TEXTURE_HINT(u?.value)) texs.add(u.value);
    }
  });
  for (const g of geos) g.dispose();
  for (const m of mats) m.dispose();
  for (const t of texs) t.dispose();
  for (const s of skeletons) s.dispose(); // libera el boneTexture de GPU
  root.clear();
}

/** Libera geometrías, materiales y texturas del rig procedural anterior.
 *  El visual GLB NO se destruye: se conserva para el siguiente operador. */
export function disposePlayerRig(root) {
  if (!root) return;
  const s = RIG_STATE.get(root);
  if (s) {
    s.alive = false; s.ready = false;
    const inst = s.instance;
    if (inst) {
      if (inst.visual.parent === root) root.remove(inst.visual);
      if (inst.currentRoot === root) inst.currentRoot = null;
      s.instance = null;
    }
    RIG_STATE.delete(root);
  }
  disposeSubtree(root);
  root.userData = {};
}

/** Libera mixer, acciones, geometrías y texturas del héroe activo.
 *  Se usa tanto al cambiar de personaje como al cerrar Electron. */
function teardownCurrent() {
  loadEpoch++;
  if (instance) {
    // Cualquier rig que siga apuntando a esta instancia debe dejar de
    // actualizarla: en un cambio rápido de héroe el renderer puede ejecutar
    // varios frames entre el teardown y el mount del GLB nuevo.
    if (instance.currentRoot) {
      const stale = RIG_STATE.get(instance.currentRoot);
      if (stale) { stale.instance = null; stale.ready = false; }
    }
    instance.mixer.stopAllAction();
    for (const action of Object.values(instance.actions)) {
      instance.mixer.uncacheAction(action.getClip(), instance.visual);
    }
    instance.mixer.uncacheRoot(instance.visual);
    if (instance.visual.parent) instance.visual.parent.remove(instance.visual);
    disposeSubtree(instance.visual);
    instance = null;
  }
  // La geometría es compartida con cloneSkinned(); disposeSubtree() ya la
  // liberó, así que aquí solo se suelta el grafo de la plantilla.
  if (template) { disposeSubtree(template.scene); template = null; }
  templatePromise = null;
}

/** Teardown completo al cerrar Electron. */
export function disposeAllCharacterAssets() {
  teardownCurrent();
  THREE.Cache.clear();
  if (window.__NR_GLB_STATUS) window.__NR_GLB_STATUS.disposed = true;
}
