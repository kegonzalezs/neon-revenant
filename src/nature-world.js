// NEON//REVENANT — Mundo 1 «PRADERAS FELICES» / Bosque encantado.
// ---------------------------------------------------------------------------
// Sustituye por completo el diorama de bloques del mundo 1 por modelos reales
// del Kenney Nature Kit. Toda la vegetación repetitiva va en InstancedMesh:
// ~3.000 elementos en unas pocas decenas de draw calls, que es lo que permite
// mantener el framerate con cientos de enemigos en pantalla.
//
// Reglas de diseño (roguelike de hordas):
//  · Suelo continuo y plano: nada de saltos ni mesetas que corten el kiting.
//  · Detalle (hierba, flores, piedras, setas, arbustos) SIN colisión: rompe la
//    monotonía visual sin estorbar el movimiento ni la IA de los enemigos.
//  · Cobertura táctica (árboles, rocas grandes, troncos, tocones) CON caja de
//    colisión orientada, agrupada en islas con pasillos entre ellas.
//  · Borde natural: valla de madera + tres anillos de bosque denso + roquedos.
//    Sin colisiones ahí: el juego ya limita al jugador a ±(ARENA-1).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { ARENA } from './voxel.js';
import { natureTemplate, natureInstances } from './nature-kit.js';

const GRASS_MODELS = ['grass', 'grass_large', 'grass_leafs', 'grass_leafsLarge'];
const FLOWER_MODELS = ['flower_redA', 'flower_redB', 'flower_yellowA', 'flower_yellowB', 'flower_purpleA', 'flower_purpleB'];
const STONE_MODELS = ['rock_smallA', 'rock_smallB', 'rock_smallC', 'rock_smallFlatA', 'stone_smallA'];
const BUSH_MODELS = ['plant_bush', 'plant_bushDetailed', 'plant_bushLarge', 'plant_bushSmall'];
const MUSH_MODELS = ['mushroom_red', 'mushroom_redGroup', 'mushroom_redTall', 'mushroom_tan', 'mushroom_tanGroup'];
const TREE_MODELS = ['tree_oak', 'tree_default', 'tree_detailed', 'tree_fat', 'tree_tall', 'tree_plateau'];
const PINE_MODELS = ['tree_pineDefaultA', 'tree_pineDefaultB', 'tree_pineTallA', 'tree_pineTallC', 'tree_pineRoundA', 'tree_pineSmallA'];
const ROCK_MODELS = ['rock_largeA', 'rock_largeB', 'rock_largeC', 'rock_tallA', 'stone_largeA'];
const LOG_MODELS = ['log', 'log_large', 'log_stack'];
const STUMP_MODELS = ['stump_round', 'stump_old'];
const FENCE_MODELS = ['fence_simple', 'fence_planks', 'fence_planksDouble', 'fence_simpleHigh'];
const CLIFF_MODELS = ['cliff_block_rock', 'cliff_large_rock'];

// Textura de hierba estilizada: dither de 2 px sobre un verde de prado
// ligeramente más apagado que el follaje (#4a7e39 ≈ el #4d8c3a pedido). Es un tile de
// canvas con filtro NEAREST, así que encaja con el lenguaje pixel-art 3D sin
// añadir ningún fichero de imagen al paquete. Se cachea: rebuildArena() se
// ejecuta en cada cambio de nivel y no debe crear una textura nueva cada vez.
let _grassTex = null;
function grassTexture() {
  if (_grassTex) return _grassTex;
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  for (let y = 0; y < S; y += 2) {
    for (let x = 0; x < S; x += 2) {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const v = n - Math.floor(n);
      const k = 0.86 + v * 0.27;
      // Prado ligeramente más oscuro y oliváceo que el verde de las briznas:
      // si suelo y vegetación tienen la misma luminosidad, el detalle del kit
      // desaparece y el escenario parece una alfombra plana.
      g.fillStyle = `rgb(${Math.round(74 * k)},${Math.round(126 * k)},${Math.round(57 * k)})`;
      g.fillRect(x, y, 2, 2);
    }
  }
  // Briznas claras y sombras cortas: se leen como relieve a distancia.
  for (let i = 0; i < 150; i++) {
    const x = Math.floor(Math.random() * 32) * 2, y = Math.floor(Math.random() * 32) * 2;
    g.fillStyle = Math.random() < 0.55 ? 'rgba(178,214,120,0.42)' : 'rgba(34,80,38,0.38)';
    g.fillRect(x, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(46, 46);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  _grassTex = tex;
  return tex;
}

export function populateNature(b, group) {
  const R = b.rnd;
  const rand = (a, z) => a + (z - a) * R();
  const pickOne = (arr) => arr[Math.floor(R() * arr.length) % arr.length];
  const batches = new Map();
  const add = (model, x, z, scale, yaw, y = 0.03, extra = null) => {
    if (!batches.has(model)) batches.set(model, []);
    batches.get(model).push(extra ? { x, z, y, scale, yaw, ...extra } : { x, z, y, scale, yaw });
  };
  const inside = (x, z, m = 44) => Math.abs(x) <= m && Math.abs(z) <= m;
  // Hueco de reaparición del jugador y de los enemigos: sin obstáculos.
  const spawnSafe = (x, z, r = 7.5) => Math.hypot(x, z - 4) > r;

  // Altura real del modelo tal como viene en el GLB (antes de escalar).
  const sizeOf = (name) => natureTemplate(name)?.size || { x: 1, y: 1, z: 1 };

  // ------------------------------------------------------------------ suelo
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
    new THREE.MeshStandardMaterial({ map: grassTexture(), color: 0xffffff, roughness: 1, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  floor.receiveShadow = true;
  floor.name = 'NATURE_ground';
  group.add(floor);

  // ---------------------------------------------- detalle sin colisión (hordas)
  // 48 manchas de hierba: agrupadas, no uniformes, para que el prado tenga
  // ritmo y no parezca una alfombra de puntos aleatorios.
  for (let c = 0; c < 52; c++) {
    const cx = rand(-42, 42), cz = rand(-42, 42);
    const n = 16 + Math.floor(R() * 22);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 3.4;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (!inside(x, z)) continue;
      add(pickOne(GRASS_MODELS), x, z, rand(0.85, 1.75), R() * Math.PI * 2);
    }
  }
  // Flores en ramilletes de colores mezclados + algunas sueltas.
  for (let c = 0; c < 26; c++) {
    const cx = rand(-41, 41), cz = rand(-41, 41);
    const n = 7 + Math.floor(R() * 10);
    const fam = R() < 0.5 ? FLOWER_MODELS.slice(0, 2) : R() < 0.5 ? FLOWER_MODELS.slice(2, 4) : FLOWER_MODELS.slice(4, 6);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 2.4;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (!inside(x, z)) continue;
      add(pickOne(fam), x, z, rand(1.0, 1.9), R() * Math.PI * 2);
    }
  }
  for (let i = 0; i < 160; i++) {
    const x = rand(-43, 43), z = rand(-43, 43);
    add(pickOne(FLOWER_MODELS), x, z, rand(0.9, 1.7), R() * Math.PI * 2);
  }
  // Piedrecillas: nunca bloquean, pero dan escala al suelo.
  for (let i = 0; i < 240; i++) {
    const x = rand(-43, 43), z = rand(-43, 43);
    add(pickOne(STONE_MODELS), x, z, rand(0.7, 1.7), R() * Math.PI * 2);
  }
  // Arbustos en grupos al pie de las zonas de cobertura.
  for (let c = 0; c < 24; c++) {
    const cx = rand(-40, 40), cz = rand(-40, 40);
    const n = 3 + Math.floor(R() * 5);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 3.0;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (!inside(x, z)) continue;
      add(pickOne(BUSH_MODELS), x, z, rand(1.3, 2.4), R() * Math.PI * 2);
    }
  }
  // Setas: más densas en la mitad norte, a la sombra del bosque de fondo.
  for (let c = 0; c < 22; c++) {
    const cx = rand(-41, 41), cz = rand(-41, 25);
    const n = 3 + Math.floor(R() * 6);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 2.2;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (!inside(x, z)) continue;
      add(pickOne(MUSH_MODELS), x, z, rand(1.3, 2.6), R() * Math.PI * 2);
    }
  }

  // ------------------------------------------- cobertura táctica CON colisión
  // Nueve islas alrededor del centro. Los huecos entre islas son los pasillos
  // por los que el jugador rodea y esquiva a la horda.
  const CLUSTERS = [
    [-27, -23], [25, -25], [-33, 5], [33, 9],
    [-18, 27], [19, 29], [0, -34], [-38, 31], [38, -9]
  ];
  let tactical = 0;
  const addCollider = (x, z, hw, hd, h, yaw = 0) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const r = Math.hypot(hw, hd) + 0.35;
    b.colliders.push({ x, z, hw, hd, h, r, cos: c, sin: s });
  };

  for (const [cx, cz] of CLUSTERS) {
    const used = [];
    const free = (x, z, gap = 2.6) => used.every(p => Math.hypot(p[0] - x, p[1] - z) > gap);

    // Árboles frondosos y pinos: 3,2-5,5 unidades, siempre más altos que el
    // personaje (2,3). La caja de colisión es el FUSTE, no la copa.
    const nTrees = 2 + Math.floor(R() * 3);
    for (let i = 0; i < nTrees; i++) {
      const a = R() * Math.PI * 2, r = 1.4 + R() * 3.6;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (!inside(x, z, 42) || !spawnSafe(x, z) || !free(x, z)) continue;
      used.push([x, z]);
      const model = R() < 0.62 ? pickOne(TREE_MODELS) : pickOne(PINE_MODELS);
      const scale = rand(2.7, 3.7);
      add(model, x, z, scale, R() * Math.PI * 2);
      addCollider(x, z, 0.55, 0.55, sizeOf(model).y * scale);
      tactical++;
    }
    // Rocas grandes y medianas: tamaño proporcional a los enemigos.
    const nRocks = 1 + Math.floor(R() * 3);
    for (let i = 0; i < nRocks; i++) {
      const a = R() * Math.PI * 2, r = 1.0 + R() * 4.2;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (!inside(x, z, 42) || !spawnSafe(x, z) || !free(x, z, 2.2)) continue;
      used.push([x, z]);
      const model = pickOne(ROCK_MODELS);
      const scale = rand(1.7, 2.5);
      const yaw = R() * Math.PI * 2;
      add(model, x, z, scale, yaw);
      const sz = sizeOf(model);
      addCollider(x, z, sz.x * scale * 0.40, sz.z * scale * 0.40, sz.y * scale, yaw);
      tactical++;
    }
    // Tronco caído: caja orientada (cos/sin) para que no se pueda atravesar.
    if (R() < 0.72) {
      const a = R() * Math.PI * 2, r = 4.5 + R() * 2.0;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (inside(x, z, 42) && spawnSafe(x, z)) {
        const model = pickOne(LOG_MODELS);
        const scale = rand(2.0, 2.8);
        const yaw = R() * Math.PI * 2;
        add(model, x, z, scale, yaw);
        const sz = sizeOf(model);
        addCollider(x, z, sz.x * scale * 0.45, sz.z * scale * 0.45, sz.y * scale + 0.35, yaw);
        tactical++;
      }
    }
    // Tocón: cobertura baja que se puede rodear a pie.
    if (R() < 0.6) {
      const a = R() * Math.PI * 2, r = 5.0 + R() * 2.0;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (inside(x, z, 42) && spawnSafe(x, z)) {
        const model = pickOne(STUMP_MODELS);
        const scale = rand(1.8, 2.4);
        add(model, x, z, scale, R() * Math.PI * 2);
        const sz = sizeOf(model);
        addCollider(x, z, sz.x * scale * 0.45, sz.z * scale * 0.45, sz.y * scale);
        tactical++;
      }
    }
  }

  // Árboles y rocas sueltos entre islas: evita que el reparto parezca una
  // cuadrícula de nueve puntos.
  for (let i = 0; i < 18; i++) {
    const x = rand(-41, 41), z = rand(-41, 41);
    if (!spawnSafe(x, z, 10) || CLUSTERS.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 7)) continue;
    const model = R() < 0.65 ? pickOne(TREE_MODELS) : pickOne(PINE_MODELS);
    const scale = rand(2.6, 3.5);
    add(model, x, z, scale, R() * Math.PI * 2);
    addCollider(x, z, 0.55, 0.55, sizeOf(model).y * scale);
    tactical++;
  }

  // Anillo táctico interior (r = 12…20). Sin él, entre el hueco de
  // reaparición y las nueve islas quedaba un vacío de ~12 unidades y el
  // jugador veía el prado vacío justo delante: la cobertura tiene que estar
  // a la vista desde el primer segundo de la oleada. Se deja el centro libre.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rand(-0.16, 0.16);
    const r = rand(12, 20);
    const x = Math.cos(a) * r, z = Math.sin(a) * r + 2;
    if (!spawnSafe(x, z, 10)) continue;
    const isRock = R() < 0.42;
    const model = isRock ? pickOne(ROCK_MODELS) : (R() < 0.6 ? pickOne(TREE_MODELS) : pickOne(PINE_MODELS));
    const scale = isRock ? rand(1.7, 2.3) : rand(2.7, 3.5);
    const yaw = R() * Math.PI * 2;
    add(model, x, z, scale, yaw);
    if (isRock) {
      const sz = sizeOf(model);
      addCollider(x, z, sz.x * scale * 0.40, sz.z * scale * 0.40, sz.y * scale, yaw);
    } else {
      addCollider(x, z, 0.55, 0.55, sizeOf(model).y * scale);
    }
    tactical++;
  }

  // ------------------------------------------------------- límites del mapa
  // Valla de madera perimetral justo por fuera del clamp del jugador (±45).
  const FENCE_SCALE = 2.7;
  const SIDE = ARENA - 0.5;                 // 45.5, justo tras el clamp ±45
  // El modelo de valla mide 1 unidad de ancho: con esta escala cada tramo
  // cubre 2,7 y encaja exactamente con el paso del bucle.
  const steps = Math.ceil((SIDE * 2) / FENCE_SCALE);
  for (let i = 0; i < steps; i++) {
    const t = -SIDE + (i + 0.5) * (SIDE * 2) / steps;
    const jitter = (R() - 0.5) * 0.12;
    const model = pickOne(FENCE_MODELS);
    add(model, t, -SIDE, FENCE_SCALE, jitter);
    add(pickOne(FENCE_MODELS), t, SIDE, FENCE_SCALE, jitter);
    add(pickOne(FENCE_MODELS), -SIDE, t, FENCE_SCALE, Math.PI / 2 + jitter);
    add(pickOne(FENCE_MODELS), SIDE, t, FENCE_SCALE, Math.PI / 2 + jitter);
  }
  // Esquinas rematadas con roquedos del kit.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    for (let k = 0; k < 3; k++) {
      const x = sx * (SIDE - 1.5) + (R() - 0.5) * 4;
      const z = sz * (SIDE - 1.5) + (R() - 0.5) * 4;
      add(pickOne(CLIFF_MODELS), x, z, rand(2.2, 3.4), R() * Math.PI * 2, -0.05);
    }
  }

  // Tres anillos de bosque denso: cerca, medio y lejos. Sin colisiones (el
  // límite ya lo impone el juego) y con escala creciente para dar profundidad.
  const RINGS = [
    { r0: 47, r1: 56, count: 96, s0: 3.1, s1: 4.3 },
    { r0: 57, r1: 70, count: 118, s0: 3.8, s1: 5.4 },
    { r0: 71, r1: 92, count: 132, s0: 4.6, s1: 7.0 }
  ];
  for (const ring of RINGS) {
    for (let i = 0; i < ring.count; i++) {
      const a = (i / ring.count) * Math.PI * 2 + (R() - 0.5) * 0.10;
      const r = ring.r0 + R() * (ring.r1 - ring.r0);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      add(R() < 0.58 ? pickOne(PINE_MODELS) : pickOne(TREE_MODELS),
        x, z, rand(ring.s0, ring.s1), R() * Math.PI * 2, -0.08);
    }
  }

  // ------------------------------------------------------- profundidad visual
  // Un bosque de tres anillos solo da una línea de árboles repetida. Se rompe
  // con DOS elementos naturales, no con cubos: los cliff_block_rock del kit
  // son bloques 1×1×1 con cara de tierra y, vistos de lejos desde la cámara
  // baja, formaban una franja marrón tipo muro/ruina. En su lugar usamos
  // rocas reales del kit a gran escala (perfil bajo, silueta irregular).
  // 1) Afloramientos rocosos entre el bosque cercano y el medio.
  for (let i = 0; i < 42; i++) {
    const a = R() * Math.PI * 2, r = rand(57, 80);
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    const n = 1 + Math.floor(R() * 2);
    for (let k = 0; k < n; k++) {
      add(pickOne(ROCK_MODELS), cx + rand(-3, 3), cz + rand(-3, 3),
        rand(3.0, 5.2), R() * Math.PI * 2, -0.08);
    }
  }
  // 2) Unos pocos árboles "hito" más altos, repartidos de forma irregular:
  //    el verde se mezcla con el bosque y no crea una franja artificial.
  for (let i = 0; i < 22; i++) {
    const a = R() * Math.PI * 2, r = rand(84, 104);
    add(R() < 0.5 ? 'tree_tall' : pickOne(PINE_MODELS),
      Math.cos(a) * r, Math.sin(a) * r, rand(7.0, 10.5), R() * Math.PI * 2, -0.15);
  }

  // ------------------------------------------------------------- instanciado
  // Sombra solo en la cobertura táctica y en el anillo cercano: el detalle
  // rastrero (miles de instancias) no la necesita y ahorra un pase de sombras.
  const shadowModels = new Set([...TREE_MODELS, ...PINE_MODELS, ...ROCK_MODELS, ...LOG_MODELS, ...STUMP_MODELS, ...CLIFF_MODELS]);
  let instances = 0, drawCalls = 0;
  const holder = new THREE.Group();
  holder.name = 'NATURE_instanced';
  for (const [model, list] of batches) {
    const mesh = natureInstances(model, list, { shadow: shadowModels.has(model) });
    if (!mesh) continue;
    holder.add(mesh);
    instances += list.length;
    drawCalls++;
  }
  group.add(holder);

  const stats = {
    ok: true, instances, drawCalls, models: drawCalls,
    colliders: b.colliders.length, tactical,
    floor: '#4a7e39', bounds: ARENA
  };
  group.userData.nature = stats;
  window.__NR_NATURE = stats;
  return stats;
}
