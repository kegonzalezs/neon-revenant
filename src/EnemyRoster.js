// NEON//REVENANT — ROSTERS DE HOSTILES POR BIOMA (Fase 2)
// ---------------------------------------------------------------------------
// Cada entrada apunta a un .glb/.gltf REAL extraído de los ZIP del usuario.
// No hay una sola primitiva: el aspecto de cada hostil sale de estos modelos y
// el `CreatureModels.js` decide si se anima con AnimationMixer (clips reales),
// por retargeting (KayKit) o con la capa procedural de respaldo.
//
// `root` es la enum del puente IPC: 'enemies' | 'bosses' | 'worlds'.
// `worlds` da acceso a los 809 GLB de los kits Kenney ya integrados en los
// 7 mundos (carrito de la compra, torretas, naves de carga...).

const CUTE = 'quaternius-cute/Cute Animated Monsters - Aug 2020/glTF/';
const BIG = 'quaternius-ultimate/Ultimate Monsters/Big/glTF/';
const BLOB = 'quaternius-ultimate/Ultimate Monsters/Blob/glTF/';
const FLY = 'quaternius-ultimate/Ultimate Monsters/Flying/glTF/';
const KAY = 'kaykit-skeletons/KayKit_Skeletons_1.1_FREE/characters/gltf/';
const KAY_RIG = 'kaykit-skeletons/KayKit_Skeletons_1.1_FREE/Animations/gltf/Rig_Medium/';
const GRAVE = 'kenney-graveyard/Models/GLB format/';
const BLOCKY = 'kenney-blocky/Models/GLB format/';
const SHOP = 'world3_shop/';
const STATION = 'world5_station/';
const SPACE = 'world6_space/';

const RIG = [KAY_RIG + 'Rig_Medium_General.glb', KAY_RIG + 'Rig_Medium_MovementBasic.glb'];
const kay = (name) => ({ root: 'enemies', file: KAY + name + '.glb', rig: RIG, height: 2.1 });
const cute = (name, height = 2.0) => ({ root: 'enemies', file: CUTE + name + '.gltf', height });
const big = (name, height = 2.3) => ({ root: 'bosses', file: BIG + name + '.gltf', height });
const blob = (name, height = 2.0) => ({ root: 'bosses', file: BLOB + name + '.gltf', height });
const flying = (name, height = 2.0) => ({ root: 'bosses', file: FLY + name + '.gltf', height });
const grave = (name, height = 2.0) => ({ root: 'bosses', file: GRAVE + name + '.glb', height });
const blocky = (name, height = 2.0) => ({ root: 'enemies', file: BLOCKY + name + '.glb', height });
const prop = (dir, name, height = 1.9) => ({ root: 'worlds', file: dir + name + '.glb', height });

// ---------------------------------------------------------------------------
// 4 ARQUETIPOS por mundo. Dos variantes por arquetipo para que una horda de 30
// no sea el mismo modelo clonado 30 veces (sin coste extra: plantilla cacheada).
// ---------------------------------------------------------------------------
export const WORLD_ROSTERS = {
  world1_nature: {
    name: 'PRADERA',
    melee:  [cute('GreenDemon'), cute('Mushroom')],
    ranged: [cute('Cactus'), blob('Mushnub')],
    tank:   [big('MushroomKing', 2.9), big('Orc', 2.8)],
    flyer:  [cute('Bee', 1.7), cute('Bat', 1.7)],
    elite:  { id: 'chaman_bosque', name: 'Chamán del Bosque', spec: blob('Wizard', 2.5), type: 'support' }
  },
  world2_snow: {
    name: 'NIEVE',
    melee:  [cute('Penguin'), cute('Yeti')],
    ranged: [cute('Ghost'), flying('Ghost', 2.0)],
    tank:   [big('Yeti', 3.0), big('Frog', 2.8)],
    flyer:  [flying('Ghost', 1.8), cute('Bat', 1.7)],
    elite:  { id: 'lanzador_escarcha', name: 'Lanzador de Escarcha', spec: blob('Wizard', 2.4), type: 'ranged' }
  },
  world3_shop: {
    name: 'SUPERMERCADO',
    melee:  [cute('Pig'), cute('Chicken')],
    ranged: [blob('GreenBlob', 1.8), blob('PinkBlob', 1.8)],
    tank:   [prop(SHOP, 'shopping-cart', 2.4), prop(SHOP, 'hand-truck', 2.4)],
    flyer:  [flying('Armabee', 1.7), cute('Bee', 1.6)],
    elite:  { id: 'juguete_kamikaze', name: 'Juguete Kamikaze', spec: cute('Chicken', 1.8), type: 'drone' }
  },
  world4_suburban: {
    name: 'SUBURBIO',
    melee:  [grave('character-zombie'), grave('character-skeleton')],
    ranged: [grave('character-vampire'), grave('character-keeper')],
    tank:   [big('Tribal', 2.8), grave('character-keeper', 2.6)],
    flyer:  [grave('character-ghost'), cute('Bat', 1.7)],
    elite:  { id: 'zombi_toxico', name: 'Zombi Tóxico', spec: grave('character-zombie', 2.3), type: 'chaser' }
  },
  world5_station: {
    name: 'ESTACIÓN',
    melee:  [blocky('character-a'), blocky('character-f')],
    ranged: [blocky('character-k'), blocky('character-n')],
    tank:   [prop(SPACE, 'turret_double', 2.6), prop(STATION, 'computer-system', 2.6)],
    flyer:  [cute('Alien', 1.7), flying('Glub', 1.7)],
    elite:  { id: 'dron_escudero', name: 'Dron Escudero', spec: prop(SPACE, 'turret_single', 2.2), type: 'support' }
  },
  world6_space: {
    name: 'MARTE',
    melee:  [blob('Alien'), cute('Alien_Tall')],
    ranged: [big('Alien', 2.2), blob('Cactoro')],
    tank:   [big('Dino', 3.0), big('BlueDemon', 2.9)],
    flyer:  [prop(SPACE, 'craft_cargoA', 1.8), flying('Squidle', 1.7)],
    elite:  { id: 'parasito_divisible', name: 'Parásito Divisible', spec: blob('GreenBlob', 2.1), type: 'swarmling' }
  },
  world7_hexagon: {
    name: 'REINO HEXAGONAL',
    // Los esqueletos KayKit (9-10 mallas skinneadas + retargeting de 23 huesos)
    // son los modelos más caros del roster. Se alternan con los personajes
    // animados de Graveyard para que una horda de 30 no dispare el coste de
    // skinning: sigue habiendo retargeting real, pero no en TODA la horda.
    melee:  [kay('Skeleton_Warrior'), grave('character-skeleton')],
    ranged: [kay('Skeleton_Rogue'), grave('character-vampire')],
    tank:   [big('Orc_Skull', 2.7), grave('character-keeper', 2.6)],
    flyer:  [grave('character-ghost'), flying('Ghost_Skull', 1.8)],
    elite:  { id: 'nigromante_real', name: 'Nigromante Real', spec: kay('Skeleton_Mage'), type: 'support' }
  }
};

// Relación entre los tipos lógicos heredados (la IA de game.js NO se toca) y
// los 4 arquetipos visuales/de comportamiento que pidió el usuario.
const ARCHETYPE_OF = {
  chaser: 'melee', stalker: 'melee', wraith: 'melee', swarmling: 'melee',
  brute: 'melee', saper: 'melee', sapper: 'ranged', boss: 'tank',
  ranged: 'ranged', turret: 'ranged', support: 'ranged',
  tank: 'tank', brute2: 'tank',
  flyer: 'flyer', drone: 'flyer'
};
export function archetypeForType(type) {
  if (type === 'tank' || type === 'brute') return 'tank';
  if (type === 'flyer' || type === 'drone') return 'flyer';
  return ARCHETYPE_OF[type] || 'melee';
}

export function rosterFor(worldId) {
  return WORLD_ROSTERS[worldId] || WORLD_ROSTERS.world1_nature;
}

/** Devuelve el spec del modelo para un arquetipo y una variante determinada. */
export function specForEnemy(worldId, archetype, variant = 0, type) {
  const r = rosterFor(worldId);
  const arch = archetype || archetypeForType(type);
  const list = r[arch] || r.melee;
  return list[Math.abs(variant | 0) % list.length];
}

export function eliteForWorld(worldId) {
  return rosterFor(worldId).elite;
}

export const WORLD_IDS = Object.keys(WORLD_ROSTERS);
export const ARCHETYPES = ['melee', 'ranged', 'tank', 'flyer'];

/** Todos los specs únicos, para precargar las plantillas UNA sola vez al
 *  arrancar la partida. Incluye los 7 élites. */
export function allRosterSpecs() {
  const out = new Map();
  const add = (s) => { if (s) out.set(s.root + '/' + s.file + (s.rig ? '|rig' : ''), s); };
  for (const r of Object.values(WORLD_ROSTERS)) {
    for (const a of ARCHETYPES) for (const s of r[a]) add(s);
    add(r.elite.spec);
  }
  return [...out.values()];
}

/** Diagnóstico estable para el QC de la Fase 2. */
export function rosterDiagnostics() {
  const counts = {};
  for (const [id, r] of Object.entries(WORLD_ROSTERS)) {
    counts[id] = { name: r.name, elite: r.elite.id,
      models: ARCHETYPES.reduce((n, a) => n + r[a].length, 0) };
  }
  return { worlds: WORLD_IDS.length, archetypes: ARCHETYPES.length,
    elites: Object.values(WORLD_ROSTERS).map(r => r.elite.id),
    uniqueModels: allRosterSpecs().length, counts };
}
