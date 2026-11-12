// NEON//REVENANT — Gestor modular de los 7 mundos Kenney.
// ---------------------------------------------------------------------------
// Responsabilidades:
//  · Carga perezosa por mundo: solo se piden por IPC los GLB que el builder
//    declara en MODELS (no los 809 del proyecto). Cada mundo tiene su propia
//    cache de plantillas.
//  · Acabado mate obligatorio: todo MeshStandardMaterial importado se normaliza
//    a roughness .90 / metalness .04 / envMapIntensity .35 y, en biomas de
//    nieve, se limita el blanco para que nunca se queme con ACES.
//  · dispose() completo al cambiar de mundo: geometrias, materiales y texturas
//    del grafo activo Y de la cache de plantillas del mundo anterior.
//  · Un unico InstancedMesh por modelo: cientos de arboles/tejas/bloques en un
//    punado de draw calls, condicion para sostener 60 FPS con hordas.
//  · Colisiones: el builder publica plataformas (para groundAt) y huellas
//    solidas (propColliders). Las rampas se discretizan en escalones de .32 u.
//    para que jugador y enemigos suban sin atascarse.
//
// El renderer de Electron esta aislado: los binarios llegan por IPC desde
// main.cjs y se parsean con GLTFLoader.parseAsync().
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { UNIT, ARENA, WORLD_DEFS, WORLD_IDS, artForLevel, COMFORT } from './worlds/registry.js';
import { MODELS as W1_MODELS, buildWorld1 } from './worlds/world1-nature.js';
import { MODELS as W2_MODELS, buildWorld2 } from './worlds/world2-snow.js';
import { MODELS as W3_MODELS, buildWorld3 } from './worlds/world3-shop.js';
import { MODELS as W4_MODELS, buildWorld4 } from './worlds/world4-suburban.js';
import { MODELS as W5_MODELS, buildWorld5 } from './worlds/world5-station.js';
import { MODELS as W6_MODELS, buildWorld6 } from './worlds/world6-space.js';
import { MODELS as W7_MODELS, buildWorld7 } from './worlds/world7-hexagon.js';

export { UNIT, ARENA, WORLD_DEFS, WORLD_IDS, artForLevel, COMFORT };

const BUILDERS = {
  world1_nature: { models: W1_MODELS, build: buildWorld1 },
  world2_snow: { models: W2_MODELS, build: buildWorld2 },
  world3_shop: { models: W3_MODELS, build: buildWorld3 },
  world4_suburban: { models: W4_MODELS, build: buildWorld4 },
  world5_station: { models: W5_MODELS, build: buildWorld5 },
  world6_space: { models: W6_MODELS, build: buildWorld6 },
  world7_hexagon: { models: W7_MODELS, build: buildWorld7 }
};

// Paletas por nombre de material de los kits Kenney. Los GLB traen
// metallicFactor=1 y verde turquesa; aqui se corrige a una paleta mate y
// coherente con las referencias oficiales (terracota, turquesa, crema).
const PALETTE = {
  grass: 0x3fbfae, grassDark: 0x2fa294, leafsGreen: 0x39b39c,
  leafsDark: 0x27836f, leafsLight: 0x5fd0ae,
  dirt: 0xd8885c, dirtDark: 0xc07048, stone: 0xd9d6c8, stoneDark: 0xb9b6a8,
  snow: 0xe7ecee, snowDark: 0xd3dce2, ice: 0xbcd8e4,
  wood: 0xc08a52, woodDark: 0x8a6039, woodBark: 0x9a7048,
  woodBarkDark: 0x74502f, woodInner: 0xddc49c,
  colorRed: 0xd9554a, colorYellow: 0xefc552, colorPurple: 0x9a72c8,
  colorRedDark: 0xa8443c, colorWhite: 0xe9e6dd, corn: 0xe8c85a,
  colorTan: 0xd9a066, colorBlue: 0x6fa8c8, colorOrange: 0xe89a4a,
  leafsFall: 0xd99a4a, woodBirch: 0xd9c9a8,
  water: 0x63cdd6, metal: 0xa8b2b4, metalDark: 0x7d8a8e,
  _defaultMat: 0xe6e0cf
};

const SNOW_CAP = 0xe9eef0;   // techo de luminancia para la nieve
const _axisY = new THREE.Vector3(0, 1, 0);

// Uint8Array -> data URL sin reventar la pila (String.fromCharCode tiene un
// límite de argumentos por llamada). Se usa data: y no blob: porque las
// texturas cargan ASÍNCRONAMENTE después de que parseAsync() resuelva: con
// blob: + revoke inmediato la carga de la imagen se perdía y el material
// quedaba negro. data: no se puede revocar y el CSP ya permite img-src data:.
function bytesToDataUrl(bytes, mime) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return `data:${mime};base64,` + btoa(s);
}

// ---------------------------------------------------------------------------
// Acabado mate. Exportada para que weapons.js / glb-character.js puedan aplicar
// el mismo criterio a los GLB de armas y personajes.
// ---------------------------------------------------------------------------
export function applyMatteFinish(root, opts = {}) {
  const snow = !!opts.snow;
  const roughness = opts.roughness ?? 0.90;
  const metalness = opts.metalness ?? 0.04;
  const seen = new Set();
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = opts.shadow !== false;
    o.receiveShadow = true;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) {
      if (!m || seen.has(m) || !m.isMeshStandardMaterial) continue;
      seen.add(m);
      m.roughness = Math.max(m.roughness ?? 0, roughness);
      m.metalness = Math.min(m.metalness ?? 1, metalness);
      m.envMapIntensity = Math.min(m.envMapIntensity ?? 1, 0.35);
      if (m.specularIntensity != null) m.specularIntensity = 0.08;
      if (m.specularColor) m.specularColor.setRGB(0.08, 0.08, 0.08);
      // Los emisivos de neón se mantienen, pero sin reventar el canal.
      if (m.emissiveIntensity != null) m.emissiveIntensity = Math.min(m.emissiveIntensity, 0.9);
      if (snow && m.color) {
        const c = m.color;
        const lum = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
        if (lum > 0.80) c.setHex(SNOW_CAP);
      }
      m.needsUpdate = true;
    }
  });
  return root;
}

function tintedMaterial(src, snow) {
  const m = src.clone();
  m.metalness = 0.04;
  m.roughness = 0.90;
  m.envMapIntensity = 0.35;
  m.flatShading = true;
  m.side = THREE.DoubleSide;
  const tint = PALETTE[src.name];
  if (tint != null) m.color.setHex(tint);
  if (snow && m.color) {
    const c = m.color;
    if (c.r * .2126 + c.g * .7152 + c.b * .0722 > .80) m.color.setHex(SNOW_CAP);
  }
  if (m.specularIntensity != null) m.specularIntensity = 0.08;
  if (m.emissiveIntensity != null) m.emissiveIntensity = Math.min(m.emissiveIntensity, 0.9);
  m.needsUpdate = true;
  return m;
}

// Convierte un GLB en UNA geometria con grupos por material, centrada en la
// base. Asi cada modelo genera un solo InstancedMesh con todos sus colores.
function makeTemplate(root, snow) {
  root.updateMatrixWorld(true);
  const parts = [];
  const box = new THREE.Box3();
  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    // Se conservan las UV: los kits de Platformer/Space pintan TODOS los
    // colores con la textura compartida Textures/colormap.png mediante islas
    // UV; sin uv la muestra cae siempre al mismo texel y sale monocromo.
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    g.clearGroups();
    g.computeBoundingBox();
    box.union(g.boundingBox);
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    parts.push({ geometry: g, material: tintedMaterial(src || new THREE.MeshStandardMaterial(), snow) });
  });
  if (!parts.length) return null;
  const off = new THREE.Vector3(
    -(box.min.x + box.max.x) * .5, -box.min.y, -(box.min.z + box.max.z) * .5
  );
  for (const p of parts) p.geometry.translate(off.x, off.y, off.z);
  let geometry;
  try { geometry = mergeGeometries(parts.map(p => p.geometry), true); } finally { }
  // mergeGeometries exige los MISMOS atributos en todas las partes: si un
  // modelo mezcla piezas con uv y piezas sin uv, se reintenta sin uv.
  if (!geometry && parts.some(p => p.geometry.attributes.uv)) {
    for (const p of parts) p.geometry.deleteAttribute('uv');
    try { geometry = mergeGeometries(parts.map(p => p.geometry), true); } catch { geometry = null; }
  }
  for (const p of parts) p.geometry.dispose();
  if (!geometry) return null;
  geometry.computeBoundingSphere();
  return {
    geometry, materials: parts.map(p => p.material), snow,
    size: { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z }
  };
}

function disposeMaterial(m) {
  for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap']) {
    if (m[key]?.dispose) m[key].dispose();
  }
  m.dispose();
}

// ---------------------------------------------------------------------------
// Contexto de construccion: los builders solo describen QUE piezas van y DONDE;
// el gestor decide como instanciarlas y como liberarlas.
// ---------------------------------------------------------------------------
class BuildContext {
  constructor(wm, root, platforms, props, rnd) {
    this.wm = wm; this.root = root; this.platforms = platforms;
    this.props = props; this.rnd = rnd || Math.random;
    this.batches = new Map();
    this.stats = { instances: 0, meshes: 0, drawCalls: 0, platforms: 0, solids: 0 };
    this.pending = [];
  }
  // una pieza (o un array de piezas) del mismo modelo
  batch(model, transforms) {
    if (!this.wm.hasTemplate(model)) { this.stats.missing = (this.stats.missing || 0) + transforms.length; return; }
    if (!this.batches.has(model)) this.batches.set(model, []);
    const dst = this.batches.get(model);
    for (const t of transforms) dst.push(t);
    this.stats.instances += transforms.length;
  }
  one(model, x, y, z, opts = {}) { this.batch(model, [{ x, y, z, ...opts }]); }
  // Tamano REAL del modelo (caja delimitadora del GLB sin escalar). Los
  // builders lo usan para alinear/stackear piezas (Box3), p.ej. apoyar el
  // rio del Mundo 1 sobre la hierba o apilar el cohete del Mundo 6.
  sizeOf(name) { return this.wm.sizeOf(name); }
  // malla simple (suelo, agua, pared de limite) con material mate
  mesh(geometry, material, x, y, z, opts = {}) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    if (opts.rotX != null) m.rotation.x = opts.rotX;
    if (opts.rotY != null) m.rotation.y = opts.rotY;
    m.castShadow = !!opts.shadow;
    m.receiveShadow = opts.receive !== false;
    m.name = opts.name || 'WORLD_surface';
    this.root.add(m);
    this.stats.meshes++;
    return m;
  }
  // ---------------------------------------------------------------- fondos --
  // Nubes mate del bioma: puffs achatados fusionados en un unico InstancedMesh,
  // sin sombras ni colision. Cada nube son 3 puffs solapados con deriva fija.
  clouds(opts = {}) {
    const { count = 10, y = 32, rMin = 62, rMax = 98, ySpread = 10, scale = 6.5,
      color = 0xf6f8fa, speed = .18 } = opts;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: .97, metalness: 0, flatShading: true });
    const im = new THREE.InstancedMesh(geo, mat, count * 3);
    im.castShadow = false; im.receiveShadow = false;
    im.name = 'WORLD_clouds';
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
      v = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + this.rnd() * .5;
      const r = rMin + this.rnd() * (rMax - rMin);
      const cy = y + (this.rnd() - .5) * 2 * ySpread;
      const sc = scale * (.7 + this.rnd() * .7);
      for (let k = 0; k < 3; k++) {
        const off = [[0, 0, 0], [sc * .55, -sc * .12, sc * .18], [-sc * .5, -sc * .1, -sc * .1]][k];
        e.set(0, this.rnd() * Math.PI, 0); q.setFromEuler(e);
        v.set(Math.cos(a) * r + off[0], cy + off[1], Math.sin(a) * r + off[2]);
        const puff = sc * (k === 0 ? 1 : .62);
        s.set(puff, puff * .5, puff * .8);
        m4.compose(v, q, s);
        im.setMatrixAt(i * 3 + k, m4);
      }
    }
    im.userData.drift = speed;
    this.root.add(im);
    this.stats.meshes++;
    return im;
  }
  // Esfera mate lejana (planetas, lunas). Sin sombras ni colision; los mundos
  // oscuros le suben emissive para que no se pierda contra el cielo.
  sphere(x, y, z, r, color, opts = {}) {
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: .92, metalness: 0, flatShading: false,
      emissive: opts.emissive ?? color, emissiveIntensity: opts.emissiveIntensity ?? 0
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), mat);
    m.position.set(x, y, z);
    if (opts.rotZ != null) m.rotation.z = opts.rotZ;
    m.castShadow = false; m.receiveShadow = false;
    m.name = opts.name || 'WORLD_celestial';
    this.root.add(m);
    this.stats.meshes++;
    return m;
  }
  // superficie transitable para groundAt()
  platform(x, z, hw, hd, top) {
    this.platforms.push({ x, z, hw, hd, top });
    this.stats.platforms++;
  }
  // huella solida orientada (cobertura y bloqueo de proyectiles)
  solid(x, z, hw, hd, h, yaw = 0) {
    this.props.push({
      x, z, hw, hd, h, r: Math.hypot(hw, hd),
      cos: Math.cos(yaw), sin: Math.sin(yaw)
    });
    this.stats.solids++;
  }
  // rampa = escalones transitables (groundAt usa step .65)
  ramp(x, z, hw, hd, from, to, steps = 6, axis = 'z') {
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps;
      const top = from + (to - from) * t;
      const px = axis === 'x' ? x - hw + (2 * hw) * (i + .5) / steps : x;
      const pz = axis === 'z' ? z - hd + (2 * hd) * (i + .5) / steps : z;
      this.platform(px, pz, axis === 'x' ? hw / steps : hw, axis === 'z' ? hd / steps : hd, top);
    }
  }
  flush() {
    const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), mtx = new THREE.Matrix4();
    for (const [model, transforms] of this.batches) {
      const tpl = this.wm.template(model);
      if (!tpl || !transforms.length) continue;
      // Clon por escenario: rebuildArena() dispone el grafo, las plantillas
      // originales deben sobrevivir solo dentro de su cache de mundo.
      const geometry = tpl.geometry.clone();
      const materials = tpl.materials.map(m => m.clone());
      const im = new THREE.InstancedMesh(geometry, materials.length === 1 ? materials[0] : materials, transforms.length);
      for (let i = 0; i < transforms.length; i++) {
        const t = transforms[i];
        q.setFromAxisAngle(_axisY, t.yaw || 0);
        p.set(t.x, t.y || 0, t.z);
        s.setScalar(t.scale ?? 1);
        if (t.sy != null) s.set(t.sx ?? s.x, t.sy, t.sz ?? s.z);
        mtx.compose(p, q, s);
        im.setMatrixAt(i, mtx);
      }
      im.instanceMatrix.needsUpdate = true;
      // Variacion de tono por instancia: rompe la pared plana sin draw calls.
      const c = new THREE.Color();
      for (let i = 0; i < transforms.length; i++) {
        const n = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
        const k = .94 + (n - Math.floor(n)) * .12;
        c.setRGB(k, k, k);
        im.setColorAt(i, c);
      }
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = true;
      im.receiveShadow = true;
      im.name = 'WORLD_' + model;
      im.computeBoundingSphere();
      this.root.add(im);
      this.stats.drawCalls++;
    }
    this.batches.clear();
    return this.stats;
  }
}

// ---------------------------------------------------------------------------
export class WorldManager {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.opts = opts;
    this.cache = new Map();       // worldId -> Map<modelName, template>
    this.loading = new Map();     // worldId -> Promise
    this.activeId = null;
    this.root = null;
    this.parent = null;
    this.token = 0;
    this.stats = { instances: 0, drawCalls: 0, disposed: 0, loads: 0 };
    this.errors = [];
  }

  hasTemplate(name) { return this.cache.get(this.activeId)?.has(name) || false; }
  template(name) { return this.cache.get(this.activeId)?.get(name) || null; }
  sizeOf(name) { return this.template(name)?.size || { x: 1, y: 1, z: 1 }; }
  artFor(levelId, legacy) { return artForLevel(levelId, legacy); }
  isImplemented(id) { return !!WORLD_DEFS[id]?.implemented; }

  // Carga solo los modelos declarados por el builder de este mundo.
  async ensureAssets(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    if (this.loading.has(id)) return this.loading.get(id);
    const def = WORLD_DEFS[id];
    const spec = BUILDERS[id];
    if (!def || !spec) return null;
    const job = (async () => {
      if (!window.desktop?.loadWorldGLBs) throw new Error('puente IPC de mundos no disponible');
      const payload = await window.desktop.loadWorldGLBs(id, spec.models);
      // Textura compartida del kit (Textures/colormap.png): el renderer aislado
      // no puede hacer fetch de file://, así que llega por IPC y se sirve como
      // data: URL mediante un URLModifier del LoadingManager del GLTFLoader.
      // data: y no blob: porque las texturas cargan ASÍNCRONAMENTE después de
      // que parseAsync() resuelva: con blob: + revoke inmediato la carga se
      // perdía y los materiales quedaban negros. data: no se puede revocar.
      const texMap = payload?.__textures__ || null;
      const manager = new THREE.LoadingManager();
      if (texMap) {
        const urls = new Map();
        for (const [p, bytes] of Object.entries(texMap)) {
          const mime = /\.jpe?g$/i.test(p) ? 'image/jpeg' : 'image/png';
          const du = bytesToDataUrl(bytes, mime);
          urls.set(p, du);
          urls.set(decodeURIComponent(p), du);
        }
        manager.setURLModifier(url => urls.get(url) || url);
      }
      const loader = new GLTFLoader(manager);
      const templates = new Map();
      const snow = id === 'world2_snow';
      for (const [file, bytes] of Object.entries(payload || {})) {
        if (file === '__textures__') continue;
        const ab = bytes instanceof Uint8Array
          ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
          : bytes;
        try {
          const gltf = await loader.parseAsync(ab, '');
          const tpl = makeTemplate(gltf.scene, snow);
          if (tpl) templates.set(file.replace(/\.glb$/i, ''), tpl);
        } catch (e) {
          this.errors.push(`${id}/${file}: ${e?.message || e}`);
        }
      }
      this.cache.set(id, templates);
      this.stats.loads++;
      return templates;
    })().catch(e => {
      this.errors.push(`${id}: ${e?.message || e}`);
      this.loading.delete(id);
      return null;
    });
    this.loading.set(id, job);
    const out = await job;
    this.loading.delete(id);
    return out;
  }

  // Libera TODO lo del mundo anterior: grafo + cache de plantillas.
  dispose() {
    let n = 0;
    if (this.root) {
      this.root.traverse(o => {
        if (o.geometry?.dispose) { o.geometry.dispose(); n++; }
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) { disposeMaterial(m); n++; }
        }
      });
      if (this.root.parent) this.root.parent.remove(this.root);
      this.root = null;
    }
    const prev = this.cache.get(this.activeId);
    if (prev) {
      for (const tpl of prev.values()) {
        tpl.geometry.dispose(); n++;
        for (const m of tpl.materials) { disposeMaterial(m); n++; }
      }
      this.cache.delete(this.activeId);
    }
    this.stats.disposed += n;
    return n;
  }

  // Punto de entrada usado por buildArena(). Devuelve false si el mundo aun no
  // esta construido (el llamador usa el fallback voxel temporal).
  requestWorld(id, parent, platforms, props, rnd) {
    const def = WORLD_DEFS[id];
    const spec = BUILDERS[id];
    if (!def?.implemented || !spec) {
      this.dispose();
      this.activeId = null;
      window.__NR_WORLD_READY = false;
      return false;
    }
    const my = ++this.token;
    this.dispose();
    this.activeId = id;
    this.parent = parent;
    this.root = new THREE.Group();
    this.root.name = 'WORLDMANAGER_' + id;
    parent.add(this.root);

    // Suelo de seguridad inmediato: el juego nunca se queda sin colision
    // mientras llegan los GLB por IPC.
    const ctx = new BuildContext(this, this.root, platforms, props, rnd);
    ctx.platform(0, 0, ARENA, ARENA, 0);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
      new THREE.MeshStandardMaterial({ color: def.art.floor, roughness: .94, metalness: .02 })
    );
    floor.rotation.x = -Math.PI / 2; floor.position.y = .01;
    floor.receiveShadow = true; floor.name = 'WORLD_placeholder_floor';
    this.root.add(floor);
    window.__NR_WORLD_READY = false;

    this.ensureAssets(id).then(() => {
      if (my !== this.token) return;          // cambio de mundo durante la carga
      if (!this.root || this.activeId !== id) return;
      // Quita el placeholder y construye el diorama real.
      for (const child of [...this.root.children]) {
        this.root.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) disposeMaterial(child.material);
      }
      platforms.length = 0; props.length = 0;
      const build = new BuildContext(this, this.root, platforms, props, rnd);
      try {
        spec.build(build);
        build.flush();
        this.stats.instances = build.stats.instances;
        this.stats.drawCalls = build.stats.drawCalls;
        this.stats.platforms = build.stats.platforms;
        this.stats.solids = build.stats.solids;
        this.stats.missing = build.stats.missing || 0;
        window.__NR_WORLD_READY = true;
        window.__NR_WORLD_DIAG = this.diagnostics();
        // Las sombras son autoUpdate=false: hay que forzar un refresco.
        if (this.opts.moon?.shadow) this.opts.moon.shadow.needsUpdate = true;
        if (this.opts.onReady) this.opts.onReady(this.diagnostics());
        console.log('WORLD_MANAGER_READY: ' + JSON.stringify(this.diagnostics()));
      } catch (e) {
        this.errors.push(`${id}/build: ${e?.message || e}`);
        console.warn('WORLD_MANAGER_BUILD_FAIL: ' + (e?.message || e));
        ctx.platform(0, 0, ARENA, ARENA, 0);
      }
    });
    return true;
  }

  diagnostics() {
    const templates = this.cache.get(this.activeId);
    return {
      active: this.activeId,
      ready: !!window.__NR_WORLD_READY,
      kit: WORLD_DEFS[this.activeId]?.kit || null,
      templates: templates?.size || 0,
      instances: this.stats.instances,
      drawCalls: this.stats.drawCalls,
      platforms: this.stats.platforms || 0,
      solids: this.stats.solids || 0,
      missing: this.stats.missing || 0,
      disposed: this.stats.disposed,
      loads: this.stats.loads,
      cachedWorlds: [...this.cache.keys()],
      errors: this.errors.slice(0, 8)
    };
  }
}

export default WorldManager;
