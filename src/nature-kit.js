// NEON//REVENANT — Kenney Nature Kit: cargador de GLB + plantillas instanciadas.
// ---------------------------------------------------------------------------
// El renderer de Electron está aislado (contextIsolation + sandbox) y se sirve
// desde file://, así que fetch()/XHR de un .glb queda bloqueado por CORS/CSP.
// main.cjs lee los binarios y preload.cjs los entrega por IPC; aquí se parsean
// una sola vez con GLTFLoader.parseAsync() y se convierten en plantillas.
//
// Cada modelo Kenney trae 1-5 primitivas (hojas / corteza / tierra...). Para no
// pagar un draw call por primitiva, las fusionamos en UNA geometría con grupos
// y un array de materiales: así cada modelo es un único InstancedMesh, aunque
// conserve todos sus colores originales del kit.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Catálogo copiado desde Models/GLTF format/ de kenney_nature-kit.zip.
// Es la lista de verdad: initNatureKit() itera lo que el IPC devuelve, este
// array solo documenta y sirve de diagnóstico si falta algún fichero.
export const NATURE_ASSETS = [
  'tree_oak.glb', 'tree_default.glb', 'tree_detailed.glb', 'tree_fat.glb',
  'tree_tall.glb', 'tree_small.glb', 'tree_plateau.glb',
  'tree_pineDefaultA.glb', 'tree_pineDefaultB.glb', 'tree_pineTallA.glb',
  'tree_pineTallC.glb', 'tree_pineRoundA.glb', 'tree_pineSmallA.glb',
  'rock_largeA.glb', 'rock_largeB.glb', 'rock_largeC.glb', 'rock_tallA.glb',
  'stone_largeA.glb',
  'rock_smallA.glb', 'rock_smallB.glb', 'rock_smallC.glb',
  'rock_smallFlatA.glb', 'stone_smallA.glb',
  'plant_bush.glb', 'plant_bushDetailed.glb', 'plant_bushLarge.glb',
  'plant_bushSmall.glb',
  'mushroom_red.glb', 'mushroom_redGroup.glb', 'mushroom_redTall.glb',
  'mushroom_tan.glb', 'mushroom_tanGroup.glb',
  'log.glb', 'log_large.glb', 'log_stack.glb', 'stump_round.glb', 'stump_old.glb',
  'flower_redA.glb', 'flower_redB.glb', 'flower_yellowA.glb',
  'flower_yellowB.glb', 'flower_purpleA.glb', 'flower_purpleB.glb',
  'grass.glb', 'grass_large.glb', 'grass_leafs.glb', 'grass_leafsLarge.glb',
  'fence_simple.glb', 'fence_planks.glb', 'fence_planksDouble.glb',
  'fence_simpleHigh.glb', 'fence_gate.glb', 'fence_corner.glb',
  'ground_grass.glb', 'cliff_block_rock.glb', 'cliff_large_rock.glb'
];

// ---------------------------------------------------------------------------
// Paleta de fantasía. Kenney Nature Kit viene con verdes TURQUESA (grass =
// #2cd8b8, leafsGreen = #29c9ab, stone = #b8e2e8) pensados para su propio
// estilo low-poly frío. Bajo el sol cálido del mundo 1 eso se leía como un
// bosque alienígena/cyberpunk, que es justo lo contrario de la temática que
// estamos buscando. Los GLB no tienen texturas ni COLOR_0: el baseColorFactor
// es la ÚNICA fuente de color, así que reasignar material.color por nombre es
// una corrección completa y sin pérdida de detalle.
//
// Los valores son HEX sRGB (lo que se quiere ver en pantalla); THREE.Color
// los convierte al espacio lineal de trabajo automáticamente.
// ---------------------------------------------------------------------------
export const NATURE_PALETTE = {
  // Verde de prado: algo más claro que el suelo #4d8c3a para que las briznas,
  // el musgo de las rocas y las hojas de las flores destaquen sin brillar.
  grass: 0x62a844,
  // Hojas de frondosas y pinos: dos verdes separados dan profundidad al bosque.
  leafsGreen: 0x4f9b3c,
  leafsDark: 0x2c6b3c,
  // Piedra cálida en vez de hielo azulado.
  stone: 0x9c9a86,
  // Blanco puro del kit revienta con sunInt=3.6; crema cálido para setas y
  // partes claras de rocas / tree_detailed.
  _defaultMat: 0xf1e7cf,
  // Maderas: de salmón anaranjado a marrones de cuento.
  wood: 0xc08a52,
  woodDark: 0x78502f,
  woodBark: 0x8a6039,
  woodBarkDark: 0x614329,
  woodInner: 0xdcc6a0,
  // Tierra/roca: gris cálido musgoso. El naranja original hacía que rocas y
  // cantiles se leyeran como tablones de madera a distancia.
  dirt: 0x8b8262,
  // Pétalos y sombreros: más saturados y menos pastel.
  colorRed: 0xdd4438,
  colorYellow: 0xf1c33c,
  colorPurple: 0x9a63cf,
  colorTan: 0xd9a066
};

const TEMPLATES = new Map();
let boot = null;
let ready = false;

export const natureReady = () => ready;
export const natureTemplate = (name) => TEMPLATES.get(name) || null;
export const natureDiag = () => ({
  ready, models: TEMPLATES.size, expected: NATURE_ASSETS.length,
  missing: NATURE_ASSETS.filter(n => !TEMPLATES.has(n.replace(/\.glb$/i, '')))
});

// Los GLB de Kenney declaran metallicFactor = 1 con roughness = 1, que en un
// PBR con luz direccional fuerte se lee como plástico gris apagado. Se
// normaliza a superficie mate y se sustituye el baseColorFactor turquesa por
// la paleta de fantasía (ver NATURE_PALETTE).
function cleanMaterial(src) {
  const m = src.clone();
  m.metalness = 0;
  m.roughness = 0.92;
  m.side = THREE.DoubleSide;       // muchas hojas son planes de una sola cara
  m.flatShading = true;            // facetas marcadas: estilo pixel-art 3D
  m.envMapIntensity = 0.55;
  const tint = NATURE_PALETTE[src.name];
  if (tint != null) m.color.setHex(tint);
  if (m.map) {
    m.map.magFilter = THREE.NearestFilter;
    m.map.minFilter = THREE.LinearMipmapLinearFilter;
    m.map.needsUpdate = true;
  }
  m.needsUpdate = true;
  return m;
}

// Pasa todas las mallas al espacio de la escena, centra la base en (0,0,0) y
// fusiona las primitivas en una sola geometría con grupos por material.
function makeTemplate(root) {
  root.updateMatrixWorld(true);
  const parts = [];
  const box = new THREE.Box3();

  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    // Todas a non-indexed: mergeGeometries exige el mismo tipo de índice y la
    // misma lista de atributos en todas las partes.
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const key of Object.keys(g.attributes)) {
      if (key !== 'position' && key !== 'normal') g.deleteAttribute(key);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    g.clearGroups();
    g.computeBoundingBox();
    box.union(g.boundingBox);
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    parts.push({ geometry: g, material: cleanMaterial(src || new THREE.MeshStandardMaterial()) });
  });

  if (!parts.length) return null;
  const off = new THREE.Vector3(
    -(box.min.x + box.max.x) * 0.5, -box.min.y, -(box.min.z + box.max.z) * 0.5
  );
  for (const p of parts) p.geometry.translate(off.x, off.y, off.z);

  let geometry;
  try {
    geometry = mergeGeometries(parts.map(p => p.geometry), true);
  } finally {
    for (const p of parts) p.geometry.dispose();
  }
  if (!geometry) return null;
  geometry.computeBoundingSphere();

  return {
    geometry,
    materials: parts.map(p => p.material),
    size: {
      x: box.max.x - box.min.x,
      y: box.max.y - box.min.y,
      z: box.max.z - box.min.z
    }
  };
}

export function initNatureKit() {
  if (boot) return boot;
  boot = (async () => {
    if (!window.desktop?.loadNatureGLBs) throw new Error('puente IPC de naturaleza no disponible');
    const payload = await window.desktop.loadNatureGLBs();
    const loader = new GLTFLoader();
    for (const [file, bytes] of Object.entries(payload || {})) {
      const ab = bytes instanceof Uint8Array
        ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        : bytes;
      const gltf = await loader.parseAsync(ab, '');
      const tpl = makeTemplate(gltf.scene);
      if (tpl) TEMPLATES.set(file.replace(/\.glb$/i, ''), tpl);
    }
    ready = TEMPLATES.size > 0;
    const diag = natureDiag();
    window.__NR_NATURE_DIAG = diag;
    console.log('NATURE_KIT_LOADED: ' + JSON.stringify(diag));
    return diag;
  })().catch((e) => {
    const err = String(e?.message || e);
    window.__NR_NATURE_DIAG = { ready: false, models: 0, error: err };
    console.warn('NATURE_KIT_FAIL: ' + err);
    return null;
  });
  return boot;
}

// Crea un InstancedMesh por modelo. Geometría y materiales se CLONAN por
// escenario: rebuildArena() llama a disposeObject3D() sobre todo el grupo, así
// que compartir las plantillas originales entre recargas las destruiría.
const _axis = new THREE.Vector3(0, 1, 0);
export function natureInstances(name, transforms, opts = {}) {
  const tpl = TEMPLATES.get(name);
  if (!tpl || !transforms || !transforms.length) return null;
  const geometry = tpl.geometry.clone();
  const materials = tpl.materials.map(m => m.clone());
  const mesh = new THREE.InstancedMesh(
    geometry, materials.length === 1 ? materials[0] : materials, transforms.length
  );
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  for (let i = 0; i < transforms.length; i++) {
    const t = transforms[i];
    q.setFromAxisAngle(_axis, t.yaw || 0);
    p.set(t.x, t.y || 0, t.z);
    s.setScalar(t.scale ?? 1);
    if (t.sy != null) s.set(t.sx ?? s.x, t.sy, t.sz ?? s.z);
    mtx.compose(p, q, s);
    mesh.setMatrixAt(i, mtx);
  }
  mesh.instanceMatrix.needsUpdate = true;

  // Variación de color por instancia. Sin esto, 346 árboles con el mismo
  // material son una pared plana de verde; con un ±10 % de luminosidad y un
  // ligero vaivén cálido/frío el bosque gana volumen SIN un draw call extra
  // (instanceColor se multiplica dentro del mismo shader).
  const vary = opts.vary ?? 0.10;
  if (vary > 0) {
    const c = new THREE.Color();
    for (let i = 0; i < transforms.length; i++) {
      const n = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
      const h = n - Math.floor(n);
      const k = 1 + (h - 0.5) * 2 * vary;
      const warm = (h - 0.5) * vary * 0.55;
      c.setRGB(k * (1 + warm), k, k * (1 - warm * 0.8));
      mesh.setColorAt(i, c);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  mesh.castShadow = !!opts.shadow;
  mesh.receiveShadow = opts.shadow !== false;
  mesh.name = 'NATURE_' + name;
  mesh.computeBoundingSphere();
  return mesh;
}

// Libera las plantillas al cerrar la ventana (Electron mantiene el renderer).
export function disposeNatureKit() {
  for (const tpl of TEMPLATES.values()) {
    tpl.geometry.dispose();
    for (const m of tpl.materials) m.dispose();
  }
  TEMPLATES.clear();
  ready = false;
  boot = null;
}
