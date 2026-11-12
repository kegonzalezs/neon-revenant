import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CHARACTERS, ABILITIES, BOOSTS, UPGRADES, LEVELS, SLOTS, SYNERGIES, MODIFIERS, DIFFICULTIES, LEVEL_ART, ROUNDS, roundLabel, UTILITY, OBJECTIVES, ACHIEVEMENTS, ENEMY_CODEX } from './content.js';
import { FAMILIES, MODULES, RESONANCES, EVOLUTIONS, ABILITY_EVOLUTIONS, abilityEvolution, AFFIXES, PACTS, RELICS, relicById, THREAT, moduleById, affixById } from './arsenal.js';
import { buildEnvironment } from './props.js';
import { buildWorld, worldArt, updateWorld } from './worlds.js';
// Arquitectura modular de los 7 mundos Kenney. Fase QC: solo 1 y 2 construidos;
// los 5 restantes usan TEMPORALMENTE el builder voxel como fallback.
import { WorldManager } from './WorldManager.js';
import { COMFORT, artForLevel, worldIdForLevel } from './worlds/registry.js';
import { BOSSES, BOSS_ABILITIES, bossFor, buildBossMesh } from './bosses.js';
import * as Meta from './meta.js';
import { MusicEngine } from './music.js';
import { FX } from './fx.js';
import { buildCatModel, buildUtilityProp } from './loadout.js';
import { buildPlayerRig, disposeOperatorCache } from './operators.js';
import {
  preloadCharacterGLB, attachCharacterGLB, setCharacterMotion, updateCharacterGLB,
  applyCharacterTint, disposePlayerRig, disposeAllCharacterAssets,
  cloneCharacterGhost, disposeCharacterGhost
} from './glb-character.js';
import { initNatureKit, disposeNatureKit } from './nature-kit.js';
// --- Arsenal único: un arma GLB por héroe, proyectiles, partículas y SFX ----
import {
  WEAPON_DEFS, UNIQUE_WEAPONS, weaponFor, initWeapons,
  attachWeapon, detachWeapon, disposeWeapons, weaponDiagnostics, activeWeapon
} from './weapons.js';
import { CombatParticles } from './combat-particles.js';
import { CombatProjectiles } from './combat-projectiles.js';
import {
  loadSfxBank, bindSfxContext, playCharacterSfx, playSfx,
  warmSfx, sfxDiagnostics, disposeSfxBank
} from './sfx.js';
import { FxPool } from './particles.js';
import { makeFacadeBank } from './facades.js';
import { renderCodex, codexSummary } from './codex.js';
import { CinematicPass } from './cinematic.js';
import { buildEnemyModel, buildEliteCrown } from './enemies.js';

const $ = (id) => document.getElementById(id);
const fx = new FX();
let vfx = null;
let combatParticles = null;   // sprites Kenney con pooling instanciado
let combatProjectiles = null; // flechas / orbes / láseres con pooling
// La cuenta de draw calls se acumula entre los pases del composer.

// Profundidad de las detonaciones en cadena: evita recursión descontrolada
// cuando una baja detona, mata a otra y esa vuelve a detonar.
let _chainDepth = 0;

// Ajustes del jugador (persisten en disco).
const SETTINGS_KEY = 'nr-settings-v1';
const settings = { sensitivity: 14, fov: 64, volume: 55, fx: true, invert: false, difficulty: 'vet', colorblind: false, flash: true, dmgnum: true };
try {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (raw) Object.assign(settings, JSON.parse(raw));
} catch (e) { }
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { } }
function currentDifficulty() { return DIFFICULTIES.find(d => d.id === settings.difficulty) || DIFFICULTIES[1]; }
window.addEventListener('error', (event) => {
  console.log('RUNTIME_ERROR: ' + event.message + ' @ ' + event.filename + ':' + event.lineno + ':' + event.colno);
  if (event.error && event.error.stack) console.log('RUNTIME_STACK: ' + event.error.stack);
});
const clamp = THREE.MathUtils.clamp;
const C = { cyan: 0x6ef7e7, coral: 0xff4d38, dark: 0x080d11, steel: 0x1b2529, white: 0xdce8e3 };
// Traduccion de acentos: la paleta cian/neon del tema anterior pasa a la gama
// oro / verde / violeta de la interfaz de fantasia. Afecta SOLO al DOM (fichas,
// gemas de botin, biblioteca y HUD); nunca a los datos de juego ni a los VFX 3D.
const UI_GEM_MAP = {
  '#6ef7e7':'#ffcf4a', '#7fc9bd':'#ffcf4a', '#8fd0e0':'#c9a9e8',
  '#9ff7ff':'#a67bea', '#8fdfff':'#c9a9e8', '#3dffb0':'#9bcf5a',
  '#5fe6b0':'#9bcf5a', '#b6ff3d':'#9bcf5a', '#a9c469':'#9bcf5a'
};
function uiGem(hex) {
  const key = String(hex || '').toLowerCase();
  return UI_GEM_MAP[key] || hex || '#ffcf4a';
}
// Vectores de trabajo reutilizados: evita miles de asignaciones por frame.
const _tmpV = new THREE.Vector3();
const _tmpV2 = new THREE.Vector3();
const _tmpV3 = new THREE.Vector3();

// Semilla del generador. La ciudad se construye con semilla fija (skyline estable)
// y cada partida se resiembra para que el botín, los modificadores y los críticos varíen.
let seed = 20260728;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
function reseed(value) { seed = (Math.abs(Math.floor(value)) % 2147483646) || 1; }
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

// ---------------------------------------------------------------- render
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05090d);
scene.fog = new THREE.FogExp2(0xa8bcc4, 0.0062);
// Cielo con gradiente: da referencia espacial y evita el vacío negro que cansa la vista.
const skyGeo = new THREE.SphereGeometry(240, 24, 16);
skyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
const skyDome = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
scene.add(skyDome);
function paintSky(bottomHex, topHex) {
  const pos = skyGeo.attributes.position, col = skyGeo.attributes.color;
  const cb = new THREE.Color(bottomHex), ct = new THREE.Color(topHex), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = clamp((pos.getY(i) / 240) * .5 + .5, 0, 1);
    tmp.copy(cb).lerp(ct, Math.pow(t, .65));
    col.setXYZ(i, tmp.r, tmp.g, tmp.b);
  }
  col.needsUpdate = true;
}
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.08, 400);
camera.rotation.order = 'YXZ';
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// La cuenta de draw calls se lleva por frame completo (varios pases del composer).
renderer.info.autoReset = false;
// Confort visual: ACES comprime las altas luces en vez de recortarlas, así la
// nieve del Mundo 2 y el oro de las armas nunca queman a blanco puro. La
// exposición queda acotada por COMFORT (0.88..1.00) en applyLevel().
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
const gl = renderer.getContext();
const gpuInfo = gl.getExtension('WEBGL_debug_renderer_info');
const gpuName = gpuInfo ? gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
window.__NR_GPU = gpuName;
console.log('GPU_RENDERER:', gpuName);
if ($('gpu-name')) {
  $('gpu-name').textContent = gpuName.includes('SwiftShader') ? 'SOFTWARE' : 'HARDWARE';
  $('gpu-name').title = gpuName;
}
$('game').appendChild(renderer.domElement);
// ---------------------------------------------------------------------------
// MAPA DE ENTORNO PROCEDURAL
// Sin él, todo material metálico (armaduras, armas, hostiles) se renderiza casi
// negro: un metal solo se ve por lo que refleja. Se genera un degradado
// equirectangular (cielo arriba, suelo abajo) y se pre-filtra con PMREM. Cuesta
// unos milisegundos al arrancar y no añade ni un draw call por frame.
function buildEnvironmentMap() {
  const W = 64, H = 32;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    let r, g, b;
    if (t < .52) {
      const k = t / .52;
      r = .05 + k * .30; g = .07 + k * .30; b = .12 + k * .32;
    } else {
      const k = (t - .52) / .48;
      r = .35 * (1 - k) + .04 * k; g = .35 * (1 - k) + .04 * k; b = .38 * (1 - k) + .05 * k;
    }
    // Un par de "farolas" frías para que el metal tenga algo que recoger.
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const glow = (x === 12 || x === 44) && t > .3 && t < .6 ? .55 : 0;
      data[i] = Math.min(255, (r + glow * .7) * 255);
      data[i + 1] = Math.min(255, (g + glow * .85) * 255);
      data[i + 2] = Math.min(255, (b + glow) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose(); tex.dispose();
  return env;
}
scene.environment = buildEnvironmentMap();
// El mapa de entorno procedural sigue dando volumen a los metales, pero a 0.42
// en vez de 1.5: antes multiplicaba los reflejos especulares y era la causa
// principal del deslumbramiento en armaduras y armas.
if ('environmentIntensity' in scene) scene.environmentIntensity = 0.42;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// Bloom casi desactivado para el escenario: umbral 0.92 solo deja pasar los
// emisivos de proyectiles / láseres / botín. Ninguna superficie mate Kenney
// alcanza ese valor, así que el diorama no brilla y no fatiga la vista.
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  0.12, COMFORT.bloomRadius, COMFORT.bloomThreshold
);
composer.addPass(bloom);
composer.addPass(new OutputPass());
// Etalonaje: saturación, contraste y viñeta. Va después del OutputPass, así que
// trabaja sobre sRGB ya codificado, que es como se ajusta una foto.
const gradePass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    // Etalonaje suave (COMFORT.grade): el contraste 1.03 y la viñeta 0.18
    // anteriores aplastaban las sombras a negro y cansaban en sesiones largas.
    sat: { value: COMFORT.grade.sat }, contrast: { value: COMFORT.grade.contrast },
    lift: { value: COMFORT.grade.lift }, vig: { value: COMFORT.grade.vig }
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float sat, contrast, lift, vig;
    varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, sat);
      c = (c - 0.5) * contrast + 0.5 + lift;
      float d = distance(vUv, vec2(0.5)) * 1.42;
      c *= 1.0 - vig * d * d * d;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`
});
composer.addPass(gradePass);
// Pase cinematográfico final: aberración, desenfoque radial, grano, viñeteado
// y etalonaje. Es el que hace que el juego "se vea a juego" con lo que pasa.
const cine = new CinematicPass();
composer.addPass(cine);

const world = new THREE.Group();
scene.add(world);
// Backend de efectos con memoria fija (instancing + pools). Se crea aquí porque
// necesita la escena, pero se usa desde todo el archivo.
vfx = new FxPool(scene);
// Pools del arsenal único: se crean una sola vez, antes del primer combate.
combatParticles = new CombatParticles(scene, camera);
combatProjectiles = new CombatProjectiles(scene, combatParticles);
const solid = new THREE.MeshStandardMaterial({ color: C.steel, roughness: 0.72, metalness: 0.65 });
const black = new THREE.MeshStandardMaterial({ color: 0x090d10, roughness: 0.4, metalness: 0.85 });
const coral = new THREE.MeshStandardMaterial({ color: 0x55130d, emissive: C.coral, emissiveIntensity: 2.2 });
const cyan = new THREE.MeshStandardMaterial({ color: 0x123a38, emissive: C.cyan, emissiveIntensity: 2.5 });
const acid = new THREE.MeshStandardMaterial({ color: 0x2c3d0d, emissive: 0xb6ff3d, emissiveIntensity: 2.5 });
const violet = new THREE.MeshStandardMaterial({ color: 0x2a153f, emissive: 0xb56bff, emissiveIntensity: 2.5 });
const white = new THREE.MeshStandardMaterial({ color: C.white, roughness: 0.32, metalness: 0.75 });
const arenaFloor = new THREE.MeshStandardMaterial({ color: 0x111a1e, roughness: 0.62, metalness: 0.72 });
const arenaAccentA = cyan.clone();
const arenaAccentB = coral.clone();
const arenaRingMat = new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: .3, side: THREE.DoubleSide });
const arenaCircleMat = new THREE.MeshBasicMaterial({ color: C.coral, side: THREE.DoubleSide });
// Volúmenes de juego: valor medio y poca saturación para que destaquen los hostiles.
const platformMat = new THREE.MeshStandardMaterial({ color: 0x948d7e, roughness: .82, metalness: .08 });
const perimeterMat = new THREE.MeshStandardMaterial({ color: 0x7b7568, roughness: .9, metalness: .05 });

// Luz base: techo 1.35 en hemisfera y rellenos con PointLights de baja
// intensidad. applyLevel() sobreescribe estos valores con la paleta del
// mundo, SIEMPRE pasada por comfortArt(): nunca blanco puro al 100% ni
// intensidades que revienten el canal.
const hemiLight = new THREE.HemisphereLight(0xd7e0dc, 0x6b6559, 1.25);
scene.add(hemiLight);
// Relleno ambiental: mínimo 0.30 garantizado por COMFORT. Sumado a la
// hemisfera impide que la sombra sea negro puro bajo la copa de los árboles
// del Nature Kit o dentro del cráter de un bloque de nieve.
const ambientLight = new THREE.AmbientLight(0xffe9c0, 0.35);
scene.add(ambientLight);
const moon = new THREE.DirectionalLight(0xfff0d6, 1.4);
moon.position.set(-22, 34, 16); moon.castShadow = true;
// Sombra más barata y más nítida: menos resolución pero un frustum mucho más
// ajustado (antes 2048² cubriendo 104×104 unidades) y refresco cada dos frames.
// ±50 cubre la arena completa (±46) para que las esquinas del diorama
// también reciban sombra.
moon.shadow.mapSize.set(1024, 1024); moon.shadow.camera.left = -50; moon.shadow.camera.right = 50;
moon.shadow.camera.top = 50; moon.shadow.camera.bottom = -50;
// normalBias desplaza la muestra a lo largo de la normal: mata el "acné" de
// sombra (las bandas que aparecían en el suelo) sin despegar la sombra del objeto.
moon.shadow.bias = -0.0002;
moon.shadow.normalBias = 0.055;
moon.shadow.autoUpdate = false; moon.shadow.needsUpdate = true;
scene.add(moon);
// Dos luces de relleno cálida/fría: separan las caras de los volúmenes sin neón.
// Intensidad contenida (COMFORT.maxFill = 8): antes iban a 34/30 y con el
// metalness alto de los GLB provocaban los destellos que cansaban la vista.
const redLight = new THREE.PointLight(0xffd9a2, 6.5, 40, 2); redLight.position.set(-18, 7, -14); scene.add(redLight);
const cyanLight = new THREE.PointLight(0x8fc4d4, 5.5, 38, 2); cyanLight.position.set(18, 6, 11); scene.add(cyanLight);

const ARENA = 46;
let currentLevel = LEVELS[0];
// Bloom del mundo activo: applyLevel() lo fija y el bucle de combate solo
// puede SUMAR sobre él sin superar COMFORT.maxBloom.
let currentBloom = 0.12;
const platforms = [];
// Huellas de la utilería (coches, contenedores, árboles...): sólidas para el
// movimiento y para los proyectiles. Se reconstruyen con la arena.
const propColliders = [];
const arenaGroup = new THREE.Group();
world.add(arenaGroup);
// ---------------------------------------------------------------- mundos Kenney
// Gestor modular de los 7 mundos (assets/worlds/). Fase QC: solo world1_nature
// y world2_snow están construidos; los otros cinco devuelven false y el juego
// cae TEMPORALMENTE al builder voxel hasta implementarlos.
//  · onReady: al llegar los GLB por IPC, WorldManager rellena plataformas y
//    huellas y levanta la arena real; aquí se recalcula la altura del anillo
//    de reaparición para que no quede flotando sobre el diorama.
let arenaRing = null, arenaCircle = null;
const worldManager = new WorldManager(scene, {
  moon,
  onReady: () => {
    const y = groundAt(0, 4, 60);
    if (arenaRing) arenaRing.position.y = y + .04;
    if (arenaCircle) arenaCircle.position.y = y + .045;
  }
});

function box(parent, size, pos, material = solid) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  m.position.set(...pos); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function cylinder(parent, r1, r2, h, pos, material = solid, sides = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, sides), material);
  m.position.set(...pos); m.castShadow = true; parent.add(m); return m;
}
function rbox(parent, size, pos, material = solid, radius = 0.035, segments = 2) {
  const r = Math.min(radius, Math.min(...size) * 0.4);
  const m = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], segments, r), material);
  m.position.set(...pos); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function applyLevel() {
  const l = currentLevel;
  // Arte del escenario: los mundos Kenney ya construidos imponen SU paleta
  // pastel; los pendientes siguen usando la voxel antigua. En ambos casos el
  // valor pasa por comfortArt(), que acota exposición, bloom, intensidades de
  // luz y pasteliza los colores para que ningún escenario queme blancos.
  const legacy = worldArt(l.id) || LEVEL_ART[l.id] || LEVEL_ART.rooftop;
  const art = artForLevel(l.id, legacy);
  scene.background = new THREE.Color(art.fog);
  scene.fog.color.setHex(art.fog);
  scene.fog.density = art.fogDensity;
  paintSky(art.sky, art.skyTop);
  hemiLight.color.setHex(art.hemiSky);
  hemiLight.groundColor.setHex(art.hemiGround);
  hemiLight.intensity = Math.min(COMFORT.maxHemi, art.hemiInt);
  ambientLight.intensity = Math.max(COMFORT.minAmbient, art.ambient ?? COMFORT.minAmbient);
  ambientLight.color.setHex(art.ambientColor ?? 0xffffff);
  moon.color.setHex(art.sun);
  moon.intensity = Math.min(COMFORT.maxSun, art.sunInt);
  moon.position.set(art.sunPos[0], art.sunPos[1], art.sunPos[2]);
  redLight.color.setHex(art.fillA); redLight.intensity = Math.min(COMFORT.maxFill, art.fillInt);
  cyanLight.color.setHex(art.fillB); cyanLight.intensity = Math.min(COMFORT.maxFill, art.fillInt * .85);
  arenaFloor.color.setHex(art.floor);
  platformMat.color.setHex(art.platform);
  perimeterMat.color.setHex(art.platform).multiplyScalar(.8);
  arenaAccentA.emissive.setHex(art.trim); arenaAccentA.color.setHex(art.trim).multiplyScalar(.55);
  arenaAccentA.emissiveIntensity = .32;
  arenaAccentB.emissive.setHex(art.trim2); arenaAccentB.color.setHex(art.trim2).multiplyScalar(.55);
  arenaAccentB.emissiveIntensity = .32;
  arenaRingMat.color.setHex(art.trim);
  arenaCircleMat.color.setHex(art.trim2);
  currentBloom = art.bloom;
  bloom.strength = art.bloom;
  bloom.threshold = COMFORT.bloomThreshold;
  bloom.radius = COMFORT.bloomRadius;
  renderer.toneMappingExposure = art.exposure;
  // La dirección del sol cambió: el mapa de sombras (autoUpdate=false) hay que
  // regenerarlo o la escena queda con la sombra del mundo anterior.
  moon.shadow.needsUpdate = true;
  rain.visible = art.rain > 0;
  rain.material.opacity = .45 * art.rain;
  document.body.style.setProperty('--cyan', uiGem(l.accent));
}
function buildArena() {
  // El escenario lo levanta el gestor modular: carga perezosa de GLB por IPC,
  // InstancedMesh, colisiones publicadas por el builder. Si el mundo aún no
  // está implementado (mundos 3-7 en la fase QC) devuelve false y se usa el
  // builder voxel antiguo como fallback TEMPORAL.
  const wid = worldIdForLevel(currentLevel.id);
  const modular = worldManager.requestWorld(wid, arenaGroup, platforms, propColliders, rnd);
  if (!modular) {
    buildWorld(currentLevel.id, arenaGroup, rnd, platforms, propColliders);
  }
  // Anillo de llegada: única concesión al lenguaje de neón, sirve para ubicar
  // el punto de reaparición sobre la meseta central.
  const cy = groundAt(0, 4, 60);
  arenaRing = new THREE.Mesh(new THREE.RingGeometry(4.4, 4.5, 64), arenaRingMat);
  arenaRing.rotation.x = -Math.PI / 2; arenaRing.position.set(0, cy + .04, 4); arenaGroup.add(arenaRing);
  arenaCircle = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.26, 4), arenaCircleMat);
  arenaCircle.rotation.x = -Math.PI / 2; arenaCircle.rotation.z = Math.PI / 4;
  arenaCircle.position.set(0, cy + .045, 4); arenaGroup.add(arenaCircle);
}
function rebuildArena() {
  // El gestor libera SU raíz (geometrías, materiales, texturas y la cache de
  // plantillas del mundo anterior) ANTES del barrido de arenaGroup: así nada
  // se dispone dos veces y el fallback voxel no tropieza con el grafo Kenney.
  worldManager.dispose();
  arenaRing = null; arenaCircle = null;
  for (const child of arenaGroup.children) disposeObject3D(child);
  arenaGroup.clear();
  platforms.length = 0;
  propColliders.length = 0;
  buildArena();
}
function groundAt(x, z, y, step = 0.65) {
  // El suelo de referencia ya no es 0: los escenarios voxel tienen canales por
  // debajo del nivel del mar. Se busca la plataforma más alta alcanzable y solo
  // si no hay ninguna se cae al 0 de antes.
  let g = -Infinity;
  for (const p of platforms) {
    if (Math.abs(x - p.x) < p.hw && Math.abs(z - p.z) < p.hd) {
      if (p.top <= y + step && p.top > g) g = p.top;
    }
  }
  return g === -Infinity ? 0 : g;
}
// Saca un punto de la huella de un prop (caja orientada) empujándolo por el eje
// de menor penetración. Devuelve true si hubo corrección.
function pushOutOfProp(pos, radius, y, c) {
  if (y >= c.h - 0.2) return false;             // por encima: se salta o se vuela
  const dx = pos.x - c.x, dz = pos.z - c.z;
  const reach = c.r + radius + .4;
  if (dx * dx + dz * dz > reach * reach) return false;
  // Pasa al sistema local del prop (inversa de la rotación Y).
  const lx = c.cos * dx - c.sin * dz, lz = c.sin * dx + c.cos * dz;
  const mx = c.hw + radius, mz = c.hd + radius;
  if (Math.abs(lx) >= mx || Math.abs(lz) >= mz) return false;
  const px = mx - Math.abs(lx), pz = mz - Math.abs(lz);
  let nlx = lx, nlz = lz;
  if (px < pz) nlx = lx >= 0 ? mx : -mx; else nlz = lz >= 0 ? mz : -mz;
  // Vuelta a coordenadas de mundo.
  pos.x = c.x + (c.cos * nlx + c.sin * nlz);
  pos.z = c.z + (-c.sin * nlx + c.cos * nlz);
  return true;
}
function resolveProps(pos, radius, y) {
  for (const c of propColliders) pushOutOfProp(pos, radius, y, c);
}
// ¿Hay un prop sólido en este punto? (lo usa la IA para rodear obstáculos)
function propAt(x, z, y, radius) {
  for (const c of propColliders) {
    if (y >= c.h - 0.2) continue;
    const dx = x - c.x, dz = z - c.z;
    if (dx * dx + dz * dz > (c.r + radius) * (c.r + radius)) continue;
    const lx = c.cos * dx - c.sin * dz, lz = c.sin * dx + c.cos * dz;
    if (Math.abs(lx) < c.hw + radius && Math.abs(lz) < c.hd + radius) return c;
  }
  return null;
}
// Punto de aparición válido: si cae dentro de un prop, se desplaza hasta su borde.
// Evita hostiles que nacen atrapados dentro de un contenedor.
function clearSpawn(x, z, radius = 1.1) {
  const p = new THREE.Vector3(x, 0, z);
  for (let k = 0; k < 3; k++) {
    const c = propAt(p.x, p.z, 0, radius);
    if (!c) break;
    const dx = p.x - c.x, dz = p.z - c.z;
    const lx = c.cos * dx - c.sin * dz, lz = c.sin * dx + c.cos * dz;
    const px = c.hw + radius - Math.abs(lx), pz = c.hd + radius - Math.abs(lz);
    let nlx = lx, nlz = lz;
    if (px < pz) nlx = lx >= 0 ? c.hw + radius : -c.hw - radius;
    else nlz = lz >= 0 ? c.hd + radius : -c.hd - radius;
    p.x = c.x + (c.cos * nlx + c.sin * nlz);
    p.z = c.z + (-c.sin * nlx + c.cos * nlz);
  }
  p.x = clamp(p.x, -ARENA + 5, ARENA - 5); p.z = clamp(p.z, -ARENA + 5, ARENA - 5);
  return p;
}
// Distancia al primer prop que corta el rayo (Infinity si ninguno). Los coches y
// contenedores son cobertura real: tapan disparos de ida y de vuelta.
const _rayD = new THREE.Vector3();
function propRayT(origin, dir, maxT) {
  let best = Infinity;
  const yLo = Math.min(origin.y, origin.y + dir.y * maxT);
  for (const c of propColliders) {
    if (yLo >= c.h - 0.12) continue;               // el tiro pasa por encima
    const dx = origin.x - c.x, dz = origin.z - c.z;
    const reach = c.r + maxT;
    if (dx * dx + dz * dz > reach * reach) continue;
    // Test de recorte (slab) en el sistema local del prop.
    const fx = c.cos * dx - c.sin * dz, fz = c.sin * dx + c.cos * dz;
    const ddx = c.cos * dir.x - c.sin * dir.z, ddz = c.sin * dir.x + c.cos * dir.z;
    let t0 = 0, t1 = maxT, ok = true;
    for (const [o, d, m] of [[fx, ddx, c.hw], [fz, ddz, c.hd]]) {
      if (Math.abs(d) < 1e-6) { if (Math.abs(o) > m) { ok = false; break; } continue; }
      let ta = (-m - o) / d, tb = (m - o) / d;
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) { ok = false; break; }
    }
    if (ok && t0 >= 0 && t0 < best) best = t0;
  }
  return best;
}
function segmentBlocked(from, to) {
  const d = _rayD.set(to.x - from.x, to.y - from.y, to.z - from.z);
  const len = d.length(); if (len < 1e-5) return false;
  d.multiplyScalar(1 / len);
  return propRayT(from, d, len) < len;
}
// Dirección alternativa cuando el camino recto está tapado: prueba desvíos
// crecientes y devuelve el primero libre. Es lo que evita que un hostile se
// quede empujando un contenedor toda la partida.
const _avoidV = new THREE.Vector3();
function detourDir(pos, dir, radius, y) {
  const probe = _avoidV;
  for (const ang of [.55, -.55, 1.05, -1.05, 1.6, -1.6, 2.2, -2.2]) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const rx = dir.x * ca - dir.z * sa, rz = dir.x * sa + dir.z * ca;
    let clear = true;
    for (const d of [1.6, 3.2]) {
      probe.set(pos.x + rx * d, 0, pos.z + rz * d);
      if (propAt(probe.x, probe.z, y, radius + .25)) { clear = false; break; }
    }
    if (clear) return { x: rx, z: rz };
  }
  return null;
}
function collideXZ(pos, y, radius = 0.55) {
  const R = ARENA - 2;
  pos.x = clamp(pos.x, -R, R); pos.z = clamp(pos.z, -R, R);
  for (const p of platforms) {
    if (y >= p.top - 0.18) continue;
    if (Math.abs(pos.x - p.x) < p.hw + radius * .5 && Math.abs(pos.z - p.z) < p.hd + radius * .5) {
      const dx = p.hw + radius * .5 - Math.abs(pos.x - p.x), dz = p.hd + radius * .5 - Math.abs(pos.z - p.z);
      if (dx < dz) pos.x = p.x + (pos.x >= p.x ? p.hw + radius * .5 : -p.hw - radius * .5);
      else pos.z = p.z + (pos.z >= p.z ? p.hd + radius * .5 : -p.hd - radius * .5);
    }
  }
  resolveProps(pos, radius, y);
}

function textTexture(text, color = '#6ef7e7', sub = 'SIGNAL / 09') {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#071014'; ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.strokeRect(10, 10, 492, 236);
  ctx.fillStyle = color; ctx.font = '900 72px Arial'; ctx.fillText(text, 35, 130);
  ctx.font = '18px monospace'; ctx.fillText(sub, 39, 178); ctx.fillRect(38, 198, 180, 5);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
// Telón de fondo: volúmenes claros y desaturados. Se lee como ciudad lejana gracias a
// la niebla (perspectiva aérea) y no compite con la arena.
// Fachadas: banco de 12 materiales compartidos (4 estilos × 3 alturas).
// La retícula de ventanas está pintada en la textura: cero ventanas-geometría.
let facadeBank = null;
function buildCity() {
  // Los escenarios voxel traen su propio horizonte (castillo, mesetas, murallas),
  // así que el rascacielos de fondo ya no pinta nada: se salta.
  if (worldArt(currentLevel.id)) return;
  if (!facadeBank) facadeBank = makeFacadeBank(Math.floor(rnd() * 9999) + 1);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6f7578, roughness: .95, metalness: .02 });
  for (let i = 0; i < 130; i++) {
    const a = rnd() * Math.PI * 2, r = ARENA + 12 + rnd() * 118, w = 6 + rnd() * 12, d = 6 + rnd() * 12, h = 12 + rnd() * 60;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, y = h / 2 - 9 - rnd() * 10;
    const style = i % 4, hClass = h < 26 ? 0 : h < 46 ? 1 : 2;
    box(world, [w, h, d], [x, y, z], facadeBank[style * 3 + hClass]);
    box(world, [w * 1.06, .8, d * 1.06], [x, y + h / 2 + .4, z], roofMat);
  }
  const signs = [[-32, 10, -18, Math.PI / 2, 'REVENANT'], [24, 12, -32, 0, 'SECTOR 09'], [34, 7, 16, -Math.PI / 2, 'NO SIGNAL']];
  signs.forEach(([x, y, z, ry, t], i) => {
    const m = new THREE.MeshBasicMaterial({ map: textTexture(t, i === 1 ? '#e0a24a' : '#9db85a'), transparent: true, opacity: .85 });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.5), m); p.position.set(x, y, z); p.rotation.y = ry; world.add(p);
  });
}
// La lluvia se crea ANTES de aplicar el nivel: applyLevel() la muestra u oculta.
const rainCount = 1800, rainPos = new Float32Array(rainCount * 3);
for (let i = 0; i < rainCount; i++) { rainPos[i * 3] = (rnd() - .5) * 110; rainPos[i * 3 + 1] = rnd() * 38; rainPos[i * 3 + 2] = (rnd() - .5) * 110; }
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0x9cd8d8, size: .045, transparent: true, opacity: .5 })); scene.add(rain);

applyLevel(); buildArena(); buildCity();

// ---------------------------------------------------------------- player
// Actualización de estilo visual: el cuerpo ya no se genera con cajas voxel.
// buildPlayerRig() solo aporta el esqueleto LÓGICO (armas, boca de fuego,
// anclas), y el GLTFLoader cuelga el robot Mixamo con su AnimationMixer.
// Cambiar de operador reparenta el mismo visual: no se recarga el .glb, no se
// duplican geometrías ni se re-suben texturas a la GPU.
let player = null;
const playerLights = [];
function createPlayerModel() {
  // El GLB del arma es una PLANTILLA COMPARTIDA por los cinco heroes. Se
  // separa del rig ANTES de disposePlayerRig(): si quedara colgado, el
  // recolector liberaria sus geometrias y texturas y el siguiente heroe
  // apareceria con el arma invisible.
  detachWeapon();
  if (player) {
    for (const l of playerLights) l.removeFromParent();
    scene.remove(player);
    disposePlayerRig(player);
    player = null;
  }
  const c = CHARACTERS[selectedCharacter];
  player = buildPlayerRig(selectedCharacter, c.color);
  player.rotation.order = 'YXZ';
  scene.add(player);
  // Tres luces que viajan con el modelo: clave, relleno y contraluz.
  if (!playerLights.length) {
    // El .glb usa PBR real (no materiales planos del maniquí voxel): con las
    // intensidades anteriores (14/8/7) y una luz a 1.5 u. de la cabeza, los
    // paneles blancos se saturaban a blanco puro. Se separan y se atenúan.
    const key = new THREE.PointLight(0xcfefff, 6.5, 9, 2); key.position.set(1.4, 2.8, 2.4);
    const fill = new THREE.PointLight(0x9fc4d6, 4, 7, 2); fill.position.set(-1.2, 1.1, 1.4);
    const rim = new THREE.PointLight(C.coral, 4, 7, 2); rim.position.set(-.8, 2.2, -1.8);
    rim.userData.isRim = true;
    playerLights.push(key, fill, rim);
  }
  for (const l of playerLights) player.add(l);
  // Arma UNICA: un GLB por heroe, colgado del soporte que el cargador de
  // personajes desplaza cada frame hasta mixamorigRightHand. No hay arma por
  // defecto compartida, ni intercambio, ni arma cuerpo a cuerpo separada.
  attachWeapon(player, selectedCharacter);
  warmSfx(selectedCharacter);
  syncWeaponHUD();
  applyCharacterTint(player, c.color);
  // GLTFLoader (plantilla cacheada). La primera carga es asíncrona: mientras
  // llega, el rig lógico ya es completamente funcional. El cargador comprueba
  // glbAlive por si el rig se desechó antes de terminar el parseo.
  attachCharacterGLB(player, selectedCharacter);
  return player;
}
// El HUD ya no anuncia un arma intercambiable ni una tecla de melé: muestra el
// arma única y, solo para los dos héroes cuerpo a cuerpo, el enfriamiento del
// ataque primario (CLIC). No queda ninguna referencia a F ni a E.
function syncWeaponHUD() {
  const w = weaponFor(selectedCharacter);
  if ($('weapon-name')) $('weapon-name').innerHTML = `${w.name} <span>${w.sub}</span>`;
  if ($('weapon-swap-hint')) $('weapon-swap-hint').textContent = 'ARMA ÚNICA POR HÉROE';
  const melSlot = $('melee-slot');
  if (melSlot) melSlot.classList.toggle('hidden', !isMeleeHero());
  if ($('melee-name')) $('melee-name').textContent = (isMeleeHero() ? '⚔ ' : '') + w.name + ' // CLIC';
}

// ---------------------------------------------------------------- state
let selectedCharacter = 'vanta';
let selectedLevelId = LEVELS[0].id;
// (los módulos viven en state.modules)
let currentOffers = [];
let currentPacts = [];
let rerolls = 2;
let lootLevels = {};
let hudDirty = true;

const state = {
  mode: 'menu', hp: 100, maxHp: 100, ammo: 24, maxAmmo: 24, baseAmmo: 24, score: 0, kills: 0, wave: 0,
  combo: 1, comboTimer: 0, charge: 0, dash: 1, dashing: 0, overdrive: 0, damage: 34, speed: 8,
  fireRate: .12, fireTimer: 0, reloading: 0, yaw: 0, pitch: -.08, shake: 0, time: 0, damageTaken: 1,
  headshotMult: 1.85, chargeMult: 1, dashRecovery: 1.55, overdriveDuration: 7, lifeOnKill: 0,
  shield: 0, maxShield: 0, shotCount: 0, grenade: false, grenadeEvery: 5, companions: 0, recoil: 0,
  py: 0, vy: 0, jumps: 2, maxJumps: 2, jumpPower: 10.6, grounded: true,
  abilities: {}, timers: {}, weaponBlessing: 0, weaponEvolved: {},
  frenzy: 0, frenzyTimer: 0, frenzyDuration: 6, chipMult: 1, chips: 0, pierceBonus: 0,
  curse: 1, curseMult: 1, pending: 0, reinforceTimer: 0,
  critChance: .09, critMult: 1.65, ads: false, dashPunch: 0, dashRoll: 0, camDip: 0, slide: 0,
  photo: false, modifier: null, modifiers: [], scoreMult: 1, regen: 0,
  // --- sistemas nuevos (arsenal de interferencia) ---------------------------
  modules: {}, familyLevels: {}, resonances: [], pacts: [], evolved: {}, evolutions: {}, relics: [], revived: false,
  killExplode: 0, retaliate: 0, abilityHaste: 1, reloadMult: 1, healMult: 1, shieldRegen: 1,
  overdriveDamage: 1.25, critExplode: false, regenAlways: false, pactElites: 0, enemySpeed: 1,
  threat: 1, runTime: 0, hordeTimer: THREAT.hordeEvery, hordeCount: 0, eliteAffixes: 1,
  slowT: 0, slowFactor: 1, echoT: 0, buildScore: 1, roundScoreMult: 1, retaliateT: 0,
  // Ranuras de carga: ataque primario (CLIC/GATILLO), utilidad (G) y gato (C).
  // `meleeSeq` identifica cada tajo para reiniciar el clip de animación.
  meleeId: 'blade', meleeCd: 0, meleeSwing: 0, meleeSeq: 0, meleeCombo: 0, meleeKills: 0, meleeUnlocked: 1,
  utilityId: 'grenade', utilityCd: 0, utilityCharges: 0, utilityMax: 0, utilityUnlocked: 1, stim: 0,
  catOut: false, cat: null, catCd: 0, catUses: 0,
  obj: null, lastHit: null, runStart: 0, runShots: 0, runHits: 0, runHead: 0, runDmg: 0, runTaken: 0
};
const keys = {}; let mouseDown = false;
const enemies = [], projectiles = [], lootBoxes = [], companions = [], grenades = [], hazards = [], mines = [];
// Orbes en arco del ZAPADOR: vuelan por separado y revientan al aterrizar.
const lobs = [];
// Entidades de utilidad desplegadas y zonas amigas (botiquín, torreta).
const pylons = [], zones = [];
let orbitBlades = [];
const clock = new THREE.Clock();

// ---------------------------------------------------------------- audio
class AudioEngine {
  constructor() { this.ctx = null; this.master = null; }
  init() {
    if (this.ctx) return this.ctx;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain(); this.master.gain.value = .22; this.master.connect(this.ctx.destination);
    // El banco Kenney (.ogg por IPC) comparte el mismo AudioContext y el mismo
    // master: así el volumen global y el desbloqueo por gesto del usuario
    // valen tanto para los tonos sintéticos como para los efectos de combate.
    bindSfxContext(this.ctx, this.master);
    warmSfx(selectedCharacter);
    this.ambient();
    return this.ctx;
  }
  tone(freq, dur, type = 'sawtooth', vol = .15, slide = 0) {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur);
  }
  noise(dur = .08, vol = .2) {
    if (!this.ctx) return; const len = this.ctx.sampleRate * dur, b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = b; g.gain.value = vol; s.connect(g); g.connect(this.master); s.start();
  }
  shoot() { this.tone(180, .07, 'square', .12, -110); this.noise(.045, .13); }
  hit() { this.tone(720, .035, 'sine', .08, 200); }
  kill() { this.tone(150, .18, 'sawtooth', .16, -90); this.tone(650, .12, 'square', .07, 250); }
  hurt() { this.tone(85, .25, 'sawtooth', .2, -45); }
  dash() { this.noise(.2, .12); this.tone(220, .18, 'sine', .1, 500); }
  jump() { this.tone(320, .12, 'sine', .08, 320); }
  reload() { this.tone(340, .06, 'square', .07, 80); setTimeout(() => this.tone(480, .08, 'square', .07, 100), 450); }
  coin() { this.tone(880, .07, 'square', .07, 220); setTimeout(() => this.tone(1180, .12, 'square', .07, 180), 90); }
  ambient() {
    if (!this.ctx) return; const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 44; f.type = 'lowpass'; f.frequency.value = 110; g.gain.value = .045;
    o.connect(f); f.connect(g); g.connect(this.master); o.start();
  }
}
const audio = new AudioEngine();
const music = new MusicEngine();

// ---------------------------------------------------------------- weapons
// ARSENAL ÚNICO. Se eliminaron el catálogo intercambiable, el arma por defecto
// compartida, la tecla F, la tecla E, el botín de armas especiales y los
// modelos procedurales. Queda UNA definición por héroe (src/weapons.js) con su
// GLB, su proyectil, sus VFX y sus SFX. El contrato numérico (damage/fireRate/
// ammo/pellets/spread/pierce/kick/color) sigue alimentando el bucle de combate.
function currentWeapon() { return weaponFor(selectedCharacter); }
// Melé puro = arma SIN proyectil. Hoy son exactamente el bárbaro (hacha) y el
// vampiro (espada carmesí). Se deriva del dato para que añadir un héroe melé
// no exija tocar el mapeo de entrada ni el HUD.
function isMeleeHero(id = selectedCharacter) { return !weaponFor(id).projectile; }
// Un ÚNICO botón de ataque para los cinco héroes: clic izquierdo / gatillo del
// mando. Los melé ejecutan el tajo con animación + partículas de arco; el resto
// dispara. Ya NO existen F (cambiar arma) ni E (cuerpo a cuerpo).
function primaryAttack() {
  if (isMeleeHero()) meleeAttack();
  else shoot();
}
function syncAmmo(full = true) {
  const w = currentWeapon();
  state.maxAmmo = Math.max(4, Math.round(state.baseAmmo * w.ammo));
  state.ammo = full ? state.maxAmmo : Math.min(state.ammo, state.maxAmmo);
  syncWeaponHUD();
  hudDirty = true;
}
// Las tragaperras ya no entregan armas: potencian la que el héroe empuña.
// Es el mismo modificador que usan las bendiciones por don saturado.
function blessWeapon(amount = .12) {
  state.weaponBlessing = (state.weaponBlessing || 0) + amount;
  state.fireRate = Math.max(.025, state.fireRate * (1 - amount * .35));
  syncAmmo(false);
  hudDirty = true;
}

// Estadísticas del golpe cercano (ataque primario con CLIC de bárbaro/vampiro)
// derivadas del arma única: ya no hay una segunda arma de melé con su propio
// catálogo, ni una tecla E independiente, ni desbloqueos por ronda.
function meleeInfo() {
  const w = currentWeapon();
  const heavy = w.key === 'hacha';
  return {
    name: w.name, sub: w.sub, color: '#' + w.color.toString(16).padStart(6, '0'),
    icon: heavy ? '⚒' : '⚔', damage: heavy ? 4.4 : 2.5,
    cooldown: heavy ? .62 : .36, range: heavy ? 4.0 : 3.2, arc: heavy ? 1.7 : 1.25,
    knock: heavy ? 12 : 6, key: w.key
  };
}

// ---------------------------------------------------------------- personajes
function applyCharacterAppearance() {
  const c = CHARACTERS[selectedCharacter];
  // Cada operador es un cuerpo distinto: si cambia el personaje, se reconstruye.
  if (!player || player.userData.operator !== selectedCharacter) createPlayerModel();
  player.scale.setScalar(c.scale);
  const ud = player.userData;
  ud.pAccent.emissive.setHex(c.color);
  ud.pAccent.emissiveIntensity = .9;
  ud.pAccent.color.setHex(c.color).multiplyScalar(.22);
  ud.pSecondary.emissive.setHex(c.color);
  // El acento del operador también tiñe el material PBR del .glb (y la luz de
  // contraluz), sin sustituir sus texturas embebidas.
  applyCharacterTint(player, c.color);
  ud.cloak.visible = true;
  // El blindaje pesado pertenecía al Guerrero, ya fuera del roster.
  ud.heavyArmor.visible = false;
  if ($('character-hud')) $('character-hud').textContent = c.name + ' // ' + c.role;
  document.body.dataset.operator = selectedCharacter;
}
// Selector estilo Slay the Spire 2: columna de operadores a la izquierda y
// ficha de gran formato a la derecha.
const opEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------------------
// ROSTER DEFINITIVO — hoja "Personajes 1.png" (5 héroes).
// Cinco GLB propios en assets/characters/, cargados por src/glb-character.js.
// El guerrero, el slime y el esqueleto quedan fuera del selector; el mago pasa
// a ser LA BRUJA. Cada entrada conserva un `id` de CHARACTERS ya existente
// para no romper árbol de habilidades, récords, arma base ni partida.
// `stats` reproduce las tres barras de la ficha (Baja/Media/Alta/Muy Alto).
// ---------------------------------------------------------------------------
const ROSTER_ICONS = 'assets/ui/roster/';
const ROSTER_ART = [
  {
    id: 'seraph', label: 'EL ARQUERO', role: 'PRECISIÓN A DISTANCIA', color: '#62c94a', icon: 'arquero',
    desc: 'Precisión y control a distancia.',
    stats: [['SALUD', .50, 'Media'], ['VELOCIDAD', .82, 'Alta'], ['DAÑO', .50, 'Medio']],
    ability: 'DISPARO MÚLTIPLE', abilityText: 'Dispara varias flechas a la vez.'
  },
  {
    id: 'ronin', label: 'EL BÁRBARO', role: 'FUERZA BRUTA', color: '#f0872c', icon: 'barbaro',
    desc: 'Fuerza bruta en su máxima expresión.',
    stats: [['SALUD', .82, 'Alta'], ['VELOCIDAD', .28, 'Baja'], ['DAÑO', 1.00, 'Muy Alto']],
    ability: 'GOLPE SALVAJE', abilityText: 'Realiza un gran golpe en área.'
  },
  {
    id: 'glitch', label: 'LA BRUJA', role: 'MAGIA OSCURA', color: '#a259e8', icon: 'bruja',
    desc: 'Control y caos con magia oscura.',
    stats: [['SALUD', .28, 'Baja'], ['VELOCIDAD', .50, 'Media'], ['DAÑO', .78, 'Alto']],
    ability: 'TORMENTA MÁGICA', abilityText: 'Invoca una tormenta de proyectiles.'
  },
  {
    id: 'vanta', label: 'EL ROBOT', role: 'ARTIFICIO DESTRUCTIVO', color: '#59b6e8', icon: 'robot',
    desc: 'Tecnología al servicio de la destrucción.',
    stats: [['SALUD', .82, 'Alta'], ['VELOCIDAD', .50, 'Media'], ['DAÑO', .50, 'Medio']],
    ability: 'RAYO LÁSER', abilityText: 'Dispara un rayo de gran alcance.'
  },
  {
    id: 'kira', label: 'EL VAMPIRO', role: 'DRENAJE VITAL', color: '#e8434f', icon: 'vampiro',
    desc: 'Roba vida y sigue luchando.',
    stats: [['SALUD', .50, 'Media'], ['VELOCIDAD', .82, 'Alta'], ['DAÑO', .78, 'Alto']],
    ability: 'ROBO DE VIDA', abilityText: 'Recupera salud al derrotar enemigos.'
  }
];
const artFor = id => ROSTER_ART.find(a => a.id === id);
const iconURL = a => `${ROSTER_ICONS}${a.icon}.png`;

function buildOperatorRoster() {
  const host = $('op-roster');
  if (!host || host.children.length) return;
  host.innerHTML = ROSTER_ART.map((a, i) => `
    <button class="roster-item" data-character="${a.id}" style="--char:${a.color}">
      <span class="roster-idx">${String(i + 1).padStart(2, '0')}</span>
      <img class="roster-icon" src="${iconURL(a)}" alt="${opEsc(a.label)}" draggable="false">
      <span class="roster-text"><b>${opEsc(a.label)}</b><small>${opEsc(a.role)}</small></span>
    </button>`).join('');
}

function paintOperatorHero(id) {
  const c = CHARACTERS[id], hero = $('op-hero');
  if (!c || !hero) return;
  const art = artFor(id);
  const accent = art ? art.color : c.hex;
  hero.style.setProperty('--char', accent);
  $('op-hero-name').textContent = art ? art.label : c.name;
  $('op-hero-role').textContent = art ? art.role : c.role;
  $('op-hero-desc').textContent = art ? art.desc : c.description;
  // Don del héroe: nombre y efecto tal como aparecen en la hoja de personajes.
  $('op-hero-passive').innerHTML = art
    ? `<span>HABILIDAD</span><b>${opEsc(art.ability)}</b><small>${opEsc(art.abilityText)}</small>`
    : `<span>PASIVA</span>${opEsc(c.passive)}`;

  // Tres atributos de la ficha + el crítico real del operador para completar
  // la rejilla 2x2. El `title` conserva el nivel literal (Media/Alta/Muy Alto).
  const stats = art
    ? [...art.stats.map(([k, v, lvl]) => [k, v, lvl]), ['CRÍTICO', c.headshotMult / 3.1, '']]
    : [
        ['VIDA', c.hp / 205, ''], ['DAÑO', c.damage / 58, ''],
        ['VELOCIDAD', c.speed / 10.6, ''], ['CRÍTICO', c.headshotMult / 3.1, '']
      ];
  $('op-hero-stats').innerHTML = stats.map(([k, v, lvl]) =>
    `<span title="${opEsc(lvl)}">${k}<i style="--v:${Math.min(100, Math.round(v * 100))}%"></i></span>`).join('');

  const w = weaponFor(id);
  $('op-hero-meta').innerHTML = [
    `ARMA ÚNICA // ${opEsc(w.name)}`, opEsc(w.how),
    `CARGADOR // ${Math.round(c.maxAmmo * w.ammo)}`, `SOBRECARGA // ${c.overdriveDuration}s`
  ].map(t => `<span>${t}</span>`).join('');

  const best = Meta.bestOf(id);
  $('op-hero-record').textContent = best && best.wave
    ? `OLA ${String(best.wave).padStart(2, '0')} · ${best.score}` : 'SIN REGISTRO';

  const ph = $('op-hero-portrait');
  ph.innerHTML = '';
  if (art) {
    const img = document.createElement('img');
    img.className = 'roster-hero-icon';
    img.src = iconURL(art);
    img.alt = art.label;
    img.draggable = false;
    ph.appendChild(img);
  } else {
    // Fallback: retratos SVG heredados si el id no pertenece al roster nuevo.
    const svg = document.querySelector(`[data-portrait="${id}"] svg`);
    if (svg) ph.appendChild(svg.cloneNode(true));
  }
  ph.style.setProperty('--char', accent);
  const glow = $('op-hero-glow');
  if (glow) glow.style.background = `radial-gradient(circle at 34% 46%, ${accent}2e, transparent 62%)`;
  const label = $('op-confirm')?.querySelector('span');
  if (label) label.textContent = id === selectedCharacter ? 'SELECCIONADO' : 'SELECCIONAR';
}

function selectCharacter(id) {
  if (!CHARACTERS[id]) return;
  selectedCharacter = id;
  hubSkillChar = id;
  buildOperatorRoster();
  document.querySelectorAll('#op-roster .roster-item').forEach(item =>
    item.classList.toggle('selected', item.dataset.character === id));
  paintOperatorHero(id);
  document.querySelectorAll('[data-skillchar]').forEach(chip => chip.classList.toggle('active', chip.dataset.skillchar === id));
  applyCharacterAppearance();
  hubTree = null;
  renderHubTree();
  updateHubSummary();
  refreshMenuStats();
}
function selectLevel(id) {
  const l = LEVELS.find(x => x.id === id); if (!l) return;
  selectedLevelId = id;
  document.querySelectorAll('.sec-card').forEach(card => card.classList.toggle('selected', card.dataset.level === id));
  updateHubSummary();
}

// ---------------------------------------------------------------- hub
let hubTree = null;
let hubSkillChar = null;
let hubTab = 'operator';
let armoryCat = 'all';

// ------------------------------------------------------------------ biblioteca
// Catálogo completo de armas, habilidades y equipo en formato de cartas.
// A diferencia del códice, aquí todo está a la vista: es una biblioteca, no un
// registro de descubrimientos. Una pequeña marca indica lo ya visto en combate.
const ARMORY_CATS = [
  ['all', 'TODO'], ['weapons', 'ARMAS ÚNICAS'], ['abilities', 'HABILIDADES'],
  ['utility', 'UTILIDAD'], ['synergies', 'SINERGIAS'],
  ['modules', 'DONES'], ['relics', 'RELIQUIAS'], ['evolutions', 'BENDICIONES'],
  ['codex', 'DESCUBRIMIENTOS']
];
const hexOf = n => '#' + Number(n || 0x6ef7e7).toString(16).padStart(6, '0');

// El códice de descubrimientos se reconstruye al entrar en la biblioteca (y al
// abrir su categoría) para que refleje las bajas de la última incursión.
function refreshHubCodex() {
  const host = $('hub-codex'); if (!host) return;
  const kills = {}; const cx = Meta.getCodex();
  for (const k in cx.enemies) kills[k] = cx.enemies[k].kills || 0;
  renderCodex(host, Meta, { kills });
}

function armoryCatalog() {
  const cx = Meta.getCodex();
  const seen = (group, id) => !!(cx[group] && cx[group][id]);
  const out = [];
  const push = (cat, id, o, discovery) => out.push({
    cat, id, seen: !discovery || seen(discovery, id), ...o
  });

  for (const w of UNIQUE_WEAPONS) {
    const traits = ['ARMA ÚNICA', w.character.toUpperCase()];
    if (w.pellets > 1) traits.push(`${w.pellets} PROYECTILES`);
    if (w.pierce) traits.push(`PERFORA ${w.pierce}`);
    if (w.projectile) traits.push(w.projectile.toUpperCase());
    else traits.push('TAJO CORTANTE');
    push('weapons', w.key, {
      icon: w.projectile === 'laser' ? '⌁' : w.projectile === 'orb' ? '◈' : w.projectile ? '➶' : '⚔',
      color: hexOf(w.color), name: w.name, sub: w.sub,
      body: w.how, tag: traits.join(' · '),
      detail: `DAÑO ×${w.damage} · CADENCIA ×${w.fireRate} · CARGADOR ×${w.ammo}`
    }, 'weapons');
  }
  for (const a of ABILITIES) push('abilities', a.id, {
    icon: a.icon, color: uiGem(a.color), name: a.name, sub: a.trigger,
    body: a.how, tag: `NIVEL MÁX ${a.max} · ${a.id.toUpperCase()}`,
    detail: typeof a.desc === 'function' ? a.desc(a.max - 1) : String(a.desc || '')
  }, 'abilities');
  for (const u of UTILITY) push('utility', u.id, {
    icon: u.icon, color: uiGem(u.color), name: u.name, sub: `RANURA G // ${u.cooldown}s`,
    body: u.how, tag: `${u.charges} CARGAS`, detail: u.desc || ''
  }, 'utility');
  for (const s of SYNERGIES) push('synergies', s.id, {
    icon: '◈', color: uiGem(s.color), name: s.name, sub: 'SINERGIA OCULTA',
    body: s.desc, tag: s.req.map(r => ABILITIES.find(a => a.id === r)?.name || r).join(' + '),
    detail: 'Reúne las dos habilidades durante la misma incursión.'
  }, 'synergies');
  for (const m of MODULES) push('modules', m.id, {
    icon: m.icon, color: m.rarity === 'ÉPICA' ? '#b56bff' : m.rarity === 'RARA' ? '#c9a9e8' : '#ffcf4a',
    name: m.name, sub: `${m.family.toUpperCase()} // ${m.rarity}`,
    body: m.how, tag: `NIVEL MÁX ${m.max}`, detail: m.desc
  });
  for (const r of RELICS) push('relics', r.id, {
    icon: r.icon, color: uiGem(r.color), name: r.name, sub: `RELIQUIA // ${r.tier}`,
    body: r.how, tag: r.tier, detail: r.desc
  });
  for (const e of EVOLUTIONS) push('evolutions', e.id, {
    icon: '✦', color: uiGem(e.color), name: e.name, sub: 'BENDICIÓN DEL ARMA ÚNICA',
    body: 'Al saturar el don ' + e.need.toUpperCase() + ', el arma única del héroe gana +18% de daño y +10% de cadencia de forma permanente durante la incursión.',
    tag: 'DON ' + e.need.toUpperCase() + ' AL MÁXIMO',
    detail: 'Ya no transforma el arma en otra: potencia la que ya empuñas.'
  });
  return out;
}

function renderArmory() {
  const chips = $('armory-chips'), grid = $('armory-grid'), hostCodex = $('hub-codex');
  if (!chips || !grid) return;
  if (!chips.children.length) {
    chips.innerHTML = ARMORY_CATS.map(([id, label]) =>
      `<button class="armory-chip" data-armory-cat="${id}">${label}</button>`).join('');
    chips.querySelectorAll('[data-armory-cat]').forEach(b => b.onclick = () => {
      armoryCat = b.dataset.armoryCat;
      audio.tone(560, .07, 'square', .06, 140);
      if (armoryCat === 'codex') refreshHubCodex();
      renderArmory();
    });
  }
  chips.querySelectorAll('[data-armory-cat]').forEach(b => b.classList.toggle('active', b.dataset.armoryCat === armoryCat));

  const showCodex = armoryCat === 'codex';
  grid.hidden = showCodex;
  if (hostCodex) hostCodex.hidden = !showCodex;

  const cat = armoryCat === 'all' ? null : armoryCat;
  const q = ($('armory-search')?.value || '').trim().toLowerCase();
  const items = armoryCatalog().filter(it => (!cat || it.cat === cat) &&
    (!q || (it.name + ' ' + it.sub + ' ' + it.body + ' ' + it.tag).toLowerCase().includes(q)));

  if (!showCodex) {
    grid.innerHTML = items.length ? items.map(it => `
      <div class="armory-card${it.seen ? '' : ' unseen'}" data-armory-id="${opEsc(it.id)}" role="button" tabindex="0" style="--char:${it.color}">
        <div class="armory-icon">${opEsc(it.icon)}</div>
        <div class="armory-name">${opEsc(it.name)}</div>
        <div class="armory-sub">${opEsc(it.sub)}</div>
        <p class="armory-how">${opEsc(it.body)}</p>
        <div class="armory-more">${opEsc(it.detail)}</div>
        <div class="armory-tag">${opEsc(it.tag)}${it.seen ? ' · VISTO' : ' · NUEVO'}</div>
      </div>`).join('') : '<div class="armory-empty">SIN RESULTADOS // PRUEBA OTRA CATEGORÍA O BÚSQUEDA</div>';
    grid.querySelectorAll('.armory-card').forEach(card => {
      const toggle = () => { card.classList.toggle('open'); audio.tone(420, .05, 'square', .05, 100); };
      card.onclick = toggle;
      card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
    });
  }
  const count = $('armory-count');
  if (count) count.textContent = showCodex ? codexSummary(Meta) : `${items.length} FICHAS EN CATÁLOGO`;
  const summary = $('codex-summary');
  if (summary) summary.textContent = showCodex ? codexSummary(Meta) : `${codexSummary(Meta)} · ${items.length} FICHAS`;
}

function selectHubTab(tab) {
  hubTab = tab;
  document.querySelectorAll('.hub-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.hub-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === tab));
  if (tab === 'skills') renderHubTree();
  if (tab === 'dossier') refreshDossier();
  if (tab === 'codex') { refreshHubCodex(); renderArmory(); }
}
function openHub(tab) {
  state.mode = 'hub'; mouseDown = false; document.exitPointerLock?.();
  ['menu', 'gameover', 'pause', 'upgrade', 'loot'].forEach(id => $(id).classList.remove('active'));
  $('hud').classList.add('hidden');
  $('lowhp').classList.remove('on');
  $('hub').classList.add('active');
  refreshHub();
  selectHubTab(tab || hubTab);
}
function renderHubTree() {
  const host = $('hub-tree'); if (!host) return;
  const charId = hubSkillChar || selectedCharacter;
  $('skill-credits').textContent = Meta.getCredits();
  $('hub-points').textContent = Meta.getCredits();
  // chips: cada operador muestra los nodos que ya lleva invertidos
  document.querySelectorAll('[data-skillchar]').forEach(chip => {
    const id = chip.dataset.skillchar;
    const c = CHARACTERS[id]; if (!c) return;
    const n = Meta.ownedCount(id);
    chip.textContent = n ? `${c.name} · ${n}` : c.name;
    chip.classList.toggle('active', id === charId);
  });
  if (!hubTree || hubTree.charId !== charId) {
    try {
    hubTree = Meta.renderGraph(charId, host, () => {
      audio.tone(700, .12, 'square', .09, 200);
      $('skill-credits').textContent = Meta.getCredits();
      $('hub-points').textContent = Meta.getCredits();
      hubTree.refresh(); refreshDossier(); refreshMenuStats();
    });
    hubTree.charId = charId;
    hubTree.setNames(!!$('tree-names')?.checked);
    hubTree.setSearch($('tree-search')?.value || '');
    } catch (err) { window.__NR_TREE_ERROR = String(err && err.stack || err); console.log('TREE_ERROR: ' + err); hubTree = null; }
  } else hubTree.refresh();
  if (hubTree?.auto) requestAnimationFrame(() => hubTree.auto());
}
function refreshDossier() {
  if (!$('stat-runs')) return;
  const m = Meta.getMeta();
  $('stat-runs').textContent = m.totals.runs;
  $('stat-kills').textContent = m.totals.kills;
  const b = Meta.bestOf(selectedCharacter);
  $('stat-wave').textContent = String(b.wave).padStart(2, '0');
  $('stat-score').textContent = String(Math.max(b.score, Number(localStorage.getItem('nr-best') || 0))).padStart(6, '0');
  $('stat-points').textContent = Meta.getCredits();
  // Panel de balance (telemetría local) y clasificación local.
  const t = Meta.telemetrySummary();
  const tel = $('telemetry-panel');
  if (tel) {
    tel.innerHTML = [
      ['PRECISIÓN', t.precision + '%'], ['HEADSHOTS', t.headshotRate + '%'],
      ['DAÑO/MIN', t.dpm], ['DAÑO RECIBIDO/MIN', t.takenPerMin],
      ['DISPAROS', t.shots], ['IMPACTOS', t.hits],
      ['MUERTES', t.deaths], ['RONDAS JUGADAS', t.rounds]
    ].map(([n, v]) => `<div class="doss-row"><span>${n}</span><b>${v}</b></div>`).join('');
  }
  const lb = $('lb-list');
  if (lb) {
    const list = Meta.getLeaderboard();
    lb.innerHTML = list.length
      ? list.map((e, i) => `<div class="doss-row"><span>${i + 1}. ${e.char || '—'} · OLA ${e.wave || 0}</span><b>${String(e.score).padStart(6, '0')}</b></div>`).join('')
      : '<div class="doss-row"><span>SIN PARTIDAS REGISTRADAS</span><b>—</b></div>';
  }
}
function renderDifficulties() {
  const host = $('diff-list'); if (!host) return;
  host.innerHTML = DIFFICULTIES.map(d =>
    `<button class="diff-item${d.id === settings.difficulty ? ' active' : ''}" data-diff="${d.id}"><b>${d.name}</b><span>${d.desc}</span><small>VIDA ×${d.hp} · DAÑO ×${d.damage} · PUNTOS ×${d.reward}</small></button>`).join('');
  host.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => {
    settings.difficulty = b.dataset.diff; saveSettings();
    renderDifficulties(); updateHubSummary(); audio.tone(300, .1, 'square', .08, -80);
  });
}
function updateHubSummary() {
  const c = CHARACTERS[selectedCharacter], l = LEVELS.find(x => x.id === selectedLevelId) || LEVELS[0];
  if ($('hub-summary')) $('hub-summary').textContent = `${c.name} // ${l.name} // ${currentDifficulty().name}`;
}
function syncSettingsUI() {
  if (!$('set-sens')) return;
  $('set-sens').value = settings.sensitivity; $('set-sens-val').textContent = settings.sensitivity;
  $('set-fov').value = settings.fov; $('set-fov-val').textContent = settings.fov + '°';
  $('set-vol').value = settings.volume; $('set-vol-val').textContent = settings.volume + '%';
  $('set-fx').checked = settings.fx; $('set-fx-val').textContent = settings.fx ? 'ON' : 'OFF';
  $('set-invert').checked = settings.invert; $('set-invert-val').textContent = settings.invert ? 'ON' : 'OFF';
  // Accesibilidad: radar con formas, sin parpadeos, números de daño.
  if ($('set-cb')) { $('set-cb').checked = settings.colorblind; $('set-cb-val').textContent = settings.colorblind ? 'ON' : 'OFF'; }
  if ($('set-flash')) { $('set-flash').checked = settings.flash; $('set-flash-val').textContent = settings.flash ? 'ON' : 'OFF'; }
  if ($('set-dmg')) { $('set-dmg').checked = settings.dmgnum; $('set-dmg-val').textContent = settings.dmgnum ? 'ON' : 'OFF'; }
  document.body.classList.toggle('colorblind', !!settings.colorblind);
  if (Math.abs(camera.fov - settings.fov) > .01) { camera.fov = settings.fov; camera.updateProjectionMatrix(); }
}
function wireSettings() {
  const bind = (id, key, after) => {
    const el = $(id); if (!el) return;
    el.addEventListener('input', () => { settings[key] = Number(el.value); saveSettings(); after?.(); syncSettingsUI(); });
  };
  const bindChk = (id, key, after) => {
    const el = $(id); if (!el) return;
    el.addEventListener('change', () => { settings[key] = el.checked; saveSettings(); after?.(); syncSettingsUI(); });
  };
  bind('set-sens', 'sensitivity');
  bind('set-fov', 'fov');
  bind('set-vol', 'volume', () => music.setVolume(settings.volume / 100));
  bindChk('set-fx', 'fx');
  bindChk('set-invert', 'invert');
  bindChk('set-cb', 'colorblind');
  bindChk('set-flash', 'flash');
  bindChk('set-dmg', 'dmgnum');
}
function refreshHub() {
  selectCharacter(selectedCharacter);
  selectLevel(selectedLevelId);
  $('hub-points').textContent = Meta.getCredits();
  renderDifficulties();
  syncSettingsUI();
  refreshDossier();
  updateHubSummary();
}

// ---------------------------------------------------------------- enemigos
const ENEMY_INFO = {
  chaser:  { hp: 110, speed: 3.4, radius: .58, touch: 12, score: 150, charge: 0 },
  ranged:  { hp: 80,  speed: 2.9, radius: .55, touch: 0,  score: 220, charge: 0 },
  tank:    { hp: 280, speed: 2.0, radius: .95, touch: 24, score: 380, charge: 0 },
  drone:   { hp: 60,  speed: 6.2, radius: .5,  touch: 0,  score: 190, charge: 0 },
  flyer:   { hp: 100, speed: 4.8, radius: .62, touch: 0,  score: 260, charge: 0 },
  stalker: { hp: 130, speed: 5.0, radius: .56, touch: 28, score: 320, charge: 0 },
  support: { hp: 150, speed: 3.0, radius: .6,  touch: 0,  score: 340, charge: 0 },
  boss:    { hp: 1500, speed: 2.7, radius: 1.7, touch: 30, score: 2600, charge: 0 },
  // ---- segunda hornada de hostiles -----------------------------------------
  sapper:  { hp: 95,  speed: 2.7, radius: .6,  touch: 0,  score: 300, charge: 0 },
  brute:   { hp: 430, speed: 2.5, radius: 1.15, touch: 32, score: 540, charge: 0 },
  swarmling:{ hp: 42, speed: 7.6, radius: .38, touch: 8,  score: 90,  charge: 0 },
  turret:  { hp: 200, speed: 0,   radius: .78, touch: 0,  score: 310, charge: 0 },
  wraith:  { hp: 125, speed: 5.8, radius: .56, touch: 26, score: 400, charge: 0 }
};
// ------------------------------------------------------------- sistema de rondas
// Cada ronda eleva el nivel de los hostiles de forma COMPUESTA (no lineal): la vida,
// el daño y la velocidad se acumulan ronda sobre ronda, y cada tramo de nivel cambia
// su aspecto para que se lea de un vistazo que la amenaza ha subido.
function roundScaling(round) {
  const R = ROUNDS, r = Math.max(1, round);
  return {
    level: r,
    hp: Math.pow(1 + R.hpPerRound, r - 1),
    dmg: Math.pow(1 + R.dmgPerRound, r - 1),
    speed: Math.min(2.1, Math.pow(1 + R.speedPerRound, r - 1)),
    tier: Math.floor((r - 1) / R.tierEvery),
    armor: r >= R.armorFrom ? Math.min(.45, (r - R.armorFrom + 1) * .035) : 0
  };
}
// Los modificadores se acumulan en rondas avanzadas: una ronda puede tener varias reglas.
function hasMod(id) { return (state.modifiers || []).some(m => m.id === id); }

// ===========================================================================
// ARSENAL DE INTERFERENCIA
// Módulos apilables + resonancias de familia + evoluciones de arma + afijos de
// élite + pactos + director de amenaza. Es la capa que convierte cada ronda en
// una BUILD y no en una suma de números.
// ===========================================================================
const hexToInt = (h) => parseInt(String(h).replace('#', ''), 16) || 0x6ef7e7;

// Caché de materiales emisivos por color: evita crear un MeshStandardMaterial
// nuevo cada vez que aparece un élite o un tramo de nivel (fuga de memoria + 
// recompilación de shaders). Se reutiliza para siempre.
const _emissiveCache = new Map();
function emissiveCache(color, intensity = 1) {
  const key = color + ':' + intensity;
  let m = _emissiveCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .4, metalness: .55 });
    _emissiveCache.set(key, m);
  }
  return m;
}
// Material de torso compartido por TODOS los hostiles: mismo aspecto, una sola
// subida a GPU. Antes se instanciaba uno por enemigo.
const ENEMY_TORSO_MAT = new THREE.MeshStandardMaterial({ color: 0x121a1e, roughness: .55, metalness: .8 });
// Variante de destello: un clon con emisivo a tope por cada material base. Se crea
// UNA vez y se intercambia la referencia del mesh al golpear, así el flash no
// recompila shaders ni contamina a los demás hostiles que comparten material.
const _flashMatCache = new Map();
function flashMaterial(base) {
  let m = _flashMatCache.get(base.uuid);
  if (!m) {
    m = base.clone();
    if (m.emissive) m.emissiveIntensity = 5;
    _flashMatCache.set(base.uuid, m);
  }
  return m;
}
// Rejilla espacial para la separación de hostiles (antes era O(n²)).
const _sepGrid = new Map();

// Variante translúcida para los acechadores de UMBRA (se crea una vez, no por spawn).
const ENEMY_GHOST_MATS = new Map();
function ghostMaterial(src) {
  let m = ENEMY_GHOST_MATS.get(src.uuid);
  if (!m) { m = src.clone(); m.transparent = true; m.opacity = .32; ENEMY_GHOST_MATS.set(src.uuid, m); }
  return m;
}

// --- API que reciben los afijos: nada de acceso directo al estado interno ---
const AFFIX_API = {
  V3: THREE.Vector3,
  get wave() { return state.wave; },
  explode(pos, radius, dmg, color) { explode(pos, radius, dmg, color); },
  hazard(pos, radius, life, dmg, color) { spawnHazard(pos, 'void', { radius, life, dmg, color }); },
  slowPlayer(t, factor) {
    state.slowT = Math.max(state.slowT || 0, t);
    state.slowFactor = Math.min(state.slowFactor || 1, factor);
  },
  arc(e, forks) {
    const from = e.group.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    for (let i = 0; i < forks; i++) {
      const a = Math.random() * Math.PI * 2, r = 2.4 + Math.random() * 2.6;
      forkedArc(from, from.clone().add(new THREE.Vector3(Math.cos(a) * r, (Math.random() - .5) * 1.8, Math.sin(a) * r)), 0x9ff7ff, 2);
    }
    if (player.position.distanceTo(e.group.position) < 4.6) hurt(6 + state.wave * 2, 'arco voltaico');
  },
  blink(e, dx, dz) {
    const at = e.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    spawnBurst(at, 0xb56bff, 12, 3); crystalShell(at, 1.6, 0xb56bff, .35);
    e.group.position.x = clamp(e.group.position.x + dx, -ARENA + 4, ARENA - 4);
    e.group.position.z = clamp(e.group.position.z + dz, -ARENA + 4, ARENA - 4);
    const to = e.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    spawnBurst(to, 0xb56bff, 12, 3); crystalShell(to, 1.6, 0xb56bff, .35);
  }
};

// --- módulos ---------------------------------------------------------------
function moduleLevel(id) { return state.modules[id] || 0; }

function recomputeFamilies() {
  const lv = {};
  for (const id in state.modules) {
    const m = moduleById(id);
    if (!m) continue;
    lv[m.family] = (lv[m.family] || 0) + state.modules[id];
  }
  state.familyLevels = lv;
  // Resonancias: cada umbral se enciende UNA vez y aplica su bonificación de set.
  for (const fam in RESONANCES) {
    const def = RESONANCES[fam], total = lv[fam] || 0;
    if (!total) continue;
    for (const tier of ['t1', 't2']) {
      const r = def[tier];
      if (!r || total < r.at) continue;
      const key = fam + ':' + tier;
      if (state.resonances.includes(key)) continue;
      state.resonances.push(key);
      r.apply(state);
      announce('RESONANCIA // ' + r.name);
      audio.tone(300, .5, 'sawtooth', .14, 700);
      setTimeout(() => audio.tone(900, .28, 'sine', .1, 300), 150);
      if (player) {
        const col = hexToInt(def.color);
        const at = player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        ringPulse(player.position.clone(), col, 4.6, .8);
        crystalShell(at, 2.6, col, .8);
        shardRing(player.position.clone(), col, 2.2, 12, 5);
      }
    }
  }
}

// BENDICIÓN del arma única: saturar un don clave ya no sustituye el arma por
// otra (el arsenal intercambiable desapareció). Potencia permanentemente la
// única que empuña el héroe durante esta incursión.
function checkEvolution(mod) {
  if (!mod || state.modules[mod.id] < mod.max) return false;
  const ev = EVOLUTIONS.find(e => e.need === mod.id && !state.weaponEvolved[e.id]);
  if (!ev) return false;
  state.weaponEvolved[ev.id] = true;
  state.evolved[ev.id] = true;
  state.weaponBlessing = (state.weaponBlessing || 0) + .18;
  state.fireRate = Math.max(.025, state.fireRate * .9);
  syncAmmo(false);
  announce('BENDICIÓN // ' + ev.name);
  audio.tone(180, .85, 'sawtooth', .18, 1200);
  setTimeout(() => audio.tone(640, .5, 'square', .12, 500), 160);
  playSfx('rpg/bookFlip1.ogg', { volume: .4 });
  if (player) {
    const col = hexToInt(ev.color), at = player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    crystalShell(at, 3.2, col, 1.1);
    ringPulse(player.position.clone(), col, 6.2, .9);
    shardRing(player.position.clone(), col, 3, 20, 6);
    impactCore(at, col, 2.4, .3);
    combatParticles?.preset(selectedCharacter, 'impact', at, new THREE.Vector3(0, 1, 0), {});
  }
  hudDirty = true;
  return true;
}

function installModule(id) {
  const m = moduleById(id);
  if (!m) return false;
  const lvl = state.modules[id] || 0;
  if (lvl >= m.max) return false;
  state.modules[id] = lvl + 1;
  m.apply(state);
  recomputeFamilies();
  checkEvolution(m);
  syncAmmo();
  hudDirty = true;
  return true;
}

// --- pactos ---------------------------------------------------------------
function offerPact() {
  const taken = state.pacts.map(p => p.id);
  const pool = PACTS.filter(p => !taken.includes(p.id));
  if (!pool.length) return null;
  return pool[Math.floor(rnd() * pool.length)];
}
function takePact(id) {
  const p = PACTS.find(x => x.id === id);
  if (!p || state.pacts.some(x => x.id === id)) return;
  state.pacts.push(p);
  p.apply(state);
  state.buildScore = (state.buildScore || 1) * (p.score || 1);
  state.scoreMult = (state.roundScoreMult || 1) * state.buildScore;
  syncAmmo();
  announce('PACTO SELLADO // ' + p.name);
  audio.tone(90, .75, 'sawtooth', .2, 380);
  fx.flash('#b56bff', .2, 260);
  if (player) { ringPulse(player.position.clone(), 0xb56bff, 5.5, .9); crystalShell(player.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 3, 0xb56bff, .9); }
  hudDirty = true;
}

// --- director de amenaza --------------------------------------------------
// La presión no depende solo de la ronda: sube con el TIEMPO real de incursión
// (modelo Risk of Rain) y con las rondas superadas. Cada cierto tiempo lanza
// una horda dirigida al jugador, no un círculo genérico alrededor del centro.
function updateDirector(dt) {
  if (state.mode !== 'playing') return;
  state.runTime += dt;
  const mins = state.runTime / 60;
  state.threat = Math.min(THREAT.softCap, 1 + mins * THREAT.perMinute + (state.wave - 1) * THREAT.perRound);
  state.hordeTimer -= dt;
  if (state.hordeTimer <= 0) { state.hordeTimer = THREAT.hordeEvery; spawnHorde(); }
}
function spawnHorde() {
  const n = Math.round(THREAT.hordeBase + (state.runTime / 60) * THREAT.hordePerMin);
  const faction = currentLevel.faction;
  const pool = faction === 'HIVE' ? ['chaser', 'chaser', 'drone', 'ranged', 'flyer']
    : faction === 'UMBRA' ? ['chaser', 'chaser', 'stalker', 'ranged', 'flyer']
      : ['chaser', 'chaser', 'ranged', 'tank', 'flyer'];
  state.hordeCount++;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * .8, r = 28 + rnd() * 9;
    const sp = clearSpawn(player.position.x + Math.cos(a) * r, player.position.z + Math.sin(a) * r, 1.3);
    createEnemy(pool[Math.floor(rnd() * pool.length)], sp.x, sp.z, rnd() < .16, faction);
  }
  announce('INTERFERENCIA // HORDA DIRIGIDA ' + String(state.hordeCount).padStart(2, '0'));
  audio.tone(64, .9, 'sawtooth', .18, 120);
  if (settings.flash) fx.flash('#ff4d38', .16, 240);
  for (let i = 0; i < 3; i++) ringPulse(player.position.clone(), 0xff4d38, 8 + i * 4, .7 + i * .18);
}
// Aspecto por tramo de nivel: más blindaje y detalles cuanto más alto sea el nivel.
const TIER_TRIM = [0xff8a5c, 0xffc24a, 0xff5c7a, 0xc07bff, 0x8dff6b];
function applyTier(g, tier, scale) {
  if (tier < 1) return;
  const c = TIER_TRIM[Math.min(tier - 1, TIER_TRIM.length - 1)];
  const trimMat = emissiveCache(c, .55);   // material compartido por tramo
  // Nivel 2: hombreras.
  if (tier >= 1) for (const xx of [-.44, .44]) rbox(g, [.3, .18, .42], [xx, 1.86, 0], trimMat, .05);
  // Nivel 3: mochila de energía + vértebra luminosa.
  if (tier >= 2) { rbox(g, [.42, .38, .2], [0, 1.5, .32], trimMat, .05); rbox(g, [.1, .5, .08], [0, 1.62, .42], trimMat, .02); }
  // Nivel 4: rodilleras y coderas.
  if (tier >= 3) for (const xx of [-.24, .24]) { rbox(g, [.26, .16, .3], [xx, .72, -.04], trimMat, .03); rbox(g, [.2, .2, .22], [xx, 1.62, -.06], trimMat, .03); }
  // Nivel 5+: cresta y pinchos de amenaza máxima.
  if (tier >= 4) {
    const crest = new THREE.Mesh(new THREE.TorusGeometry(.3, .045, 5, 12), trimMat);
    crest.rotation.x = Math.PI / 2; crest.position.y = 2.28; g.add(crest);
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(.07, .26, 5), trimMat);
      sp.position.set(0, 2.1, .3 + i * .12); sp.rotation.x = -1.1; g.add(sp);
    }
  }
  g.scale.setScalar(g.scale.x); // el tramo no altera la escala de aparición
}
// ------------------------------------------------------------- jefes
// Los jefes NO usan el cuerpo genérico: cada uno tiene su propia silueta, sus
// tres habilidades y dos umbrales de fase. La vida no depende de la ronda
// (ya escala con el propio jefe) para que el combate sea legible.
function bossIndexForRound(wave) {
  return Math.floor((wave - 1) / ROUNDS.bossEvery) % ROUNDS.bossesPerFaction;
}
function createBoss(x, z, faction, kindId) {
  const idx = bossIndexForRound(state.wave);
  const kind = BOSSES.find(b => b.id === kindId) || bossFor(faction, idx);
  const g = buildBossMesh(kind);
  g.position.set(x, 0, z);
  g.scale.setScalar(.05);
  scene.add(g);
  const diff = currentDifficulty();
  const rs = roundScaling(state.wave);
  const hpMod = diff.hp * (hasMod('tank') ? 1.5 : hasMod('glass') ? .6 : 1);
  // Tras completar un mundo, los jefes vuelven más fuertes (modo infinito).
  const cycle = Math.max(0, Math.floor((state.wave - 1) / ROUNDS.perWorld));
  const hp = kind.hp * hpMod * (1 + cycle * .6);
  const baseShield = (faction === 'SYNTEK' ? 260 : 0) + (hasMod('shield') ? hp * .18 : 0);
  const e = {
    group: g, type: 'boss', hp, maxHp: hp, radius: 1.7 * kind.scale * .8, legs: g.userData.legs || [], plates: [],
    dead: false, phase: rnd() * 6, spawn: .8, flash: 0, targetScale: kind.scale, elite: false, faction,
    y: 0, vy: 0, level: rs.level, tier: rs.tier, kind, bossIdx: idx,
    floats: (g.userData.legs || []).length === 0,
    speed: kind.speed * (faction === 'HIVE' ? 1.12 : faction === 'UMBRA' ? .95 : 1) * diff.speed * (hasMod('fast') ? 1.15 : 1) * (state.curse || 1),
    dmgMult: diff.damage * Math.min(2.2, rs.dmg) * (1 + idx * .12) * (hasMod('rage') ? 1.2 : 1),
    chipMult: hasMod('glass') ? 2 : 1, knock: 0, step: rnd() * 6,
    cooldown: 2, armor: 0, armorMax: 0,
    shield: baseShield, shieldMax: baseShield, shieldTimer: 0,
    sprint: 1, burst: 0, charge: 0, dive: 2, healTimer: 2, blink: 4,
    hover: 3.4, orbitCd: 0, slow: 0, touchCd: 0, bossKind: kind.name,
    summon: 5, pulse: 3,
    // estado propio del combate de jefe
    phaseIdx: 0, abilityIdx: rnd() < .5 ? 0 : 1, abilityTimer: 3.2, telegraphT: 0, telegraphId: null,
    casting: 0, chargeGo: 0, invuln: 0,
    // mismos ganchos de destello que los hostiles comunes
    flashMeshes: (() => {
      const list = [];
      g.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.emissive) list.push({ o, base: o.material }); });
      return list;
    })()
  };
  enemies.push(e);
  spawnBurst(new THREE.Vector3(x, 1.2, z), faction === 'HIVE' ? 0xb6ff3d : faction === 'UMBRA' ? 0xb56bff : C.coral, 30, 6);
  Meta.markSeen('bosses', kind.id);
  if (Meta.getCodex().bosses[kind.id] && Meta.getCodex().bosses[kind.id].seen === 1)
    announce('NUEVO REGISTRO // ' + kind.name);
  announce('JEFE: ' + kind.name);
  return e;
}
// Tipos demasiado pequeños (o aéreos) para que su sombra se lea en el suelo.
const NO_SHADOW_TYPES = new Set(['swarmling', 'drone', 'flyer', 'wraith']);
function createEnemy(type, x, z, elite = false, faction = 'SYNTEK', bossKindId) {
  if (type === 'boss') return createBoss(x, z, faction, bossKindId);
  const info = ENEMY_INFO[type] || ENEMY_INFO.chaser;
  const isTank = type === 'tank';
  const scale = (isTank ? 1.32 : type === 'drone' ? .74 : type === 'stalker' ? .95 : 1) * (elite ? 1.22 : 1);
  const rs = roundScaling(state.wave);
  // --- Afijos de élite -----------------------------------------------------
  // Se eligen ANTES de construir el cuerpo para poder teñir la corona con el
  // color del afijo. Un élite lleva uno; a partir de la ronda 8 lleva dos.
  const affixes = [];
  if (elite) {
    const n = state.wave >= 8 || (state.pactElites > 0 && rnd() < .4) ? 2 : 1;
    const pool = AFFIXES.slice();
    for (let i = 0; i < n && pool.length; i++) affixes.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  }
  const affHp = affixes.reduce((a, f) => a * (f.hp || 1), 1);
  const affDmg = affixes.reduce((a, f) => a * (f.dmg || 1), 1);
  const affSpeed = affixes.reduce((a, f) => a * (f.speed || 1), 1);
  // Cuerpo: plantilla horneada por (tipo, facción, tramo). Comparte geometría y
  // materiales con el resto de hostiles iguales, así que un spawn cuesta muy poco.
  const g = buildEnemyModel(type, faction, rs.tier);
  g.position.set(x, 0, z);
  g.scale.setScalar(.05);
  // Los hostiles muy pequeños no proyectan sombra: en el pase de sombras no se
  // distinguen y su coste es el mismo que el de un bruto.
  if (NO_SHADOW_TYPES.has(type)) g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  if (elite) g.add(buildEliteCrown(affixes.map(f => f.color)));
  scene.add(g);
  const diff = currentDifficulty();
  const hpMod = diff.hp * (hasMod('tank') ? 1.5 : hasMod('glass') ? .6 : 1);
  const hp = info.hp * rs.hp * hpMod * (elite ? 2.4 : 1) * affHp * state.threat;
  const baseShield = (faction === 'SYNTEK' ? 28 * rs.hp : 0) + (hasMod('shield') ? hp * .22 : 0);
  const baseArmor = isTank ? hp * .55 : hp * rs.armor;
  const e = {
    group: g, type, hp, maxHp: hp, radius: info.radius * scale, legs: g.userData.legs, arms: g.userData.arms, plates: g.userData.plates, dead: false, phase: rnd() * 6,
    spawn: .55, flash: 0, targetScale: scale, elite, faction, y: 0, vy: 0,
    level: rs.level, tier: rs.tier,
    speed: info.speed * rs.speed * (faction === 'HIVE' ? 1.12 : faction === 'UMBRA' ? .95 : 1) * diff.speed * (hasMod('fast') ? 1.2 : 1) * (state.curse || 1) * (state.enemySpeed || 1) * affSpeed,
    dmgMult: diff.damage * rs.dmg * (hasMod('rage') ? 1.25 : 1) * affDmg,
    chipMult: hasMod('glass') ? 2 : 1, knock: 0, step: rnd() * 6,
    cooldown: 1 + rnd(), armor: baseArmor, armorMax: baseArmor,
    shield: baseShield, shieldMax: baseShield, shieldTimer: 0,
    sprint: 1 + rnd() * 2, burst: 0, charge: 0, dive: 2 + rnd() * 3, healTimer: 2, blink: 3 + rnd() * 3,
    hover: 3.4 + rnd() * 2.6, orbitCd: 0, slow: 0, touchCd: 0, bossKind: null,
    summon: 5, pulse: 3, affixes, affixName: affixes.map(f => f.name).join(' + '),
    // Meshes con material emisivo, para intercambiar a la variante de destello sin
    // recorrer el árbol del hostil en cada frame.
    flashMeshes: (() => {
      const list = [];
      g.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.emissive) list.push({ o, base: o.material }); });
      return list;
    })()
  };
  // Enganche de aparición del afijo (BLINDADO añade placas encima de la vida).
  for (const f of affixes) if (f.onSpawn) f.onSpawn(e, AFFIX_API);
  enemies.push(e);
  if (affixes.length) announce('ÉLITE ' + affixes.map(f => f.name).join(' + ') + ' // ' + (ENEMY_CODEX[type] ? ENEMY_CODEX[type].name : 'HOSTIL'));
  // Primera vez que el jugador ve este hostile: entra en la biblioteca.
  Meta.markSeen('enemies', type + ':' + faction);
  if (Meta.seen('enemies', type + ':' + faction) && Meta.getCodex().enemies[type + ':' + faction].seen === 1)
    announce('NUEVO REGISTRO // ' + (ENEMY_CODEX[type] ? ENEMY_CODEX[type].name : 'HOSTIL'));
  spawnBurst(new THREE.Vector3(x, 1, z), faction === 'HIVE' ? 0xb6ff3d : faction === 'UMBRA' ? 0xb56bff : type === 'ranged' ? C.cyan : C.coral, 14, 4);
  return e;
}

function spawnWave() {
  state.wave++; state.mode = 'playing';
  // MONEDA PARTIDA: cada ronda cobra su peaje en carne.
  if (state.wave > 1 && hasRelic('moneda_partida')) {
    const cut = Math.round(state.maxHp * .08);
    state.maxHp = Math.max(50, state.maxHp - cut);
    state.hp = Math.min(state.hp, state.maxHp);
  }
  const faction = currentLevel.faction;
  const boss = state.wave % ROUNDS.bossEvery === 0;
  const diff = currentDifficulty();
  const rs = roundScaling(state.wave);
  // Los modificadores se ACUMULAN: a más rondas, más reglas activas a la vez.
  const mods = [];
  const addMod = () => {
    for (let t = 0; t < 6; t++) { const m = pick(MODIFIERS); if (!mods.some(x => x.id === m.id)) { mods.push(m); return; } }
  };
  if (!boss && state.wave >= ROUNDS.modifierFrom && rnd() < .55) addMod();
  if (!boss && state.wave >= ROUNDS.secondModifierFrom && rnd() < .7) addMod();
  if (!boss && state.wave >= ROUNDS.thirdModifierFrom) addMod();
  state.modifiers = mods;
  state.modifier = mods[0] || null;
  state.roundScoreMult = diff.reward * mods.reduce((a, m) => a * m.score, 1) * (state.curseMult || 1);
  // El multiplicador de build (módulos, resonancias y pactos) se conserva entre rondas:
  // la ronda solo fija su propia parte y el build multiplica por encima.
  state.scoreMult = state.roundScoreMult * (state.buildScore || 1);
  // Objetivo de la ronda + desbloqueo de ranuras de cuerpo a cuerpo y utilidad.
  const objDef = rollObjective(state.wave);
  checkSlotUnlocks();
  if (state.utilityCharges <= 0 && state.utilityCd <= 0) { state.utilityCharges = utilityInfo().charges; syncUtilityHUD(); }
  // Cantidad: crece por ronda hasta el techo, y el jefe trae escolta.
  const count = boss
    ? Math.min(6 + Math.floor(state.wave / 2), 16)
    : Math.min(Math.round(ROUNDS.countBase + (state.wave - 1) * ROUNDS.countPerRound), ROUNDS.countMax);
  if (boss) {
    const kind = bossFor(faction, bossIndexForRound(state.wave));
    const sp = clearSpawn(0, -24, 2.4);
    createEnemy('boss', sp.x, sp.z, false, faction, kind.id);
    $('boss-wrap').classList.remove('hidden');
    $('boss-name').textContent = kind.name + ' // ' + kind.title + ' // NVL ' + rs.level;
    announce('JEFE DE SECTOR // ' + kind.name);
  } else $('boss-wrap').classList.add('hidden');
  const elites = state.wave >= ROUNDS.eliteFrom
    ? Math.min(1 + Math.floor((state.wave - ROUNDS.eliteFrom) / ROUNDS.eliteEvery) + (rs.tier > 0 ? rs.tier : 0), 10) * (hasMod('elite') ? 2 : 1)
    : 0;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rnd() * .5, r = 26 + rnd() * 14;
    const x = clamp(Math.cos(a) * r, -ARENA + 6, ARENA - 6), z = clamp(Math.sin(a) * r, -ARENA + 6, ARENA - 6);
    let type = 'chaser';
    if (faction === 'HIVE') type = i % 4 === 0 ? 'drone' : i % 3 === 0 ? 'ranged' : 'chaser';
    else if (faction === 'UMBRA') type = i % 3 === 0 ? 'ranged' : i % 5 === 0 ? 'stalker' : 'chaser';
    else type = i % 3 === 0 ? 'ranged' : i % 7 === 0 ? 'support' : 'chaser';
    if (state.wave > 1 && i % 5 === 0) type = 'tank';
    if (state.wave > 2 && i % 4 === 0) type = 'flyer';
    if (state.wave > 3 && i % 9 === 0) type = 'stalker';
    // ---- segunda hornada: entran progresivamente y por facción ------------
    // Cada facción tiene su propia especialidad: SYNTEK ancla centinelas,
    // HIVE inunda con cría y UMBRA manda espectros.
    if (state.wave > 2 && i % 11 === 0) type = faction === 'SYNTEK' ? 'turret' : faction === 'HIVE' ? 'swarmling' : 'wraith';
    if (state.wave > 4 && i % 8 === 0) type = faction === 'PYRE' ? 'sapper' : 'sapper';
    if (state.wave > 6 && i % 13 === 0) type = 'brute';
    if (state.wave > 7 && i % 6 === 0 && faction === 'HIVE') type = 'swarmling';
    if (state.wave > 8 && i % 10 === 0 && faction === 'UMBRA') type = 'wraith';
    // En rondas altas entran los tipos pesados con mucha más frecuencia.
    if (state.wave >= 9 && i % 3 === 0) type = i % 6 === 0 ? 'tank' : 'flyer';
    if (state.wave >= 12 && i % 7 === 0) type = 'brute';
    if (hasMod('swarm') && i % 2 === 0) type = i % 4 === 0 ? 'flyer' : 'stalker';
    const sp = clearSpawn(x, z, 1.2);
    createEnemy(type, sp.x, sp.z, i < elites && !boss, faction);
  }
  state.pending = boss ? 4 : Math.min(2 + state.wave, 8);
  // Objetivo de extracción: tres cajas de datos marcadas en dorado.
  if (state.obj && state.obj.id === 'collect' && state.obj.need > 0) {
    for (let i = 0; i < state.obj.need; i++) {
      const a = (i / state.obj.need) * Math.PI * 2, r = 12 + rnd() * 20;
      const sp = clearSpawn(Math.cos(a) * r, Math.sin(a) * r, 1.4);
      const g = new THREE.Group(); g.position.set(sp.x, 1.1, sp.z);
      box(g, [.5, .5, .5], [0, 0, 0], new THREE.MeshStandardMaterial({ color: 0x2b2416, emissive: 0xffd34d, emissiveIntensity: 1.1, roughness: .3, metalness: .85 }));
      const halo = new THREE.Mesh(new THREE.RingGeometry(.7, .85, 20), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: .6, side: THREE.DoubleSide }));
      halo.rotation.x = -Math.PI / 2; g.add(halo);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(.3, .34, 18, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: .1, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.y = 9; g.add(beam);
      scene.add(g);
      lootBoxes.push({ group: g, cage: halo, halo, halo2: halo, beam, light: null, phase: rnd() * 6, base: g.position.y, objCache: true });
    }
    announce('EXTRACCIÓN // RECOGE ' + state.obj.need + ' CAJAS DE DATOS');
  }
  showModifier();
  $('wave').textContent = String(state.wave).padStart(2, '0');
  $('sector-label').textContent = currentLevel.name;
  const tierEl = $('round-tier');
  if (tierEl) {
    const inWorld = ((state.wave - 1) % ROUNDS.perWorld) + 1;
    tierEl.textContent = 'NVL ' + String(rs.level).padStart(2, '0') + ' // ' + roundLabel(state.wave)
      + ' // RONDA ' + String(inWorld).padStart(2, '0') + '/' + ROUNDS.perWorld;
    tierEl.className = 't' + Math.min(5, Math.max(1, rs.tier + 1));
  }
  const banner = $('wave-banner');
  banner.querySelector('small').textContent = boss ? 'JEFE DE SECTOR' : 'RONDA ' + String(state.wave).padStart(2, '0');
  banner.querySelector('b').textContent = boss ? currentLevel.boss : 'OLEADA ' + String(state.wave).padStart(2, '0');
  banner.querySelector('span').textContent = boss
    ? 'NIVEL ' + rs.level + ' // UNIDAD DE EXTERMINIO'
    : 'NIVEL ' + rs.level + ' // ' + roundLabel(state.wave)
      + (mods.length ? ' // ' + mods.map(m => m.name).join(' + ') : '')
      + ' // OBJETIVO: ' + objDef.name.toUpperCase();
  banner.classList.add('show'); setTimeout(() => banner.classList.remove('show'), 2300);
  music.setIntensity(Math.min(1, state.wave / 12));
  hudDirty = true;
  updateHUD();
}
// Cartel lateral con los modificadores activos de la ronda (se acumulan).
function showModifier() {
  const el = $('modifier-banner'); if (!el) return;
  const mods = state.modifiers || [];
  if (!mods.length) { el.classList.remove('show'); return; }
  el.style.setProperty('--mod', mods[0].color);
  const total = mods.reduce((a, m) => a * m.score, 1);
  el.innerHTML = `<div class="mod-chip" style="color:#8b9694"><b>${mods.length > 1 ? 'MODIFICADORES ×' + mods.length : 'MODIFICADOR'}</b></div>` +
    mods.map(m => `<div class="mod-chip" style="color:${m.color}"><b>${m.name}</b><small>${m.desc} · PUNTOS ×${m.score}</small></div>`).join('') +
    (mods.length > 1 ? `<div class="mod-chip" style="color:#ffbf47"><b>TOTAL</b><small>Multiplicador combinado ×${total.toFixed(2)}</small></div>` : '');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 5200);
}

// ---------------------------------------------------------------- efectos
// Los materiales compartidos no se pueden liberar: viven en varios objetos a la vez.
const SHARED_MATERIALS = new Set([solid, black, coral, cyan, acid, violet, white, arenaFloor, arenaRingMat, arenaCircleMat, platformMat, perimeterMat, arenaAccentA, arenaAccentB]);
function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse(o => {
    // Las geometrías marcadas como compartidas las reutilizan varios props.
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if (!SHARED_MATERIALS.has(m)) m.dispose();
    }
  });
}
// Toda la capa visual pasa por el pool instanciado: cero mallas nuevas por frame.
function spawnBurst(pos, color, count = 8, power = 3) { vfx.burst(pos, color, count, power); }
function tracer(from, to, color = C.cyan, life = .07) { vfx.tracer(from, to, color, life); }
function jaggedTracer(from, to, color) { vfx.arc(from, to, color, 1, .9); }
function ringPulse(pos, color, radius, life = .5) { vfx.ring(pos, color, radius, life); }
function crystalShell(pos, radius, color, life = .6) { vfx.shell(pos, radius, color, life); }
function shardRing(pos, color, radius, count = 14, up = 5) { vfx.shards(pos, color, radius, count, up); }
function motes(pos, color, count = 12, radius = 2.4, rise = 1.8) { vfx.glowMotes(pos, color, count, radius, rise); }
function groundMark(pos, color, radius, life = 1.4, opacity = .45) { vfx.mark(pos, color, radius, life, opacity); }
function impactCore(pos, color, radius = 1.5, life = .24) {
  vfx.core(pos, color, radius, life);
  vfx.flash(pos, color, 55, radius * 6, life * .8);
}
// Arco eléctrico con ramificaciones.
function forkedArc(from, to, color, forks = 3) {
  vfx.arc(from, to, color, forks);
  vfx.arc(from, to, 0xffffff, 0, .7);
  impactCore(to.clone(), color, .9, .2);
}
function muzzleFlash(color = 0xffffff) {
  const p = new THREE.Vector3(); player.userData.muzzle.getWorldPosition(p);
  // Destello 3D discreto: el protagonismo visual lo llevan los sprites Kenney
  // con AdditiveBlending del pool de partículas.
  vfx.flash(p, color, 8, 2.4, .04);
}
// Onda que recorre el suelo en anillos concéntricos: se usa en detonaciones
// grandes, señuelos espectrales y aterrizajes de jefe.
function gridRipple(pos, color = 0x6ef7e7, rings = 3) {
  for (let i = 0; i < rings; i++) ringPulse(new THREE.Vector3(pos.x, (state.py || 0) + .06, pos.z), color, 2.2 + i * 2.4, .5 + i * .12);
}
// ¿Esta habilidad ya evolucionó en esta incursión?
function hasEvo(base) { return !!state.evolutions[base]; }
// Al saturar una habilidad se transforma: cambia el comportamiento, no el número.
function checkAbilityEvolution(id) {
  const a = ABILITIES.find(x => x.id === id);
  if (!a || abilityLevel(id) < a.max || state.evolutions[id]) return false;
  const evo = abilityEvolution(id);
  if (!evo) return false;
  state.evolutions[id] = true;
  announce('EVOLUCIÓN // ' + evo.name);
  audio.tone(180, .85, 'sawtooth', .18, 1200);
  setTimeout(() => audio.tone(640, .5, 'square', .12, 500), 160);
  if (player) {
    const col = hexToInt(evo.color), at = player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    crystalShell(at, 3.2, col, 1.1);
    ringPulse(player.position.clone(), col, 6.2, .9);
    shardRing(player.position.clone(), col, 3, 20, 6);
    impactCore(at, col, 2.4, .3);
    gridRipple(player.position, col, 3);
  }
  if (typeof cine !== 'undefined' && cine) cine.kick(.3);
  if (id === 'orbit') syncOrbit();
  if (id === 'swarm') spawnCompanion(true);
  if (id === 'spiral') castSpiral();
  if (id === 'regen') { state.maxShield += 40; state.shield = state.maxShield; }
  hudDirty = true;
  return true;
}
function announce(text) {
  $('announcement').textContent = text;
  setTimeout(() => { if ($('announcement').textContent === text) $('announcement').textContent = ''; }, 1700);
}
function addFeed(action, points) {
  const d = document.createElement('div'); d.className = 'feed'; d.innerHTML = `${action} <b>+${points}</b>`;
  $('killfeed').prepend(d); setTimeout(() => d.remove(), 3000);
}

// =====================================================================
// HABILIDADES DE CONTROL, ÁREA Y EJECUCIÓN
// Cadena de plasma, pozo gravitatorio, lluvia orbital y el sistema de
// ejecuciones (hostil malherido -> remate con marca visible).
// =====================================================================
const vortices = [];
const delayedBlasts = [];
const echoShots = [];

function nearestEnemy(pos, maxDist = 34, exclude) {
  let best = null, bd = maxDist;
  for (const e of enemies) {
    if (e.dead || e.spawn > 0 || (exclude && exclude.has(e))) continue;
    const d = e.group.position.distanceTo(pos);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// CADENA DE PLASMA: salta de hostil en hostil perdiendo fuerza en cada salto.
function castChain() {
  const lvl = abilityLevel('chain');
  let cur = nearestEnemy(player.position);
  if (!cur) return;
  const jumps = 3 + lvl;
  let dmg = 45 + 28 * lvl;
  const hit = new Set();
  let from = player.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  for (let i = 0; i < jumps && cur; i++) {
    hit.add(cur);
    const at = cur.group.position.clone().add(new THREE.Vector3(0, 1.35 * cur.group.scale.y, 0));
    forkedArc(from, at, 0x9ff7ff, 3);
    impactCore(at, 0x9ff7ff, .85, .15);
    damageEnemy(cur, dmg, false);
    dmg *= .88;
    from = at;
    cur = nearestEnemy(at, 11, hit);
  }
  audio.tone(760, .16, 'square', .1, 520);
}

// POZO GRAVITATORIO: vórtice que arrastra y luego implosiona.
function castSingularity() {
  const lvl = abilityLevel('singularity');
  let best = null, bestScore = -1;
  for (const e of enemies) {
    if (e.dead || e.spawn > 0) continue;
    let n = 0;
    for (const o of enemies) {
      if (o.dead || o.spawn > 0) continue;
      if (o.group.position.distanceToSquared(e.group.position) < 81) n++;
    }
    if (n > bestScore) { bestScore = n; best = e; }
  }
  if (!best) return;
  const pos = best.group.position.clone().add(new THREE.Vector3(0, 1.1, 0));
  const g = new THREE.Group(); g.position.copy(pos); scene.add(g);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.55, 1), new THREE.MeshBasicMaterial({ color: 0x0b0316 }));
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), new THREE.MeshBasicMaterial({ color: 0xb56bff, wireframe: true, transparent: true, opacity: .55 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, .05, 6, 28), new THREE.MeshBasicMaterial({ color: 0xd9b6ff, transparent: true, opacity: .7 }));
  ring.rotation.x = Math.PI / 2;
  g.add(core, shell, ring);
  vortices.push({ g, shell, ring, pos, t: 1.25, life: 1.25, radius: 5 + lvl, dmg: 110 + 60 * lvl });
  audio.tone(90, .8, 'sawtooth', .16, -40);
  ringPulse(pos, 0xb56bff, 6, .6);
}
function updateVortices(dt) {
  for (let i = vortices.length - 1; i >= 0; i--) {
    const v = vortices[i];
    v.t -= dt;
    v.g.rotation.y += dt * 3.4; v.g.rotation.x += dt * 1.6;
    v.ring.rotation.z += dt * 2.2;
    v.shell.scale.setScalar(1 + Math.sin((v.life - v.t) * 9) * .12);
    for (const e of enemies) {
      if (e.dead || e.spawn > 0) continue;
      const d = e.group.position.distanceTo(v.pos);
      if (d > v.radius || d < .9) continue;
      const pull = (1 - d / v.radius) * 17 * dt;
      const dir = v.pos.clone().sub(e.group.position).setY(0).normalize();
      e.group.position.addScaledVector(dir, pull);
    }
    if (v.t <= 0) {
      explode(v.pos.clone(), v.radius * 1.25, v.dmg, 0xb56bff);
      crystalShell(v.pos.clone(), v.radius, 0xb56bff, .55);
      shardRing(v.pos.clone(), 0xd9b6ff, v.radius * .8, 20, 7);
      scene.remove(v.g); disposeObject3D(v.g);
      vortices.splice(i, 1);
    }
  }
}

// LLUVIA ORBITAL: marca el suelo y pulveriza desde arriba con retardo legible.
function castRain() {
  const lvl = abilityLevel('rain');
  const n = 1 + lvl;
  for (let i = 0; i < n; i++) {
    let base = null;
    if (i === 0) { const t = nearestEnemy(player.position, 30); if (t) base = t.group.position; }
    if (!base) {
      const pool = enemies.filter(e => !e.dead && e.spawn <= 0);
      base = pool.length ? pool[Math.floor(rnd() * pool.length)].group.position
        : player.position.clone().add(new THREE.Vector3((rnd() - .5) * 16, 0, (rnd() - .5) * 16));
    }
    const pos = new THREE.Vector3(base.x, 0, base.z);
    groundMark(pos.clone(), 0xffbf47, 3.5, .9, .55);
    ringPulse(pos.clone(), 0xffbf47, 3.5, .5);
    delayedBlasts.push({ pos, t: .55 + i * .14, radius: 3.5, dmg: 120 + 70 * lvl, color: 0xffbf47 });
  }
  audio.tone(420, .3, 'sine', .1, 700);
}
// Resuelve los disparos fantasma del ECO DE COMBATE.
function updateEchoes(dt) {
  for (let i = echoShots.length - 1; i >= 0; i--) {
    const sh = echoShots[i];
    sh.t -= dt;
    if (sh.t > 0) continue;
    echoShots.splice(i, 1);
    tracer(sh.from, sh.to, sh.color, .085);
    impactCore(sh.to, sh.color, .85, .14);
    if (rnd() < .5) crystalShell(sh.from, .9, sh.color, .22);
    for (const tg of sh.targets) if (tg.e && !tg.e.dead) damageEnemy(tg.e, sh.dmg, tg.head);
  }
}
function updateDelayedBlasts(dt) {
  for (let i = delayedBlasts.length - 1; i >= 0; i--) {
    const b = delayedBlasts[i];
    b.t -= dt;
    if (b.t > 0) continue;
    const at = b.pos.clone().setY(1);
    vfx.column(at, b.color, .55, .35, .55);
    impactCore(at, 0xffffff, 1.7, .2);
    explode(at, b.radius, b.dmg, b.color);
    state.shake = Math.max(state.shake, .35);
    delayedBlasts.splice(i, 1);
  }
}

// --- EJECUCIONES --------------------------------------------------------
// Un hostil por debajo del umbral queda marcado con un rombo rojo. Un tiro a la
// cabeza o un golpe cuerpo a cuerpo lo remata al instante (jefes exceptuados).
let execMarker = null;
function ensureExecMarker() {
  if (execMarker) return execMarker;
  const g = new THREE.Group();
  const dia = new THREE.Mesh(new THREE.OctahedronGeometry(.2, 0), new THREE.MeshBasicMaterial({ color: 0xff4d38, transparent: true, opacity: .95 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.32, .028, 6, 16), new THREE.MeshBasicMaterial({ color: 0xffbf47, transparent: true, opacity: .7 }));
  ring.rotation.x = Math.PI / 2;
  g.add(dia, ring); g.visible = false;
  scene.add(g);
  execMarker = g;
  return g;
}
function executeThreshold() {
  // LA HOJA DEL VERDUGO sube el umbral de remate al 30% de golpe.
  if (state.relics && state.relics.includes('segadora')) return .30;
  return .10 + .06 * abilityLevel('harvest');
}
function updateExecuteMarker(dt) {
  const m = ensureExecMarker();
  if (state.mode !== 'playing') { m.visible = false; state.execTarget = null; return; }
  const thr = executeThreshold();
  let best = null, bd = 42;
  for (const e of enemies) {
    if (e.dead || e.spawn > 0 || e.type === 'boss') continue;
    if (e.hp / e.maxHp > thr) continue;
    const d = e.group.position.distanceTo(player.position);
    if (d < bd) { bd = d; best = e; }
  }
  state.execTarget = best;
  if (!best) { m.visible = false; return; }
  m.visible = true;
  m.position.copy(best.group.position).add(new THREE.Vector3(0, 2.6 * best.group.scale.y + .45, 0));
  m.rotation.y += dt * 4.2;
  m.scale.setScalar(1 + Math.sin(state.time * 8) * .16);
}
function executeEnemy(e, reason) {
  if (e.dead) return;
  const at = e.group.position.clone().add(new THREE.Vector3(0, 1.3, 0));
  impactCore(at, 0xff4d38, 2.4, .22);
  shardRing(e.group.position.clone(), 0xff4d38, 2.6, 18, 6);
  ringPulse(e.group.position.clone(), 0xffbf47, 3.2, .35);
  crystalShell(at, 2, 0xffbf47, .4);
  state.chips += 9 * state.chipMult;
  state.frenzy = Math.min(100, state.frenzy + 12);
  state.score += Math.round(220 * state.scoreMult);
  addFeed('EJECUCIÓN' + (reason ? ' // ' + reason : ''), 300);
  audio.tone(1180, .12, 'square', .12, -520);
  if (settings.flash) fx.flash('#ff4d38', .1, 90);
  e.hp = 0;
  // Marca el remate: CORAZA VIVA lo usa para recargar el escudo al instante.
  e.lastHitBy = 'execute';
  killEnemy(e, true);
}

// ---------------------------------------------------------------- botín
function spawnLootBox(pos) {
  const g = new THREE.Group(); g.position.copy(pos).setY(Math.max(1.3, (pos.y || 0) + 1.3));
  box(g, [.72, .72, .72], [0, 0, 0], new THREE.MeshStandardMaterial({ color: 0x1b2b2f, emissive: C.coral, emissiveIntensity: 1.2, roughness: .3, metalness: .85 }));
  const cage = new THREE.Mesh(new THREE.BoxGeometry(.92, .92, .92), new THREE.MeshBasicMaterial({ color: C.coral, wireframe: true })); g.add(cage);
  // Columna de luz visible desde cualquier punto del sector.
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.46, .5, 30, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: C.coral, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 15; g.add(beam);
  const halo = new THREE.Mesh(new THREE.RingGeometry(.95, 1.15, 24), new THREE.MeshBasicMaterial({ color: C.coral, transparent: true, opacity: .55, side: THREE.DoubleSide }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = -.55; g.add(halo);
  const halo2 = new THREE.Mesh(new THREE.RingGeometry(.55, .62, 20), new THREE.MeshBasicMaterial({ color: 0xffbf47, transparent: true, opacity: .4, side: THREE.DoubleSide }));
  halo2.rotation.x = -Math.PI / 2; halo2.position.y = -.55; g.add(halo2);
  const light = new THREE.PointLight(C.coral, 26, 13); g.add(light);
  scene.add(g);
  lootBoxes.push({ group: g, cage, halo, halo2, beam, light, phase: rnd() * 6, base: g.position.y });
  announce('BOTÍN ESPECIAL // RECOGE LA CAJA');
  spawnBurst(g.position.clone(), C.coral, 34, 7);
  ringPulse(g.position.clone(), C.coral, 5.5, .75);
  fx.flash('#ff4d38', .22, 220);
  audio.tone(520, .5, 'square', .12, 600); audio.tone(180, .6, 'sawtooth', .12, 220);
}
function updateLoot(dt) {
  for (let i = lootBoxes.length - 1; i >= 0; i--) {
    const b = lootBoxes[i]; b.phase += dt;
    b.group.rotation.y += dt * 1.7; b.cage.rotation.x += dt * 1.1; b.cage.rotation.y -= dt * .8;
    b.group.position.y = b.base + Math.sin(b.phase * 2.6) * .12;
    b.halo.scale.setScalar(1 + Math.sin(b.phase * 4) * .16);
    b.halo2.rotation.z += dt * 2.2; b.halo2.scale.setScalar(1 + Math.cos(b.phase * 3) * .22);
    b.beam.material.opacity = .09 + Math.sin(b.phase * 3.4) * .045;
    if (b.light) b.light.intensity = 20 + Math.sin(b.phase * 5) * 8;
    // BOBINA IMANTADORA: el botín viene hacia ti sin que tengas que perseguirlo.
    if (hasRelic('imantadora') && state.mode === 'playing' && !b.objCache) {
      const to = player.position.clone().sub(b.group.position).setY(0);
      const dd = to.length();
      if (dd > 1 && dd < 40) {
        b.group.position.addScaledVector(to.normalize(), Math.min(dd, 9 * dt));
        b.base = Math.max(.8, groundAt(b.group.position.x, b.group.position.z, b.base, 2));
      }
    }
    const d = b.group.position.distanceTo(player.position);
    // IMÁN DE DATOS: el radio de recogida crece con el nivel de la habilidad.
    const mLvl = abilityLevel('magnet');
    const reach = 3 + (mLvl > 0 ? 6 + 4 * mLvl : 0);
    if (state.mode === 'playing' && d < reach) {
      if (b.objCache) {
        // Caja de datos del objetivo de extracción: no suelta arma especial.
        state.obj.have++;
        state.chips += 30 + state.wave * 4;
        addFeed('DATOS EXTRAÍDOS ' + state.obj.have + '/' + state.obj.need, 120);
        spawnBurst(b.group.position.clone(), 0xffd34d, 22, 5);
        ringPulse(b.group.position.clone(), 0xffd34d, 4, .5);
        audio.coin();
        if (state.obj.have >= state.obj.need) announce('EXTRACCIÓN COMPLETA');
      } else {
        spawnBurst(b.group.position.clone(), C.coral, 30, 6);
        ringPulse(b.group.position.clone(), 0xffbf47, 5, .5);
        fx.flash(settings.flash ? '#ffbf47' : 'transparent', settings.flash ? .3 : 0, 200);
        rollLoot();
      }
      scene.remove(b.group); disposeObject3D(b.group); lootBoxes.splice(i, 1);
    }
  }
  updateWaypoint();
}
// Flecha guía hacia la caja de botín más cercana.
function updateWaypoint() {
  const el = $('waypoint'); if (!el) return;
  if (!lootBoxes.length || state.mode !== 'playing') { el.classList.remove('show'); return; }
  let best = lootBoxes[0], bd = Infinity;
  for (const b of lootBoxes) { const d = b.group.position.distanceTo(player.position); if (d < bd) { bd = d; best = b; } }
  const local = best.group.position.clone().add(new THREE.Vector3(0, 1.6, 0));
  const proj = local.clone().project(camera);
  const behind = proj.z > 1;
  if (behind) { proj.x *= -1; proj.y *= -1; }
  const x = (proj.x * .5 + .5) * innerWidth, y = (-proj.y * .5 + .5) * innerHeight;
  el.classList.add('show');
  el.style.transform = `translate(-50%,-50%) translate(${clamp(x, 60, innerWidth - 60)}px,${clamp(y, 90, innerHeight - 140)}px) rotate(${behind ? 180 : 0}deg)`;
  el.querySelector('span').textContent = Math.round(bd) + ' M';
}
function rollLoot() {
  const pool = [];
  // Sin botín de armas: el arma única es fija por héroe. El botín solo reparte
  // habilidades (sistema intacto) y mejoras de estadísticas.
  for (const a of ABILITIES) if ((state.abilities[a.id] || 0) < a.max) pool.push({ kind: 'ability', data: a, weight: 3 });
  for (const b of BOOSTS) if ((lootLevels[b.id] || 0) < b.max) pool.push({ kind: 'boost', data: b, weight: 2 });
  if (!pool.length) { state.score += 500; state.chips += 120; addFeed('BOTÍN DUPLICADO', 500); return; }
  const total = pool.reduce((n, x) => n + x.weight, 0);
  let roll = rnd() * total, chosen = pool[0];
  for (const p of pool) { roll -= p.weight; if (roll <= 0) { chosen = p; break; } }
  showLootReveal(chosen);
}
function showLootReveal(item) {
  state.mode = 'loot'; mouseDown = false; document.exitPointerLock?.();
  pendingItem = item;
  const d = item.data;
  const isAbility = item.kind === 'ability';
  $('loot-icon').textContent = d.icon;
  $('loot-icon').style.setProperty('--rarity', uiGem(d.color));
  $('loot-kind').textContent = isAbility ? 'HABILIDAD ESPECIAL' : 'MEJORA';
  $('loot-name').textContent = d.name;
  $('loot-sub').textContent = d.trigger || 'INSTANTÁNEO';
  const level = isAbility ? (state.abilities[d.id] || 0) : 0;
  $('loot-desc').textContent = isAbility ? d.desc(level) : (d.desc ? d.desc(level) : d.how);
  $('loot-how').textContent = d.how || '';
  const synBox = $('loot-synergy');
  const syn = isAbility ? synergyCompletedBy(d.id) : null;
  if (syn) {
    synBox.classList.remove('hidden');
    synBox.style.setProperty('--syn', uiGem(syn.color));
    $('loot-synergy-name').textContent = syn.name;
    $('loot-synergy-desc').textContent = syn.desc;
  } else synBox.classList.add('hidden');
  $('loot').classList.add('active');
  audio.tone(520, .35, 'square', .14, 420); audio.tone(300, .5, 'sawtooth', .12, 180);
  if (syn) { fx.flash(syn.color, .3, 260); audio.tone(880, .5, 'square', .1, 700); }
}
let pendingItem = null;
function equipLoot() {
  const item = pendingItem; if (!item) return;
  const d = item.data;
  if (item.kind === 'ability') {
    state.abilities[d.id] = (state.abilities[d.id] || 0) + 1;
    state.timers[d.id] = 0;
    Meta.markSeen('abilities', d.id);
    if (d.id === 'swarm') spawnCompanion(true);
    if (d.id === 'orbit') syncOrbit();
    if (d.id === 'regen' && state.maxShield === 0) { state.maxShield = 40; state.shield = 40; }
    checkAbilityEvolution(d.id);
  } else {
    lootLevels[d.id] = (lootLevels[d.id] || 0) + 1;
    d.apply(state);
    syncAmmo(false);
  }
  // Sinergia nueva: se anota en el códice la primera vez que se forma.
  for (const s of activeSynergies()) Meta.markSeen('synergies', s.id);
  pendingItem = null;
  $('loot').classList.remove('active');
  state.mode = 'playing'; clock.getDelta(); lockPointer();
  addFeed('EQUIPADO: ' + d.name, 250); updateHUD(); hudDirty = true;
}

// ---------------------------------------------------------------- habilidades
function abilityLevel(id) { return state.abilities[id] || 0; }
// Sinergias: se activan al reunir las dos habilidades que pide la combinación.
function hasSynergy(id) { const s = SYNERGIES.find(x => x.id === id); return !!s && s.req.every(r => abilityLevel(r) > 0); }
function activeSynergies() { return SYNERGIES.filter(s => s.req.every(r => abilityLevel(r) > 0)); }
function synergyCompletedBy(id) { return SYNERGIES.find(s => s.req.includes(id) && s.req.every(r => r === id || abilityLevel(r) > 0)); }
// Una cuchilla orbital ya no es un rectángulo: tiene hoja biselada, punta, guarda,
// empuñadura, pomo y filos emisivos, y deja estela al girar.
function makeOrbitBlade() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x3b4a4d, roughness: .22, metalness: .96 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x0e3a37, emissive: C.cyan, emissiveIntensity: 2.7, roughness: .35, metalness: .5 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(.72, .045, .13), steel); g.add(blade);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(.72, .075, .035), steel); g.add(spine);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.08, .28, 4), steel); tip.rotation.z = -Math.PI / 2; tip.position.x = .5; g.add(tip);
  for (const yy of [.03, -.03]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(.64, .014, .028), edge);
    f.position.set(.02, yy, 0); g.add(f);
  }
  const guard = new THREE.Mesh(new THREE.BoxGeometry(.06, .21, .05), steel); guard.position.x = -.3; g.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.028, .036, .2, 6), steel); grip.rotation.z = Math.PI / 2; grip.position.x = -.42; g.add(grip);
  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(.058), edge); pommel.position.x = -.55; g.add(pommel);
  g.userData.edge = edge; g.userData.steel = steel;
  return g;
}
function syncOrbit() {
  for (const b of orbitBlades) { scene.remove(b); disposeObject3D(b); }
  orbitBlades = [];
  if (orbitRing) { scene.remove(orbitRing); disposeObject3D(orbitRing); orbitRing = null; }
  const n = abilityLevel('orbit');
  // La luz orbital es permanente (intensidad 0 si no hay cuchillas): así el
  // recuento de luces de la escena nunca cambia y three.js no recompila materiales.
  if (!orbitLight) { orbitLight = new THREE.PointLight(C.cyan, 0, 9, 2); scene.add(orbitLight); }
  orbitLight.intensity = 0;
  if (!n) return;
  for (let i = 0; i < n + 1; i++) {
    const g = makeOrbitBlade(); g.rotation.order = 'YXZ'; scene.add(g); orbitBlades.push(g);
  }
  // Anillo portador: hace legible la trayectoria de las cuchillas.
  orbitRing = new THREE.Mesh(new THREE.TorusGeometry(1, .012, 4, 60),
    new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: .18 }));
  orbitRing.rotation.x = Math.PI / 2; scene.add(orbitRing);
  orbitLight.intensity = 9;
}
let orbitRing = null, orbitLight = null;
function updateOrbit(dt) {
  const n = orbitBlades.length; if (!n) return;
  const lvl = abilityLevel('orbit');
  const glacial = hasSynergy('glacial'), vortex = hasSynergy('vortex');
  const r = 2.3 + lvl * .12 + (vortex ? .9 : 0);
  const dmg = (16 + 9 * lvl) * (glacial ? 1.3 : 1);
  const tint = glacial ? 0x8fdfff : C.cyan;
  if (orbitRing) {
    orbitRing.position.set(player.position.x, state.py + 1.35, player.position.z);
    orbitRing.scale.setScalar(r);
    orbitRing.material.color.setHex(tint);
    orbitRing.material.opacity = .14 + Math.sin(state.time * 3) * .04;
  }
  if (orbitLight) { orbitLight.color.setHex(tint); orbitLight.position.set(player.position.x, state.py + 1.5, player.position.z); }
  orbitTrailTimer -= dt;
  for (let i = 0; i < n; i++) {
    const a = state.time * (vortex ? 4.4 : 3.1) + (i / n) * Math.PI * 2;
    const m = orbitBlades[i];
    m.position.set(player.position.x + Math.cos(a) * r, state.py + 1.35 + Math.sin(state.time * 2 + i) * .12, player.position.z + Math.sin(a) * r);
    // Orientación: la hoja apunta en el sentido de giro y se inclina como un sable.
    m.rotation.set(.34, -a, .22);
    if (m.userData.edge.emissive.getHex() !== tint) m.userData.edge.emissive.setHex(tint);
    if (orbitTrailTimer <= 0) {
      // Estela de la cuchilla: una chispa del pool, no una malla nueva.
      vfx.burst(m.position, tint, 2, .6);
    }
    for (const e of enemies) {
      if (e.dead || e.spawn > 0) continue;
      const d = Math.hypot(e.group.position.x - m.position.x, e.group.position.z - m.position.z);
      if (d < e.radius + .55 && Math.abs((e.group.position.y + 1.2) - m.position.y) < 1.6) {
        if (e.orbitCd > 0) continue;
        e.orbitCd = .38;
        damageEnemy(e, dmg, false);
        if (glacial) { e.slow = Math.max(e.slow, 1.6); e.slowFactor = .5; }
        spawnBurst(m.position.clone(), tint, 5, 2.6);
        impactCore(m.position.clone(), tint, .5, .16);
      }
    }
  }
  if (orbitTrailTimer <= 0) orbitTrailTimer = .055;
}
let orbitTrailTimer = 0;
function castTesla() {
  const lvl = abilityLevel('tesla');
  let best = null, bd = 26;
  for (const e of enemies) { if (e.dead || e.spawn > 0) continue; const d = e.group.position.distanceTo(player.position); if (d < bd) { bd = d; best = e; } }
  if (!best) return;
  const dmg = 60 + 35 * lvl;
  const storm = hasSynergy('storm');
  // Descarga con cuerpo: arco principal, ramificaciones, chispas y marca en el suelo.
  let from = best.group.position.clone().add(new THREE.Vector3(0, 3.4, 0));
  const hitPoint = best.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  const arcColor = storm ? 0x9ff7ff : C.cyan;
  forkedArc(from.clone(), hitPoint, arcColor, storm ? 5 : 3);
  spawnBurst(hitPoint.clone(), arcColor, 14, 4.5);
  spawnBurst(hitPoint.clone(), 0xffffff, 6, 3.2);
  groundMark(best.group.position.clone(), arcColor, 2.6, .9, .35);
  crystalShell(hitPoint.clone(), 1.4, arcColor, .34);
  state.shake = Math.max(state.shake, .12);
  damageEnemy(best, dmg, false);
  let chained = 0, last = best;
  const maxChain = 2 + lvl;
  const used = new Set([best]);
  while (chained < maxChain) {
    let next = null, nd = 9;
    for (const e of enemies) {
      if (e.dead || e.spawn > 0 || used.has(e)) continue;
      const d = e.group.position.distanceTo(last.group.position); if (d < nd) { nd = d; next = e; }
    }
    if (!next) break;
    used.add(next);
    const a = last.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const b = next.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    forkedArc(a, b, arcColor, 2);
    spawnBurst(b.clone(), arcColor, 8, 3.4);
    impactCore(b.clone(), arcColor, .7, .18);
    damageEnemy(next, dmg * .6, false);
    last = next; chained++;
  }
  audio.tone(1180, .14, 'square', .1, -700);
}
// Nova de escarcha: anillo en el suelo, cristales que brotan, cúpula helada y nieve.
function castFrost() {
  const lvl = abilityLevel('frost');
  const radius = 8 + lvl * 1.5, dur = 3 + lvl * .6, factor = .55 - lvl * .15;
  const p = player.position.clone();
  ringPulse(p.clone(), 0x8fdfff, radius, .55);
  groundMark(p.clone(), 0xcfefff, radius * 1.1, 1.8, .38);
  shardRing(p.clone(), 0xdff4ff, radius, 20, 4.2);
  crystalShell(p.clone().add(new THREE.Vector3(0, 1.2, 0)), radius * .8, 0xa9e6ff, .7);
  motes(p.clone(), 0xe8f8ff, 26, radius * .8, 1.4);
  vfx.flash(new THREE.Vector3(p.x, p.y + 1.6, p.z), 0x8fdfff, 60, radius * 3, .3);
  state.shake = Math.max(state.shake, .14);
  let hit = 0;
  for (const e of enemies) {
    if (e.dead || e.spawn > 0) continue;
    if (e.group.position.distanceTo(player.position) < radius) {
      e.slow = dur; e.slowFactor = factor; hit++;
      // Cristales solo en los primeros afectados: con oleadas grandes no se disparan cientos.
      if (hit <= 12) shardRing(e.group.position.clone(), 0xdff4ff, 1.6, 5, 2.2);
    }
  }
  audio.tone(240, .5, 'sine', .12, 420);
  if (hit) announce('ESCARCHA // ' + hit + ' ENEMIGOS');
}
function castBeam() {
  const lvl = abilityLevel('beam');
  const storm = hasSynergy('storm'), overheal = hasSynergy('overheal');
  const candidates = enemies.filter(e => !e.dead && e.spawn <= 0);
  if (!candidates.length) return;
  const shots = Math.min(storm ? 4 : 1, candidates.length);
  const used = new Set();
  for (let i = 0; i < shots; i++) {
    let target = null;
    for (let k = 0; k < 10; k++) { const t = pick(candidates); if (!used.has(t)) { target = t; break; } }
    if (!target) target = pick(candidates);
    used.add(target);
    const pos = target.group.position.clone();
    // Columna orbital en capas: marca de carga en el suelo, columna, núcleo
    // incandescente y fogonazo de impacto.
    groundMark(pos.clone(), 0x9ff7ff, 5.2, .8, .5);
    groundMark(pos.clone(), 0xffffff, 2.4, .55, .7);
    vfx.column(pos, 0x6fe9ff, 1.15, .5, .34);
    vfx.column(pos, 0xffffff, .42, .38, .9);
    vfx.flash(new THREE.Vector3(pos.x, 3, pos.z), 0x9ff7ff, 120, 22, .3);
    ringPulse(pos.clone(), C.cyan, 3.4, .5);
    ringPulse(pos.clone(), 0xffffff, 5.5, .38);
    shardRing(pos.clone(), 0xbfefff, 3, 9, 6);
    spawnBurst(pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xffffff, 18, 6);
    state.shake = Math.max(state.shake, .3);
    damageEnemy(target, 130 + 70 * lvl, false);
    if (overheal) { state.hp = Math.min(state.maxHp, state.hp + 10); fx.damageNumber(player.position.clone().add(new THREE.Vector3(0, 2.2, 0)), 10, false, false); }
  }
  audio.tone(1400, .35, 'sawtooth', .12, -900);
}
// Explosión con impacto real: fogonazo, onda de choque, metralla y daño en área.
function explode(pos, radius, dmg, color = 0xffbf47) {
  spawnBurst(pos, color, 42, 9);
  spawnBurst(pos, 0xffffff, 16, 6);
  ringPulse(pos, color, radius * 1.6, .45);
  ringPulse(pos, 0xffffff, radius * .85, .28);
  vfx.core(pos, color, radius * .75, .3);
  vfx.flash(pos, color, 90, radius * 4, .14);
  state.shake = Math.max(state.shake, .45);
  fx.flash('#ffbf47', .16, 150); fx.hitstop(35);
  audio.tone(70, .45, 'sawtooth', .24, -50); audio.noise(.4, .24);
  for (const e of enemies) {
    if (e.dead || e.spawn > 0) continue;
    const d = e.group.position.distanceTo(pos);
    if (d < radius) damageEnemy(e, dmg * (1 - d / (radius * 1.35)), false);
  }
}
function dropMine() {
  const lvl = abilityLevel('mines');
  const a = rnd() * Math.PI * 2, d = 1.4 + rnd() * 1.6;
  const p = new THREE.Vector3(player.position.x + Math.cos(a) * d, state.py + .16, player.position.z + Math.sin(a) * d);
  const g = new THREE.Group(); g.position.copy(p);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2418, roughness: .5, metalness: .85 });
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xff4d38 });
  cylinder(g, .27, .31, .13, [0, 0, 0], bodyMat, 12);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x3a2a06, emissive: 0xffbf47, emissiveIntensity: .7 }));
  dome.position.y = .05; g.add(dome);
  for (let i = 0; i < 6; i++) {
    const ang = i / 6 * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(.05, .17, 5), bodyMat);
    spike.position.set(Math.cos(ang) * .24, .12, Math.sin(ang) * .24);
    spike.rotation.z = -Math.cos(ang) * .55; spike.rotation.x = Math.sin(ang) * .55;
    g.add(spike);
  }
  const led = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 8), ledMat); led.position.y = .3; g.add(led);
  // Anillo de detección en el suelo: hace visible el radio de la mina.
  const trip = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 36, 1, 0, Math.PI * 2),
    new THREE.MeshBasicMaterial({ color: 0xffbf47, transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false }));
  trip.rotation.x = -Math.PI / 2; trip.position.y = -.11; trip.scale.setScalar(2.1); g.add(trip);
  scene.add(g);
  // Sin luz propia: el LED y la cúpula emisiva ya la hacen legible y no alteran
  // el recuento de luces de la escena.
  mines.push({ m: g, led, dome, trip, life: 16, arm: 1.15, dmg: 95 + 45 * lvl, phase: rnd() * 6 });
}
function updateMines(dt) {
  for (let i = mines.length - 1; i >= 0; i--) {
    const mn = mines[i]; mn.life -= dt; mn.phase += dt;
    if (mn.arm > 0) {
      // Secuencia de armado: el LED parpadea en rojo y la mina "crece" hasta asentarse.
      mn.arm -= dt;
      const armed = 1 - Math.max(0, mn.arm) / 1.15;
      const blink = Math.sin(mn.phase * 20) > 0;
      mn.led.material.color.setHex(blink ? 0xff4d38 : 0x2a0a05);
      mn.m.scale.setScalar(.55 + armed * .45);
      mn.dome.material.emissiveIntensity = .4 + armed * .6;
    } else {
      const pulse = .5 + Math.sin(mn.phase * 5) * .5;
      mn.led.material.color.setHex(0xffbf47);
      mn.dome.material.emissiveIntensity = 1.2 + pulse * 2.2;
      mn.m.rotation.y += dt * .7;
      if (mn.trip) { mn.trip.material.opacity = .12 + pulse * .12; mn.trip.rotation.z += dt * .5; }
    }
    let boom = mn.life <= 0;
    if (!boom && mn.arm <= 0) for (const e of enemies) {
      if (e.dead || e.spawn > 0) continue;
      if (Math.hypot(e.group.position.x - mn.m.position.x, e.group.position.z - mn.m.position.z) < 2 && Math.abs(e.group.position.y - mn.m.position.y) < 2.6) { boom = true; break; }
    }
    if (boom) {
      const p = mn.m.position.clone();
      explode(p, 4.8, mn.dmg, 0xffbf47);
      // Sinergia CADENA DE DEMOLICIÓN: una explosión detona las minas cercanas.
      if (hasSynergy('demolition')) for (const o of mines) { if (o !== mn && o.m.position.distanceTo(p) < 7.5) o.life = Math.min(o.life, .1); }
      scene.remove(mn.m); disposeObject3D(mn.m); mines.splice(i, 1);
    }
  }
}
function updateAbilities(dt) {
  const A = state.abilities;
  if (A.orbit) updateOrbit(dt);
  // Regeneración: se corta unos segundos al recibir daño, salvo con CARNE INFINITA.
  // `shieldRegen` multiplica la recarga del escudo (resonancia BALUARTE).
  if (state.regen > 0 && (state.regenAlways || (state.hurtT || 0) <= 0)) {
    if (state.maxShield > 0 && state.shield < state.maxShield) state.shield = Math.min(state.maxShield, state.shield + state.regen * (state.shieldRegen || 1) * dt);
    else state.hp = Math.min(state.maxHp, state.hp + state.regen * .6 * dt);
  }
  if (A.regen) {
    const lvl = A.regen;
    if (state.maxShield > 0 && state.shield < state.maxShield) state.shield = Math.min(state.maxShield, state.shield + 2.2 * lvl * dt);
    else state.hp = Math.min(state.maxHp, state.hp + 1.1 * lvl * dt);
  }
  if (A.aura) {
    state.timers.aura = (state.timers.aura || 0) - dt;
    const radius = 3.6 + A.aura * .8;
    // El aura es una cúpula con capas: esfera interior, malla cristalina que gira,
    // marca en el suelo y motas ascendentes. Nada de un solo círculo translúcido.
    if (!auraGroup) {
      auraGroup = new THREE.Group();
      auraCore = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xb56bff, transparent: true, opacity: .09 }));
      auraShell = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xd9b3ff, wireframe: true, transparent: true, opacity: .32 }));
      auraShell2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xb56bff, wireframe: true, transparent: true, opacity: .18 }));
      auraDisc = new THREE.Mesh(new THREE.RingGeometry(.55, 1, 48), new THREE.MeshBasicMaterial({ color: 0xb56bff, transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false }));
      auraDisc.rotation.x = -Math.PI / 2;
      auraGroup.add(auraCore, auraShell, auraShell2, auraDisc);
      scene.add(auraGroup);
    }
    auraGroup.visible = true;
    auraGroup.position.set(player.position.x, state.py + 1.2, player.position.z);
    auraCore.scale.setScalar(radius);
    auraShell.scale.setScalar(radius * (.92 + Math.sin(state.time * 2.2) * .04));
    auraShell2.scale.setScalar(radius * (1.02 + Math.sin(state.time * 1.5 + 1) * .05));
    auraShell.rotation.y += dt * .5; auraShell.rotation.x += dt * .22;
    auraShell2.rotation.y -= dt * .7; auraShell2.rotation.z += dt * .3;
    auraCore.material.opacity = .07 + Math.sin(state.time * 4) * .025;
    auraDisc.scale.setScalar(radius * 1.02);
    auraDisc.position.y = -1.15;
    auraDisc.material.opacity = .22 + Math.sin(state.time * 3) * .07;
    if (auraMoteTimer <= 0) { auraMoteTimer = .28; motes(new THREE.Vector3(player.position.x, state.py, player.position.z), 0xc9a0ff, 3, radius * .9, 2.2); }
    else auraMoteTimer -= dt;
    const timefield = hasSynergy('timefield');
    if (state.timers.aura <= 0) {
      state.timers.aura = .5;
      let touched = 0;
      for (const e of enemies) {
        if (e.dead || e.spawn > 0) continue;
        if (e.group.position.distanceTo(player.position) < radius) {
          damageEnemy(e, 13 * A.aura, false); touched++;
          if (timefield) { e.slow = Math.max(e.slow, 1.2); e.slowFactor = .65; }
        }
      }
      if (touched) ringPulse(player.position.clone(), 0xb56bff, radius * 1.05, .4);
    }
  } else if (auraGroup) auraGroup.visible = false;
  // --- segunda hornada de habilidades automáticas -----------------------
  if (A.chain) { state.timers.chain = (state.timers.chain || 0) - dt; if (state.timers.chain <= 0) { castChain(); state.timers.chain = Math.max(1.5, 3.2 - A.chain * .22) * (state.abilityHaste || 1); } }
  if (A.singularity) { state.timers.singularity = (state.timers.singularity || 0) - dt; if (state.timers.singularity <= 0) { castSingularity(); state.timers.singularity = Math.max(5, 9.5 - A.singularity * .8) * (state.abilityHaste || 1); } }
  if (A.rain) { state.timers.rain = (state.timers.rain || 0) - dt; if (state.timers.rain <= 0) { castRain(); state.timers.rain = Math.max(4.5, 8.5 - A.rain * .7) * (state.abilityHaste || 1); } }
  updateVortices(dt); updateDelayedBlasts(dt); updateEchoes(dt);
  if (A.tesla) { state.timers.tesla = (state.timers.tesla || 0) - dt; if (state.timers.tesla <= 0) { castTesla(); state.timers.tesla = Math.max(1.4, 3.6 - A.tesla * .35) * (hasSynergy('storm') ? .7 : 1) * (state.abilityHaste || 1); } }
  if (A.frost) { state.timers.frost = (state.timers.frost || 0) - dt; if (state.timers.frost <= 0) { castFrost(); state.timers.frost = Math.max(2.5, 5.5 - A.frost * .6) * (state.abilityHaste || 1); } }
  if (A.mines) { state.timers.mines = (state.timers.mines || 0) - dt; if (state.timers.mines <= 0 && mines.length < 3 + A.mines * 2) { dropMine(); state.timers.mines = Math.max(2, 4.5 - A.mines * .6) * (state.abilityHaste || 1); } }
  if (A.beam) { state.timers.beam = (state.timers.beam || 0) - dt; if (state.timers.beam <= 0) { castBeam(); state.timers.beam = Math.max(3.5, 7 - A.beam * .8) * (state.abilityHaste || 1); } }
  // --- tercera hornada: despliegues, artillería orbital y engaño -----------
  if (A.turret) { state.timers.turret = (state.timers.turret || 0) - dt; if (state.timers.turret <= 0) { castTurret(); state.timers.turret = Math.max(8, 13 - A.turret * .8) * (state.abilityHaste || 1); } }
  if (A.meteor) { state.timers.meteor = (state.timers.meteor || 0) - dt; if (state.timers.meteor <= 0) { castMeteor(); state.timers.meteor = Math.max(6, 11 - A.meteor * .9) * (state.abilityHaste || 1); } }
  if (A.ghost) { state.timers.ghost = (state.timers.ghost || 0) - dt; if (state.timers.ghost <= 0) { castGhost(); state.timers.ghost = Math.max(7, 12 - A.ghost * .9) * (state.abilityHaste || 1); } }
  if (A.spiral) { state.timers.spiral = (state.timers.spiral || 0) - dt; if (state.timers.spiral <= 0) { castSpiral(); state.timers.spiral = Math.max(3.5, 6 - A.spiral * .5) * (state.abilityHaste || 1); } }
  // --- cuarta hornada: control de masas, castigo y caos --------------------
  if (A.quake) { state.timers.quake = (state.timers.quake || 0) - dt; if (state.timers.quake <= 0) { castQuake(); state.timers.quake = Math.max(4.5, 7 - A.quake * .5) * (state.abilityHaste || 1); } }
  if (A.comet) { state.timers.comet = (state.timers.comet || 0) - dt; if (state.timers.comet <= 0) { castComet(); state.timers.comet = Math.max(2.8, 5 - A.comet * .4) * (state.abilityHaste || 1); } }
  updateMines(dt); updateTurrets(dt); updateMeteors(dt); updateGhosts(dt); updateSpiral(dt); updateComets(dt);
}
let auraGroup = null, auraCore = null, auraShell = null, auraShell2 = null, auraDisc = null, auraMoteTimer = 0;

// ----------------------------------- cuarta hornada: control, castigo y caos
// TREMOR: una onda expansiva recorre la arena desde tus pies.
function castQuake() {
  const lvl = abilityLevel('quake');
  const R = 7 + lvl * 1.5;
  const dmg = 60 + 35 * lvl;
  const p = player.position.clone();
  gridRipple(p, 0xff4d38, 4);
  groundMark(p.clone(), 0xff4d38, R, .9, .5);
  for (const e of enemies) {
    if (e.dead || e.spawn > 0) continue;
    const d = e.group.position.distanceTo(p);
    if (d > R) continue;
    damageEnemy(e, dmg * (1 - d / R * .4), false);
    e.slow = Math.max(e.slow || 0, .9);
    e.knock = Math.max(e.knock || 0, .4);
  }
  state.shake = Math.max(state.shake, .38);
  announce('TREMOR');
  audio.tone(70, .45, 'sawtooth', .18, 260);
}
// COMETA: un núcleo helado que orbita y sale disparado al hostile más lejano.
const comets = [];
function castComet() {
  const lvl = abilityLevel('comet');
  const dmg = 70 + 45 * lvl;
  let far = null, fd = 0;
  for (const e of enemies) {
    if (e.dead || e.spawn > 0) continue;
    const d = e.group.position.distanceTo(player.position);
    if (d > fd) { fd = d; far = e; }
  }
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 0),
    new THREE.MeshStandardMaterial({ color: 0x18303a, emissive: 0x8fdfff, emissiveIntensity: 2.6, roughness: .25 }));
  m.position.copy(player.position.clone().add(new THREE.Vector3(0, 1.6, 0)));
  scene.add(m);
  comets.push({ m, target: far, t: 0, orbit: rnd() * 6.28, dmg, fired: false });
  audio.tone(880, .16, 'triangle', .07, 400);
}
function updateComets(dt) {
  const p = player.position.clone();
  for (let i = comets.length - 1; i >= 0; i--) {
    const c = comets[i]; c.t += dt; c.orbit += dt * 6;
    if (c.t < .55) {                                   // gira alrededor del jugador
      const r = 1.4;
      c.m.position.set(p.x + Math.cos(c.orbit) * r, p.y + 1.6 + Math.sin(c.t * 8) * .18, p.z + Math.sin(c.orbit) * r);
      c.m.rotation.x += dt * 9; c.m.rotation.z += dt * 7;
      continue;
    }
    if (!c.target || c.target.dead) { scene.remove(c.m); disposeObject3D(c.m); comets.splice(i, 1); continue; }
    const tp = c.target.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const dir = tp.sub(c.m.position);
    const dist = dir.length();
    dir.normalize();
    if (dist < .6) {
      explode(c.m.position.clone(), 3, c.dmg, 0x8fdfff);
      crystalShell(c.m.position.clone(), 2.4, 0x8fdfff, .4);
      for (const e of enemies) {
        if (e.dead || e.spawn > 0) continue;
        if (e.group.position.distanceTo(c.m.position) < 3.2) damageEnemy(e, c.dmg * .5, false);
      }
      scene.remove(c.m); disposeObject3D(c.m); comets.splice(i, 1);
      continue;
    }
    c.m.position.addScaledVector(dir, Math.min(dist, 26 * dt));
    c.m.rotation.x += dt * 5;
    if (rnd() < dt * 30) motes(c.m.position.clone(), 0x8fdfff, 1, .3, .8);
    if (c.t > 6) { scene.remove(c.m); disposeObject3D(c.m); comets.splice(i, 1); }
  }
}

// ------------------------------------------- arsenal extendido: despliegues
// Cuatro habilidades con identidad propia: torreta autónoma, bombardeo orbital
// telegrafiado, señuelo espectral que detona y rosa de cuchillas de fase.
const turrets = [], ghosts = [], meteors = [];
function castTurret() {
  const lvl = abilityLevel('turret');
  const n = hasEvo('turret') ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const a = rnd() * Math.PI * 2, d = 1.6 + k * 1.1;
    const px = player.position.x + Math.cos(a) * d, pz = player.position.z + Math.sin(a) * d;
    const g = new THREE.Group(); g.position.set(px, groundAt(px, pz, state.py), pz);
    const body = new THREE.MeshStandardMaterial({ color: 0x1b2529, roughness: .4, metalness: .85 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x3a2a06, emissive: 0xffbf47, emissiveIntensity: 2.2 });
    for (const la of [0, 2.1, 4.2]) {
      const leg = rbox(g, [.08, .8, .08], [Math.cos(la) * .3, .3, Math.sin(la) * .3], body, .02);
      leg.rotation.z = Math.cos(la) * .4; leg.rotation.x = -Math.sin(la) * .4;
    }
    cylinder(g, .3, .34, .18, [0, .72, 0], body, 10);
    const head = new THREE.Group(); head.position.y = .95; g.add(head);
    rbox(head, [.34, .3, .42], [0, 0, 0], body, .04);
    const barrel = cylinder(head, .05, .06, .6, [0, .04, -.4], glow, 8); barrel.rotation.x = Math.PI / 2;
    rbox(head, [.1, .1, .12], [0, .2, -.05], glow, .02);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 8), glow); eye.position.set(0, .04, -.24); head.add(eye);
    scene.add(g);
    ringPulse(g.position.clone(), 0xffbf47, 2.4, .4); motes(g.position.clone(), 0xffd34d, 8, 1.2, 1.4);
    turrets.push({ group: g, head, life: 14 + lvl * 5, cd: 0, rate: (hasEvo('turret') ? 1 / (2.2 + lvl * .7) : 1 / (3.5 + lvl * 1.1)) });
  }
  announce('CENTINELA AUTÓNOMA // DESPLEGADA');
  audio.tone(220, .2, 'square', .12, 80);
}
function updateTurrets(dt) {
  for (let i = turrets.length - 1; i >= 0; i--) {
    const t = turrets[i]; t.life -= dt; t.cd -= dt;
    if (t.life <= 0) {
      spawnBurst(t.group.position.clone().add(new THREE.Vector3(0, .8, 0)), 0xffbf47, 10, 3);
      scene.remove(t.group); disposeObject3D(t.group); turrets.splice(i, 1); continue;
    }
    // Barrido inactivo cuando no hay objetivo; giro de cabeza al disparar.
    if (t.cd > 0) continue;
    let best = null, bd = 22;
    for (const e of enemies) {
      if (e.dead || e.spawn > 0) continue;
      const d = e.group.position.distanceTo(t.group.position);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) { t.head.rotation.y += dt * 1.8; continue; }
    t.cd = t.rate;
    const from = t.group.position.clone().add(new THREE.Vector3(0, 1.05, 0));
    const to = best.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    tracer(from, to, 0xffbf47, .09);
    spawnBurst(to, 0xffd34d, 3, 2);
    damageEnemy(best, state.damage * 1.1, false);
    audio.tone(760, .05, 'square', .045, -180);
  }
}
function castMeteor() {
  const lvl = abilityLevel('meteor');
  const n = hasEvo('meteor') ? 9 : 3 + lvl * 2;
  const alive = enemies.filter(e => !e.dead && e.spawn <= 0);
  for (let k = 0; k < n; k++) {
    let tx, tz;
    if (alive.length) { const e = alive[Math.floor(rnd() * alive.length)]; tx = e.group.position.x + (rnd() - .5) * 3; tz = e.group.position.z + (rnd() - .5) * 3; }
    else { tx = player.position.x + (rnd() - .5) * 16; tz = player.position.z + (rnd() - .5) * 16; }
    const delay = .4 + k * .22;
    const radius = hasEvo('meteor') ? 6.2 : 4.2;
    meteors.push({ x: tx, z: tz, t: delay, radius, dmg: (120 + 60 * lvl) * (hasEvo('meteor') ? 1.3 : 1) });
    // Telegrafo: el suelo avisa dónde va a caer cada meteoro.
    groundMark(new THREE.Vector3(tx, 0, tz), 0xff4d38, radius * 1.05, delay + .05, .5);
  }
  announce('BOMBARDEO ORBITAL // MARCANDO');
  audio.tone(140, .5, 'sawtooth', .14, 300);
}
function updateMeteors(dt) {
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i]; m.t -= dt;
    if (m.t > 0) continue;
    const hit = new THREE.Vector3(m.x, groundAt(m.x, m.z, 0), m.z);
    const top = new THREE.Vector3(m.x, 30, m.z);
    tracer(top, hit, 0xff6a4d, .16);
    tracer(top.clone().add(new THREE.Vector3(.3, 0, .2)), hit, 0xffbf47, .12);
    explode(hit, m.radius, m.dmg, 0xff4d38);
    shardRing(hit, 0xffc9b0, 2.6, 10, 6);
    groundMark(hit.clone(), 0xff4d38, m.radius * 1.4, 1.2, .4);
    impactCore(hit.clone().add(new THREE.Vector3(0, .6, 0)), 0xff6a4d, 2.2, .3);
    meteors.splice(i, 1);
  }
}
function castGhost() {
  const lvl = abilityLevel('ghost');
  const n = hasEvo('ghost') ? 3 : 1;
  for (let k = 0; k < n; k++) {
    const a = rnd() * Math.PI * 2;
    const px = player.position.x + Math.cos(a) * 2.4, pz = player.position.z + Math.sin(a) * 2.4;
    // Clon con esqueleto propio (SkeletonUtils). player.clone(true) serializa
    // userData a JSON y el mixer del GLB formaría un ciclo irresoluble.
    const c = cloneCharacterGhost(player);
    c.position.set(px, state.py, pz);
    const mat = new THREE.MeshBasicMaterial({ color: 0xb56bff, transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending });
    c.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = false; o.receiveShadow = false; } });
    c.userData.ghostMat = mat;
    scene.add(c);
    ghosts.push({ model: c, life: 4 + lvl * 2, boom: (90 + 50 * lvl) * (hasEvo('ghost') ? 1.4 : 1), pullT: 0 });
    ringPulse(new THREE.Vector3(px, state.py, pz), 0xb56bff, 2.2, .4);
  }
  announce('SEÑUELO ESPECTRAL // ACTIVO');
  audio.tone(340, .3, 'sine', .1, -120);
}
function updateGhosts(dt) {
  for (let i = ghosts.length - 1; i >= 0; i--) {
    const gh = ghosts[i]; gh.life -= dt; gh.pullT -= dt;
    gh.model.userData.ghostMat.opacity = .22 + Math.sin(state.time * 8) * .12;
    gh.model.position.y = state.py + Math.sin(state.time * 2.6 + i) * .08;
    // Taunt: succiona la atención (y el cuerpo) de los hostiles cercanos.
    if (gh.pullT <= 0) {
      gh.pullT = .6;
      for (const e of enemies) {
        if (e.dead || e.spawn > 0) continue;
        const d = e.group.position.distanceTo(gh.model.position);
        if (d < 12 && d > 1.5) {
          const to = gh.model.position.clone().sub(e.group.position).setY(0).normalize();
          e.group.position.addScaledVector(to, (hasEvo('ghost') ? 9.4 : 5.8) * dt);
          e.slow = Math.max(e.slow, .4);
        }
      }
      motes(gh.model.position.clone(), 0xb56bff, 3, 1.6, 1.2);
    }
    if (gh.life <= 0) {
      const p = gh.model.position.clone().add(new THREE.Vector3(0, 1, 0));
      explode(p, 5, gh.boom, 0xb56bff);
      crystalShell(p, 4, 0xb56bff, .45);
      gridRipple(gh.model.position, 0xb56bff);
      scene.remove(gh.model);
      gh.model.userData.ghostMat.dispose();
      // El señuelo tiene su propio Skeleton: se libera su boneTexture de GPU.
      disposeCharacterGhost(gh.model);
      ghosts.splice(i, 1);
    }
  }
}
function castSpiral() {
  state.spiralT = 1.3; state.spiralHit = {};
  announce('ESPIRAL DE FASE');
  audio.tone(520, .25, 'square', .1, 200);
}
function updateSpiral(dt) {
  if (!(state.spiralT > 0)) return;
  state.spiralT -= dt;
  const lvl = abilityLevel('spiral');
  const arms = hasEvo('spiral') ? 4 : 2 + lvl;
  const R = 3.4, dmg = (26 + 14 * lvl) * (hasEvo('spiral') ? 1.25 : 1);
  const base = state.time * 7.5;
  const p = player.position.clone();
  for (let a = 0; a < arms; a++) {
    const ang = base + (a / arms) * Math.PI * 2;
    const tip = p.clone().add(new THREE.Vector3(Math.cos(ang) * R, 1.2, Math.sin(ang) * R));
    tracer(p.clone().add(new THREE.Vector3(Math.cos(ang) * .6, 1.2, Math.sin(ang) * .6)), tip, 0x9ff7ff, .08);
    for (const e of enemies) {
      if (e.dead || e.spawn > 0) continue;
      if ((state.spiralHit[e.group.uuid] || 0) > 0) continue;
      const d = e.group.position.distanceTo(p);
      if (d > R + e.radius) continue;
      const ea = Math.atan2(e.group.position.z - p.z, e.group.position.x - p.x);
      const diff = Math.abs((((ea - ang) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if (diff < .85) { damageEnemy(e, dmg, false); state.spiralHit[e.group.uuid] = .3; }
    }
  }
  for (const k in state.spiralHit) state.spiralHit[k] -= dt;
  // Evolución ROSA ETERNA: la espiral jamás se apaga.
  if (state.spiralT <= 0 && hasEvo('spiral')) state.spiralT = .001;
}

// ---------------------------------------------------------------- mascotas y granadas
// El dron de escolta es una pieza con chasis, ojiva, rotor y estabilizadores,
// no un cubo con un aro.
function spawnCompanion(micro = false) {
  const g = new THREE.Group();
  const s = micro ? .7 : 1;
  const shell = new THREE.MeshStandardMaterial({ color: 0x1b2426, roughness: .35, metalness: .9 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x2a153f, emissive: 0xb56bff, emissiveIntensity: 2.4, roughness: .4, metalness: .4 });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(.26 * s, .16 * s, .26 * s), shell); g.add(chassis);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(.07 * s, 10, 8), glow); eye.position.set(0, .02 * s, -.15 * s); g.add(eye);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(.1 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), shell); dome.position.y = .08 * s; g.add(dome);
  const rotor = new THREE.Mesh(new THREE.TorusGeometry(.3 * s, .035, 6, 14), new THREE.MeshBasicMaterial({ color: 0xb56bff }));
  rotor.rotation.x = Math.PI / 2; g.add(rotor);
  const fins = [];
  for (const xx of [-.17, .17]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(.05 * s, .05 * s, .2 * s), glow);
    fin.position.set(xx * s, -.02 * s, .16 * s); fin.rotation.y = xx > 0 ? -.3 : .3; g.add(fin); fins.push(fin);
  }
  scene.add(g);
  companions.push({ group: g, rotor, fins, cooldown: .4, index: companions.length, micro, trail: 0 });
  state.companions++;
}
function updateCompanions(dt) {
  // Los aliados temporales (LEGIONARIA) caducan: se retiran con una detonación.
  for (let i = companions.length - 1; i >= 0; i--) {
    const tc = companions[i];
    if (!tc.temp) continue;
    tc.temp -= dt;
    if (tc.temp > 0) continue;
    explode(tc.group.position.clone(), 2.6, 60, 0xb56bff);
    scene.remove(tc.group); disposeObject3D(tc.group);
    companions.splice(i, 1); state.companions = Math.max(0, state.companions - 1);
  }
  companions.forEach((c, i) => {
    const a = state.time * (c.micro ? 2.4 : 1.6) + i * (Math.PI * 2 / Math.max(1, companions.length));
    const target = _tmpV.set(
      player.position.x + Math.cos(a) * (c.micro ? 1.3 : 1.9),
      state.py + 2.35 + Math.sin(state.time * 3 + i) * .12,
      player.position.z + Math.sin(a) * (c.micro ? 1.3 : 1.9)
    );
    c.group.position.lerp(target, 1 - Math.pow(.002, dt));
    c.group.rotation.y += dt * 2.4;
    // El rotor gira, los estabilizadores vibran y el dron deja estela.
    if (c.rotor) c.rotor.rotation.z += dt * (c.micro ? 9 : 6);
    if (c.fins) for (const f of c.fins) f.rotation.x = Math.sin(state.time * 9 + i) * .18;
    c.trail -= dt;
    if (c.trail <= 0) {
      c.trail = .16;
      vfx.glowMotes(c.group.position, 0xb56bff, 1, .1, .35);
    }
    c.cooldown -= dt;
    if (c.cooldown > 0) return;
    let best = null, bestDist = c.micro ? 16 : 22;
    for (const e of enemies) { if (e.dead || e.spawn > 0) continue; const d = e.group.position.distanceTo(player.position); if (d < bestDist) { bestDist = d; best = e; } }
    if (!best) return;
    c.cooldown = c.micro ? .6 : 1.05;
    const from = c.group.position.clone(), to = best.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const frozen = hasSynergy('swarmlord');
    tracer(from, to, frozen ? 0x8fdfff : 0xb56bff, .06); audio.tone(880, .07, 'square', .05, -260);
    damageEnemy(best, (c.micro ? 9 : 14) + state.damage * .18, false);
    if (frozen) { best.slow = Math.max(best.slow, 1.4); best.slowFactor = .55; }
    spawnBurst(to, frozen ? 0x8fdfff : 0xb56bff, 4, 2);
  });
}
function fireGrenade() {
  const mp = new THREE.Vector3(); player.userData.muzzle.getWorldPosition(mp);
  const dir = new THREE.Vector3(-Math.sin(state.yaw) * Math.cos(state.pitch), Math.sin(state.pitch) + .05, -Math.cos(state.yaw) * Math.cos(state.pitch)).normalize();
  const m = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 10), new THREE.MeshStandardMaterial({ color: 0x3a0f08, emissive: C.coral, emissiveIntensity: 1.6 }));
  m.position.copy(mp); scene.add(m); grenades.push({ m, dir, speed: 26, life: 1.5 });
  audio.tone(120, .14, 'sawtooth', .16, -60);
}
function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i]; g.life -= dt; g.dir.y -= 6 * dt; g.m.position.addScaledVector(g.dir, g.speed * dt);
    let hit = false;
    for (const e of enemies) { if (e.dead || e.spawn > 0) continue; if (e.group.position.distanceTo(g.m.position) < e.radius + 1.1) { hit = true; break; } }
    if (hit || g.life <= 0 || g.m.position.y < .4) {
      const p = g.m.position.clone();
      // La granada de la ranura G es más potente que la automática del arma.
      if (g.utility) { explode(p, 6.5, state.damage * 3.4, 0xffbf47); ringPulse(p, 0xffbf47, 6.8, .5); }
      else explode(p, 5, state.damage * 1.9, C.coral);
      scene.remove(g.m); disposeObject3D(g.m); grenades.splice(i, 1);
    }
  }
}
function spawnHazard(pos, kind, opts) {
  const o = opts || {};
  const color = o.color !== undefined ? o.color : kind === 'acid' ? 0xb6ff3d : 0xb56bff;
  const r = o.radius || 2.6;
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .32, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y = groundAt(pos.x, pos.z, 4) + .06; scene.add(m);
  hazards.push({ m, life: o.life || 9, dps: o.dmg || 13, r });
}
function updateHazards(dt) {
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i]; h.life -= dt;
    h.m.material.opacity = .32 * Math.min(1, h.life / 2);
    if (Math.hypot(player.position.x - h.m.position.x, player.position.z - h.m.position.z) < h.r && Math.abs(state.py - h.m.position.y) < 1.6) {
      state.hp -= h.dps * dt;
      $('damage-flash').style.opacity = '.35'; setTimeout(() => $('damage-flash').style.opacity = '0', 100);
      if (state.hp <= 0) { state.hp = 0; gameOver(); }
    }
    if (h.life <= 0) { scene.remove(h.m); disposeObject3D(h.m); hazards.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- disparo
function frenzyActive() { return state.frenzyTimer > 0; }

/** Aplica un impacto ya resuelto. Se invoca al LLEGAR el proyectil (armas a
 *  distancia) o de inmediato (tajos del hacha y la daga). Los efectos de
 *  partículas y sonido se emiten una sola vez por disparo, no por enemigo. */
/** Firma de partículas Kenney del héroe al CONFIRMAR un golpe. Se emite en el
 *  cuerpo del enemigo (pecho / cabeza), una vez por enemigo acertado, con los
 *  sprites y el etalonaje de `WEAPON_DEFS[id].vfx.hit` / `.hitStyle`. */
function emitHitParticles(e, headshot = false) {
  if (!combatParticles || !e || !e.group) return;
  const at = e.group.position.clone().add(new THREE.Vector3(0, (headshot ? 2 : 1.35) * (e.group.scale.y || 1), 0));
  combatParticles.preset(selectedCharacter, 'hit', at, null, {});
}

function applyShotHit(h, dmgBase) {
  if (!h || h.e.dead || h.e.spawn > 0) return;
  const dmg = dmgBase * (h.head ? state.headshotMult : 1);
  damageEnemy(h.e, dmg, h.head);
  emitHitParticles(h.e, h.head);
  state.runHits++; if (h.head) state.runHead++; state.runDmg += dmg;
}

function shoot() {
  if (state.mode !== 'playing' || state.reloading > 0 || state.fireTimer > 0 || state.dashing > 0) return;
  const w = currentWeapon();
  if (state.ammo <= 0) { reload(); return; }
  const rate = state.fireRate * w.fireRate * (state.overdrive > 0 ? .55 : 1) * (frenzyActive() ? .62 : 1) * (state.stim > 0 ? .7 : 1) * (state.retaliateT > 0 ? 1 / (1 + (state.retaliate || 0)) : 1);
  state.fireTimer = rate; state.ammo--; state.shake = Math.max(state.shake, .08 + w.kick * .3); state.shotCount++; state.recoil = 1;
  state.runShots += w.pellets;

  // Geometría del disparo. Se calcula ANTES de los disparos auxiliares: antes
  // firePureLance() usaba baseDir/dmgBase en su zona de muerte temporal (TDZ).
  const origin = camera.position.clone();
  const baseDir = new THREE.Vector3(-Math.sin(state.yaw) * Math.cos(state.pitch), Math.sin(state.pitch), -Math.cos(state.yaw) * Math.cos(state.pitch)).normalize();
  const mp = new THREE.Vector3(); player.userData.muzzle.getWorldPosition(mp);
  const rcLvl = abilityLevel('ricochet');
  const pierce = 1 + w.pierce + state.pierceBonus + (rcLvl > 0 ? 1 + rcLvl : 0);
  const dmgBase = state.damage * w.damage * (1 + (state.weaponBlessing || 0))
    * (state.overdrive > 0 ? 1.25 : 1) * (frenzyActive() ? 1.2 : 1);
  const maxT = w.range || 85;

  // Salida: fogonazo Kenney propio del héroe + chispas 3D + SFX con pitch
  // aleatorio y polifonía limitada. Ya no existe el tracer hitscan genérico.
  muzzleFlash(w.color);
  combatParticles?.preset(selectedCharacter, 'shoot', mp, baseDir, {});
  playCharacterSfx(selectedCharacter, 'shoot', { volume: .6 });
  if (!isMeleeHero()) { $('crosshair').classList.add('fire'); setTimeout(() => $('crosshair').classList.remove('fire'), 55); }
  if (state.grenade && state.shotCount % state.grenadeEvery === 0) fireGrenade();
  if (hasRelic('core_inestable') && state.shotCount % 12 === 0) firePureLance(baseDir, dmgBase);

  for (let p = 0; p < w.pellets; p++) {
    const dir = baseDir.clone();
    if (w.spread) {
      dir.x += (rnd() - .5) * w.spread * 2; dir.y += (rnd() - .5) * w.spread * 2; dir.z += (rnd() - .5) * w.spread * 2;
      dir.normalize();
    }
    const hits = [];
    for (const e of enemies) {
      if (e.dead || e.spawn > 0) continue;
      for (const part of [{ y: 1.98, r: .32, head: true }, { y: 1.25, r: e.radius, head: false }]) {
        const center = e.group.position.clone().add(new THREE.Vector3(0, part.y * e.group.scale.y, 0));
        const oc = center.clone().sub(origin), t = oc.dot(dir); if (t < 1 || t > maxT) continue;
        const closest = origin.clone().addScaledVector(dir, t), dist = closest.distanceTo(center);
        if (dist < part.r * e.group.scale.y) { hits.push({ e, t, head: part.head }); break; }
      }
    }
    hits.sort((a, b) => a.t - b.t);
    // Cobertura real: la utilería alta detiene el tiro (coches, contenedores, muros).
    const blockT = Math.min(propRayT(origin, dir, maxT), maxT);
    const live = hits.filter(h => h.t < blockT);
    const end = origin.clone().addScaledVector(dir, Math.min(blockT, live.length ? live[live.length - 1].t : maxT));
    if (blockT < maxT && p === 0) spawnBurst(end, 0xcdc7b8, 3, 1.6);
    const limited = live.slice(0, pierce);

    const impact = (at) => {
      for (const h of limited) {
        applyShotHit(h, dmgBase);
        spawnBurst(at, h.head ? C.white : w.color, h.head ? 5 : 3, 2);
      }
      combatParticles?.preset(selectedCharacter, 'impact', at, dir, {});
      playCharacterSfx(selectedCharacter, 'impact', { volume: .34 });
    };

    if (w.projectile) {
      // Flecha / orbe arcano / haz láser: malla 3D ligera del pool. El daño
      // llega con el proyectil, no en el instante de apretar el gatillo.
      combatProjectiles?.spawn(w.projectile, mp, end, {
        speed: w.projectileSpeed, characterId: selectedCharacter,
        size: w.projectile === 'laser' ? .48 : .34,
        onImpact: impact
      });
    } else {
      // Hacha y daga: tajo inmediato de corto alcance con su slash/shockwave.
      impact(end);
    }

    // --- ECO DE COMBATE ---------------------------------------------------
    // Un segundo tirador fantasma dispara desde el flanco, un instante después,
    // sobre los mismos blancos. Sube de nivel añadiendo daño y réplicas.
    const echoLvl = abilityLevel('echo');
    if (echoLvl > 0 && p === 0 && echoShots.length < 8) {
      const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
      const ghosts = 1 + (echoLvl >= 3 ? 1 : 0);
      for (let gI = 0; gI < ghosts; gI++) {
        const side = gI === 0 ? 1 : -1;
        echoShots.push({
          from: mp.clone().addScaledVector(right, 1.25 * side).add(new THREE.Vector3(0, .5 - gI * .2, 0)),
          to: end.clone().addScaledVector(right, .12 * side),
          t: .1 + gI * .07,
          dmg: dmgBase * (.26 + .13 * echoLvl),
          color: w.color,
          targets: limited.map(h => ({ e: h.e, head: h.head }))
        });
      }
    }
  }
  if (state.ammo === 0) setTimeout(() => { if (state.mode === 'playing') reload(); }, 180);
  updateHUD();
}
function reload() {
  if (state.reloading > 0 || state.ammo === state.maxAmmo || state.mode !== 'playing') return;
  state.reloadDur = 1.05 * (state.reloadMult || 1);
  state.reloading = state.reloadDur;
  playSfx('rpg/metalClick.ogg', { volume: .32 });
  $('reload-text').textContent = 'RECARGANDO ' + currentWeapon().name + '...';
}
// ---------------------------------------------------------------------------
// DAÑO EN EL TIEMPO (quemadura y veneno). Un solo slot por hostil: el más
// fuerte gana y refresca la duración. El daño se aplica por segundo real.
function applyDot(e, dps, dur, color) {
  if (e.dead) return;
  if (!e.dot || e.dot.dps <= dps) e.dot = { dps, t: dur, color };
  else e.dot.t = Math.max(e.dot.t, dur);
}
function updateDots(dt) {
  for (const e of enemies) {
    if (e.dead || e.spawn > 0 || !e.dot) continue;
    e.dot.t -= dt;
    if (e.dot.t <= 0) { e.dot = null; continue; }
    // El DoT no puede rematar: deja al hostil a 1 de vida para que lo ejecutes.
    const dmg = e.dot.dps * dt;
    if (e.hp - dmg <= 1) { e.hp = Math.max(1, e.hp - dmg * .25); }
    else e.hp -= dmg;
    if (rnd() < dt * 6) motes(e.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), e.dot.color, 1, .5, 1.1);
  }
}

function damageEnemy(e, dmg, headshot) {
  let d = dmg;
  // Cambio de fase del jefe: breve ventana invulnerable, bien telegrafiada.
  if (e.invuln > 0) { e.flash = .06; return; }
  // GLITCH: cada impacto tira un dado; si sale, el golpe se multiplica por tres.
  if (state.chaosCrit > 0 && rnd() < state.chaosCrit) {
    d *= 3;
    fx.damageNumber(e.group.position.clone().add(new THREE.Vector3(0, 2.3, 0)), d, true, false);
  }
  if (e.armor > 0) { e.armor -= d * .5; d *= .45; if (e.armor <= 0) breakArmor(e); }
  if (e.shield > 0) { const abs = Math.min(e.shield, d); e.shield -= abs; d -= abs; e.shieldTimer = 4; }
  const crit = !headshot && rnd() < state.critChance;
  if (crit) d *= state.critMult;
  // EJECUCIÓN: si el golpe deja al hostil bajo el umbral y es un tiro a la
  // cabeza o cuerpo a cuerpo (o tienes COSECHA), se remata al instante.
  if (e.type !== 'boss' && e.hp - d > 0) {
    const hLvl = abilityLevel('harvest');
    const thr = executeThreshold() * e.maxHp;
    if (e.hp - d <= thr && (headshot || e.lastHitBy === 'melee' || hLvl > 0)) {
      executeEnemy(e, hLvl > 0 ? 'COSECHA' : headshot ? 'TIRO LIMPIO' : 'CUERPO A CUERPO');
      return;
    }
  }
  e.hp -= d; e.flash = .08; e.hitAnim = .18; e.hitDir = (e.hitDir || 0);
  e.knock = Math.max(e.knock || 0, Math.min(.55, d * .0022));
  audio.hit();
  // --- elementos de la build ------------------------------------------------
  // El arma única ya no inyecta quemadura, ralentización ni rebote: esos
  // efectos pertenecen a habilidades, módulos y reliquias (sistema intacto).
  if (state.burnOnHit > 0) applyDot(e, state.burnOnHit, 3, 0xff6a3d);
  const vLvl = abilityLevel('venom');
  if (vLvl > 0) applyDot(e, (4 + 2.5 * vLvl) * (1 + state.damage / 60), 4, 0xb6ff3d);
  // SIFÓN VITAL: cada impacto devuelve integridad (en headshot, el triple).
  const sLvl = abilityLevel('siphon');
  if (sLvl > 0 && !e.dead) {
    const heal = (.6 + sLvl * .5) * (headshot ? 3 : 1);
    state.hp = Math.min(state.maxHp, state.hp + heal);
  }
  // VORACIDAD: parte de cada golpe vuelve a ti en forma de vida.
  if (hasRelic('voracidad') && !e.dead) state.hp = Math.min(state.maxHp, state.hp + d * .06);
  // TRIÁNGULO DE DATOS: el headshot rebota al hostile siguiente.
  if (hasRelic('triangulo') && headshot && _chainDepth < 3) {
    const seen = new Set([e]);
    const next = nearestEnemy(e.group.position, 12, seen);
    if (next) {
      _chainDepth++;
      vfx.arc(e.group.position.clone().add(new THREE.Vector3(0, 1.9, 0)), next.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 0x8fdfff, 2);
      damageEnemy(next, d * .6, false);
      _chainDepth--;
    }
  }
  // CADENA: el proyectil salta a los hostiles cercanos (perk de la build).
  const chainCount = state.chainBonus || 0;
  if (chainCount > 0 && _chainDepth < 3) {
    _chainDepth++;
    let from = e;
    const seen = new Set([e]);
    for (let i = 0; i < chainCount; i++) {
      const next = nearestEnemy(from.group.position, 9, seen);
      if (!next) break;
      seen.add(next);
      vfx.arc(from.group.position.clone().add(new THREE.Vector3(0, 1.3, 0)), next.group.position.clone().add(new THREE.Vector3(0, 1.3, 0)), 0x9ff7ff, 2);
      damageEnemy(next, d * .62, false);
      from = next;
    }
    _chainDepth--;
  }
  if (d > 0.5) {
    const at = e.group.position.clone().add(new THREE.Vector3(0, (headshot ? 2.0 : 1.45) * e.group.scale.y, 0));
    fx.damageNumber(at, d, crit, !!headshot);
  }
  state.score += Math.round((headshot ? 18 : crit ? 12 : 7) * state.combo * currentLevel.rewardMult * state.scoreMult);
  $('hitmarker').className = 'show' + (crit ? ' crit' : ''); setTimeout(() => $('hitmarker').className = '', 70);
  if (crit) { fx.flash('#ff4d38', .12, 110); }
  if (e.hp <= 0) killEnemy(e, headshot);
  // RUIDO BLANCO: los críticos detonan. Se dispara DESPUÉS de resolver la baja
  // para no re-entrar en damageEnemy con el mismo hostil.
  else if (crit && state.critExplode && _chainDepth < 3) {
    _chainDepth++;
    explode(e.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 3.4, d * .75, 0x9ff7ff);
    _chainDepth--;
  }
}
function breakArmor(e) {
  for (const p of e.plates || []) { p.visible = false; }
  e.speed *= 1.32; e.armor = 0;
  spawnBurst(e.group.position.clone().add(new THREE.Vector3(0, 1.6, 0)), C.white, 18, 5);
  announce('BLINDAJE ROTO');
}
function killEnemy(e, headshot) {
  e.dead = true;
  // Los reflejos del jefe ECO son señuelos: no cuentan como baja ni dan botín.
  const phantom = !!e.phantom;
  if (!phantom) {
    state.kills++;
    tryGrantAchievement('firstblood');
    Meta.markSeen('enemies', e.type + ':' + e.faction, { kills: 1 });
  }
  // Baja cuerpo a cuerpo: progreso de la ranura, del objetivo y del logro.
  if (!phantom && e.lastHitBy === 'melee') {
    state.meleeKills++;
    if (state.obj && state.obj.id === 'execute') state.obj.have++;
    if (state.meleeKills >= 50) tryGrantAchievement('melee50');
  }
  if (state.combo >= 5) tryGrantAchievement('combo50');
  if (activeSynergies().length > 0) tryGrantAchievement('synergy');
  // Logro de arsenal redefinido: ya no hay armas extra, se concede al potenciar
  // el arma única con una bendición y llevar tres habilidades activas.
  if (state.weaponBlessing > 0 && Object.keys(state.abilities).length >= 3) tryGrantAchievement('arsenal');
  state.combo = Math.min(6, state.combo + .25); state.comboTimer = 4;
  state.frenzy = Math.min(100, state.frenzy + (phantom ? 3 : 7));
  if (state.frenzy >= 100 && state.frenzyTimer <= 0) {
    state.frenzyTimer = state.frenzyDuration; announce('FRENESÍ // VELOCIDAD Y CADENCIA MÁXIMAS'); audio.tone(120, .6, 'sawtooth', .18, 900);
    document.body.classList.add('frenzy');
  }
  const info = ENEMY_INFO[e.type] || ENEMY_INFO.chaser;
  const base = info.score * (e.elite ? 2 : 1);
  if (!phantom) {
    state.score += Math.round(base * state.combo * currentLevel.rewardMult * state.scoreMult);
    state.chips += Math.round((e.type === 'boss' ? 60 : e.elite ? 15 : 1 + rnd() * 2) * state.chipMult * (e.chipMult || 1));
  }
  state.charge = Math.min(100, state.charge + (e.type === 'boss' ? 50 : 12) * state.chargeMult);
  state.hp = Math.min(state.maxHp, state.hp + state.lifeOnKill * (state.healMult || 1));
  audio.kill(); state.shake = Math.max(state.shake, e.type === 'boss' ? .5 : e.elite ? .35 : .18);
  const color = e.faction === 'HIVE' ? 0xb6ff3d : e.faction === 'UMBRA' ? 0xb56bff : e.type === 'ranged' ? C.cyan : C.coral;
  const dp = e.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  const heavy = e.type === 'boss' || e.elite;
  // ROBO DE VIDA (El Vampiro): ocho partículas rojas de circle_01.png viajan
  // desde el enemigo derrotado hasta el héroe. El pool las guía con homing.
  if (!phantom && selectedCharacter === 'kira') {
    const target = player.position.clone().add(new THREE.Vector3(0, 1.25, 0));
    combatParticles?.preset('kira', 'lifesteal', dp, null, { target });
    playCharacterSfx('kira', 'lifesteal', { volume: .42 });
  }
  // Muerte por capas: metralla, destello, onda, cascara cristalina y marca en el suelo.
  spawnBurst(dp, color, e.type === 'boss' ? 60 : e.elite ? 34 : 20, e.type === 'boss' ? 8 : 5);
  spawnBurst(dp, 0xffffff, heavy ? 12 : 5, 4);
  ringPulse(e.group.position.clone(), color, heavy ? 5.5 : 2.6, .4);
  if (heavy) {
    crystalShell(dp, heavy ? 4.2 : 2.4, color, .42);
    shardRing(e.group.position.clone(), color, 2.4, e.type === 'boss' ? 18 : 9, 5);
    groundMark(e.group.position.clone(), color, 3.2, 1.1, .3);
    impactCore(dp, color, 1.6, .22);
  }
  if (e.faction === 'HIVE') spawnHazard(e.group.position.clone(), 'acid');
  if (abilityLevel('deathexplode')) {
    const lvl = abilityLevel('deathexplode'), r = 3.2 + lvl * .6, dmg = 45 + 25 * lvl;
    const chain = hasSynergy('demolition');
    explode(e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), r * (chain ? 1.4 : 1), dmg * (chain ? 1.25 : 1), C.coral);
  }
  // --- Afijos de élite: cada uno reacciona a su propia muerte --------------
  for (const f of (e.affixes || [])) if (f.onDeath) f.onDeath(e, AFFIX_API);
  // --- Módulo DETONADOR / resonancia de PULSO: cadena de detonaciones ------
  if (!phantom && state.killExplode > 0 && _chainDepth < 3 && rnd() < state.killExplode) {
    _chainDepth++;
    explode(e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 4.4, 40 + state.damage * 1.6, C.coral);
    _chainDepth--;
  }
  // --- OVERCLOCK: cada baja estira el frenesí ------------------------------
  const ocLvl = abilityLevel('overclock');
  if (ocLvl > 0 && !phantom) {
    state.frenzyTimer = Math.max(state.frenzyTimer, 0) + (.5 + ocLvl * .35);
    document.body.classList.add('frenzy');
  }
  // --- LEGIONARIA: los caídos dejan un eco leal ----------------------------
  const lgLvl = abilityLevel('legion');
  if (lgLvl > 0 && !phantom && companions.length < 12 && rnd() < (.20 + .12 * lgLvl)) {
    const before = companions.length;
    spawnCompanion(true);
    if (companions.length > before) {
      const ally = companions[companions.length - 1];
      ally.temp = (5 + lgLvl * 2) * (state.allyLifeMult || 1);
      motes(e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xb56bff, 8, 1.4, 1.6);
    }
  }
  // --- AEGIS: escudo por baja ----------------------------------------------
  if (state.shieldOnKill > 0 && state.maxShield > 0) state.shield = Math.min(state.maxShield, state.shield + state.shieldOnKill);
  // --- CORAZA VIVA: cada ejecución recarga el escudo por completo ----------
  if (hasRelic('coraza_viva') && e.lastHitBy === 'execute' && state.maxShield > 0) state.shield = state.maxShield;
  // --- CATALIZADOR DE PLAGA: el DoT salta al morir el portador -------------
  if (hasRelic('catalizador') && e.dot && !phantom) {
    const seen = new Set([e]);
    const next = nearestEnemy(e.group.position, 10, seen);
    if (next) applyDot(next, e.dot.dps, 4, e.dot.color);
  }
  // --- RONIN: rematar cuerpo a cuerpo recupera el dash ---------------------
  if (state.meleeDash && e.lastHitBy === 'melee') { state.dash = 1; }
  scene.remove(e.group); disposeObject3D(e.group);
  addFeed(phantom ? 'REFLEJO ROTO' : headshot ? 'HEADSHOT' : e.elite ? 'ÉLITE PURGADO' : 'SEÑAL PURGADA', phantom ? 0 : base);
  // El botín especial es más raro pero más contundente: jefe siempre, élite con probabilidad.
  if (e.type === 'boss') { for (let i = 0; i < 3; i++) spawnLootBox(e.group.position.clone().add(new THREE.Vector3((rnd() - .5) * 3, 0, (rnd() - .5) * 3))); }
  else if (e.elite && rnd() < .45) spawnLootBox(e.group.position.clone());
  $('hitmarker').className = 'show kill'; setTimeout(() => $('hitmarker').className = '', 140);
  if (e.type === 'boss') { fx.hitstop(140); fx.slowmo(900, .3); fx.flash(settings.flash ? '#ffffff' : 'transparent', settings.flash ? .55 : 0, 320); }
  else if (e.elite) { fx.hitstop(60); fx.flash(settings.flash ? '#ffbf47' : 'transparent', settings.flash ? .16 : 0, 140); }
  if (e.type === 'boss') {
    $('boss-wrap').classList.add('hidden');
    tryGrantAchievement('bossdown');
    // Cada jefe de sector derribado concede UNA reliquia única.
    const granted = grantRelic();
    if (granted) fx.hitstop(200);
    Meta.markSeen('bosses', e.bossKind, { kills: 1 });
    if (!state.bossHitTaken) tryGrantAchievement('nohit');
    state.bossHitTaken = false;
  }
  hudDirty = true;
}
// Logro: se guarda y se anuncia solo la primera vez.
function tryGrantAchievement(id) {
  if (Meta.grantAchievement(id)) {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    announce('LOGRO // ' + (a ? a.name : id));
    audio.tone(880, .12, 'sine', .12, 220); setTimeout(() => audio.tone(1180, .18, 'sine', .1, 160), 130);
  }
}
function hurt(amount, source) {
  if (state.dashing > 0 || state.mode !== 'playing') return;
  if ((state.invuln || 0) > 0) return;
  // GUARDIÁN: una capa de energía absorbe una parte fija de cada golpe.
  const wLvl = abilityLevel('ward');
  if (wLvl > 0) amount *= 1 - (.08 + .05 * wLvl);
  let dmg = amount * state.damageTaken;
  state.lastHit = { amount: Math.round(dmg), by: source || 'hostil', wave: state.wave, at: Date.now() };
  state.runTaken += dmg;
  // Para el logro INTOCABLE: ¿hay un jefe vivo mientras recibes daño?
  if (enemies.some(e => !e.dead && e.type === 'boss')) state.bossHitTaken = true;
  if (state.shield > 0) { const absorbed = Math.min(state.shield, dmg); state.shield -= absorbed; dmg -= absorbed; }
  state.hp -= dmg; state.combo = 1; state.comboTimer = 0; state.frenzy = Math.max(0, state.frenzy - 25);
  // La regeneración se corta 3 s (CARNE INFINITA lo ignora) y RETROALIMENTACIÓN
  // convierte el golpe en cadencia durante 4 s.
  state.hurtT = 3;
  if (state.retaliate > 0) state.retaliateT = 4;
  state.shake = Math.max(state.shake, .4); audio.hurt();
  // CORONA DE ESPINAS: cada golpe recibido erupciona espinas de fase alrededor.
  const spLvl = abilityLevel('spikes');
  if (spLvl > 0 && (state.spikeCd || 0) <= 0) {
    state.spikeCd = 1.1;
    const at = player.position.clone().add(new THREE.Vector3(0, 1, 0));
    shardRing(player.position.clone(), 0xff4d38, 4.5, 16, 6);
    ringPulse(player.position.clone(), 0xff4d38, 4.5, .35);
    crystalShell(at, 2.2, 0xff4d38, .3);
    for (const e of enemies) {
      if (e.dead || e.spawn > 0) continue;
      if (e.group.position.distanceTo(player.position) < 4.5) damageEnemy(e, 55 + 35 * spLvl, false);
    }
    if (state.maxShield > 0) state.shield = Math.min(state.maxShield, state.shield + 10);
  }
  // ESPEJO NEGRO: no esquiva, responde. Copia una parte del golpe y lo devuelve.
  if (hasRelic('espejo_negro') && typeof source === 'object' && source && source.group && !source.dead) {
    damageEnemy(source, dmg * .25, false);
    vfx.arc(player.position.clone().add(new THREE.Vector3(0, 1.2, 0)), source.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x9ff7ff, 2);
  }
  if (settings.flash) { $('damage-flash').style.opacity = '.8'; setTimeout(() => $('damage-flash').style.opacity = '0', 120); }
  if (state.hp <= 0) {
    // ÚLTIMO ALIENTO: una sola vez por incursión, la muerte se paga en tiempo.
    if (hasRelic('ultimo_aliento') && !state.revived) {
      state.revived = true; state.hp = Math.round(state.maxHp * .4); state.invuln = 2.5;
      announce('ÚLTIMO ALIENTO');
      audio.tone(90, 1.2, 'sawtooth', .2, 1400);
      fx.hitstop(160); fx.flash('#ff4d38', .5, 420);
      if (player) {
        crystalShell(player.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 3.4, 0xff4d38, 1.2);
        ringPulse(player.position.clone(), 0xff4d38, 8, 1);
        shardRing(player.position.clone(), 0xff8a6a, 3.6, 24, 8);
      }
      updateHUD(); return;
    }
    // RELOJ DE ARENA ROTO: si te queda sobrecarga, el golpe mortal la gasta.
    if (hasRelic('reloj_roto') && state.charge >= 100 && !state.revived) {
      state.revived = true; state.charge = 0; state.hp = Math.round(state.maxHp * .35); state.invuln = 2.2;
      overdrive();
      announce('RELOJ DE ARENA ROTO');
      if (player) { crystalShell(player.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 3.4, 0xb56bff, 1.2); ringPulse(player.position.clone(), 0xb56bff, 8, 1); }
      updateHUD(); return;
    }
    state.hp = 0; gameOver();
  }
  updateHUD();
}
// NÚCLEO INESTABLE: un disparo que no se parece a los tuyos. Atraviesa la arena
// entera en línea recta y no gasta munición ni cadencia.
function firePureLance(dir, dmgBase) {
  const origin = camera.position.clone();
  const mp = new THREE.Vector3(); player.userData.muzzle.getWorldPosition(mp);
  const hits = [];
  for (const e of enemies) {
    if (e.dead || e.spawn > 0) continue;
    const center = e.group.position.clone().add(new THREE.Vector3(0, 1.3 * e.group.scale.y, 0));
    const oc = center.clone().sub(origin), t = oc.dot(dir);
    if (t < 1 || t > 120) continue;
    if (origin.clone().addScaledVector(dir, t).distanceTo(center) > (e.radius + .7) * e.group.scale.y) continue;
    hits.push({ e, t });
  }
  hits.sort((a, b) => a.t - b.t);
  const end = hits.length
    ? origin.clone().addScaledVector(dir, hits[hits.length - 1].t + 8)
    : origin.clone().addScaledVector(dir, 90);
  tracer(mp, end, 0xff4d38, .22);
  tracer(mp.clone().add(new THREE.Vector3(0, .12, 0)), end, 0xffffff, .16);
  impactCore(mp.clone(), 0xff4d38, 1.6, .2);
  for (const h of hits) damageEnemy(h.e, dmgBase * 2.6, false);
  state.shake = Math.max(state.shake, .16);
  audio.tone(180, .18, 'sawtooth', .12, 620);
}
// El ZAPADOR no dispara recto: lanza un orbe en arco que revienta en área.
// El punto de caída se telegrafía en el suelo para que se pueda esquivar.
function lobProjectile(e) {
  const start = e.group.position.clone().add(new THREE.Vector3(0, 1.5 * e.group.scale.y, 0));
  const target = player.position.clone();
  const flight = 1.15;
  const m = new THREE.Mesh(new THREE.SphereGeometry(.22, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x2a1a06, emissive: 0xff8a3d, emissiveIntensity: 2.4, roughness: .4 }));
  m.position.copy(start); scene.add(m);
  groundMark(target.clone(), 0xff8a3d, 3.4, flight, .5);
  audio.tone(150, .2, 'sawtooth', .07, 120);
  lobs.push({ m, from: start.clone(), to: target.clone(), t: 0, dur: flight, dmg: (e.dmgMult || 1) * 22 });
}
function updateLobs(dt) {
  for (let i = lobs.length - 1; i >= 0; i--) {
    const l = lobs[i]; l.t += dt;
    const k = Math.min(1, l.t / l.dur);
    l.m.position.lerpVectors(l.from, l.to, k);
    l.m.position.y += Math.sin(k * Math.PI) * 4.2;        // arco parabólico
    l.m.rotation.x += dt * 6; l.m.rotation.y += dt * 4;
    if (k >= 1) {
      explode(l.m.position.clone(), 3.4, l.dmg, 0xff8a3d);
      shardRing(l.m.position.clone(), 0xffc9a0, 2.2, 8, 5);
      scene.remove(l.m); disposeObject3D(l.m); lobs.splice(i, 1);
    }
  }
}
function enemyShoot(e, radial = false) {
  const start = e.group.position.clone().add(new THREE.Vector3(0, 1.4 * e.group.scale.y, 0));
  const count = radial ? 12 : 1;
  for (let i = 0; i < count; i++) {
    let dir;
    if (radial) { const a = i / count * Math.PI * 2 + state.time; dir = new THREE.Vector3(Math.cos(a), .02, Math.sin(a)); }
    else dir = player.position.clone().add(new THREE.Vector3(0, 1, 0)).sub(start).normalize();
    const m = new THREE.Mesh(new THREE.SphereGeometry(radial ? .14 : .1, 6, 6), new THREE.MeshBasicMaterial({ color: e.faction === 'HIVE' ? 0xb6ff3d : e.faction === 'UMBRA' ? 0xb56bff : C.coral }));
    m.position.copy(start); scene.add(m);
    const mult = e.dmgMult || 1;
    projectiles.push({ m, dir, speed: radial ? 8 : 11, life: 5, damage: (radial ? 12 : 9) * mult, homing: !radial && e.faction === 'UMBRA' });
  }
  audio.tone(110, .12, 'square', .06, 70);
}

// ---------------------------------------------------------------- jugador
function jump() {
  if (state.mode !== 'playing') return;
  if (state.jumps <= 0) return;
  state.vy = state.jumpPower; state.jumps--; state.py += .05; state.grounded = false;
  player.userData.thrusters.visible = true;
  audio.jump();
  spawnBurst(player.position.clone().add(new THREE.Vector3(0, .3, 0)), C.cyan, 6, 2);
}
function updatePlayer(dt) {
  const fwd = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
  const move = new THREE.Vector3();
  if (keys.KeyW || padMove.y < -.35) move.add(fwd); if (keys.KeyS || padMove.y > .35) move.sub(fwd);
  if (keys.KeyD || padMove.x > .35) move.add(right); if (keys.KeyA || padMove.x < -.35) move.sub(right);
  if (move.lengthSq() > 0) move.normalize();
  const speed = state.speed * (frenzyActive() ? 1.25 : 1) * (state.overdrive > 0 ? 1.1 : 1) * (state.stim > 0 ? 1.35 : 1) * (state.slowT > 0 ? (state.slowFactor || 1) : 1);
  if (state.dashing > 0) {
    state.dashing -= dt; state.slide = 1;
    player.position.addScaledVector(state.dashDir || fwd, 26 * dt);
    // Polvo a ras de suelo mientras derrapa.
    if (rnd() < .55) spawnBurst(player.position.clone().add(new THREE.Vector3(0, .18, 0)), 0xcfc6b4, 2, 1.3);
  } else {
    state.slide = Math.max(0, (state.slide || 0) - dt * 2.4);
    player.position.addScaledVector(move, speed * dt);
  }
  // Pozo de gravedad (jefe): te arrastra hacia él mientras esté activo.
  if (state.pullT > 0) {
    state.pullT -= dt;
    const dx = state.pullX - player.position.x, dz = state.pullZ - player.position.z;
    const d = Math.hypot(dx, dz) || 1;
    player.position.x += (dx / d) * state.pullForce * dt;
    player.position.z += (dz / d) * state.pullForce * dt;
  }
  collideXZ(player.position, state.py);

  const ground = groundAt(player.position.x, player.position.z, state.py);
  const airborne = state.vy > 0 || state.py > ground + .03;
  if (airborne) {
    state.vy -= 26 * dt; state.py += state.vy * dt;
    if (state.py <= ground) {
      const hard = state.vy < -14; state.py = ground; state.vy = 0; state.grounded = true; state.jumps = state.maxJumps;
      player.userData.thrusters.visible = false;
      if (hard) { spawnBurst(player.position.clone().add(new THREE.Vector3(0, .2, 0)), C.cyan, 8, 2); state.shake = Math.max(state.shake, .12); state.camDip = .26; state.landT = 1; audio.noise(.09, .1); ringPulse(player.position.clone(), C.cyan, 2.2, .3); }
    } else state.grounded = false;
  } else { state.py = ground; state.vy = 0; state.grounded = true; state.jumps = state.maxJumps; player.userData.thrusters.visible = false; }
  player.position.y = state.py - (state.slide || 0) * .58;

  const slide = state.slide || 0;
  const ud = player.userData;
  // Pose de deslizamiento: se agacha, inclina el torso atrás y estira la pierna delantera.
  player.rotation.set(.52 * slide, state.yaw + (state.modelYaw || 0), 0);
  const moving = move.lengthSq() > 0 ? 1 : 0;
  // --- curva de tajo melé: anticipación -> cruce -> recuperación ----------
  // `meleeSwing` baja de 1 a 0. El tramo negativo carga el arma hacia atrás
  // y el positivo la cruza delante del cuerpo; el hacha es más amplia/lenta
  // que la espada. Además de los clips Mixamo, mueve torso, brazos y soporte
  // del GLB para que el filo acompañe de verdad al golpe.
  const heavySwing = selectedCharacter === 'ronin';
  let swingPose = 0;
  if (state.meleeSwing > 0) {
    const t = 1 - state.meleeSwing;
    swingPose = (t < .26
      ? -Math.sin(t / .26 * Math.PI * .5)
      : Math.sin((t - .26) / .74 * Math.PI) * (1 - (t - .26) / .74 * .25))
      * (heavySwing ? .95 : .72);
    player.rotation.y += swingPose * .42;
  }
  // Mismo contrato lógico de siempre, ahora traducido a clips Mixamo por el
  // AnimationMixer: reposo / caminar / correr / aire / dash / cuerpo a cuerpo.
  // Las variables son exactamente las que movían las piernas y brazos del rig
  // anterior (moving, slide, grounded, meleeSwing, ads, reloading, speed...).
  setCharacterMotion(player, {
    moving: !!moving, grounded: state.grounded, dashing: state.dashing, slide,
    meleeSwing: state.meleeSwing, meleeSeq: state.meleeSeq,
    meleeStyle: isMeleeHero() ? (selectedCharacter === 'ronin' ? 'heavy' : 'fast') : null,
    reloading: state.reloading, ads: state.ads,
    speed, overdrive: state.overdrive, frenzy: state.frenzy,
    // Física vertical real: con vy + el flanco de grounded el mixer distingue
    // despegue, doble salto, caída y compresión de aterrizaje.
    vy: state.vy, landT: state.landT || 0
  });
  // La cadencia de zancada va con la velocidad real: correr acelera el paso y
  // frenar lo arrastra. Antes era una constante y los pies patinaban.
  const spd01 = clamp(state.speed / 12, .55, 1.6);
  const phase = state.time * 11 * spd01;
  state.recoil = Math.max(0, state.recoil - dt * 7);
  const breathe = Math.sin(state.time * 1.7) * .014 * (moving ? .25 : 1);
  const stride = Math.sin(phase) * .65 * moving;
  ud.legs[0].rotation.x = stride;
  ud.legs[1].rotation.x = -stride;
  if (!state.grounded) { ud.legs[0].rotation.x = -.5; ud.legs[1].rotation.x = .35; }
  if (slide > .02) {
    ud.legs[0].rotation.x = ud.legs[0].rotation.x * (1 - slide) - 1.25 * slide;
    ud.legs[1].rotation.x = ud.legs[1].rotation.x * (1 - slide) + .82 * slide;
  }
  // Brazos: contrabalanceo al correr, recogidos al apuntar.
  const aim = state.ads ? 1 : 0;
  ud.arms[0].rotation.x = -1.05 - state.recoil * .35 + slide * .55 - swingPose * 1.15 - stride * .2 * (1 - aim);
  ud.arms[1].rotation.x = -1.28 - state.recoil * .45 + slide * .85 + stride * .16 * (1 - aim) + swingPose * .95;
  ud.arms[1].rotation.z = -swingPose * .55;
  ud.torso.position.y = 1.62 + breathe;
  ud.chestPlate.position.y = 1.66 + breathe;
  // Inclinación al desplazarse de lado y balanceo del impulso: el cuerpo acompaña
  // al mando en vez de deslizarse rígido.
  const strafe = (keys.KeyD || padMove.x > .35 ? 1 : 0) - (keys.KeyA || padMove.x < -.35 ? 1 : 0);
  player.rotation.z = -strafe * .085 * moving + (state.dashRoll || 0) + Math.sin(phase * .5) * .01 * moving + swingPose * .16;
  // Compresión de aterrizaje: absorbe el impacto en el torso y las rodillas.
  if ((state.landT || 0) > 0) {
    state.landT = Math.max(0, state.landT - dt * 5);
    const k = state.landT * state.landT;
    ud.torso.position.y -= k * .17;
    ud.chestPlate.position.y -= k * .17;
    ud.legs[0].rotation.x += k * .4;
    ud.legs[1].rotation.x += k * .4;
  }
  ud.head.rotation.x = clamp(-state.pitch * .45, -.32, .3);
  ud.head.rotation.y = clamp(Math.sin(state.time * .7) * .05, -.2, .2);
  // Núcleo dorsal: late más rápido en sobrecarga y con cada disparo.
  if (ud.core) {
    const od = state.overdrive > 0 ? 1 : 0;
    const beat = 1 + Math.sin(state.time * (3.4 + od * 9)) * (.07 + od * .12) + state.recoil * .3;
    ud.core.userData.bulb.scale.setScalar(beat);
    ud.core.userData.halo.rotation.z += dt * (1.2 + od * 7);
    ud.core.userData.halo.scale.setScalar(1 + od * .3 + state.recoil * .2);
  }
  ud.pAccent.emissiveIntensity = .9 + (state.overdrive > 0 ? 1.1 : 0) + state.recoil * .55;
  // Retroceso del soporte del arma única: el GLB va colgado de él, así que
  // todo el modelo retrocede y se inclina en vez de una pieza procedural.
  const gun = player.userData.gun;
  if (gun) {
    gun.position.z = -.48 + state.recoil * .14 - swingPose * .16;
    gun.rotation.x = -state.recoil * .3 + swingPose * .85;
    gun.rotation.y = -swingPose * .5;
    if (state.reloading <= 0) gun.rotation.z = swingPose * .35;
  }
  player.userData.scarf.rotation.x = -.3 - Math.sin(state.time * 5) * .15 - moving * .35;
  if (player.userData.cloak.visible) player.userData.cloak.rotation.x = Math.sin(state.time * 2.1) * .07 - moving * .22;
  state.dash = Math.min(1, state.dash + dt / state.dashRecovery);
  state.fireTimer = Math.max(0, state.fireTimer - dt);
  // Temporizadores de las ranuras de carga y del gato.
  if (state.meleeCd > 0) state.meleeCd -= dt;
  // La ventana del clip acompaña al enfriamiento: .5 s para el hacha y .34 s
  // para la espada. Antes era .31 s para ambos y el combo Mixamo (4.3 s a 3×)
  // solo alcanzaba a mostrar la preparación del primer golpe.
  if (state.meleeSwing > 0) state.meleeSwing = Math.max(0, state.meleeSwing - dt * (heavySwing ? 2.0 : 2.9));
  if (state.catCd > 0) state.catCd -= dt;
  if ((state.invuln || 0) > 0) state.invuln -= dt;
  if ((state.hurtT || 0) > 0) state.hurtT -= dt;
  if ((state.retaliateT || 0) > 0) state.retaliateT -= dt;
  if ((state.slowT || 0) > 0) { state.slowT -= dt; if (state.slowT <= 0) state.slowFactor = 1; }
  if (state.reloading > 0) {
    state.reloading -= dt;
    if (gun) gun.rotation.z = Math.sin(((state.reloadDur || 1.05) - state.reloading) * 5) * .5;
    if (state.reloading <= 0) {
      state.ammo = state.maxAmmo;
      if (gun) gun.rotation.z = 0;
      $('reload-text').textContent = currentWeapon().name + ' // LISTO';
      audio.tone(620, .06, 'square', .08, 80);
    }
  }
  if (state.overdrive > 0) state.overdrive -= dt;
  if (state.frenzyTimer > 0) {
    state.frenzyTimer -= dt;
    if (state.frenzyTimer <= 0) { state.frenzy = 0; document.body.classList.remove('frenzy'); }
  } else state.frenzy = Math.max(0, state.frenzy - dt * 5);
  // Un único botón de ataque: CLIC / gatillo. El enrutamiento lo decide el
  // arma única del héroe (melé o a distancia), no una tecla auxiliar.
  if (mouseDown || state.padFire) primaryAttack();
  if (state.comboTimer > 0) { state.comboTimer -= dt; if (state.comboTimer <= 0) state.combo = 1; }
  // -------------------------------------------------- cámara de tercera persona anclada
  // El brazo de cámara es rígido: el personaje no se mueve del mismo punto de la pantalla
  // ni al correr, ni al saltar, ni al girar. Solo cambia el zoom (distancia).
  updateCamera(dt);
  const wantFov = settings.fov + state.dashPunch * 3 + (frenzyActive() ? 4 : 0) + (state.overdrive > 0 ? 2 : 0) - (state.ads ? 10 : 0);
  if (Math.abs(wantFov - camera.fov) > .05) { camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 9); camera.updateProjectionMatrix(); }
  state.dashPunch = Math.max(0, state.dashPunch - dt * 3.8);
  state.dashRoll += (0 - state.dashRoll) * Math.min(1, dt * 7);
}

// ------------------------------------------------------------------ cámara
// Punto de pantalla donde se clava el personaje (en NDC: -1 izquierda/abajo, 1 derecha/arriba).
const CAM = {
  anchorX: -0.26,
  anchorY: -0.26,
  anchorHeight: 1.45,
  dist: 6.1,
  adsDist: 3.7,
  minDist: 2.0,
  clearance: 1.15,
  shakeMax: .12
};
let camDist = CAM.dist, camDistTarget = CAM.dist;
const _anchor = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();
function updateCamera(dt) {
  // Orientación: exactamente la del disparo. Sin suavizado, sin deriva.
  camera.rotation.set(state.pitch, state.yaw, 0);
  camera.updateMatrix();

  // El desplazamiento se deduce del punto de pantalla deseado, así el ancla se mantiene
  // aunque cambie el FOV, el ADS o la relación de aspecto de la ventana.
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) * .5);
  _dir.set(-CAM.anchorX * camera.aspect * tan, -CAM.anchorY * tan, 1).applyQuaternion(camera.quaternion);
  _anchor.set(player.position.x, state.py + CAM.anchorHeight, player.position.z);

  // Distancia: se suaviza sola. Al chocar con geometría solo se acorta, nunca gira.
  camDistTarget += ((state.ads ? CAM.adsDist : CAM.dist) - camDistTarget) * Math.min(1, dt * 8);
  let allowed = camDistTarget;
  for (let i = 0; i < 5; i++) {
    const cy = _anchor.y + _dir.y * allowed;
    const g = groundAt(_anchor.x + _dir.x * allowed, _anchor.z + _dir.z * allowed, cy + 2.4, 3.4) + CAM.clearance;
    if (cy >= g) break;
    allowed *= .78;
  }
  allowed = Math.max(CAM.minDist, allowed);
  // Se encoge rápido (evita atravesar muros) y se recupera despacio (evita saltos).
  camDist += (allowed - camDist) * Math.min(1, dt * (allowed < camDist ? 20 : 5));

  camera.position.set(_anchor.x + _dir.x * camDist, _anchor.y + _dir.y * camDist, _anchor.z + _dir.z * camDist);

  // Sacudida mínima y en ejes locales: comunica el impacto sin mover el encuadre.
  if (state.shake > 0) {
    state.shake = Math.max(0, state.shake - dt * 2.8);
    const s = Math.min(CAM.shakeMax, state.shake) * .5;
    _camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    _camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.position.addScaledVector(_camRight, (rnd() - .5) * s).addScaledVector(_camUp, (rnd() - .5) * s);
  }
  camera.updateMatrixWorld(true);
}
// Marca de derrape en el suelo: hace legible por dónde has deslizado.
function spawnSlideTrail() {
  // Plano del pool, orientado al dash: sin geometría ni material nuevos.
  vfx.skid({ x: player.position.x, y: state.py, z: player.position.z }, 0xc9bda6, 1.15, 4.6, state.yaw, .6, .4);
  ringPulse(player.position.clone(), 0xcfc6b4, 3.2, .4);
}
function dash() {
  if (state.mode !== 'playing' || state.dash < 1 || state.dashing > 0) return;
  state.dash = 0; state.dashing = .3; state.slide = 1;
  const f = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  const r = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
  state.dashDir = new THREE.Vector3();
  if (keys.KeyW) state.dashDir.add(f); if (keys.KeyS) state.dashDir.sub(f);
  if (keys.KeyD) state.dashDir.add(r); if (keys.KeyA) state.dashDir.sub(r);
  if (state.dashDir.lengthSq() === 0) state.dashDir.copy(f);
  state.dashDir.normalize();
  spawnSlideTrail();
  audio.dash();
  // Efecto de cámara del dash: empuje de FOV, cabeceo y líneas de velocidad.
  state.dashPunch = 1;
  state.dashRoll = -state.dashDir.dot(r) * .085;
  if (settings.fx) fx.speedLines(true);
  setTimeout(() => fx.speedLines(false), 280);
  fx.flash('#6ef7e7', .08, 120);
  spawnBurst(player.position.clone().add(new THREE.Vector3(0, 1, 0)), C.cyan, 14, 3);
  // PEONZA DE FASE: el dash deja una huella que sigue cortando donde la dejaste.
  if (hasRelic('peonza')) dropPhaseTop();
  // CONTRAEMBESTIDA: dashear te vuelve intocable y descarga el daño al salir.
  const bwLvl = abilityLevel('bulwark');
  if (bwLvl > 0) {
    state.invuln = .5 + bwLvl * .25;
    crystalShell(player.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 2.6, 0x6ef7e7, .5);
    setTimeout(() => {
      if (state.mode !== 'playing' || !player) return;
      const at = player.position.clone().add(new THREE.Vector3(0, 1, 0));
      ringPulse(at.clone(), 0x6ef7e7, 5.2, .4);
      shardRing(player.position.clone(), 0x9ff7ff, 3.4, 14, 6);
      for (const e of enemies) {
        if (e.dead || e.spawn > 0) continue;
        if (e.group.position.distanceTo(player.position) < 5.2) damageEnemy(e, 40 + 28 * bwLvl, false);
      }
      audio.tone(300, .22, 'square', .12, 180);
    }, (0.5 + bwLvl * .25) * 1000);
  }
  if (abilityLevel('dashwave')) {
    const lvl = abilityLevel('dashwave'), dmg = 55 + 30 * lvl;
    const p = player.position.clone().addScaledVector(state.dashDir, 2.2);
    // Onda de choque en capas: anillo, cúpula, metralla dirigida y marca en el suelo.
    ringPulse(p, C.coral, 6, .45);
    ringPulse(p, 0xffffff, 3.2, .3);
    groundMark(p.clone(), C.coral, 7, .9, .4);
    crystalShell(p.clone().add(new THREE.Vector3(0, 1, 0)), 5, C.coral, .38);
    shardRing(p.clone(), 0xffc9b0, 3.4, 12, 5.5);
    spawnBurst(p.clone().add(new THREE.Vector3(0, .8, 0)), C.coral, 18, 6);
    impactCore(p.clone().add(new THREE.Vector3(0, 1, 0)), C.coral, 2, .2);
    state.shake = Math.max(state.shake, .3); audio.tone(70, .3, 'sawtooth', .2, -50);
    for (const e of enemies) {
      if (e.dead || e.spawn > 0) continue;
      const d = e.group.position.distanceTo(p);
      if (d < 6) damageEnemy(e, dmg, false);
      // Sinergia VÓRTICE: el pulso succiona a los hostiles hacia el impacto.
      if (hasSynergy('vortex') && d < 10) {
        const pull = e.group.position.clone().sub(p); pull.y = 0; pull.normalize().multiplyScalar(3.4);
        e.group.position.sub(pull); e.slow = Math.max(e.slow, .8); e.slowFactor = .6;
      }
    }
    if (hasSynergy('vortex')) { ringPulse(p, 0xb56bff, 10, .6); fx.flash('#b56bff', .14, 160); }
  }
}
function overdrive() {
  if (state.mode !== 'playing' || state.charge < 100 || state.overdrive > 0) return;
  state.charge = 0; state.overdrive = state.overdriveDuration; syncAmmo();
  announce(`SOBRECARGA // ${state.overdriveDuration.toFixed(1)} SEGUNDOS`);
  audio.tone(90, .8, 'sawtooth', .2, 700);
}

// ---------------------------------------------------------------- enemigos IA
// ---------------------------------------------------------------------------
// REGLA PROPIA DE CADA OPERADOR. Se aplica una vez por incursión, al limpiar el
// estado. Cada perk está pensado para cambiar una decisión, no una estadística.
function applyOperatorPerk(perk) {
  if (!perk) return;
  if (perk.chain) state.chainBonus = (state.chainBonus || 0) + perk.chain;   // NYX
  if (perk.burn) state.burnOnHit = (state.burnOnHit || 0) + perk.burn;       // PYRE
  if (perk.startShield) { state.maxShield += perk.startShield; state.shield = state.maxShield; }  // AEGIS
  if (perk.shieldOnKill) state.shieldOnKill = (state.shieldOnKill || 0) + perk.shieldOnKill;      // AEGIS
  if (perk.chaos) state.chaosCrit = (state.chaosCrit || 0) + perk.chaos;     // GLITCH
  if (perk.startCompanions) for (let i = 0; i < perk.startCompanions; i++) spawnCompanion(true);  // SERAPH
  if (perk.meleeMult) state.meleeMult = (state.meleeMult || 1) * perk.meleeMult;                 // RONIN
  if (perk.meleeDash) state.meleeDash = true;                                                    // RONIN
  if (perk.pierce) state.pierceBonus += perk.pierce;                                             // CIPHER
  if (perk.hsBonus) state.headshotMult += perk.hsBonus;                                          // CIPHER
}

// ---------------------------------------------------------------------------
// RELIQUÍAS: una pieza, una regla. Se conceden al derribar a un jefe y no se
// repiten. Cada gancho está en el sitio exacto donde la regla debe notarse.
function hasRelic(id) { return state.relics.includes(id); }
// Registro de reliquías CON GANCHO REAL en el bucle de juego. Si añades una
// reliquía a arsenal.js y no la apuntas aquí, el MEGA_TEST la marca como hueca:
// es la red que evita que una pieza exista solo como texto bonito.
const RELIC_WIRED = new Set([
  'core_inestable',  // firePureLance() en shoot(), cada 12 disparos
  'reloj_roto',      // hurt(): el golpe mortal gasta la sobrecarga
  'peonza',          // dash(): deja una peonza que sigue cortando
  'moneda_partida',  // grantRelic() x2 chips + spawnWave() peaje de vida
  'catalizador',     // killEnemy(): el DoT salta al hostile más cercano
  'espejo_negro',    // hurt(): devuelve el 25% al atacante
  'imantadora',      // updateLoot(): el botín viaja hacia ti
  'amalgama',        // allyLifeMult: los aliados temporales duran el doble
  'segadora',        // executeThreshold(): umbral de remate al 30%
  'sobrecarga',      // grantRelic(): +60% de carga y +2 s
  'coraza_viva',     // killEnemy(): el remate recarga el escudo entero
  'triangulo',       // damageEnemy(): el headshot rebota al siguiente
  'jaula',           // updateRelicSystems(): ancla a 4 m
  'ultimo_aliento',  // hurt(): segunda vida al 40%
  'voracidad',       // damageEnemy(): roba el 6% como vida
  'satélite'         // updateRelicSystems(): impacto orbital cada 20 s
]);
function testRelicHook(id) { return RELIC_WIRED.has(id); }
function grantRelic() {
  const pool = RELICS.filter(r => !state.relics.includes(r.id));
  if (!pool.length) return null;
  const r = pool[Math.floor(rnd() * pool.length)];
  state.relics.push(r.id);
  announce('RELIQUIA // ' + r.name);
  audio.tone(120, 1.1, 'sawtooth', .16, 900);
  setTimeout(() => audio.tone(480, .7, 'triangle', .12, 600), 180);
  if (player) {
    const col = hexToInt(r.color), at = player.position.clone().add(new THREE.Vector3(0, 1.3, 0));
    crystalShell(at, 3.6, col, 1.3);
    ringPulse(player.position.clone(), col, 7, 1.1);
    shardRing(player.position.clone(), col, 3.4, 22, 7);
    gridRipple(player.position, col, 4);
  }
  if (typeof cine !== 'undefined' && cine) cine.kick(.4);
  if (r.id === 'sobrecarga') { state.chargeMult *= 1.6; state.overdriveDuration += 2; }
  if (r.id === 'moneda_partida') state.chipMult *= 2;
  if (r.id === 'amalgama') state.allyLifeMult = 2;
  Meta.markSeen('relics', r.id);
  hudDirty = true;
  return r;
}
// Peonzas que deja el dash con PEONZA DE FASE.
const relicTops = [];
function dropPhaseTop() {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(.38, 0),
    new THREE.MeshStandardMaterial({ color: 0x0d2c33, emissive: 0x6ef7e7, emissiveIntensity: 2.4, roughness: .3 }));
  m.position.copy(player.position.clone().add(new THREE.Vector3(0, 1.1, 0)));
  scene.add(m);
  relicTops.push({ m, t: 3, hit: {} });
}
function updateRelicSystems(dt) {
  // PEONZA DE FASE: la huella del dash sigue cortando donde la dejaste.
  for (let i = relicTops.length - 1; i >= 0; i--) {
    const t = relicTops[i]; t.t -= dt;
    t.m.rotation.y += dt * 14; t.m.rotation.x += dt * 9;
    for (const e of enemies) {
      if (e.dead || e.spawn > 0) continue;
      if (e.group.position.distanceTo(t.m.position) > 2.6) continue;
      if ((t.hit[e.group.uuid] || 0) > 0) continue;
      t.hit[e.group.uuid] = .35;
      damageEnemy(e, state.damage * 1.15, false);
    }
    for (const k in t.hit) t.hit[k] -= dt;
    if (t.t <= 0) {
      ringPulse(t.m.position.clone(), 0x6ef7e7, 2.6, .35);
      scene.remove(t.m); disposeObject3D(t.m); relicTops.splice(i, 1);
    }
  }
  // JAULA DE INTERFERENCIA: lo que se te acerque demasiado, se queda.
  if (hasRelic('jaula')) {
    state.jaulaCd = (state.jaulaCd || 0) - dt;
    if (state.jaulaCd <= 0) {
      state.jaulaCd = .5;
      for (const e of enemies) {
        if (e.dead || e.spawn > 0) continue;
        if (e.group.position.distanceTo(player.position) < 4) {
          e.slow = Math.max(e.slow || 0, 1); e.slowFactor = Math.min(e.slowFactor || 1, .05);
        }
      }
    }
  }
  // SATÉLITE CAÍDO: un impacto orbital automático sobre el grupo más grande.
  if (hasRelic('satélite')) {
    state.satCd = (state.satCd || 0) - dt;
    if (state.satCd <= 0) {
      state.satCd = 20;
      let best = null, bestN = 0;
      for (const e of enemies) {
        if (e.dead || e.spawn > 0) continue;
        let n = 0;
        for (const o of enemies) if (!o.dead && o.spawn <= 0 && o.group.position.distanceTo(e.group.position) < 6) n++;
        if (n > bestN) { bestN = n; best = e; }
      }
      if (best) {
        const p = best.group.position.clone();
        groundMark(p.clone(), 0xffbf47, 5, 1, .5);
        setTimeout(() => {
          if (state.mode !== 'playing') return;
          explode(p.clone().add(new THREE.Vector3(0, .5, 0)), 5, 260 + state.damage * 2.4, 0xffbf47);
          shardRing(p.clone(), 0xffd34d, 3, 14, 7);
          gridRipple(p, 0xffbf47, 3);
        }, 900);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// ANIMACIÓN DE JEFE — un único punto de mantenimiento para toda la presencia.
// Cada jefe declara en userData qué piezas quiere ver moverse y aquí se traduce
// a movimiento real. Aquí no hay lógica de combate: solo lectura de intención.
function animateBossModel(e, dt) {
  const u = e.group.userData;
  const t = state.time;
  const hpFrac = e.maxHp > 0 ? e.hp / e.maxHp : 1;
  const rage = 1 - hpFrac;                 // 0 recién aparecido, 1 al borde de caer
  const casting = e.telegraphT > 0 ? 1 : 0;

  // --- anillo de fase: crece por fase y se calienta al perder vida ----------
  if (u.phaseRing) {
    const s = 2.2 + Math.sin(t * 1.6) * .12 + e.phaseIdx * .55;
    u.phaseRing.scale.setScalar(s);
    u.phaseRing.material.opacity = .2 + Math.sin(t * 3.2) * .05 + e.phaseIdx * .1 + casting * .18;
    u.phaseRing.rotation.z += dt * (.35 + e.phaseIdx * .5 + casting * .8);
    if (u.phaseRing2) {
      u.phaseRing2.scale.setScalar(s * 1.34);
      u.phaseRing2.rotation.z -= dt * (.5 + e.phaseIdx * .6);
      u.phaseRing2.material.opacity = .1 + e.phaseIdx * .07;
    }
  }
  // --- fragmentos de órbita: aparecen en la fase 2 y aceleran con la furia --
  if (u.orbitShards) {
    const on = e.phaseIdx >= 1;
    const spin = 1.1 + rage * 2.0;
    for (let i = 0; i < u.orbitShards.length; i++) {
      const m = u.orbitShards[i];
      m.visible = on;
      if (!on) continue;
      const a = t * spin + (i / u.orbitShards.length) * Math.PI * 2;
      const r = 2.7 + Math.sin(t * 2 + i) * .25;
      m.position.set(Math.cos(a) * r, 1.4 + Math.sin(t * 1.7 + i * 1.3) * .8, Math.sin(a) * r);
      m.rotation.x += dt * 2.2; m.rotation.y += dt * 3.1;
    }
  }
  // --- latido del emisivo: late más rápido cuanto más herido está -----------
  if (u.pulses) {
    const beat = .5 + .5 * Math.sin(t * (2.2 + rage * 7));
    const k = 1 + rage * 1.5 + beat * (.2 + rage * .5) + casting * .8;
    for (let i = 0; i < u.pulses.length; i++) u.pulses[i].m.emissiveIntensity = u.pulses[i].base * k;
  }

  // --- piezas declaradas por cada jefe -------------------------------------
  // FLORACIÓN: los pétalos se abren al telegrafiar y se cierran al descansar.
  if (u.petals) {
    const open = .32 + casting * .55 + Math.sin(t * 1.1) * .06;
    for (let i = 0; i < u.petals.length; i++) u.petals[i].rotation.x = -open;
  }
  // RESCOLDO: las brasas laten y las motas orbitan sin descanso.
  if (u.embers) {
    for (let i = 0; i < u.embers.length; i++) {
      const m = u.embers[i].material;
      if (m) m.opacity = .55 + Math.abs(Math.sin(t * (3 + i * .7))) * .45;
    }
  }
  if (u.motes) {
    for (const mo of u.motes) {
      const a = mo.a + t * (.8 + mo.i * .06);
      mo.o.position.set(Math.cos(a) * mo.rr, 1.1 + Math.sin(t * 1.4 + mo.i) * 1.6, Math.sin(a) * mo.rr);
    }
  }
  // ESPECTRO CERO: los ecos se desplazan detrás y se desvanecen.
  if (u.echoes) {
    for (let i = 0; i < u.echoes.length; i++) {
      const ec = u.echoes[i];
      const k = (t * .6 + i * .33) % 1;
      ec.position.set(Math.sin(t * 1.2 + i) * .5, 0, -k * 1.6);
      ec.traverse(o => { if (o.isMesh && o.material) o.material.opacity = .16 * (1 - k); });
    }
  }
  // HÉLICE PRIMARIA: los nodos recorren la doble hélice.
  if (u.strandNodes) {
    for (const n of u.strandNodes) {
      const a = n.t * Math.PI * 4 + n.s * Math.PI + t * 2.4;
      const r = .85 + Math.sin(n.t * Math.PI * 2) * .25;
      n.o.position.set(Math.cos(a) * r, .6 + n.t * 3.4, Math.sin(a) * r);
    }
  }
  // OMEGA: las capas se separan al enfurecer y los fragmentos orbitan.
  if (u.shells) {
    for (let i = 0; i < u.shells.length; i++) {
      const k = 1 + e.phaseIdx * (.18 + i * .12) + rage * .3;
      u.shells[i].scale.set(k, k, k);
      u.shells[i].material.opacity = .92 - e.phaseIdx * .12;
    }
  }
  if (u.frag) {
    for (const f of u.frag) {
      const a = f.a + t * (.6 + f.i * .05);
      f.o.position.set(Math.cos(a) * 2.3, 1.6 + Math.sin(t * 1.3 + f.i) * .7, Math.sin(a) * 2.3);
    }
  }
  // PARADOJA: las dos mitades respiran en oposición.
  if (u.halves) {
    for (let h = 0; h < u.halves.length; h++) {
      u.halves[h].position.x = (h ? .55 : -.55) + Math.sin(t * 1.2 + (h ? Math.PI : 0)) * .14;
    }
  }
  // HIDRA: los cuellos se balancean buscando al jugador.
  if (u.heads && player) {
    for (let i = 0; i < u.heads.length; i++) {
      u.heads[i].rotation.y = Math.sin(t * 1.1 + i * 1.4) * .28;
      u.heads[i].rotation.x = Math.sin(t * .8 + i) * .1 - casting * .2;
    }
  }
  // CRISOL / FORJA: los brazos se balancean como péndulos de fundición.
  if (u.arms && e.type === 'boss') {
    for (let i = 0; i < u.arms.length; i++) {
      u.arms[i].rotation.x = Math.sin(t * 1.7 + i * 1.6) * .18;
      u.arms[i].rotation.z = Math.sin(t * 1.2 + i) * .1;
    }
  }
  // MATRIARCA: los sacos brillan antes de soltar cría.
  if (u.sacs) {
    for (let i = 0; i < u.sacs.length; i++) {
      const m = u.sacs[i].material;
      if (m) m.emissiveIntensity = .5 + Math.abs(Math.sin(t * 2.4 + i)) * 1.6 + casting * 2.2;
    }
  }
  // ECO: los fragmentos parpadean como espejos rotos.
  if (u.shards) {
    for (let i = 0; i < u.shards.length; i++) {
      u.shards[i].position.x += Math.sin(t * 3 + i) * .002;
    }
  }
  // SUPERVISOR: los pods aceleran al telegrafiar.
  if (u.pods) {
    for (let i = 0; i < u.pods.length; i++) {
      u.pods[i].rotation.y += dt * (2.2 + casting * 4);
    }
  }
  // HERALDO: el orbe del báculo brilla antes de lanzar.
  if (u.orb) u.orb.material.emissiveIntensity = 1.6 + casting * 3.4 + Math.sin(t * 4) * .4;
  // WARDEN / MAGNA: retroceso del cañón al abrir fuego.
  if (u.cannon) u.cannon.position.z = (u.cannon.userData.baseZ ?? (u.cannon.userData.baseZ = u.cannon.position.z)) - casting * .35;
}

// ------------------------------------------------------------- peligros de jefe
// Zonas de daño persistentes y SIEMPRE telegrafiadas: primero se dibuja la
// amenaza en el suelo y después pega. El jugador puede leerlas y salir.
const bossHazards = [];
const HAZ_DISC = new THREE.RingGeometry(.84, 1, 40);
const HAZ_CIRC = new THREE.CircleGeometry(1, 36);
const HAZ_PLANE = new THREE.PlaneGeometry(1, 1);
for (const g of [HAZ_DISC, HAZ_CIRC, HAZ_PLANE]) g.userData.shared = true;

function addHazard(h) {
  const color = h.color !== undefined ? h.color : 0xff4d38;
  h.tick = 0; h.hit = false;
  const root = new THREE.Group(); root.position.set(h.x, .07, h.z); scene.add(root);
  let m;
  if (h.shape === 'bar') {
    root.rotation.y = -(h.angle || 0);
    m = new THREE.Mesh(HAZ_PLANE, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .34, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.scale.set(h.len || 10, h.w || 1.4, 1); m.position.set((h.len || 10) / 2, 0, 0);
    root.add(m);
  } else {
    m = new THREE.Mesh(h.shape === 'ring' ? HAZ_DISC : HAZ_CIRC, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: h.shape === 'ring' ? .6 : .26, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; root.add(m);
    if (h.shape === 'ring') { const inner = new THREE.Mesh(HAZ_CIRC, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .14, side: THREE.DoubleSide, depthWrite: false })); inner.rotation.x = -Math.PI / 2; root.add(inner); h.inner = inner; }
  }
  h.root = root; h.m = m;
  bossHazards.push(h);
  return h;
}
function clearHazards() {
  for (const h of bossHazards) { scene.remove(h.root); disposeObject3D(h.root); }
  bossHazards.length = 0;
}
// ¿Está el jugador dentro de una barra orientada?
function inBar(h, px, pz, pad = 0) {
  const dx = px - h.x, dz = pz - h.z;
  const a = h.angle || 0;
  const along = dx * Math.cos(a) + dz * Math.sin(a);
  const perp = -dx * Math.sin(a) + dz * Math.cos(a);
  return along > -.4 && along < (h.len || 10) && Math.abs(perp) < (h.w || 1.4) * .5 + pad;
}
function updateBossHazards(dt) {
  const px = player.position.x, pz = player.position.z;
  for (let i = bossHazards.length - 1; i >= 0; i--) {
    const h = bossHazards[i];
    h.t -= dt;
    const dmg = (h.dmg || 0) * (state.damageTaken || 1);
    if (h.shape === 'ring') {
      // Anillo expansivo: pega una vez cuando el frente pasa por el jugador.
      const k = 1 - Math.max(0, h.t) / h.max;
      h.r = h.from + (h.to - h.from) * k;
      h.m.scale.setScalar(h.r); if (h.inner) h.inner.scale.setScalar(h.r);
      const dist = Math.hypot(px - h.x, pz - h.z);
      if (!h.hit && Math.abs(dist - h.r) < 1.4) { h.hit = true; hurt(dmg); }
    } else if (h.shape === 'bar') {
      h.angle = (h.angle || 0) + (h.spin || 0) * dt;
      h.root.rotation.y = -h.angle;
      h.tick -= dt;
      if (h.tick <= 0 && inBar(h, px, pz, .5)) { h.tick = .45; hurt(dmg); }
    } else {
      // Círculo: charco/grieta (daño por segundo) o marca detonante.
      const grow = h.grow || 0;
      const k = 1 - Math.max(0, h.t) / h.max;
      h.m.scale.setScalar(grow ? h.r * (.35 + .65 * k) : h.r);
      if (h.detonate) {
        if (h.t <= 0) {
          const dist = Math.hypot(px - h.x, pz - h.z);
          if (dist < h.r) hurt(dmg);
          explode(new THREE.Vector3(h.x, .4, h.z), h.r, dmg * .35, h.color);
          spawnBurst(new THREE.Vector3(h.x, .5, h.z), h.color, 16, 5);
        }
      } else {
        h.tick -= dt;
        const dist = Math.hypot(px - h.x, pz - h.z);
        if (h.tick <= 0 && dist < h.r) { h.tick = .55; hurt(dmg); }
      }
    }
    h.m.material.opacity = h.shape === 'bar' ? .34 : (h.shape === 'ring' ? .6 : .26) * (h.t < .4 ? .55 : 1);
    if (h.t <= 0) { scene.remove(h.root); disposeObject3D(h.root); bossHazards.splice(i, 1); }
  }
}

// =========================================================== ranuras de carga
// Cuerpo a cuerpo (E), utilidad (G) y el gato robot (C). Los modelos se
// desbloquean por rondas y se anuncian; el códice guarda cada descubrimiento.
function roundOfSlot(list, wave) {
  return list.filter(m => {
    const n = m.unlock && m.unlock.match(/\d+/);
    return !n || wave >= Number(n[0]);
  });
}
function checkSlotUnlocks() {
  // Ya no existen desbloqueos de armas cuerpo a cuerpo por ronda: el arma
  // única del héroe está disponible desde el primer segundo de la incursión.
  // Solo la ranura de utilidad (G) mantiene su progresión de descubrimientos.
  for (const u of UTILITY) {
    const order = { grenade: 0, medkit: 2, stim: 6, pylon: 9 };
    if (state.wave >= order[u.id] && !Meta.seen('utility', u.id)) {
      Meta.markSeen('utility', u.id);
      announce('UTILIDAD // ' + u.name);
    }
  }
  hudDirty = true;
}
// Ataque primario (CLIC / gatillo) del bárbaro y el vampiro: es el MISMO arma
// única, no una segunda hoja. Sus VFX y SFX son los del héroe; el daño y el
// alcance salen de meleeInfo(). `meleeSeq` reinicia el clip en cada tajo.
function meleeAttack() {
  if (state.mode !== 'playing' || state.meleeCd > 0) return;
  const m = meleeInfo();
  const heavy = m.key === 'hacha';
  state.meleeCd = m.cooldown * (state.stim > 0 ? .75 : 1);
  state.meleeSwing = 1;
  state.meleeSeq = (state.meleeSeq || 0) + 1;
  const dir = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  const origin = player.position.clone().add(new THREE.Vector3(0, 1.1, 0));
  // EL ARCO VA DELANTE DEL HÉROE, no en la punta del arma: las partículas no
  // se veían porque `shoot()` las emitía en `player.userData.muzzle`, pegadas
  // al cuerpo y a la cámara en tercera persona, y sin animación de tajo.
  const at = origin.clone().addScaledVector(dir, Math.min(2.1, m.range * .62));
  const near = origin.clone().addScaledVector(dir, Math.min(1.05, m.range * .32));
  combatParticles?.preset(selectedCharacter, 'melee', at, dir, { heavy });
  combatParticles?.preset(selectedCharacter, 'melee', near, dir, { heavy, lite: true });
  playCharacterSfx(selectedCharacter, 'shoot', { volume: .5 });
  const dmgBase = state.damage * m.damage * (state.overdrive > 0 ? 1.2 : 1) * (state.meleeMult || 1);
  let hitAny = false;
  for (const e of enemies) {
    if (e.dead || e.spawn > 0) continue;
    const flat = e.group.position.clone().sub(player.position); flat.y = 0;
    const dist = flat.length();
    if (dist > m.range + (e.radius || .6)) continue;
    if (dist > 1 && flat.normalize().dot(dir) < Math.cos(m.arc * .55)) continue;
    hitAny = true;
    e.lastHitBy = 'melee';
    damageEnemy(e, dmgBase, false);
    e.knock = Math.max(e.knock || 0, m.knock);
    e.lastHitBy = 'melee';
    const ep = e.group.position.clone().add(new THREE.Vector3(0, 1.2 * e.group.scale.y, 0));
    combatParticles?.preset(selectedCharacter, 'impact', ep, dir, {});
    // Firma Kenney propia del héroe, solo si el golpe ha entrado de verdad.
    emitHitParticles(e);
    // Hacha: quiebra blindaje. Daga: drena vida y acumula descarga carmesí.
    if (m.key === 'hacha' && e.armor > 0) breakArmor(e);
    if (m.key === 'daga') {
      state.hp = Math.min(state.maxHp, state.hp + 2.5 * (state.healMult || 1));
      state.meleeCombo++;
      if (state.meleeCombo >= 8) {
        state.meleeCombo = 0;
        explode(ep, 4, state.damage * 1.6, 0xe8434f);
        announce('DESCARGA CARMESÍ');
      }
    }
  }
  if (hitAny) {
    spawnBurst(at, m.key === 'hacha' ? 0xffbf47 : wColorOf(), 8, 3);
    playCharacterSfx(selectedCharacter, 'impact', { volume: .35 });
  }
  if (m.key === 'hacha' && hitAny) {
    explode(at, 4, dmgBase * .5, 0xffbf47);
    ringPulse(at, 0xffbf47, 4.4, .35);
  }
  if (m.key !== 'hacha' && m.key !== 'daga' && hitAny) {
    // Golpe rápido de las armas a distancia: recuperar el dash y 1 s de
    // invulnerabilidad (heredero del antiguo CORTE FANTASMA).
    state.dash = 1; state.invuln = Math.max(state.invuln || 0, 1);
  }
  $('hitmarker').className = hitAny ? 'show' : ''; if (hitAny) setTimeout(() => $('hitmarker').className = '', 90);
}
function wColorOf() { return currentWeapon().color; }

// ---------------------------------------------------------------- utilidad
function utilityInfo() { return UTILITY.find(u => u.id === state.utilityId) || UTILITY[0]; }
function syncUtilityHUD() {
  const u = utilityInfo();
  const el = $('utility-name'); if (el) el.innerHTML = `${u.icon} ${u.name} <small>${state.utilityCharges > 0 ? 'LISTA' : Math.ceil(state.utilityCd) + 's'}</small>`;
}
function useUtility() {
  if (state.mode !== 'playing' || state.utilityCd > 0 || state.utilityCharges <= 0) return;
  const u = utilityInfo();
  state.utilityCharges--; state.utilityCd = u.cooldown;
  const origin = player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  const dir = new THREE.Vector3(-Math.sin(state.yaw) * Math.cos(state.pitch), Math.sin(state.pitch) + .25, -Math.cos(state.yaw) * Math.cos(state.pitch)).normalize();
  if (u.id === 'grenade') {
    const m = buildUtilityProp('grenade', 0xffbf47);
    m.position.copy(origin); scene.add(m);
    grenades.push({ m, dir, speed: 22, life: 1.1, utility: true });
    audio.tone(140, .16, 'sawtooth', .14, -70);
  } else if (u.id === 'medkit') {
    state.hp = Math.min(state.maxHp, state.hp + 55);
    const z = new THREE.Mesh(new THREE.CircleGeometry(3, 24), new THREE.MeshBasicMaterial({ color: 0x6ef7e7, transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false }));
    z.rotation.x = -Math.PI / 2; z.position.set(player.position.x, groundAt(player.position.x, player.position.z, state.py) + .07, player.position.z);
    scene.add(z);
    zones.push({ m: z, life: 6, heal: 9, r: 3 });
    motes(origin, 0x6ef7e7, 14, 2, 2.4);
    announce('BOTIQUÍN DESPLEGADO'); audio.tone(760, .2, 'sine', .12, 220);
  } else if (u.id === 'stim') {
    state.stim = 8;
    announce('ESTIMULANTE // +CADENCIA +VELOCIDAD');
    fx.flash('#b56bff', .2, 220); audio.tone(320, .3, 'sawtooth', .14, 420);
  } else if (u.id === 'pylon') {
    const g = buildUtilityProp('pylon', 0xff4d38);
    g.position.set(player.position.x + dir.x * 1.5, groundAt(player.position.x + dir.x * 1.5, player.position.z + dir.z * 1.5, state.py), player.position.z + dir.z * 1.5);
    scene.add(g);
    pylons.push({ group: g, hp: 150, maxHp: 150, life: 14, cd: .4 });
    announce('TORRETA CENTINELA DESPLEGADA'); audio.tone(210, .25, 'square', .13, 90);
  }
  syncUtilityHUD(); updateHUD();
}
function cycleUtility() {
  const avail = UTILITY.filter(u => {
    const order = { grenade: 0, medkit: 2, stim: 6, pylon: 9 };
    return state.wave >= order[u.id];
  });
  const i = avail.findIndex(u => u.id === state.utilityId);
  const next = avail[(i + 1) % avail.length];
  state.utilityId = next.id;
  // El cambio de utilidad reinicia la recarga parcialmente (justo, no gratis).
  state.utilityCd = Math.max(state.utilityCd, 1.5);
  announce('UTILIDAD // ' + next.name);
  syncUtilityHUD(); audio.tone(500, .08, 'square', .08, 120);
}
function updateUtility(dt) {
  if (state.utilityCd > 0) {
    state.utilityCd -= dt;
    if (state.utilityCd <= 0) { state.utilityCd = 0; state.utilityCharges = utilityInfo().charges; syncUtilityHUD(); }
  }
  if (state.stim > 0) state.stim -= dt;
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i]; z.life -= dt;
    z.m.material.opacity = .1 + .14 * Math.min(1, z.life / 2);
    z.m.scale.setScalar(1 + Math.sin(state.time * 3) * .03);
    if (Math.hypot(player.position.x - z.m.position.x, player.position.z - z.m.position.z) < z.r)
      state.hp = Math.min(state.maxHp, state.hp + z.heal * dt);
    if (z.life <= 0) { scene.remove(z.m); disposeObject3D(z.m); zones.splice(i, 1); }
  }
  for (let i = pylons.length - 1; i >= 0; i--) {
    const p = pylons[i]; p.life -= dt; p.cd -= dt;
    p.group.rotation.y += dt * .8;
    if (p.group.userData.eye) p.group.userData.eye.material.emissiveIntensity = 1 + Math.sin(state.time * 6) * .6;
    let nearest = null, nd = 22;
    for (const e of enemies) {
      if (e.dead || e.spawn > 0) continue;
      const d = e.group.position.distanceTo(p.group.position);
      if (d < nd) { nd = d; nearest = e; }
    }
    if (nearest && p.cd <= 0) {
      p.cd = .55;
      const from = p.group.position.clone().add(new THREE.Vector3(0, 1, 0));
      const to = nearest.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      tracer(from, to, 0xff4d38, .09);
      damageEnemy(nearest, state.damage * 1.1, false);
      spawnBurst(to, 0xff4d38, 3, 2);
    }
    // Los hostiles que la pisan la desmontan a golpes.
    for (const e of enemies) {
      if (e.dead || e.spawn > 0) continue;
      if (e.group.position.distanceTo(p.group.position) < (e.radius || .6) + .9) p.hp -= 26 * dt;
    }
    if (p.hp <= 0 || p.life <= 0) {
      explode(p.group.position.clone().add(new THREE.Vector3(0, .5, 0)), 3, state.damage * .8, 0xff4d38);
      scene.remove(p.group); disposeObject3D(p.group); pylons.splice(i, 1);
      if (p.hp <= 0) announce('TORRETA DESTRUIDA');
    }
  }
}

// ---------------------------------------------------------------- gato robot
// GATO-9: unidad de apoyo felina. Ataca sola, recibe daño y se retira si lo
// derriban, se asusta o se cansa (30-40 s). Tecla C para invocarlo.
function summonCat() {
  if (state.mode !== 'playing') return;
  if (state.catOut || state.catCd > 0) { announce(state.catCd > 0 ? 'GATO-9 RECALIBRÁNDOSE // ' + Math.ceil(state.catCd) + 's' : 'GATO-9 YA ESTÁ FUERA'); return; }
  const model = buildCatModel(0xffd34d);
  model.position.copy(player.position).add(new THREE.Vector3(Math.cos(state.yaw) * 1.8, 0, Math.sin(state.yaw) * -1.8));
  model.position.y = 0;
  scene.add(model);
  state.cat = { model, hp: 160, maxHp: 160, life: 30 + rnd() * 10, cd: .6, mode: 'follow', ring: 1.4, walk: 0 };
  state.catOut = true; state.catUses++;
  Meta.markSeen('utility', 'cat');
  if (state.catUses >= 10) tryGrantAchievement('catdeploy');
  announce('GATO-9 EN CAMPO // ¡MAU!');
  ringPulse(model.position.clone(), 0xffd34d, 2.4, .5);
  audio.tone(660, .1, 'square', .1, 120); setTimeout(() => audio.tone(880, .12, 'square', .1, -80), 120);
}
function catRetreat(reason) {
  if (!state.catOut) return;
  const msgs = {
    down: ['GATO-9 FUERA DE COMBATE // VOLVIENDO A LA BASE', 60],
    scared: ['GATO-9 SE HA ASUSTADO // SE ESCONDE UN RATO', 30],
    tired: ['GATO-9 SE CANSÓ // VUELVE A LA NAVE', 20]
  };
  const [msg, cd] = msgs[reason] || msgs.tired;
  announce(msg);
  spawnBurst(state.cat.model.position.clone().add(new THREE.Vector3(0, .5, 0)), 0xffd34d, 14, 4);
  motes(state.cat.model.position.clone(), 0xffd34d, 8, 1.4, 2.4);
  scene.remove(state.cat.model); disposeObject3D(state.cat.model);
  state.cat = null; state.catOut = false; state.catCd = cd;
}
function updateCat(dt) {
  if (!state.catOut || !state.cat) return;
  const c = state.cat, m = c.model;
  c.life -= dt;
  // Anillo de invocación se desvanece.
  if (c.ring > 0) { c.ring -= dt; m.userData.ring.material.opacity = Math.max(0, c.ring / 1.4); m.userData.ring.scale.setScalar(1 + (1.4 - c.ring) * .4); }
  // Busca objetivo cercano.
  let target = null, td = 15;
  for (const e of enemies) {
    if (e.dead || e.spawn > 0) continue;
    const d = e.group.position.distanceTo(m.position);
    if (d < td) { td = d; target = e; }
  }
  const dest = new THREE.Vector3();
  if (target) {
    dest.copy(target.group.position).addScaledVector(target.group.position.clone().sub(m.position).normalize(), -1.1);
    c.mode = 'attack';
  } else {
    dest.copy(player.position).add(new THREE.Vector3(Math.cos(state.yaw) * 2.1, 0, Math.sin(state.yaw) * -2.1));
    c.mode = 'follow';
  }
  const flat = dest.clone().sub(m.position); flat.y = 0;
  const dist = flat.length();
  const spd = c.mode === 'attack' ? 9.5 : 8.2;
  if (dist > (c.mode === 'attack' ? 1.15 : 1.4)) {
    flat.normalize();
    m.position.addScaledVector(flat, spd * dt);
    resolveProps(m.position, .5, 0);
    m.position.x = clamp(m.position.x, -ARENA + 1, ARENA - 1);
    m.position.z = clamp(m.position.z, -ARENA + 1, ARENA - 1);
    c.walk += dt * 11;
    m.rotation.y = Math.atan2(flat.x, flat.z);
  } else {
    c.walk += dt * 2;
    if (target) m.rotation.y = Math.atan2(target.group.position.x - m.position.x, target.group.position.z - m.position.z);
  }
  // Animación: patas y cola segméntica.
  m.userData.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(c.walk + i * Math.PI * .5) * .5; });
  m.userData.tail.rotation.y = Math.sin(state.time * 3.2) * .3;
  m.userData.tailSegs.forEach((s, i) => { s.rotation.y = Math.sin(state.time * 3.2 - i * .8) * .3; });
  m.userData.head.rotation.y = Math.sin(state.time * 1.8) * .25;
  m.position.y = Math.abs(Math.sin(c.walk * .5)) * .06;
  // Ataque: zarpazo con retorno.
  c.cd -= dt;
  if (target && td < 1.6 && c.cd <= 0) {
    c.cd = .8;
    damageEnemy(target, 16 + state.wave * 1.6, false);
    target.catAggro = 2.2;
    spawnBurst(target.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xffd34d, 6, 2.4);
    audio.tone(520, .06, 'square', .09, -160);
  }
  // Devolución de los hostiles molestos por el gato.
  for (const e of enemies) {
    if (e.dead || e.catAggro === undefined) continue;
    if (e.catAggro > 0 && e.group.position.distanceTo(m.position) < 1.8) {
      c.hp -= 14 * (e.dmgMult || 1) * dt * 2.2;
      if (e.catAggro > 0) e.catAggro -= dt;
    }
  }
  // Regenera al seguirte de cerca (se cura cuando no pelea).
  if (c.mode === 'follow' && c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + 4 * dt);
  // Barra de vida flotante: pequeño indicador bajo el gato.
  if (c.hp <= 0) { catRetreat('down'); return; }
  if (c.hp < c.maxHp * .32) { catRetreat('scared'); return; }
  if (c.life <= 0) catRetreat('tired');
}

// ---------------------------------------------------------------- objetivos
// Ronda con propósito: purga (clásico), supervivencia (cronómetro), extracción
// (cajas de datos) o ejecución (bajas cuerpo a cuerpo). El jefe siempre es purga.
function rollObjective(wave) {
  if (wave % ROUNDS.bossEvery === 0 || wave < 3) {
    state.obj = { id: 'purge', have: 0, need: 0, timer: 0 };
    return OBJECTIVES[0];
  }
  const pool = [OBJECTIVES[0], OBJECTIVES[1], OBJECTIVES[2], OBJECTIVES[3]];
  const o = pool[Math.floor(rnd() * pool.length)];
  const obj = { id: o.id, have: 0, need: 0, timer: 0 };
  if (o.id === 'survive') obj.timer = Math.min(70, 38 + wave * 2);
  if (o.id === 'collect') obj.need = 3;
  if (o.id === 'execute') obj.need = Math.min(12, 6 + Math.floor(wave / 4));
  state.obj = obj;
  return o;
}
function objectiveDone(alive) {
  const o = state.obj; if (!o) return alive === 0;
  if (o.id === 'purge') return alive === 0;
  if (o.id === 'survive') return o.timer <= 0;
  if (o.id === 'collect') return o.have >= o.need;
  if (o.id === 'execute') return o.have >= o.need || alive === 0;
  return alive === 0;
}
function objectiveMet() {
  const o = state.obj; if (!o) return true;
  if (o.id === 'purge') return true;
  if (o.id === 'survive') return true;
  if (o.id === 'collect') return o.have >= o.need;
  if (o.id === 'execute') return o.have >= o.need;
  return true;
}
function updateObjective(dt) {
  const o = state.obj; if (!o || o.id !== 'survive') return;
  o.timer -= dt;
  const el = $('obj-timer');
  if (el) el.textContent = '⏱ ' + Math.max(0, Math.ceil(o.timer)) + 's';
  if (o.timer <= 0 && state.mode === 'playing') {
    // Implosión: los hostiles restantes se desintegran al cumplirse el plazo.
    for (const e of enemies) if (!e.dead) damageEnemy(e, 99999, false);
  }
}
// ------------------------------------------------------------- combate de jefe
// Tres habilidades en rotación, telegrafía antes de cada una y dos umbrales de
// fase: al cambiar de fase el jefe se vuelve más rápido y añade una habilidad.
function bossPhaseUp(e) {
  e.invuln = .9;
  e.speed *= 1.12;
  e.abilityTimer = Math.min(e.abilityTimer, 1.4);
  announce(e.phaseIdx === 2 ? 'FASE FINAL: ' + e.kind.name : 'FASE ' + (e.phaseIdx + 1) + ': ' + e.kind.name);
  spawnBurst(e.group.position.clone().add(new THREE.Vector3(0, 2.4, 0)), C.coral, 34, 7);
  ringPulse(e.group.position.clone(), C.coral, 9, .7);
  state.shake = Math.max(state.shake, .5);
  audio.tone(90, .4, 'sawtooth', .2, -40);
  e.flash = .3;
}
function bossAbilityList(e) {
  // Fase 0 usa dos habilidades; la fase final las usa todas.
  const all = e.kind.abilities;
  return e.phaseIdx >= 2 ? all : e.phaseIdx === 1 ? all.slice(0, 2) : all.slice(0, 2);
}
function startBossCast(e) {
  const list = bossAbilityList(e);
  e.telegraphId = list[e.abilityIdx % list.length];
  e.abilityIdx++;
  const info = BOSS_ABILITIES[e.telegraphId];
  e.telegraphT = e.kind.telegraph * (e.phaseIdx >= 2 ? .75 : 1);
  e.telegraphMax = e.telegraphT;
  if (info) announce('⚠ ' + info.name);
  // Telegrafía visual en el suelo, antes de que la habilidad exista.
  groundMark(e.group.position.clone(), C.coral, 5.5, e.telegraphT, .5);
}
function bossCast(e, id) {
  const P = e.group.position, PP = player.position.clone();
  const dmg = 14 * e.dmgMult;
  switch (id) {
    case 'barrage':
      enemyShoot(e, true); announce('ANDANADA'); break;
    case 'charge':
      e.chargeGo = .55; e.chargeHit = false; audio.tone(70, .3, 'square', .2, -20); break;
    case 'shieldWall':
      e.shieldMax = e.maxHp * .22; e.shield = e.shieldMax; e.shieldTimer = 5;
      ringPulse(P.clone(), C.cyan, 6, .5); announce('ESCUDO DESPLEGADO'); break;
    case 'laserCross':
      for (let i = 0; i < 4; i++) addHazard({ shape: 'bar', x: P.x, z: P.z, angle: i * Math.PI / 2, len: 22, w: 1.6, spin: .55, t: 5, max: 5, dmg: 16 * e.dmgMult, color: 0xff4d38 });
      break;
    case 'verdict':
      addHazard({ shape: 'circle', x: PP.x, z: PP.z, r: 3.4, t: 1.25, max: 1.25, detonate: true, dmg: 34 * e.dmgMult, color: 0xffbf47, grow: 1 });
      addHazard({ shape: 'circle', x: PP.x, z: PP.z, r: 3.4, t: 1.25, max: 1.25, detonate: true, dmg: 0, color: 0xffffff, grow: 1 });
      break;
    case 'beamSweep':
      addHazard({ shape: 'bar', x: P.x, z: P.z, angle: Math.atan2(PP.z - P.z, PP.x - P.x), len: 26, w: 2.0, spin: 1.05, t: 4.5, max: 4.5, dmg: 20 * e.dmgMult, color: 0xb56bff });
      break;
    case 'summon': {
      const n = e.faction === 'HIVE' ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        const sp = clearSpawn(P.x + Math.cos(a) * 6, P.z + Math.sin(a) * 6, 1.2);
        createEnemy(e.faction === 'HIVE' ? 'drone' : e.faction === 'UMBRA' ? 'stalker' : 'ranged', sp.x, sp.z, false, e.faction);
      }
      announce('REFUERZOS DEL JEFE'); break;
    }
    case 'spitVolley':
      for (let i = 0; i < 7; i++) {
        const base = Math.atan2(PP.z - P.z, PP.x - P.x);
        const a = base + (i - 3) * .17;
        pushBolt(P.clone().add(new THREE.Vector3(0, 1.6, 0)), new THREE.Vector3(Math.cos(a), .02, Math.sin(a)), 13, 13 * e.dmgMult, 0xb6ff3d);
      }
      audio.tone(180, .18, 'sawtooth', .12, 40); break;
    case 'acidPool':
      for (let i = 0; i < 5; i++) {
        const a = rnd() * Math.PI * 2, r2 = rnd() * 7;
        addHazard({ shape: 'circle', x: PP.x + Math.cos(a) * r2, z: PP.z + Math.sin(a) * r2, r: 2.4, t: 8, max: 8, dmg: 9 * e.dmgMult, color: 0xb6ff3d });
      }
      announce('ÁCIDO EN EL SUELO'); break;
    case 'locustRing':
      addHazard({ shape: 'ring', x: P.x, z: P.z, from: 2, to: 24, t: 2.4, max: 2.4, dmg: 26 * e.dmgMult, color: 0xb6ff3d });
      break;
    case 'homingBolts':
      for (let i = 0; i < 4; i++) {
        const a = Math.atan2(PP.z - P.z, PP.x - P.x) + (i - 1.5) * .3;
        pushBolt(P.clone().add(new THREE.Vector3(0, 1.8, 0)), new THREE.Vector3(Math.cos(a), .04, Math.sin(a)), 9, 12 * e.dmgMult, 0xb56bff, true);
      }
      announce('RAYOS GUIADOS'); break;
    case 'voidRift': {
      const a = rnd() * Math.PI * 2, r2 = 10 + rnd() * 6;
      const nx = clamp(P.x + Math.cos(a) * r2, -ARENA + 6, ARENA - 6), nz = clamp(P.z + Math.sin(a) * r2, -ARENA + 6, ARENA - 6);
      addHazard({ shape: 'circle', x: P.x, z: P.z, r: 3.2, t: 6, max: 6, dmg: 11 * e.dmgMult, color: 0xb56bff });
      spawnBurst(P.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xb56bff, 24, 5);
      e.group.position.set(nx, e.y, nz);
      spawnBurst(new THREE.Vector3(nx, 1.5, nz), 0xb56bff, 24, 5);
      announce('GRIETA DEL VACÍO'); break;
    }
    case 'mirrorClones':
      for (let i = 0; i < 3; i++) {
        const a = rnd() * Math.PI * 2;
        const sp = clearSpawn(P.x + Math.cos(a) * 5, P.z + Math.sin(a) * 5, 1.1);
        const c = createEnemy('stalker', sp.x, sp.z, false, e.faction);
        if (c) { c.phantom = true; c.hp = c.maxHp = 120 * roundScaling(state.wave).hp; }
      }
      announce('REFLEJOS ESPECTRALES'); break;
    case 'gravityWell':
      state.pullT = 2.6; state.pullX = P.x; state.pullZ = P.z; state.pullForce = 9;
      addHazard({ shape: 'circle', x: P.x, z: P.z, r: 16, t: 2.6, max: 2.6, dmg: 5 * e.dmgMult, color: 0xb56bff });
      announce('POZO DE GRAVEDAD'); break;
    case 'collapse': {
      const r2 = 13;
      addHazard({ shape: 'circle', x: P.x, z: P.z, r: r2, t: 1.6, max: 1.6, detonate: true, dmg: 46 * e.dmgMult, color: 0xff4d38, grow: 1 });
      state.shake = Math.max(state.shake, .5);
      announce('COLAPSO INMINENTE'); break;
    }
    default: break;
  }
}
// Proyectil suelto (lo usan las habilidades que no son el disparo estándar).
function pushBolt(from, dir, speed, damage, color, homing = false) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(.13, 6, 6), new THREE.MeshBasicMaterial({ color }));
  m.position.copy(from); scene.add(m);
  projectiles.push({ m, dir: dir.normalize(), speed, life: 5, damage, homing });
}
function updateBoss(e, dt, dist, flat, slowMul) {
  if (e.spawn > 0) return;
  const hpf = Math.max(0, e.hp / e.maxHp);
  const want = hpf <= .34 ? 2 : hpf <= .67 ? 1 : 0;
  if (want > e.phaseIdx) { e.phaseIdx = want; bossPhaseUp(e); }
  if (e.invuln > 0) e.invuln -= dt;
  if (e.dying) return;

  // Animación propia del modelo: anillos, pods y fragmentos.
  if (e.group.userData.spinners) for (const s of e.group.userData.spinners) s.o.rotation[s.axis] += s.speed * dt;
  if (e.group.userData.bobbers) for (const b of e.group.userData.bobbers) b.o.position.y = b.base + Math.sin(state.time * b.speed) * b.amp;
  animateBossModel(e, dt);

  // Embestida: primero corre, y si te alcanza te tira.
  if (e.chargeGo > 0) {
    e.chargeGo -= dt;
    e.group.position.addScaledVector(flat, 22 * dt);
    collideXZ(e.group.position, e.y, e.radius);
    if (!e.chargeHit && dist < 3.2) { e.chargeHit = true; hurt(30 * e.dmgMult); state.shake = Math.max(state.shake, .5); }
    return;
  }
  // Movimiento base: se acerca y rodea.
  const spd = e.speed * slowMul;
  if (dist > 3.6) e.group.position.addScaledVector(flat, spd * dt);
  e.group.position.add(new THREE.Vector3(-flat.z, 0, flat.x).multiplyScalar(.4 * dt * spd));
  collideXZ(e.group.position, e.y, e.radius);

  // Rotación de habilidades con telegrafía.
  if (e.telegraphT > 0) {
    e.telegraphT -= dt;
    if (e.telegraphT <= 0) { bossCast(e, e.telegraphId); e.telegraphId = null; e.abilityTimer = 4.6 - e.phaseIdx * .9; }
    return;
  }
  e.abilityTimer -= dt;
  if (e.abilityTimer <= 0) startBossCast(e);
  // Contacto cuerpo a cuerpo.
  if (e.touchCd <= 0 && dist < 3.8) { hurt((e.kind.touch || 30) * e.dmgMult); e.touchCd = 1.2; }
  e.touchCd = Math.max(0, e.touchCd - dt);
}

// Rodea la utilería en vez de empujarla: si el camino recto está tapado, elige
// un desvío y lo mantiene un momento (evita recalcular cada frame y que el
// hostile oscile entre dos opciones).
function applyDetour(e, dir, dt) {
  const r = e.radius || .6;
  if (e.avoidHold > 0) {
    e.avoidHold -= dt;
    if (propAt(e.group.position.x + dir.x * 2.1, e.group.position.z + dir.z * 2.1, e.y, r + .2)) {
      dir.set(e.avoidX, 0, e.avoidZ); return;
    }
    e.avoidHold = 0;                      // ya hay línea libre: vuelve al camino recto
  }
  e.avoidCd = (e.avoidCd || 0) - dt;
  if (e.avoidCd > 0) return;
  e.avoidCd = .22;
  if (!propAt(e.group.position.x + dir.x * 2.1, e.group.position.z + dir.z * 2.1, e.y, r + .2)) return;
  const d = detourDir(e.group.position, dir, r, e.y);
  if (d) { e.avoidX = d.x; e.avoidZ = d.z; e.avoidHold = .9; dir.set(d.x, 0, d.z); }
}
// Separación entre hostiles: sin esto se apilan en un solo punto y el combate
// se convierte en un bloque. Empuje simétrico, una sola pasada, O(n²) con n pequeño.
function separateEnemies() {
  // Rejilla espacial: cada hostil solo se compara con los de su celda y las 8
  // vecinas. Antes esto era un doble bucle O(n²) que se notaba con las hordas.
  const CELL = 3.2;
  _sepGrid.clear();
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.dead || e.spawn > 0) continue;
    const k = (((e.group.position.x / CELL) | 0) + 1024) * 4096 + (((e.group.position.z / CELL) | 0) + 1024);
    let cell = _sepGrid.get(k);
    if (!cell) { cell = []; _sepGrid.set(k, cell); }
    cell.push(i);
  }
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (a.dead || a.spawn > 0) continue;
    const aFly = a.type === 'flyer' || a.type === 'drone';
    const cx = (a.group.position.x / CELL) | 0, cz = (a.group.position.z / CELL) | 0;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const cell = _sepGrid.get((cx + ox + 1024) * 4096 + (cz + oz + 1024));
        if (!cell) continue;
        for (let c = 0; c < cell.length; c++) {
          const j = cell[c];
          if (j <= i) continue;
          const b = enemies[j];
          if (b.dead || b.spawn > 0) continue;
          if (aFly !== (b.type === 'flyer' || b.type === 'drone')) continue;
          const dx = b.group.position.x - a.group.position.x, dz = b.group.position.z - a.group.position.z;
          const d2 = dx * dx + dz * dz;
          const min = (a.radius + b.radius) * .92;
          if (d2 > min * min || d2 < 1e-8) continue;
          const d = Math.sqrt(d2), push = (min - d) * .5;
          const nx = dx / d, nz = dz / d;
          a.group.position.x -= nx * push; a.group.position.z -= nz * push;
          b.group.position.x += nx * push; b.group.position.z += nz * push;
        }
      }
    }
  }
  // Segundo pase: nadie queda dentro de un prop tras el empuje.
  for (const e of enemies) {
    if (e.dead || e.spawn > 0 || e.type === 'flyer' || e.type === 'drone') continue;
    collideXZ(e.group.position, e.y, e.radius || .6);
  }
}

// Contacto de un hostil: aplica el daño y dispara los afijos que reaccionan
// al golpe (GÉLIDO ralentiza, VOLTAICO descarga un arco).
function enemyTouch(e, dmg) {
  hurt(dmg, e.type);
  if (e.affixes) for (const f of e.affixes) if (f.onHit) f.onHit(e, AFFIX_API);
}

function updateEnemies(dt) {
  let alive = 0, boss = null;
  updateBossHazards(dt);
  // Los hostile caídos salen del array: si no, se acumulan toda la partida y todos los
  // bucles (disparo, habilidades, radar) recorren cadáveres sin necesidad.
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);
  const chrono = state.overdrive > 0 ? Math.max(.3, 1 - .35 * abilityLevel('chrono')) : 1;
  for (const e of enemies) {
    if (e.dead) continue; alive++; if (e.type === 'boss') boss = e;
    if (e.spawn > 0) { e.spawn -= dt; const s = e.targetScale * (1 - Math.max(0, e.spawn) / .55); e.group.scale.setScalar(Math.max(.05, s)); continue; }
    e.flash -= dt; e.orbitCd = Math.max(0, (e.orbitCd || 0) - dt); e.touchCd = Math.max(0, e.touchCd - dt);
    // Destello por intercambio de material (no por mutación): los materiales son
    // compartidos, así que tocarlos teñiría a todos los hostiles a la vez.
    if (e.flashMeshes) {
      const on = e.flash > 0;
      if (on !== e.flashing) {
        e.flashing = on;
        for (const f of e.flashMeshes) f.o.material = on ? flashMaterial(f.base) : f.base;
      }
    }
    if (e.slow > 0) e.slow -= dt;
    // Afijos con comportamiento continuo (VACÍO se teletransporta, etc.).
    if (e.affixes) for (const f of e.affixes) if (f.onTick) f.onTick(e, AFFIX_API, dt);
    if (e.shield < e.shieldMax) { e.shieldTimer -= dt; if (e.shieldTimer <= 0) e.shield = Math.min(e.shieldMax, e.shield + 12 * dt); }

    const stepFromX = e.group.position.x, stepFromZ = e.group.position.z;
    const toPlayer = player.position.clone().sub(e.group.position);
    const flat = toPlayer.clone(); flat.y = 0;
    const dist = flat.length(); flat.normalize();
    if (e.type !== 'flyer' && e.type !== 'drone') applyDetour(e, flat, dt);
    // Retroceso al recibir un impacto: hace que cada disparo se sienta.
    if (e.knock > 0) { e.group.position.addScaledVector(flat, -e.knock * dt * 14); e.knock = Math.max(0, e.knock - dt * 3.4); }
    e.group.rotation.y = Math.atan2(-flat.x, -flat.z);
    e.phase += dt; e.cooldown -= dt;
    const heightGap = state.py - e.y;
    let slowMul = (e.slow > 0 ? (e.slowFactor || .5) : 1) * chrono;

    if (e.type === 'flyer') {
      e.dive -= dt;
      const wantY = e.dive <= 0 ? state.py + 1.1 : e.hover;
      e.y += (wantY - e.y) * Math.min(1, dt * 2.4);
      if (e.dive <= -2.2) e.dive = 4 + rnd() * 3;
      e.group.position.addScaledVector(flat, e.speed * slowMul * dt);
      if (e.cooldown <= 0 && dist < 26) { enemyShoot(e); e.cooldown = 1.5 + rnd() * .6; }
      if (e.group.userData.wingL) { const f = Math.sin(state.time * 16) * .5; e.group.userData.wingL.rotation.z = .32 + f; e.group.userData.wingR.rotation.z = -.32 - f; }
    } else if (e.type === 'drone') {
      e.y += ((state.py + 1.3) - e.y) * Math.min(1, dt * 3);
      e.group.position.addScaledVector(flat, e.speed * slowMul * dt);
      if (e.group.userData.rotor) e.group.userData.rotor.rotation.z += dt * 22;
      if (dist < 1.9 && Math.abs(heightGap) < 2.2) {
        spawnBurst(e.group.position.clone(), C.coral, 26, 6); audio.tone(70, .35, 'sawtooth', .22, -30);
        enemyTouch(e, 22 * (e.dmgMult || 1)); e.hp = 0; killEnemy(e, false); continue;
      }
    } else if (e.type === 'stalker') {
      e.blink -= dt;
      if (dist > 12 && e.blink <= 0 && dist < 30 && e.faction === 'UMBRA') {
        e.blink = 5 + rnd() * 4;
        spawnBurst(e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xb56bff, 14, 4);
        e.group.position.addScaledVector(flat, Math.min(12, dist - 5));
        spawnBurst(e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xb56bff, 14, 4);
      }
      const spd = e.speed * (dist > 6 ? 1.7 : 1.15) * slowMul;
      e.group.position.addScaledVector(flat, spd * dt);
      if (e.touchCd <= 0 && dist < 1.7 && Math.abs(heightGap) < 1.6) { enemyTouch(e, 26 * (e.dmgMult || 1)); e.touchCd = 1.1; state.shake = Math.max(state.shake, .35); }
    } else if (e.type === 'support') {
      const want = dist < 11 ? -1 : dist > 15 ? 1 : 0;
      e.group.position.addScaledVector(flat, e.speed * slowMul * want * dt);
      if (e.group.userData.orb) { e.group.userData.orb.rotation.y += dt * 3; e.group.userData.ring.rotation.z += dt * 2; }
      e.healTimer -= dt;
      if (e.healTimer <= 0) {
        e.healTimer = 2.2;
        let healed = 0;
        for (const o of enemies) {
          if (o.dead || o.spawn > 0 || o === e) continue;
          if (o.group.position.distanceTo(e.group.position) < 11 && o.hp < o.maxHp) {
            o.hp = Math.min(o.maxHp, o.hp + o.maxHp * .14);
            tracer(e.group.position.clone().add(new THREE.Vector3(0, 2.4, 0)), o.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 0x6ef7e7, .2);
            healed++;
          }
        }
        if (healed) { audio.tone(560, .18, 'sine', .06, 180); addFeed('ENEMIGO REGENERADO', 0); }
      }
    } else if (e.type === 'ranged' || e.type === 'turret') {
      // EL CENTINELA es un ranged que no se mueve: anclado, pero con más ráfagas.
      if (e.type !== 'turret') {
        if (dist > 13) e.group.position.addScaledVector(flat, e.speed * slowMul * dt);
        else if (dist < 8) e.group.position.addScaledVector(flat, -e.speed * slowMul * dt);
        e.group.position.add(new THREE.Vector3(-flat.z, 0, flat.x).multiplyScalar(Math.sin(e.phase) * .8 * dt * e.speed));
      }
      if (e.cooldown <= 0 && dist < (e.type === 'turret' ? 30 : 26)) {
        e.burst = e.type === 'turret' ? 5 : 3; e.cooldown = (e.type === 'turret' ? 2.9 : 2.4) + rnd() * .8;
      }
      if (e.burst > 0) {
        e.burstTimer = (e.burstTimer || 0) - dt;
        if (e.burstTimer <= 0) { e.burstTimer = e.type === 'turret' ? .16 : .22; e.burst--; enemyShoot(e); }
      }
    } else if (e.type === 'sapper') {
      // EL ZAPADOR lanza orbes en arco que revientan en área. Se mantiene lejos.
      if (dist > 17) e.group.position.addScaledVector(flat, e.speed * slowMul * dt);
      else if (dist < 11) e.group.position.addScaledVector(flat, -e.speed * slowMul * dt);
      if (e.cooldown <= 0 && dist < 30) {
        e.cooldown = 3.2 + rnd() * 1.2;
        lobProjectile(e);
      }
    } else if (e.type === 'boss') {
      updateBoss(e, dt, dist, flat, slowMul);
    } else {
      // chaser / tank
      let spd = e.speed * slowMul;
      if (e.type === 'chaser') {
        e.sprint -= dt;
        if (dist < 16 && e.sprint <= 0) { e.sprint = 2.6 + rnd() * 2; e.sprinting = .9; }
        if (e.sprinting > 0) { e.sprinting -= dt; spd *= 2.15; }
      }
      if (e.type === 'tank') {
        e.charge -= dt;
        if (dist < 14 && dist > 4 && e.charge <= 0 && e.armor <= 0) { e.charge = 5 + rnd() * 3; e.charging = .8; }
        if (e.charging > 0) { e.charging -= dt; spd *= e.charging > .3 ? 0 : 4.2; }
      }
      // EL BRUTO embiste más lejos y más rápido cuando pierde el blindaje.
      if (e.type === 'brute') {
        e.charge -= dt;
        if (dist < 20 && dist > 5 && e.charge <= 0 && e.armor <= 0) { e.charge = 6 + rnd() * 3; e.charging = 1.0; }
        if (e.charging > 0) { e.charging -= dt; spd *= e.charging > .35 ? .2 : 5.6; }
      }
      // EL ESPECTRO se desplaza en cortos: aparece a tu espalda sin avisar.
      if (e.type === 'wraith') {
        e.blink -= dt;
        if (e.blink <= 0 && dist > 4) {
          e.blink = 3.2 + rnd() * 2.4;
          const a = rnd() * Math.PI * 2, r = 3.5 + rnd() * 2.5;
          const nx = player.position.x + Math.cos(a) * r, nz = player.position.z + Math.sin(a) * r;
          crystalShell(e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 1.4, 0xb56bff, .35);
          e.group.position.x = nx; e.group.position.z = nz;
          crystalShell(new THREE.Vector3(nx, e.y + 1, nz), 1.4, 0xb56bff, .35);
          audio.tone(520, .12, 'sine', .05, -240);
        }
      }
      if (dist > 1.35) e.group.position.addScaledVector(flat, spd * dt);
      collideXZ(e.group.position, e.y, e.radius || .6);
      const info = ENEMY_INFO[e.type];
      if (e.touchCd <= 0 && dist < 1.7 && Math.abs(heightGap) < 1.5) { enemyTouch(e, (info.touch || 12) * (e.dmgMult || 1)); e.touchCd = e.type === 'tank' ? 1.4 : .85; state.shake = Math.max(state.shake, .3); }
      // si el jugador está en alto, atacan a distancia
      if (heightGap > 1.4 && dist < 18 && e.cooldown <= 0) { enemyShoot(e); e.cooldown = 2.2 + rnd(); }
    }

    if (e.type !== 'flyer' && e.type !== 'drone') {
      // Los jefes sin patas flotan: su modelo ya nace elevado.
      const g = groundAt(e.group.position.x, e.group.position.z, e.y, 1.7) + (e.floats ? 1.15 : 0);
      e.y += (g - e.y) * Math.min(1, dt * 8);
      e.group.position.y = e.y;
    } else {
      e.group.position.y = e.y + (e.type === 'drone' ? Math.sin(e.phase * 3) * .18 : 0);
    }
    // Animación proporcional a la velocidad real del hostile.
    const moved = Math.hypot(e.group.position.x - stepFromX, e.group.position.z - stepFromZ) / Math.max(dt, .0001);
    e.step = (e.step || 0) + dt * (2.2 + moved * 1.9);
    const swing = Math.min(1, moved / 4.2);
    const quad = e.legs.length >= 4;
    const amp = (e.type === 'tank' || e.type === 'boss' ? .34 : quad ? .42 : .58) * swing;
    if (quad) {
      // Marcha de cuadrúpedo: diagonales en fase, como un animal real.
      const ph = Math.sin(e.step * 2);
      e.legs[0].rotation.x = ph * amp; e.legs[3].rotation.x = ph * amp;
      e.legs[1].rotation.x = -ph * amp; e.legs[2].rotation.x = -ph * amp;
      e.group.position.y += Math.abs(Math.sin(e.step * 4)) * .035 * swing;
    } else if (e.legs.length >= 2) {
      const ph = Math.sin(e.step * 2);
      e.legs[0].rotation.x = ph * amp;
      e.legs[1].rotation.x = -ph * amp;
      e.group.position.y += Math.abs(ph) * .06 * swing;
      // Brazos en contrafase con las piernas: es lo que hace que corran y no patinen.
      if (e.arms && e.arms.length >= 2) {
        const armAmp = amp * (e.type === 'tank' ? .45 : .75);
        e.arms[0].rotation.x = -ph * armAmp * .8 - .06;
        e.arms[1].rotation.x = ph * armAmp * .8 - .06;
      }
    } else if (e.legs.length === 1) {
      e.legs[0].rotation.x = Math.sin(e.step * 2) * amp;
    }
    // Inclinación al acelerar: los bípedos se echan hacia delante al correr.
    if (!quad && e.legs.length >= 2) e.group.rotation.x = -swing * (e.type === 'tank' ? .04 : .09);
    else e.group.rotation.x = 0;
    if (e.type === 'flyer' && e.group.userData.wingL) {
      const f2 = Math.sin(state.time * 16) * .5;
      e.group.userData.wingL.rotation.z = .32 + f2; e.group.userData.wingR.rotation.z = -.32 - f2;
    }
    // Reacción al impacto: encoge y gira un instante.
    if (e.hitAnim > 0) {
      e.hitAnim = Math.max(0, e.hitAnim - dt);
      const k = e.hitAnim / .18;
      e.group.scale.setScalar(e.targetScale * (1 + k * .11));
      e.group.rotation.y += k * .06;
    } else if (e.group.scale.x !== e.targetScale) e.group.scale.setScalar(e.targetScale);
  }
  // Los hostiles dejan de apilarse y ninguno atraviesa la utilería.
  separateEnemies();

  if (boss) $('boss-health').style.width = (Math.max(0, boss.hp / boss.maxHp) * 100) + '%';
  $('enemy-count').textContent = String(alive).padStart(2, '0') + ' HOSTILES';

  if (objectiveDone(alive) && state.mode === 'playing') {
    // Los objetivos alternativos implosionan a los remanentes al completarse.
    if (alive > 0) for (const e of enemies) if (!e.dead) damageEnemy(e, 99999, false);
    const bonusOk = objectiveMet();
    state.mode = 'transition'; state.score += state.wave * 250 * currentLevel.rewardMult * state.scoreMult * (bonusOk ? 1 : .7);
    state.chips += 40 + state.wave * 10;
    if (bonusOk && state.obj && state.obj.id !== 'purge') {
      state.score += Math.round(state.wave * 150 * state.scoreMult);
      addFeed('OBJETIVO CUMPLIDO // ' + state.obj.id.toUpperCase(), Math.round(state.wave * 150));
      if (state.obj.id === 'execute') tryGrantAchievement('melee50');
    }
    document.exitPointerLock?.();
    const finished = state.wave > 0 && state.wave % ROUNDS.perWorld === 0;
    // Un solo temporizador pendiente: si algo lo reemplaza, el anterior se
    // cancela (evita dobles borradores); setWorldView lo cancela para QC.
    clearTimeout(waveFlowTimer);
    if (finished) { waveFlowTimer = setTimeout(() => worldComplete(), 1200); announce('MUNDO DOMINADO'); }
    else { waveFlowTimer = setTimeout(() => showUpgradeDraft(), 1300); announce('SECTOR PURIFICADO'); }
  } else if (state.mode === 'playing' && state.pending > 0) {
    state.reinforceTimer -= dt;
    if (state.reinforceTimer <= 0 && alive < 6) {
      state.reinforceTimer = 6;
      const n = Math.min(2, state.pending); state.pending -= n;
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, r = ARENA - 8;
        const sp = clearSpawn(Math.cos(a) * r, Math.sin(a) * r, 1.2);
        createEnemy(pick(['chaser', 'chaser', 'ranged', 'flyer', 'drone']), sp.x, sp.z, rnd() < .25, currentLevel.faction);
      }
      announce('REFUERZOS HOSTILES');
    }
  }
}
const _projPrev = new THREE.Vector3();
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.homing) { const to = player.position.clone().add(new THREE.Vector3(0, 1, 0)).sub(p.m.position).normalize(); p.dir.lerp(to, Math.min(1, dt * 2.6)).normalize(); }
    _projPrev.copy(p.m.position);
    p.m.position.addScaledVector(p.dir, p.speed * dt); p.life -= dt;
    if (p.m.position.distanceTo(player.position.clone().add(new THREE.Vector3(0, 1, 0))) < .7) { hurt(p.damage); p.life = 0; }
    // Las torretas y el gato también reciben fuego hostil.
    if (p.life > 0 && pylons.length) {
      for (const py of pylons) {
        if (p.m.position.distanceTo(py.group.position.clone().add(new THREE.Vector3(0, .9, 0))) < .9) {
          py.hp -= p.damage * 1.2; p.life = 0; spawnBurst(p.m.position.clone(), 0xff4d38, 4, 2); break;
        }
      }
    }
    if (p.life > 0 && state.catOut && state.cat && p.m.position.distanceTo(state.cat.model.position.clone().add(new THREE.Vector3(0, .45, 0))) < .7) {
      state.cat.hp -= p.damage * .55; p.life = 0; spawnBurst(p.m.position.clone(), 0xffd34d, 4, 2);
    }
    // Cobertura: un proyectil que atraviesa un coche o un contenedor se pierde.
    if (p.life > 0 && segmentBlocked(_projPrev, p.m.position)) {
      p.life = 0; spawnBurst(p.m.position.clone(), 0xcdc7b8, 4, 1.8);
    }
    if (p.life <= 0) { scene.remove(p.m); disposeObject3D(p.m); projectiles.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- HUD
function updateHUD() {
  $('score').textContent = String(Math.round(state.score)).padStart(6, '0');
  $('combo').textContent = '×' + state.combo.toFixed(2) + ' SINCRONÍA';
  $('hp-number').textContent = Math.ceil(state.hp);
  const hpRatio = state.maxHp > 0 ? state.hp / state.maxHp : 1;
  $('health-bar').style.width = (hpRatio * 100) + '%';
  $('health-bar').style.background = hpRatio < .3 ? '#e2683f' : '#9bcf5a';
  const low = $('lowhp');
  if (low) low.classList.toggle('on', hpRatio < .32 && state.mode === 'playing');
  $('ammo').textContent = String(state.ammo).padStart(2, '0');
  $('dash-bar').style.width = (state.dash * 100) + '%';
  $('charge-ring').style.strokeDashoffset = 163.36 * (1 - state.charge / 100);
  $('charge-text').textContent = Math.floor(state.charge) + '%';
  $('overdrive').classList.toggle('ready', state.charge >= 100);
  $('chips').textContent = String(Math.round(state.chips));
  $('frenzy-bar').style.width = (state.frenzyTimer > 0 ? (state.frenzyTimer / state.frenzyDuration) * 100 : state.frenzy) + '%';
  $('frenzy-wrap').classList.toggle('active', state.frenzyTimer > 0);
  const shieldLine = $('shield-line');
  if (state.maxShield > 0) { shieldLine.classList.remove('hidden'); $('shield-bar').style.width = (state.shield / state.maxShield * 100) + '%'; }
  else shieldLine.classList.add('hidden');
  // Ataque primario melé (sin tecla E) + utilidad + gato + objetivo.
  const melEl = $('melee-cd');
  if (melEl) melEl.textContent = state.meleeCd > 0 ? Math.ceil(state.meleeCd * 10) / 10 + 's' : 'LISTO';
  const catEl = $('cat-status');
  if (catEl) {
    if (state.catOut && state.cat) catEl.textContent = '❥ GATO-9 ' + Math.max(0, Math.round(state.cat.hp)) + ' HP';
    else if (state.catCd > 0) catEl.textContent = '❥ GATO-9 // ' + Math.ceil(state.catCd) + 's';
    else catEl.textContent = '❥ GATO-9 LISTO [C]';
  }
  const objEl = $('obj-line');
  if (objEl) {
    const o = state.obj;
    if (o && o.id !== 'purge' && state.mode === 'playing') {
      const def = OBJECTIVES.find(x => x.id === o.id);
      let txt = def ? def.icon + ' ' + def.name : '';
      if (o.id === 'survive') txt += ' // ' + Math.max(0, Math.ceil(o.timer)) + 's';
      else txt += ' // ' + Math.min(o.have, o.need) + '/' + o.need;
      objEl.textContent = txt;
      objEl.style.color = def ? def.color : '#fff';
      objEl.classList.remove('hidden');
    } else objEl.classList.add('hidden');
  }
  if (hudDirty) {
    const parts = [];
    // Familias del build: nivel total acumulado y estrella si la resonancia
    // de set está encendida. Es la lectura rápida de "qué build llevas".
    for (const f in state.familyLevels) {
      const def = FAMILIES[f], lv = state.familyLevels[f];
      if (!def || !lv) continue;
      const star = state.resonances.includes(f + ':t2') ? 2 : state.resonances.includes(f + ':t1') ? 1 : 0;
      parts.push(`<span class="fam" style="border-color:${def.color};color:${def.color}">${def.icon} ${def.name} <b>${lv}${star ? ' ' + '★'.repeat(star) : ''}</b></span>`);
    }
    for (const p of state.pacts) parts.push(`<span class="pact-chip" style="border-color:${p.color};color:${p.color}">${p.icon} ${p.curse}</span>`);
    for (const id in state.abilities) {
      const a = ABILITIES.find(x => x.id === id); if (!a) continue;
      parts.push(`<span style="border-color:${a.color};color:${a.color}">${a.icon} ${a.name} <b>${state.abilities[id]}</b></span>`);
    }
    for (const id in lootLevels) {
      const l = BOOSTS.find(x => x.id === id); if (!l || !lootLevels[id]) continue;
      parts.push(`<span style="border-color:${l.color};color:${l.color}">${l.icon} ${l.name} <b>${lootLevels[id]}</b></span>`);
    }
    for (const s of activeSynergies()) parts.push(`<span class="syn" style="border-color:${s.color};color:${s.color}">◈ ${s.name}</span>`);
    // Techo de chips: con builds muy cargadas la tira tapaba media pantalla.
    if (parts.length > 14) {
      const extra = parts.length - 13;
      parts.length = 13;
      parts.push(`<span class="more">+${extra} MÁS</span>`);
    }
    $('loadout').innerHTML = parts.length ? '<small>ARSENAL</small>' + parts.join('') : '';
    hudDirty = false;
  }
}
function updateRadar() {
  const root = $('radar-dots'); root.innerHTML = '';
  for (const e of enemies) {
    if (e.dead) continue;
    const rel = e.group.position.clone().sub(player.position);
    const x = clamp(49 + rel.x * .95, 5, 95), y = clamp(49 + rel.z * .95, 5, 95);
    const d = document.createElement('i');
    d.className = 'enemy-dot' + (e.type === 'boss' ? ' boss' : e.elite ? ' elite' : '');
    d.style.left = x + 'px'; d.style.top = y + 'px'; root.appendChild(d);
  }
  for (const b of lootBoxes) {
    const rel = b.group.position.clone().sub(player.position);
    const d = document.createElement('i');
    d.className = 'enemy-dot loot'; d.style.left = clamp(49 + rel.x * .95, 5, 95) + 'px'; d.style.top = clamp(49 + rel.z * .95, 5, 95) + 'px';
    root.appendChild(d);
  }
}

// ---------------------------------------------------------------- mejoras
// --- borrador de módulos --------------------------------------------------
// Sustituye al draft genérico de mejoras: ahora cada carta es un MÓDULO de una
// FAMILIA, con su nivel actual y aviso si va a desbloquear una evolución.
function rollModuleOffers() {
  const weight = (m) => m.rarity === 'COMÚN' ? 5 : m.rarity === 'RARA' ? 3 : 1.6;
  // Sesgo hacia las familias ya empezadas: la build se vuelve coherente en vez
  // de una sopa de bonificaciones sueltas.
  const bias = (m) => 1 + (state.familyLevels[m.family] || 0) * .14;
  const offers = [];
  const pool = MODULES.filter(m => (state.modules[m.id] || 0) < m.max);
  while (offers.length < 3 && pool.length > offers.length) {
    const avail = pool.filter(m => !offers.includes(m));
    if (!avail.length) break;
    const ws = avail.map(m => weight(m) * bias(m));
    let roll = rnd() * ws.reduce((a, b) => a + b, 0), idx = 0;
    for (let i = 0; i < avail.length; i++) { roll -= ws[i]; if (roll <= 0) { idx = i; break; } }
    offers.push(avail[idx]);
  }
  return offers;
}
function renderBuild() {
  const c = CHARACTERS[selectedCharacter];
  $('build-character').textContent = c.name;
  $('build-character').style.color = c.hex;
  const stats = [['VIDA MÁXIMA', Math.round(state.maxHp)], ['DAÑO', Math.round(state.damage)], ['CADENCIA', (1 / (state.fireRate * currentWeapon().fireRate)).toFixed(1) + '/s'], ['VELOCIDAD', state.speed.toFixed(1)], ['CARGADOR', state.maxAmmo], ['REDUCCIÓN', Math.round((1 - state.damageTaken) * 100) + '%']];
  $('build-stats').innerHTML = stats.map(([n, v]) => `<div class="build-stat"><span>${n}</span><b>${v}</b></div>`).join('');
  // Familias: nivel total y estrella si la resonancia está encendida.
  const fams = Object.keys(FAMILIES).map(f => {
    const lv = state.familyLevels[f] || 0;
    if (!lv) return '';
    const def = FAMILIES[f];
    const star = state.resonances.includes(f + ':t2') ? 2 : state.resonances.includes(f + ':t1') ? 1 : 0;
    const next = RESONANCES[f];
    const goal = star === 0 ? next.t1.at : star === 1 ? next.t2.at : 0;
    return `<div class="build-fam" style="--fam:${uiGem(def.color)}"><span>${def.icon} ${def.name}</span><b>${lv}${star ? ' <i>★' + star + '</i>' : goal ? ' <i>→' + goal + '</i>' : ''}</b></div>`;
  }).join('');
  const modRows = MODULES.filter(m => state.modules[m.id]).map(m =>
    `<div class="build-mod" style="--fam:${uiGem(FAMILIES[m.family].color)}"><span>${m.icon} ${m.name}</span><b>${state.modules[m.id]}/${m.max}</b></div>`).join('');
  const extra = Object.keys(state.abilities).map(k => { const a = ABILITIES.find(x => x.id === k); return `<div class="build-mod"><span>${a.name}</span><b>NV.${state.abilities[k]}</b></div>`; }).join('');
  const pactRows = state.pacts.map(p => `<div class="build-mod pact"><span>${p.icon} ${p.name}</span><b>${p.curse}</b></div>`).join('');
  // Reliquias: una línea por pieza, con su regla resumida.
  const relicRows = (state.relics || []).map(id => {
    const r = relicById(id); if (!r) return '';
    return `<div class="build-mod relic" style="--fam:${uiGem(r.color)}"><span>${r.icon} ${r.name}</span><b>${r.tier}</b></div>`;
  }).join('');
  $('build-mods').innerHTML = (fams + modRows + pactRows + relicRows + extra) || 'SIN MUTACIONES';
}
function showUpgradeDraft() {
  state.mode = 'upgrade'; document.exitPointerLock?.();
  currentOffers = rollModuleOffers();
  const pact = offerPact();
  currentPacts = pact ? [pact] : [];
  renderBuild();
  $('next-wave').textContent = String(state.wave + 1).padStart(2, '0');
  $('reroll-count').textContent = rerolls + ' RESTANTES';
  $('reroll-btn').disabled = rerolls <= 0;
  $('upgrade-options').innerHTML = currentOffers.map(m => {    const level = state.modules[m.id] || 0;
    const fam = FAMILIES[m.family];
    // Aviso de bendición: si esta carta satura el don, el arma ÚNICA del héroe
    // gana daño y cadencia. Ya no depende de tener un arma base de botín.
    const evo = EVOLUTIONS.find(e => e.need === m.id && !state.weaponEvolved?.[e.id] && level + 1 >= m.max);
    return `<button class="upgrade-choice" data-offer="${m.id}" style="--rarity:${uiGem(fam.color)}">`
      + `<span class="upgrade-icon" style="color:${uiGem(fam.color)}">${m.icon}</span>`
      + `<span class="upgrade-copy"><small style="color:${uiGem(fam.color)}">${fam.name} // ${m.rarity}</small><b>${m.name}</b><span>${m.desc}</span>`
      + (evo ? `<em class="evo-tag">▲ BENDICIÓN: ${evo.name}</em>` : '')
      + `</span><span class="upgrade-level">${level ? 'NIVEL' : 'NUEVO'}<b>${level + 1}/${m.max}</b></span></button>`;
  }).join('');
  // Salvaguarda: si TODOS los módulos están saturados (modo infinito muy largo),
  // la ronda tiene que poder cerrarse igualmente.
  if (!currentOffers.length) {
    $('upgrade-options').innerHTML = `<button class="upgrade-choice" data-skip="1" style="--rarity:#ffcf4a">`
      + `<span class="upgrade-icon" style="color:#ffcf4a">✓</span>`
      + `<span class="upgrade-copy"><small style="color:#ffcf4a">EQUIPO // COMPLETO</small><b>TODOS LOS DONES AL MÁXIMO</b>`
      + `<span>No queda nada que instalar. Cierra la ronda y sigue acumulando chips.</span></span>`
      + `<span class="upgrade-level">BONUS<b>+400</b></span></button>`;
    document.querySelector('[data-skip]').onclick = () => {
      state.chips += 400; audio.coin();
      $('upgrade').classList.remove('active');
      const pw = $('pact-offer'); if (pw) { pw.classList.remove('active'); pw.innerHTML = ''; }
      updateHUD(); hudDirty = true; spawnWave(); lockPointer();
    };
  }
  document.querySelectorAll('[data-offer]').forEach(b => b.onclick = () => chooseUpgrade(b.dataset.offer));
  renderPactOffer();
  updateSlotUI();
  $('upgrade').classList.add('active');
}
// El pacto es opcional: se acepta con un clic y se rechaza sin coste.
function renderPactOffer() {
  const wrap = $('pact-offer'); if (!wrap) return;
  if (!currentPacts.length) { wrap.classList.remove('active'); wrap.innerHTML = ''; return; }
  const p = currentPacts[0];
  wrap.classList.add('active');
  wrap.style.setProperty('--pact', p.color);
  wrap.innerHTML = `<div class="pact-head"><small>// PACTO DE INTERFERENCIA</small><b>${p.icon} ${p.name}</b></div>`
    + `<p>${p.desc}</p><span class="pact-curse">MALDICIÓN // ${p.curse}</span>`
    + `<div class="pact-actions"><button id="pact-take">ACEPTAR</button><button id="pact-skip">RECHAZAR</button></div>`;
  $('pact-take').onclick = () => { takePact(p.id); currentPacts = []; renderPactOffer(); };
  $('pact-skip').onclick = () => { currentPacts = []; renderPactOffer(); audio.tone(300, .12, 'square', .07, -80); };
}
function chooseUpgrade(id) {
  if (state.mode !== 'upgrade') return;
  const m = moduleById(id); if (!m) return;
  if (!installModule(id)) return;
  audio.tone(240, .4, 'sawtooth', .12, 620);
  $('upgrade').classList.remove('active');
  const pw = $('pact-offer'); if (pw) { pw.classList.remove('active'); pw.innerHTML = ''; }
  updateHUD(); hudDirty = true; spawnWave(); lockPointer();
}
function rerollUpgrades() { if (state.mode === 'upgrade' && rerolls > 0) { rerolls--; audio.tone(420, .1, 'square', .08, -120); showUpgradeDraft(); } }

// ---------------------------------------------------------------- tragaperras
let spinning = false;
function renderSlotRules() {
  const ul = $('slot-rules'); if (!ul) return;
  ul.innerHTML =
    SLOTS.symbols.map(s => `<li><i style="color:${s.color}">${s.icon}</i><b>${s.label}</b><span>${s.plain}</span></li>`).join('') +
    SLOTS.rules.map(([k, v]) => `<li class="rule"><b>${k}</b><span>${v}</span></li>`).join('');
}
function updateSlotUI() {
  $('slot-chips').textContent = Math.round(state.chips);
  const btn = $('slot-spin');
  btn.disabled = spinning || state.chips < SLOTS.cost;
  const label = btn.querySelector('b');
  if (label) label.textContent = state.chips < SLOTS.cost ? `FALTAN ${Math.ceil(SLOTS.cost - state.chips)} CHIPS` : `GIRAR · ${SLOTS.cost} CHIPS`;
}
function setSlotLabel(i, sym) {
  const el = $('label-' + (i + 1)); if (!el) return;
  el.textContent = sym.label; el.style.color = sym.color;
}
function spinSlots() {
  if (spinning || state.chips < SLOTS.cost) return;
  state.chips -= SLOTS.cost; spinning = true;
  updateSlotUI();
  const reels = [$('reel-1'), $('reel-2'), $('reel-3')];
  const result = [pick(SLOTS.symbols), pick(SLOTS.symbols), pick(SLOTS.symbols)];
  $('slot-result').textContent = 'GIRANDO...';
  $('slot-result').className = '';
  let stopped = 0;
  reels.forEach((el, i) => {
    const t0 = 520 + i * 420;
    const iv = setInterval(() => {
      const s = pick(SLOTS.symbols);
      el.textContent = s.icon; el.style.color = s.color; setSlotLabel(i, s);
      audio.tone(600 + i * 120, .04, 'square', .03, 0);
    }, 90);
    setTimeout(() => {
      clearInterval(iv);
      el.textContent = result[i].icon; el.style.color = result[i].color; setSlotLabel(i, result[i]);
      audio.coin();
      if (++stopped === 3) setTimeout(() => resolveSlots(result), 260);
    }, t0);
  });
}
function resolveSlots(result) {
  spinning = false;
  const ids = result.map(r => r.id);
  const all = ids[0] === ids[1] && ids[1] === ids[2];
  const pair = !all && (ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]);
  const pairId = pair ? (ids[0] === ids[1] ? ids[0] : ids[1] === ids[2] ? ids[1] : ids[0]) : null;
  let text = '', cls = 'good';
  if (all) {
    switch (ids[0]) {
      case 'epic': {
        const epics = MODULES.filter(m => m.rarity === 'ÉPICA' && (state.modules[m.id] || 0) < m.max);
        for (let i = 0; i < 2 && epics.length; i++) { const m = pick(epics); installModule(m.id); }
        blessWeapon(.15);
        text = '¡JACKPOT! DOS MUTACIONES ÉPICAS + BENDICIÓN DEL ARMA ÚNICA'; break;
      }
      case 'wpn': {
        blessWeapon(.22);
        text = '¡TRIPLE BENDICIÓN! ' + currentWeapon().name + ' +22% DAÑO';
        break;
      }
      case 'dmg': state.damage *= 1.25; state.headshotMult += .5; text = '¡TRIPLE DAÑO! +25% DAÑO Y +0.5 HEADSHOT'; break;
      case 'def': state.maxShield += 80; state.shield = state.maxShield; state.maxHp += 30; text = '¡TRIPLE ESCUDO! +80 ESCUDO Y +30 VIDA'; break;
      case 'chip': state.chips += 500; text = '¡TRIPLE CHIPS! +500 CHIPS'; break;
      case 'skull': state.curse = Math.min(1.6, state.curse * 1.3); state.curseMult = Math.min(2.5, state.curseMult * 1.75); text = '¡MALDICIÓN! ENEMIGOS +30% RÁPIDOS, PUNTOS ×1.75'; cls = 'bad'; break;
    }
  } else if (pair) {
    switch (pairId) {
      case 'dmg': state.damage *= 1.12; text = 'PAR DE DAÑO: +12% DAÑO'; break;
      case 'def': state.maxShield += 35; state.shield = state.maxShield; text = 'PAR DE ESCUDO: +35 ESCUDO'; break;
      case 'wpn': {
        blessWeapon(.1);
        text = 'PAR DE BENDICIONES: ' + currentWeapon().name + ' +10% DAÑO';
        break;
      }
      case 'epic': {
        const epics = MODULES.filter(m => m.rarity === 'ÉPICA' && (state.modules[m.id] || 0) < m.max);
        if (epics.length) { const m = pick(epics); installModule(m.id); text = 'PAR ÉPICO: ' + m.name; }
        else text = 'PAR ÉPICO: +200 CHIPS', state.chips += 200;
        break;
      }
      case 'chip': state.chips += 220; text = 'PAR DE CHIPS: +220 CHIPS'; break;
      case 'skull': state.curse = Math.min(1.6, state.curse * 1.15); state.curseMult = Math.min(2.5, state.curseMult * 1.4); text = 'PAR DE RIESGO: ENEMIGOS +15% RÁPIDOS, PUNTOS ×1.4'; cls = 'bad'; break;
    }
  } else {
    state.chips += 120; text = 'SIN COMBINACIÓN: +120 CHIPS DE CONSUELO'; cls = 'neutral';
  }
  syncAmmo();
  renderBuild();
  $('slot-result').textContent = text; $('slot-result').className = cls;
  updateSlotUI(); updateHUD(); hudDirty = true;
  audio.tone(cls === 'bad' ? 90 : 660, .5, cls === 'bad' ? 'sawtooth' : 'square', .14, cls === 'bad' ? -30 : 500);
}

// ---------------------------------------------------------------- flujo
function clearGame() {
  // Cada incursión se resiembra: botín, modificadores y críticos dejan de ser idénticos.
  reseed(Date.now() ^ Math.floor(Math.random() * 2147483646));
  for (const e of enemies) { scene.remove(e.group); disposeObject3D(e.group); } enemies.length = 0;
  for (const p of projectiles) { scene.remove(p.m); disposeObject3D(p.m); } projectiles.length = 0;
  for (const b of lootBoxes) { scene.remove(b.group); disposeObject3D(b.group); } lootBoxes.length = 0;
  for (const c2 of companions) { scene.remove(c2.group); disposeObject3D(c2.group); } companions.length = 0;
  for (const g2 of grenades) { scene.remove(g2.m); disposeObject3D(g2.m); } grenades.length = 0;
  clearHazards();
  for (const h of hazards) { scene.remove(h.m); disposeObject3D(h.m); } hazards.length = 0;
  for (const m of mines) { scene.remove(m.m); disposeObject3D(m.m); } mines.length = 0;
  for (const l of lobs) { scene.remove(l.m); disposeObject3D(l.m); } lobs.length = 0;
  for (const c of comets) { scene.remove(c.m); disposeObject3D(c.m); } comets.length = 0;
  for (const t of relicTops) { scene.remove(t.m); disposeObject3D(t.m); } relicTops.length = 0;
  // Entidades de utilidad, zonas amigas y el gato robot.
  for (const p of pylons) { scene.remove(p.group); disposeObject3D(p.group); } pylons.length = 0;
  for (const z of zones) { scene.remove(z.m); disposeObject3D(z.m); } zones.length = 0;
  if (state.catOut && state.cat) { scene.remove(state.cat.model); disposeObject3D(state.cat.model); }
  state.cat = null; state.catOut = false; state.catCd = 0;
  for (const b of orbitBlades) { scene.remove(b); disposeObject3D(b); } orbitBlades = [];
  if (orbitRing) { scene.remove(orbitRing); disposeObject3D(orbitRing); orbitRing = null; }
  if (orbitLight) { scene.remove(orbitLight); orbitLight = null; }
  if (auraGroup) auraGroup.visible = false;
  // Arsenal extendido: torretas, señuelos espectrales y meteoros en vuelo.
  for (const t of turrets) { scene.remove(t.group); disposeObject3D(t.group); } turrets.length = 0;
  for (const gh of ghosts) {
    scene.remove(gh.model);
    if (gh.model.userData.ghostMat) gh.model.userData.ghostMat.dispose();
    disposeCharacterGhost(gh.model);
  } ghosts.length = 0;
  meteors.length = 0; state.spiralT = 0; state.spiralHit = {};

  const c = CHARACTERS[selectedCharacter];
  const bonus = Meta.getBonuses(selectedCharacter);
  currentOffers = []; currentPacts = []; lootLevels = {};
  state.abilities = {}; state.timers = {};
  // Cada incursión vuelve a empuñar el arma única "de fábrica": las
  // bendiciones no se heredan entre partidas. Los pools se vacían pero NO se
  // destruyen (se reutilizan las mismas mallas / instancias).
  state.weaponBlessing = 0; state.weaponEvolved = {};
  combatProjectiles?.clear(); combatParticles?.clear();
  rerolls = 2 + (bonus.rerolls || 0);
  Object.assign(state, {
    hp: c.hp + bonus.maxHp, maxHp: c.hp + bonus.maxHp,
    ammo: c.maxAmmo + bonus.maxAmmo, maxAmmo: c.maxAmmo + bonus.maxAmmo, baseAmmo: c.maxAmmo + bonus.maxAmmo,
    score: 0, kills: 0, wave: 0, combo: 1, comboTimer: 0, charge: 0, dash: 1, dashing: 0, overdrive: 0,
    damage: c.damage * bonus.damage, speed: c.speed * bonus.speed, fireRate: c.fireRate * bonus.fireRate,
    fireTimer: 0, reloading: 0, yaw: 0, pitch: -.08,
    damageTaken: c.damageTaken * bonus.damageTaken, headshotMult: c.headshotMult + bonus.headshot,
    chargeMult: c.chargeMult * bonus.chargeMult, dashRecovery: c.dashRecovery * bonus.dashRecovery,
    overdriveDuration: c.overdriveDuration + bonus.overdrive, lifeOnKill: bonus.lifeOnKill,
    shield: bonus.shield, maxShield: bonus.shield, shotCount: 0,
    grenade: !!bonus.grenade, grenadeEvery: 5, companions: 0, recoil: 0,
    py: 0, vy: 0, jumps: 1 + (bonus.maxJumps || 0), maxJumps: 1 + (bonus.maxJumps || 0), jumpPower: 10.6 + (bonus.jump || 0), grounded: true,
    frenzy: 0, frenzyTimer: 0, frenzyDuration: 6 + bonus.frenzyDuration, chipMult: bonus.chipMult, chips: 40 + bonus.chips,
    pierceBonus: bonus.pierce, curse: 1, curseMult: 1, pending: 0, reinforceTimer: 0,
    critChance: .09, critMult: 1.65, ads: false, dashPunch: 0, dashRoll: 0, camDip: 0, slide: 0,
    photo: false, modifier: null, modifiers: [], scoreMult: 1, regen: bonus.regen,
    pullT: 0, pullX: 0, pullZ: 0, pullForce: 0,
    meleeId: 'blade', meleeCd: 0, meleeSwing: 0, meleeSeq: 0, meleeCombo: 0, meleeKills: 0, meleeUnlocked: 1,
    utilityId: 'grenade', utilityCd: 0, utilityCharges: UTILITY[0].charges, utilityMax: UTILITY[0].charges, utilityUnlocked: 1, stim: 0,
    invuln: 0, obj: null, lastHit: null, bossHitTaken: false,
    runStart: state.time, runShots: 0, runHits: 0, runHead: 0, runDmg: 0, runTaken: 0,
    // --- arsenal de interferencia: se reinicia por completo cada incursión ---
    modules: {}, familyLevels: {}, resonances: [], pacts: [], evolved: {}, evolutions: {}, relics: [],
    // La segunda vida de las reliquías se rearma en cada incursión.
    revived: false, allyLifeMult: 1,
    killExplode: 0, retaliate: 0, retaliateT: 0, abilityHaste: 1, reloadMult: 1, healMult: 1,
    // Reglas propias del operador (se rellenan en applyOperatorPerk).
    chainBonus: 0, burnOnHit: 0, shieldOnKill: 0, chaosCrit: 0, meleeMult: 1, meleeDash: false,
    shieldRegen: 1, overdriveDamage: 1.25, critExplode: false, regenAlways: false,
    pactElites: 0, enemySpeed: 1, threat: 1, runTime: 0, hordeTimer: THREAT.hordeEvery,
    hordeCount: 0, eliteAffixes: 1, slowT: 0, slowFactor: 1, echoT: 0, hurtT: 0,
    buildScore: 1, roundScoreMult: 1, reloadDur: 1.05
  });
  // ---- regla propia de cada operador nuevo --------------------------------
  // No son números sueltos: cada perk cambia una decisión dentro de la partida.
  applyOperatorPerk(c.perk);
  syncWeaponHUD(); syncUtilityHUD();
  // La granada de serie entra en el códice desde el arranque; el arma única
  // se registra en startGame() con la clave real del héroe.
  Meta.markSeen('utility', state.utilityId);
  if (bonus.companions > 0) for (let i = 0; i < bonus.companions; i++) spawnCompanion(false);
  currentLevel = LEVELS.find(l => l.id === selectedLevelId) || LEVELS[0];
  applyLevel(); rebuildArena();
  // Las mesetas están elevadas: el jugador aparece sobre la superficie real.
  player.position.set(0, 0, 2); state.py = groundAt(0, 2, 60); state.vy = 0;
  applyCharacterAppearance(); syncAmmo();
  $('boss-wrap').classList.add('hidden'); $('killfeed').innerHTML = '';
  document.body.classList.remove('frenzy');
  document.body.style.setProperty('--cyan', uiGem(currentLevel.accent));
  hudDirty = true; updateHUD();
}
function lockPointer() { if (window.__NR_SMOKE) return; const request = renderer.domElement.requestPointerLock?.(); if (request?.catch) request.catch(() => { }); }
function startGame(daily = false) {
  const ctx = audio.init();
  music.init(ctx); music.setVolume(settings.volume / 100); music.setMood(currentLevel.faction); music.setIntensity(.2); music.start();
  clearGame();
  if (daily) {
    // Desafío diario: misma semilla para todos, botín y modificadores idénticos.
    const d = Meta.dailyInfo();
    reseed(d.seed);
    announce('DESAFÍO DIARIO // SEMILLA ' + d.seed);
  }
  Meta.markSeen('weapons', CHARACTERS[selectedCharacter].weapon);
  ['menu', 'hub', 'gameover', 'pause', 'upgrade', 'loot', 'buildsum', 'codex'].forEach(id => $(id) && $(id).classList.remove('active'));
  $('hud').classList.remove('hidden');
  fx.clear();
  spawnWave(); lockPointer();
}
function pause() { if (state.mode !== 'playing') return; state.mode = 'paused'; mouseDown = false; document.exitPointerLock?.(); $('pause').classList.add('active'); }
function resume() { if (state.mode !== 'paused') return; state.mode = 'playing'; $('pause').classList.remove('active'); clock.getDelta(); lockPointer(); }
// Fin de un mundo: 15 rondas y sus tres jefes. Se puede extraer (cerrar la
// incursión con la recompensa completa) o seguir en modo infinito.
function worldComplete() {
  state.mode = 'worldclear'; mouseDown = false; document.exitPointerLock?.();
  document.body.classList.remove('frenzy');
  tryGrantAchievement('worldclear');
  Meta.addTelemetry({ damageDealt: state.runDmg, damageTaken: state.runTaken, shots: state.runShots, hits: state.runHits, headshots: state.runHead, time: state.time - (state.runStart || 0), rounds: state.wave });
  const bonus = Meta.getBonuses(selectedCharacter);
  const earned = Math.round(Meta.creditReward(state.wave, state.score, state.kills, state.chips) * bonus.creditGain * 1.5);
  Meta.addCredits(earned);
  Meta.recordRun(selectedCharacter, state.score, state.wave, state.kills);
  const best = Math.max(state.score, Number(localStorage.getItem('nr-best') || 0));
  localStorage.setItem('nr-best', best);
  $('wc-score').textContent = String(Math.round(state.score)).padStart(6, '0');
  $('wc-kills').textContent = String(state.kills).padStart(2, '0');
  $('wc-wave').textContent = String(state.wave).padStart(2, '0');
  $('wc-earned').textContent = '+' + earned;
  $('wc-total').textContent = Meta.getCredits();
  $('worldclear-sub').textContent = currentLevel.name + ' // ' + ROUNDS.perWorld + ' RONDAS COMPLETADAS. Jefes caídos: ' + Math.min(3, Math.floor(state.wave / ROUNDS.bossEvery)) + '/3.';
  announce('MUNDO DOMINADO');
  fx.flash('#ffffff', .4, 300);
  setTimeout(() => $('worldclear').classList.add('active'), 500);
}
function gameOver() {
  state.mode = 'gameover'; mouseDown = false; document.exitPointerLock?.();
  music.setIntensity(0); music.stop();
  document.body.classList.remove('frenzy');
  const bonus = Meta.getBonuses(selectedCharacter);
  const earned = Math.round(Meta.creditReward(state.wave, state.score, state.kills, state.chips) * bonus.creditGain);
  Meta.addCredits(earned);
  Meta.recordRun(selectedCharacter, state.score, state.wave, state.kills);
  // Telemetría de la incursión y clasificación local.
  Meta.addTelemetry({ damageDealt: state.runDmg, damageTaken: state.runTaken, shots: state.runShots, hits: state.runHits, headshots: state.runHead, time: state.time - (state.runStart || 0), deaths: 1, rounds: state.wave });
  Meta.submitDaily(state.score);
  Meta.submitScore({ char: CHARACTERS[selectedCharacter].name, score: Math.round(state.score), wave: state.wave, kills: state.kills, daily: Meta.dailyInfo().day });
  if (state.wave >= 15) tryGrantAchievement('round15');
  const best = Math.round(Math.max(state.score, Number(localStorage.getItem('nr-best') || 0)));
  localStorage.setItem('nr-best', best);
  $('best-score').textContent = String(best).padStart(6, '0');
  $('final-score').textContent = String(Math.round(state.score)).padStart(6, '0');
  $('final-kills').textContent = String(state.kills).padStart(2, '0');
  $('final-wave').textContent = String(state.wave).padStart(2, '0');
  $('credits-earned').textContent = '+' + earned;
  $('credits-total').textContent = Meta.getCredits();
  // Causa de la muerte: qué te remató y desde qué ronda.
  const lh = state.lastHit;
  $('death-cause').textContent = lh
    ? 'REMATADO POR: ' + lh.by.toUpperCase() + ' · ' + lh.amount + ' DE DAÑO · RONDA ' + lh.wave
    : 'SEÑAL PERDIDA EN LA RONDA ' + state.wave;
  setTimeout(() => $('gameover').classList.add('active'), 450);
}
function toMenu() {
  state.mode = 'menu'; clearGame(); music.stop(); fx.clear();
  ['gameover', 'pause', 'upgrade', 'hub', 'loot'].forEach(id => $(id).classList.remove('active'));
  $('hud').classList.add('hidden'); $('menu').classList.add('active');
  document.body.classList.remove('photo-mode'); state.photo = false;
  refreshMenuStats();
}
function refreshMenuStats() {
  const m = Meta.getMeta();
  $('menu-credits').textContent = Meta.getCredits();
  const b = Meta.bestOf(selectedCharacter);
  $('menu-best-wave').textContent = String(b.wave).padStart(2, '0');
  $('menu-runs').textContent = m.totals.runs;
  $('best-score').textContent = String(Math.round(Number(localStorage.getItem('nr-best') || 0))).padStart(6, '0');
  if ($('hub-points')) $('hub-points').textContent = Meta.getCredits();
  // Chip del desafío diario en el menú principal.
  const d = Meta.dailyInfo();
  if ($('menu-daily-chip')) $('menu-daily-chip').textContent = 'DESAFÍO DIARIO // MEJOR ' + String(d.best).padStart(6, '0');
}
// Modo foto: oculta la interfaz para capturar la escena (también desde el hub).
function togglePhoto() {
  if (state.mode !== 'playing' && state.mode !== 'paused') return;
  state.photo = !state.photo;
  document.body.classList.toggle('photo-mode', state.photo);
  if (state.photo) announce('MODO FOTO // INTERFAZ OCULTA');
}

// ---------------------------------------------------------------- UI
$('start-btn').onclick = () => openHub('operator');
$('skills-btn').onclick = () => openHub('skills');
$('hub-back').onclick = toMenu;
$('hub-deploy').onclick = () => startGame(false);
if ($('daily-btn')) $('daily-btn').onclick = () => startGame(true);
if ($('menu-codex-btn')) $('menu-codex-btn').onclick = () => { openHub('codex'); };
if ($('codex-close')) $('codex-close').onclick = closeCodex;
if ($('buildsum-close')) $('buildsum-close').onclick = closeBuildSummary;
if ($('telemetry-reset')) $('telemetry-reset').onclick = () => { Meta.resetTelemetry(); refreshDossier(); audio.tone(300, .1, 'square', .08, -120); };
if ($('lb-clear')) $('lb-clear').onclick = () => { Meta.clearLeaderboard(); refreshDossier(); audio.tone(240, .1, 'square', .08, -120); };
document.querySelectorAll('.hub-tabs button').forEach(b => b.onclick = () => { audio.tone(520, .08, 'square', .07, 120); selectHubTab(b.dataset.tab); });
document.querySelectorAll('[data-skillchar]').forEach(chip => chip.onclick = () => {
  hubSkillChar = chip.dataset.skillchar; hubTree = null; renderHubTree();
  audio.tone(620, .08, 'square', .07, 160);
});
if ($('tree-names')) $('tree-names').addEventListener('change', e => hubTree?.setNames(e.target.checked));
if ($('tree-search')) $('tree-search').addEventListener('input', e => hubTree?.setSearch(e.target.value));
if ($('tree-fit-btn')) $('tree-fit-btn').onclick = () => { hubTree?.fit(); audio.tone(440, .07, 'square', .07, 120); };
$('respec-btn').onclick = () => {
  const r = Meta.respec(hubSkillChar || selectedCharacter);
  hubTree = null; renderHubTree(); refreshMenuStats();
  announce('REEMBOLSO: ' + r + ' PUNTOS DE CLASE');
  audio.tone(360, .2, 'square', .1, 260);
};
$('restart-btn').onclick = () => startGame(false);
$('restart-pause-btn').onclick = () => startGame(false);
$('resume-btn').onclick = resume;
$('menu-btn').onclick = () => openHub('operator');
$('pause-menu-btn').onclick = () => openHub('operator');
$('skills-btn-gameover').onclick = () => { $('gameover').classList.remove('active'); openHub('skills'); };
$('wc-continue').onclick = () => { $('worldclear').classList.remove('active'); state.mode = 'transition'; showUpgradeDraft(); };
$('wc-extract').onclick = () => { $('worldclear').classList.remove('active'); openHub('operator'); };
$('loot-equip-btn').onclick = equipLoot;
$('quit-btn').onclick = () => window.desktop?.quit();
$('fullscreen-btn').onclick = () => window.desktop?.fullscreen();
$('reroll-btn').onclick = rerollUpgrades;
$('slot-spin').onclick = spinSlots;
$('music-btn').onclick = () => { const on = music.setEnabled(!music.enabled); $('music-btn').textContent = on ? 'MÚSICA: ON' : 'MÚSICA: OFF'; };
$('menu-music-btn').onclick = () => { const on = music.setEnabled(!music.enabled); $('menu-music-btn').textContent = on ? 'MÚSICA: ON' : 'MÚSICA: OFF'; };
$('hud-menu-btn').onclick = () => pause();
buildOperatorRoster();
$('op-roster')?.addEventListener('click', e => {
  const item = e.target.closest('[data-character]'); if (!item) return;
  audio.tone(480, .09, 'square', .08, 180);
  selectCharacter(item.dataset.character);
});
if ($('op-confirm')) $('op-confirm').onclick = () => {
  selectCharacter(selectedCharacter);
  audio.tone(720, .12, 'square', .09, 240);
  selectHubTab('sector');
};
if ($('armory-search')) $('armory-search').addEventListener('input', () => renderArmory());
document.querySelectorAll('[data-level]').forEach(card => card.onclick = () => { audio.tone(480, .09, 'square', .08, 180); selectLevel(card.dataset.level); });

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); jump(); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') dash();
  if (e.code === 'KeyR') reload();
  if (e.code === 'KeyQ') overdrive();
  // F (cambiar arma) y E (cuerpo a cuerpo) ya no existen: cada héroe tiene
  // un arma única y el melé se ejecuta con el mismo clic que el disparo.
  if (e.code === 'KeyG') useUtility();
  if (e.code === 'KeyX') cycleUtility();
  if (e.code === 'KeyC') summonCat();
  if (e.code === 'KeyP') togglePhoto();
  if (e.code === 'KeyB') { if (state.mode === 'codex') closeCodex(); else openCodex(); }
  if (e.code === 'Tab') {
    e.preventDefault();
    if (state.mode === 'buildsum') closeBuildSummary();
    else if (state.mode === 'playing') openBuildSummary();
  }
  if (e.code === 'KeyM') {
    const on = music.setEnabled(!music.enabled);
    $('music-btn').textContent = on ? 'MÚSICA: ON' : 'MÚSICA: OFF';
    if ($('menu-music-btn')) $('menu-music-btn').textContent = on ? 'MÚSICA: ON' : 'MÚSICA: OFF';
  }
  if (e.code === 'Escape') {
    if (state.mode === 'codex') closeCodex();
    else if (state.mode === 'buildsum') closeBuildSummary();
    else if (state.mode === 'playing') pause();
    else if (state.mode === 'paused') resume();
  }
  if (e.code === 'F11') window.desktop?.fullscreen();
  // F3: monitor de rendimiento en vivo (FPS, draw calls, triángulos, FX, amenaza).
  if (e.code === 'F3') { e.preventDefault(); perf.show = !perf.show; updatePerfHud(); }
});
// Biblioteca en partida: pausa el combate sin mostrar el menú de pausa.
function openCodex() {
  if (state.mode !== 'playing' && state.mode !== 'paused') return;
  state.mode = 'codex'; mouseDown = false;
  document.exitPointerLock?.();
  const kills = {};
  const cx = Meta.getCodex();
  for (const k in cx.enemies) kills[k] = cx.enemies[k].kills || 0;
  renderCodex($('codex-body'), Meta, { kills });
  $('codex-count').textContent = codexSummary(Meta);
  $('codex').classList.add('active');
  audio.tone(540, .1, 'square', .08, 160);
}
function closeCodex() {
  if (state.mode !== 'codex') return;
  $('codex').classList.remove('active');
  state.mode = 'playing'; clock.getDelta(); lockPointer();
}
// Resumen de build (TAB): estadísticas, arsenal y mutaciones sin pausar el tiempo.
function openBuildSummary() {
  if (state.mode !== 'playing') return;
  state.mode = 'buildsum'; mouseDown = false;
  document.exitPointerLock?.();
  fillBuildSummary();
  $('buildsum').classList.add('active');
}
function closeBuildSummary() {
  if (state.mode !== 'buildsum') return;
  $('buildsum').classList.remove('active');
  state.mode = 'playing'; clock.getDelta(); lockPointer();
}
function fillBuildSummary() {
  const c = CHARACTERS[selectedCharacter];
  const w = currentWeapon();
  const stats = [['VIDA', Math.round(state.hp) + '/' + Math.round(state.maxHp)], ['DAÑO', Math.round(state.damage)],
    ['CADENCIA', (1 / (state.fireRate * w.fireRate)).toFixed(1) + '/s'], ['VELOCIDAD', state.speed.toFixed(1)],
    ['CRÍTICO', Math.round(state.critChance * 100) + '%'], ['REDUCCIÓN', Math.round((1 - state.damageTaken) * 100) + '%']];
  const melee = meleeInfo(), util = utilityInfo();
  // Segunda ranura = el ataque primario con CLIC. Ya no es una ranura «E // 
  // CUERPO A CUERPO»: el melé solo existe para bárbaro y vampiro y comparte
  // botón con el disparo. Se conservan 4 .bs-slot (contrato del smoke test).
  const attackSlot = isMeleeHero()
    ? `<div class="bs-slot" style="--cc:${melee.color}"><b>CLIC // ATAQUE MELÉ</b><span>${melee.icon} ${melee.name} · ${melee.sub}</span><small>${melee.damage.toFixed(1)}× DAÑO · ${melee.range.toFixed(1)}m · ${melee.cooldown.toFixed(2)}s${state.weaponBlessing > 0 ? ' · BENDICIÓN +' + Math.round(state.weaponBlessing * 100) + '%' : ''}</small></div>`
    : `<div class="bs-slot" style="--cc:${w.color ? '#' + w.color.toString(16).padStart(6, '0') : '#ffcf4a'}"><b>CLIC // DISPARO</b><span>↯ ${w.name} · ${w.sub}</span><small>${(1 / (state.fireRate * w.fireRate)).toFixed(1)} DISPAROS/s · ${w.pellets} PROYECTIL(ES)</small></div>`;
  $('buildsum-body').innerHTML = `
    <div class="bs-col"><h4>HÉROE</h4>
      <div class="bs-stats">${stats.map(([n, v]) => `<div class="build-stat"><span>${n}</span><b>${v}</b></div>`).join('')}</div></div>
    <div class="bs-col"><h4>RANURAS DE CARGA</h4>
      <div class="bs-slot" style="--cc:${w.color ? '#' + w.color.toString(16).padStart(6, '0') : '#ffcf4a'}"><b>PRINCIPAL</b><span>${w.name} · ${w.sub}</span><small>${state.ammo}/${state.maxAmmo}</small></div>
      ${attackSlot}
      <div class="bs-slot" style="--cc:${util.color}"><b>G // UTILIDAD</b><span>${util.icon} ${util.name}</span><small>${state.utilityCharges}/${util.charges} · ${state.utilityCd > 0 ? Math.ceil(state.utilityCd) + 's' : 'LISTA'}</small></div>
      <div class="bs-slot" style="--cc:#ffd34d"><b>C // MASCOTA</b><span>❥ GATO-9</span><small>${state.catOut ? 'EN CAMPO · ' + Math.max(0, Math.round(state.cat.hp)) + ' HP' : state.catCd > 0 ? 'RECALIBRÁNDOSE ' + Math.ceil(state.catCd) + 's' : 'LISTO'}</small></div></div>
    <div class="bs-col"><h4>MUTACIONES Y HABILIDADES</h4>
      <div class="bs-mods">${(() => {
        const mods = MODULES.filter(m => state.modules[m.id]).map(m => `<div class="build-mod"><span>${m.icon} ${m.name}</span><b>NV.${state.modules[m.id]}</b></div>`);
        const abs = Object.keys(state.abilities).map(k => { const a = ABILITIES.find(x => x.id === k); return `<div class="build-mod"><span>${a.icon} ${a.name}</span><b>NV.${state.abilities[k]}</b></div>`; });
        const syn = activeSynergies().map(s => `<div class="build-mod syn" style="color:${s.color}"><span>◈ ${s.name}</span><b>ACTIVA</b></div>`);
        const out = [...mods, ...abs, ...syn];
        return out.length ? out.join('') : '<div class="build-mod"><span>SIN MUTACIONES</span></div>';
      })()}</div></div>`;
}
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('mousedown', e => {
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) state.ads = true;
});
addEventListener('mouseup', e => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) state.ads = false;
});
addEventListener('contextmenu', e => { if (state.mode === 'playing') e.preventDefault(); });
addEventListener('mousemove', e => {
  if (document.pointerLockElement === renderer.domElement && state.mode === 'playing') {
    const sens = settings.sensitivity / 1400;
    state.yaw -= e.movementX * sens;
    state.pitch = clamp(state.pitch - e.movementY * sens * (settings.invert ? -1 : 1) * .82, -.65, .55);
  }
});
renderer.domElement.addEventListener('click', () => { if (state.mode === 'playing' && document.pointerLockElement !== renderer.domElement) lockPointer(); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && state.mode === 'playing') pause(); });
addEventListener('blur', () => { if (state.mode === 'playing') pause(); });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  applyPixelRatio();
});

// ---------------------------------------------------------------- bucle
let radarTimer = 0, musicTimer = 0, heartT = 0;

// ---------------------------------------------------------- rendimiento
// Calidad adaptativa: si el frame se alarga se baja la resolución de render;
// si sobra margen se recupera. Nunca se toca la lógica del juego.
const perf = { fps: 60, avg: 16.7, acc: 0, frames: 0, quality: 1, slowStreak: 0, fastStreak: 0, show: false };
const perfEl = document.createElement('div');
perfEl.id = 'perf-hud';
document.body.appendChild(perfEl);
function applyPixelRatio() {
  const base = Math.min(window.devicePixelRatio || 1, 1.65);
  renderer.setPixelRatio(base * perf.quality);
  composer.setPixelRatio ? composer.setPixelRatio(base * perf.quality) : null;
  composer.setSize(innerWidth, innerHeight);
  // El bloom es un desenfoque: calcularlo a media resolución no se distingue y
  // recorta a la CUARTA PARTE el trabajo de píxeles del pase más caro.
  bloom.setSize(Math.max(8, Math.round(innerWidth * .5)), Math.max(8, Math.round(innerHeight * .5)));
}
function adaptQuality() {
  if (perf.avg > 24) { perf.slowStreak++; perf.fastStreak = 0; }
  else if (perf.avg < 13) { perf.fastStreak++; perf.slowStreak = 0; }
  else { perf.slowStreak = 0; perf.fastStreak = 0; }
  if (perf.slowStreak >= 3 && perf.quality > .62) {
    perf.quality = Math.max(.62, perf.quality - .16);
    perf.slowStreak = 0;
    applyPixelRatio();
  } else if (perf.fastStreak >= 6 && perf.quality < 1) {
    perf.quality = Math.min(1, perf.quality + .12);
    perf.fastStreak = 0;
    applyPixelRatio();
  }
}
function updatePerfHud() {
  perfEl.classList.toggle('on', !!perf.show);
  if (!perf.show) return;
  const info = renderer.info.render;
  const fxStats = vfx.stats();
  const fams = Object.keys(state.familyLevels).length;
  perfEl.innerHTML =
    `<b>${perf.fps} FPS</b> · ${perf.avg.toFixed(1)} ms · CALIDAD ${Math.round(perf.quality * 100)}%<br>` +
    `DRAW ${info.calls} · TRI ${(info.triangles / 1000).toFixed(0)}K · HOSTILES ${enemies.length}<br>` +
    `FX chispas ${fxStats.sparks} · motas ${fxStats.motes} · líneas ${fxStats.lines}<br>` +
    `AMENAZA ×${(state.threat || 1).toFixed(2)} · MÓDULOS ${fams} · RESONANCIAS ${state.resonances.length}`;
}

// Un paso de simulación: todo lo que avanza con el tiempo de juego.
function simStep(dt) {
  // updateEnemies ya refresca los peligros de jefe (updateBossHazards);
  // aquí van el resto: ácido, utilidad, gato y objetivo de ronda.
  updatePlayer(dt); updateEnemies(dt); updateProjectiles(dt); updateGrenades(dt);
  updateCompanions(dt); updateLoot(dt); updateAbilities(dt); updateHazards(dt); updateLobs(dt); updateDots(dt); updateRelicSystems(dt);
  updateUtility(dt); updateCat(dt); updateObjective(dt); updateDirector(dt); updateExecuteMarker(dt);
}
function animate() {
  requestAnimationFrame(animate);
  const raw = Math.min(clock.getDelta(), .04);
  // hitstop y cámara lenta controlan el tiempo del juego, no el de la interfaz.
  const dt = raw * (settings.fx ? fx.timeScale() : 1);
  state.time += raw;
  // El mapa de sombras se refresca en frames alternos: la mitad de coste de
  // dibujado de sombra y un frame de retardo que no se percibe.
  if ((perf.frames & 1) === 0) moon.shadow.needsUpdate = true;
  perf.acc += raw; perf.frames++;
  if (perf.acc >= .5) {
    perf.fps = Math.round(perf.frames / perf.acc);
    perf.avg = (perf.acc / perf.frames) * 1000;
    perf.acc = 0; perf.frames = 0;
    adaptQuality();
    updatePerfHud();
  }
  const pos = rain.geometry.attributes.position.array;
  for (let i = 0; i < rainCount; i++) {
    pos[i * 3 + 1] -= raw * 20; pos[i * 3] -= raw * 2;
    if (pos[i * 3 + 1] < 0) { pos[i * 3 + 1] = 34; pos[i * 3] = player.position.x + (rnd() - .5) * 100; pos[i * 3 + 2] = player.position.z + (rnd() - .5) * 100; }
  }
  rain.geometry.attributes.position.needsUpdate = true;
  // Brillo del agua y de las cascadas del escenario voxel.
  updateWorld(state.time);

  if (state.mode === 'playing') {
    // Paso de simulación subdividido: si el frame va rezagado (dt > 20 ms) se
    // parte en dos pasos para que la física y los golpes no salten.
    const steps = raw > .02 ? 2 : 1;
    for (let s = 0; s < steps; s++) simStep(dt / steps);
    radarTimer -= dt; if (radarTimer <= 0) { updateRadar(); radarTimer = .12; }
    musicTimer -= dt;
    if (musicTimer <= 0) {
      musicTimer = .5;
      let alive = 0; for (const e of enemies) if (!e.dead) alive++;
      music.setIntensity(Math.min(1, alive / 20 * .6 + (state.frenzyTimer > 0 ? .4 : 0) + state.wave * .02));
    }
    // Bloom ESTABLE: el mundo fija su bloom y se queda fijo. Las sumas por
    // combo/frenesi/dash hacian oscilar el brillo de toda la escena mientras
    // se juega (el combo cambia cada segundo) = bombeo continuo que cansa.
    bloom.strength = currentBloom;
    // Audio reactivo: latido grave cuando la integridad es crítica.
    heartT -= raw;
    if (state.maxHp > 0 && state.hp / state.maxHp < .32 && heartT <= 0) {
      heartT = .85;
      audio.tone(58, .15, 'sine', .18, -16);
      setTimeout(() => audio.tone(50, .12, 'sine', .13, -12), 170);
    }
    pollGamepad(raw);
    updateHUD();
  } else if (state.mode === 'menu' || state.mode === 'hub') {
    const a = state.time * .075;
    camera.position.set(Math.sin(a) * 24, 11, Math.cos(a) * 24); camera.lookAt(0, 2, 0);
    player.rotation.y = Math.sin(state.time * .3) * .2;
  } else if (state.mode === 'transition') {
    updateProjectiles(dt); updateLoot(dt);
  }
  // Un único mixer.update() por frame, también en menú/hub para que el idle
  // sintetizado siga vivo. En partida usa el dt de simulación (respeta el
  // hitstop / cámara lenta igual que la física del suelo).
  updateCharacterGLB(player, state.mode === 'playing' ? dt : raw);
  // Los proyectiles viajan con el dt de simulación (respetan hitstop / cámara
  // lenta); las partículas usan el tiempo real para no congelarse en un golpe.
  combatProjectiles?.update(dt);
  combatParticles?.update(raw);
  vfx.update(dt);
  fx.update(camera, raw);
  // ---- estado que alimenta el pase cinematográfico ------------------------
  const hpRatio = state.maxHp > 0 ? state.hp / state.maxHp : 1;
  const playing = state.mode === 'playing';
  cine.enabled = !!settings.fx;
  cine.update(raw, {
    // el dash y la sobrecarga estiran la imagen hacia el centro
    blur: playing ? clamp(state.dashPunch * .85 + (state.overdrive > 0 ? .22 : 0) + (frenzyActive() ? .12 : 0), 0, 1) : 0,
    heat: playing && state.overdrive > 0 ? clamp(state.overdrive / state.overdriveDuration, .35, 1) : 0,
    damage: playing && hpRatio < .55 ? (1 - hpRatio / .55) * .85 : 0,
    lift: playing ? Math.min(.35, state.shake * .5) : 0,
    // el bombo de la música empuja la saturación: el neón late con el sintetizador
    beat: (music.enabled ? music.beat || 0 : 0)
  });
  // Contabilidad real del frame: con EffectComposer hay varios pases, así que se
  // desactiva el auto-reset y se reinicia una vez por frame.
  renderer.info.reset();
  composer.render();
}

// ---------------------------------------------------------------- mando
// Mapeo estándar: sticks para mover/apuntar, gatillos para disparar/dashear.
let padPrev = {};
const padMove = { x: 0, y: 0 };
function pollGamepad(dt) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let pad = null;
  for (const p of pads) if (p && p.connected) { pad = p; break; }
  if (!pad) { padMove.x = 0; padMove.y = 0; return; }
  const dz = v => Math.abs(v) < .18 ? 0 : v;
  padMove.x = dz(pad.axes[0] || 0);
  padMove.y = dz(pad.axes[1] || 0);
  const sens = settings.sensitivity / 1400 * 2.4;
  state.yaw -= dz(pad.axes[2] || 0) * sens * dt * 14;
  state.pitch = clamp(state.pitch - dz(pad.axes[3] || 0) * sens * dt * 10 * (settings.invert ? -1 : 1), -.65, .55);
  const b = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
  state.padFire = b(7) || dz(pad.buttons[7]?.value || 0) > .4;
  const edge = i => { const now = b(i), was = !!padPrev[i]; padPrev[i] = now; return now && !was; };
  if (edge(0)) jump();
  // El botón 1 (antes melé) y el 3 (antes cambio de arma) quedan libres:
  // el ataque primario es el gatillo RT/7, que enruta primaryAttack().
  if (edge(2)) reload();
  if (edge(4)) useUtility();
  if (edge(5)) overdrive();
  if (edge(6)) dash();
}

// ---------------------------------------------------------------- arranque
Meta.loadMeta();
// El parseo del .glb (34 MB, texturas PNG embebidas) arranca en paralelo al
// resto del boot: cuando el jugador abra el hub ya estará en caché.
preloadCharacterGLB(selectedCharacter);
// Los 56 GLB del Kenney Nature Kit se parsean en paralelo al boot. Cuando
// llegan, se reconstruye la arena del Mundo 1 para sustituir el suelo vacío
// por los modelos reales; en los otros once mundos no cambia nada.
const natureBoot = initNatureKit();
natureBoot.then((diag) => {
  window.__NR_NATURE_READY = !!diag;
  if (diag && window.__NR_NATURE_PENDING && currentLevel.id === 'rooftop') {
    window.__NR_NATURE_PENDING = false;
    rebuildArena();
  }
});
// --- Arranque en paralelo del arsenal único --------------------------------
// Los cinco GLB de arma, los sprites Kenney y los .ogg se leen por IPC sin
// bloquear el menú. El soporte lógico del arma ya funciona desde el primer
// frame; cuando llega el GLB se cuelga del héroe activo (incluso si el
// jugador cambió de personaje mientras cargaba).
const weaponBoot = initWeapons();
const vfxBoot = combatParticles.init();
const sfxBoot = loadSfxBank();
Promise.all([weaponBoot, vfxBoot, sfxBoot]).then(([wd, vd, sd]) => {
  if (wd?.ok && player) attachWeapon(player, selectedCharacter);
  window.__NR_COMBAT_READY = !!(wd?.ok && vd?.ok && sd?.ok);
  window.__NR_COMBAT = {
    weapons: weaponDiagnostics(), vfx: vd || null, sfx: sfxDiagnostics(),
    projectiles: combatProjectiles?.diag || null
  };
  console.log('COMBAT_ASSETS: ' + JSON.stringify(window.__NR_COMBAT));
});
applyCharacterAppearance();
selectLevel(selectedLevelId);
wireSettings();
syncSettingsUI();
renderSlotRules();
renderDifficulties();
refreshMenuStats();
updateHubSummary();
if ($('gpu-name')) $('gpu-name').title = gpuName;
setTimeout(() => { $('boot').style.opacity = '0'; setTimeout(() => $('boot').remove(), 650); }, 1100);
// Electron mantiene el renderer vivo entre recargas: liberar explícitamente
// mixer, geometrías, materiales, texturas y el caché procedural evita fugas.
window.addEventListener('beforeunload', () => {
  combatProjectiles?.dispose();
  combatParticles?.dispose();
  disposeWeapons();
  disposeSfxBank();
  disposeAllCharacterAssets();
  disposeOperatorCache();
  disposeNatureKit();
  worldManager.dispose();
});
animate();

// utilidades de prueba
function testDropLoot() { spawnLootBox(player.position.clone()); }
function testOpenLoot() { rollLoot(); }
function testDropCompanion() { spawnCompanion(true); }
function testSpawn(type) { return createEnemy(type, player.position.x + 8, player.position.z + 4, false, currentLevel.faction); }
// El botín de armas desapareció: el gancho de prueba ahora comprueba que una
// bendición potencia el arma única en vez de añadir otra al inventario.
function testGrantWeapon() {
  blessWeapon(.15);
  return { weapon: currentWeapon().key, blessing: +(state.weaponBlessing || 0).toFixed(3), ammo: state.ammo };
}
function testAddChips(n) { state.chips += n; updateSlotUI(); }
// QC: invulnerabilidad temporal para capturas automatizadas (oleadas vivas
// mataban al héroe antes de la foto: W7 salio con la pantalla de derrota).
function testGod(on = true) {
  state.damageTaken = on ? 0 : 1;
  if (on) { state.hp = state.maxHp; state.shield = state.maxShield; hudDirty = true; }
  return { god: on, hp: state.hp };
}
function testClearEnemies() {
  for (const e of enemies) { if (!e.dead) { e.dead = true; scene.remove(e.group); disposeObject3D(e.group); } }
  enemies.length = 0;
}
function testAbility(id) {
  state.abilities[id] = (state.abilities[id] || 0) + 1; state.timers[id] = 0;
  if (id === 'orbit') syncOrbit();
  if (id === 'swarm') spawnCompanion(true);
  checkAbilityEvolution(id);
}
function testTurret() { state.abilities.turret = 3; castTurret(); return turrets.length; }
function testMeteor() { state.abilities.meteor = 3; castMeteor(); return meteors.length; }
function testGhost() { state.abilities.ghost = 3; castGhost(); return ghosts.length; }
function testSpiral() { state.abilities.spiral = 3; castSpiral(); return (state.spiralT || 0) > 0; }
function testEvolveAbility(id) { state.abilities[id] = 99; return checkAbilityEvolution(id); }
function testGrantRelic() { const r = grantRelic(); return r ? { id: r.id, name: r.name } : null; }
function getMap() { return currentLevel.id; }
function getLootLevels() { return { ...lootLevels, ...state.abilities }; }
function getSynergies() { return activeSynergies().map(s => s.id); }
// --- ganchos de prueba del arsenal (solo los usa el smoke test) ----------
function testInstall(id) { return installModule(id); }
function testElite(affixId, type = 'chaser') {
  const e = createEnemy(type, player.position.x + 7, player.position.z + 4, true, currentLevel.faction);
  if (e && affixId) {
    const f = affixById(affixId);
    if (f) { e.affixes = [f]; e.affixName = f.name; if (f.onSpawn) f.onSpawn(e, AFFIX_API); }
  }
  return e ? { type: e.type, hp: Math.round(e.maxHp), affix: e.affixName || null, armor: Math.round(e.armor || 0) } : null;
}
function testEvolve() {
  // Saturar el don ya no transforma el arma: aplica una BENDICIÓN permanente
  // sobre el arma única y deja constancia en state.weaponEvolved.
  const ev = EVOLUTIONS[0];
  const mod = moduleById(ev.need);
  while ((state.modules[ev.need] || 0) < mod.max) installModule(ev.need);
  return {
    weapon: currentWeapon().key, blessing: +(state.weaponBlessing || 0).toFixed(3),
    evolved: Object.keys(state.weaponEvolved || {}), name: ev.name
  };
}
// --- ganchos de prueba del sistema de combate ------------------------------
function testCombat() {
  return {
    ready: !!window.__NR_COMBAT_READY, active: activeWeapon()?.key || null,
    weapons: weaponDiagnostics(), vfx: combatParticles?.diag || null,
    projectiles: combatProjectiles?.diag || null, sfx: sfxDiagnostics()
  };
}
async function testFire(count = 6, gap = 75) {
  state.mode = 'playing';
  // Espaciado real entre disparos: si se disparan todos en el mismo frame los
  // sprites se apilan y la captura no representa lo que ve el jugador.
  for (let i = 0; i < count; i++) {
    // primaryAttack() cubre ambos casos: para bárbaro/vampiro ejecuta el tajo
    // melé real (animación + partículas de arco), para el resto el disparo.
    state.fireTimer = 0; state.reloading = 0; state.meleeCd = 0;
    primaryAttack();
    if (gap) await new Promise(r => setTimeout(r, gap));
  }
  return {
    attack: isMeleeHero() ? 'melee' : 'ranged',
    spawned: combatProjectiles?.diag.spawned || 0,
    emitted: combatParticles?.diag.emitted || 0,
    played: sfxDiagnostics().played
  };
}
// Regresión del pool: un proyectil reciclado debe RECORRER su trayectoria y
// ejecutar el callback de impacto (el daño ya no se aplica al apretar el
// gatillo). Sin esto un cambio en update() podría dejar los disparos mudos.
async function testProjectileHit() {
  const e = createEnemy('chaser', player.position.x, player.position.z - 6, false, currentLevel.faction);
  e.spawn = 0; e.speed = 0; e.cooldown = 99;
  const before = e.hp;
  const spawned0 = combatProjectiles?.diag.spawned || 0;
  let arrived = 0;
  const from = player.position.clone().add(new THREE.Vector3(0, 1.4, -.4));
  const to = from.clone().add(new THREE.Vector3(0, 0, -5));
  combatProjectiles?.spawn('arrow', from, to, {
    speed: 26, characterId: selectedCharacter,
    onImpact: () => { arrived++; applyShotHit({ e, head: false }, Math.max(2, state.damage * .25)); }
  });
  await new Promise(r => setTimeout(r, 650));
  const after = e.dead ? 0 : e.hp;
  return {
    spawned: (combatProjectiles?.diag.spawned || 0) - spawned0,
    arrived, damaged: after < before, hpBefore: Math.round(before), hpAfter: Math.round(after),
    live: combatProjectiles?.diag.live || 0
  };
}
function testDirector(seconds = 120) {
  state.runTime += seconds;
  state.hordeTimer = 0;
  updateDirector(.016);
  return { threat: +state.threat.toFixed(2), runTime: Math.round(state.runTime), hordes: state.hordeCount, enemies: enemies.length };
}
function getPerf() {
  const r = renderer.info;
  return {
    calls: r.render.calls, tris: r.render.triangles,
    geometries: r.memory.geometries, textures: r.memory.textures,
    programs: r.programs ? r.programs.length : -1,
    enemies: enemies.length, projectiles: projectiles.length,
    fx: vfx.stats()
  };
}
function getBuild() {
  return {
    modules: Object.assign({}, state.modules), families: Object.assign({}, state.familyLevels),
    resonances: state.resonances.slice(), pacts: state.pacts.map(p => p.id),
    evolved: Object.keys(state.evolved), threat: +state.threat.toFixed(2),
    damage: Math.round(state.damage), fireRate: +state.fireRate.toFixed(3), crit: +state.critChance.toFixed(3),
    maxHp: Math.round(state.maxHp), maxShield: Math.round(state.maxShield), scoreMult: +(state.scoreMult || 1).toFixed(2)
  };
}

function testForceModifier(id) {
  const m = MODIFIERS.find(x => x.id === id) || null;
  state.modifier = m; state.modifiers = m ? [m] : [];
  state.scoreMult = currentDifficulty().reward * (m ? m.score : 1);
  showModifier();
  return state.modifier ? state.modifier.id : null;
}
// Comprobación de las colisiones de la utilería: la usa el test de humo.
function testProps() {
  const out = { colliders: propColliders.length, pushed: 0, checked: 0, inside: 0, enemies: 0, blocked: 0, rayTests: 0 };
  // 1. Un punto colocado en el centro de un prop debe salir expulsado.
  for (const c of propColliders.slice(0, 24)) {
    const p = new THREE.Vector3(c.x, 0, c.z);
    out.checked++;
    resolveProps(p, .6, 0);
    if (Math.hypot(p.x - c.x, p.z - c.z) > Math.min(c.hw, c.hd) * .9) out.pushed++;
  }
  // 2. Ningún hostile terrestre debe estar dentro de un prop.
  for (const e of enemies) {
    if (e.dead || e.spawn > 0 || e.type === 'flyer' || e.type === 'drone') continue;
    out.enemies++;
    if (propAt(e.group.position.x, e.group.position.z, e.y, (e.radius || .6) * .8)) out.inside++;
  }
  // 3. Un disparo recto a través del prop más ALTO queda interceptado.
  //    (Antes se elegía el de mayor base: en el Mundo 1 eso es una roca baja
  //    de h≈0.6, por la que un tiro a y=1.2 pasa legítimamente por encima, y
  //    la comprobación de cobertura ni siquiera se ejecutaba.)
  const big = propColliders.filter(c => c.h > 1.8).sort((a, b) => b.h - a.h)[0] || null;
  if (big) {
    const ax = big.cos, az = -big.sin, d = big.hw + 5;
    const from = new THREE.Vector3(big.x - ax * d, 1.2, big.z - az * d);
    const to = new THREE.Vector3(big.x + ax * d, 1.2, big.z + az * d);
    out.rayTests++;
    if (segmentBlocked(from, to)) out.blocked++;
    // y uno por encima no debería cortarse
    const hi = new THREE.Vector3(big.x - ax * d, big.h + 1.5, big.z - az * d);
    const hi2 = new THREE.Vector3(big.x + ax * d, big.h + 1.5, big.z + az * d);
    out.rayTests++;
    if (!segmentBlocked(hi, hi2)) out.blocked++;
  }
  return out;
}
function testDamageNumbers() {
  const n0 = fx.numbers.length;
  for (const e of enemies) { if (!e.dead) { damageEnemy(e, 40, false); damageEnemy(e, 25, true); break; } }
  return { before: n0, after: fx.numbers.length, dom: document.querySelectorAll('#fx-layer .dmg-num').length };
}
function getState() {
  return {
    mode: state.mode, py: +state.py.toFixed(3), vy: +state.vy.toFixed(2), jumps: state.jumps, level: currentLevel.id, wave: state.wave,
    weapon: currentWeapon().key, weaponBlessing: +(state.weaponBlessing || 0).toFixed(3),
    weapons: [currentWeapon().key], abilities: { ...state.abilities }, chips: Math.round(state.chips),
    enemies: enemies.filter(e => !e.dead).length, synergies: getSynergies(),
    shotCount: state.shotCount, meleeCd: +state.meleeCd.toFixed(2), meleeSeq: state.meleeSeq || 0,
    attack: isMeleeHero() ? 'melee' : 'ranged',
    modifier: state.modifier ? state.modifier.id : null, fov: +camera.fov.toFixed(1), photo: !!state.photo
  };
}
// Prueba de equilibrio sin render: simula el crecimiento compuesto de las
// rondas y devuelve la tabla para calibrar dificultades sin abrir el juego.
function testBalance(rounds = 15) {
  const out = [];
  for (let r = 1; r <= rounds; r++) {
    const rs = roundScaling(r);
    const count = Math.min(Math.round(ROUNDS.countBase + (r - 1) * ROUNDS.countPerRound), ROUNDS.countMax);
    out.push({
      round: r, level: rs.level, hpMul: +rs.hp.toFixed(3), dmgMul: +rs.dmg.toFixed(3),
      speedMul: +rs.speed.toFixed(3), count, boss: r % ROUNDS.bossEvery === 0,
      chaserHp: Math.round(110 * rs.hp), bossHp: Math.round(1500 * rs.hp * (1 + (Math.ceil(r / ROUNDS.bossEvery) - 1) * .5))
    });
  }
  return out;
}
function testMelee() {
  const m = meleeInfo();
  state.meleeCd = 0;              // el gancho debe ejecutar el tajo siempre
  meleeAttack();
  return { id: m.key, name: m.name, weapon: currentWeapon().key,
    cd: +state.meleeCd.toFixed(2), seq: state.meleeSeq, unlocked: 1 };
}
function testUtility() {
  state.utilityCd = 0; state.utilityCharges = utilityInfo().charges;
  useUtility();
  return { id: state.utilityId, cd: +state.utilityCd.toFixed(2), pylons: pylons.length, zones: zones.length };
}
function testCat() {
  state.catCd = 0; summonCat();
  const out = { out: state.catOut, life: state.cat ? +state.cat.life.toFixed(1) : 0 };
  updateCat(.016);
  return out;
}
function testObjective() {
  return { id: state.obj ? state.obj.id : null, have: state.obj ? state.obj.have : 0, need: state.obj ? state.obj.need : 0, timer: state.obj ? +state.obj.timer.toFixed(1) : 0 };
}
// Pasarela visual: presenta un ejemplar de cada tipo de hostil sobre un suelo
// neutro, en dos filas. Solo la usan las capturas de desarrollo.
let _scFloor = null, _scSaved = null;
// Congela y oculta los hostiles vivos sin matarlos: así la ronda no se cierra y
// el modo sigue en 'playing' (la cámara y las animaciones siguen corriendo).
function _scFreeze() {
  for (const e of enemies) {
    e.group.visible = false; e.speed = 0; e.cooldown = 99; e.touchCd = 99;
    e.hp = e.maxHp = 1e9; e.armor = 0; e.shield = 0;
  }
  state.pending = 0;
  const pz = document.getElementById('pause'); if (pz) pz.classList.remove('active');
  const up = document.getElementById('upgrade'); if (up) up.classList.remove('active');
  if (state.mode !== 'playing') state.mode = 'playing';
}
export function showcase(faction = 'SYNTEK') {
  _scFreeze();
  if (!_scSaved) _scSaved = { platforms: platforms.slice(), props: propColliders.slice() };
  arenaGroup.visible = false;
  platforms.length = 0; propColliders.length = 0;
  player.position.set(0, 0, 14); state.py = 0; state.yaw = 0; state.pitch = -.05;
  player.visible = false;
  // Cámara de estudio: más cerca para poder revisar la geometría de cerca.
  CAM.dist = 3.0; camDist = 3.0;
  if (!_scFloor) {
    _scFloor = new THREE.Mesh(new THREE.CircleGeometry(30, 56),
      new THREE.MeshStandardMaterial({ color: 0x0b0f14, roughness: .88, metalness: .12 }));
    _scFloor.rotation.x = -Math.PI / 2;
    _scFloor.receiveShadow = true;
    scene.add(_scFloor);
  }
  _scFloor.visible = true; _scFloor.position.set(0, 0, 8);
  const rows = [['chaser', 'tank', 'ranged', 'support'], ['stalker', 'flyer', 'drone']];
  const out = [];
  rows.forEach((row, ri) => {
    const d = 3.2 + ri * 2.6;
    row.forEach((t, i) => {
      const off = (i - (row.length - 1) / 2) * (ri === 0 ? 1.55 : 1.9);
      const px = off, pz = 14 - d;
      const e = createEnemy(t, px, pz, false, faction);
      e.spawn = 0; e.speed = 0; e.cooldown = 99;
      e.group.scale.setScalar(e.targetScale);
      e.group.rotation.y = Math.atan2(-(player.position.x - px), -(player.position.z - pz));
      out.push(t);
    });
  });
  return out;
}
// Vista de estudio del operador: cámara corta y modelo girado para poder ver el
// arma y el detalle del traje desde delante. Solo para capturas.
export function playerCloseup(yawOff = Math.PI * .8, dist = 2.5) {
  _scFreeze();
  if (!_scSaved) _scSaved = { platforms: platforms.slice(), props: propColliders.slice() };
  arenaGroup.visible = false;
  platforms.length = 0; propColliders.length = 0;
  player.position.set(0, 0, 8); state.py = 0; state.yaw = 0; state.pitch = -.06;
  state.modelYaw = yawOff;
  player.visible = true;
  if (!_scFloor) {
    _scFloor = new THREE.Mesh(new THREE.CircleGeometry(30, 56),
      new THREE.MeshStandardMaterial({ color: 0x0b0f14, roughness: .88, metalness: .12 }));
    _scFloor.rotation.x = -Math.PI / 2; _scFloor.receiveShadow = true; scene.add(_scFloor);
  }
  _scFloor.visible = true; _scFloor.position.set(0, 0, 4);
  CAM.dist = dist; camDist = dist;
  return true;
}
export function endShowcase() {
  player.visible = true;
  state.modelYaw = 0;
  CAM.dist = 6.1; camDist = 6.1;
  arenaGroup.visible = true;
  if (_scFloor) _scFloor.visible = false;
  if (_scSaved) { platforms.push(..._scSaved.platforms); propColliders.push(..._scSaved.props); _scSaved = null; }
}

// --- Pasarela de QC de los mundos Kenney (solo automatización --worlds) -----
// Reconstruye la arena sobre el mundo pedido con su paleta y colisiones, y
// devuelve el diagnóstico del gestor. La vista la controla setWorldView().
function previewWorld(worldId) {
  const level = LEVELS.find(l => worldIdForLevel(l.id) === worldId);
  if (!level) return { error: 'mundo sin sector asignado', worldId };
  currentLevel = level;
  selectedLevelId = level.id;
  if (state.mode !== 'playing') state.mode = 'playing';
  applyLevel();
  rebuildArena();
  player.position.set(0, 0, 2);
  state.py = groundAt(0, 2, 60); state.vy = 0;
  setWorldView(34, -.44, 0);
  return worldManager.diagnostics();
}
// Cámara de inspección: distancia y pitch directos (sin suavizado) para poder
// encuadrar la vista general del diorama y después la vista de juego.
// Solo QC: además cierra cualquier overlay (borrador de mejora, pausa, fin de
// mundo) y devuelve el modo a 'playing', para que las capturas vean el
// escenario y no la interfaz.
let waveFlowTimer = 0;   // borrador de mejora / fin de mundo pendiente
function setWorldView(dist = 34, pitch = -.44, yaw = 0) {
  state.pitch = pitch; state.yaw = yaw;
  CAM.dist = dist; camDist = dist; camDistTarget = dist;
  clearTimeout(waveFlowTimer);
  document.getElementById('upgrade')?.classList.remove('active');
  document.getElementById('pause')?.classList.remove('active');
  document.getElementById('worldclear')?.classList.remove('active');
  if (state.mode !== 'playing' && state.mode !== 'menu' && state.mode !== 'hub') state.mode = 'playing';
  return true;
}
function worldDiagnostics() {
  return {
    ...worldManager.diagnostics(),
    level: currentLevel.id,
    toneMapping: renderer.toneMapping === THREE.ACESFilmicToneMapping ? 'ACESFilmic' : 'other',
    exposure: +renderer.toneMappingExposure.toFixed(3),
    bloom: +bloom.strength.toFixed(3), bloomThreshold: +bloom.threshold.toFixed(3),
    hemi: +hemiLight.intensity.toFixed(2), sun: +moon.intensity.toFixed(2),
    ambient: +ambientLight.intensity.toFixed(2),
    shadowMap: renderer.shadowMap.type === THREE.PCFSoftShadowMap ? 'PCFSoft' : 'other',
    fps: perf.fps, avgMs: +perf.avg.toFixed(2),
    drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles
  };
}

export {
  showUpgradeDraft, spawnWave, testDropLoot, testOpenLoot, testDropCompanion, testSpawn, testGrantWeapon, testAbility,
  testAddChips, testClearEnemies, testGod, getMap, getLootLevels, getState, getSynergies, openHub, renderHubTree,
  testForceModifier, testDamageNumbers, testProps, testBalance, testMelee, testUtility, testCat, testObjective,
  testInstall, testElite, testEvolve, testDirector, getBuild, getPerf,
  testTurret, testMeteor, testGhost, testSpiral,   testEvolveAbility, testGrantRelic, testRelicHook,
  testCombat, testFire, testProjectileHit,
  previewWorld, setWorldView, worldDiagnostics
};
