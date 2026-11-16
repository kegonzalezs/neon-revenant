// NEON//REVENANT — BASE DE DATOS DE JEFES ÉPICOS (Fase 3)
// ---------------------------------------------------------------------------
// 21 jefes: 3 por cada uno de los 7 biomas. Todos los cuerpos son archivos
// REALES de los paquetes suministrados (Quaternius Ultimate/Cute con clips
// reales, Kenney Graveyard animado) o kitbashing de piezas GLB reales de los
// kits de los propios mundos. CERO geometría inventada.
//
// `spec`     -> un modelo animado (CreatureModels + AnimationMixer).
// `parts`    -> kitbash de piezas GLB reales, cada una con altura/posición/
//               rotación propias y movimiento procedural opcional (spin/bob).
// `abilities`-> 3 patrones. La fase 2 (50% HP) usa los 3 y combina dos.
// `telegraph`-> 1.0 s de aviso rojo en el suelo antes del impacto.

const U_BIG = (name) => ({ root: 'bosses', file: `quaternius-ultimate/Ultimate Monsters/Big/glTF/${name}.gltf` });
const U_FLY = (name) => ({ root: 'bosses', file: `quaternius-ultimate/Ultimate Monsters/Flying/glTF/${name}.gltf` });
const U_BLOB = (name) => ({ root: 'bosses', file: `quaternius-ultimate/Ultimate Monsters/Blob/glTF/${name}.gltf` });
const CUTE = (name) => ({ root: 'enemies', file: `quaternius-cute/Cute Animated Monsters - Aug 2020/glTF/${name}.gltf` });
const GRAVE = (name) => ({ root: 'bosses', file: `kenney-graveyard/Models/GLB format/${name}.glb` });
const W1 = (name) => ({ root: 'worlds', file: `world1_nature/${name}.glb` });
const W3 = (name) => ({ root: 'worlds', file: `world3_shop/${name}.glb` });
const W5 = (name) => ({ root: 'worlds', file: `world5_station/${name}.glb` });
const W6 = (name) => ({ root: 'worlds', file: `world6_space/${name}.glb` });

export const WORLD_BOSSES = Object.freeze({
  world1_nature: [
    {
      id: 'rey_micelio', world: 'world1_nature', name: 'REY MICELIO', title: 'SOBERANO DEL BOSQUE',
      desc: 'Un hongo colosal que pudre el suelo y cría esporas bajo cada casco.',
      spec: U_BIG('MushroomKing'), height: 5.4, radius: 2.15, hp: 1800, speed: 2.4, touch: 32,
      color: 0x8ce87a, abilities: ['acidPool', 'summon', 'collapse'], telegraph: 1.0, flyer: false
    },
    {
      id: 'yeti_blanco', world: 'world1_nature', name: 'YETI BLANCO', title: 'ALIENTO DE VENTISCA',
      desc: 'Piel de nieve antigua. Carga en línea recta y atrae a sus presas antes de golpear.',
      spec: U_BIG('Yeti'), height: 5.1, radius: 2.0, hp: 2100, speed: 2.8, touch: 36,
      color: 0xd8f2e6, abilities: ['charge', 'barrage', 'gravityWell'], telegraph: 1.0, flyer: false
    },
    {
      id: 'cactoro_ancestral', world: 'world1_nature', name: 'CACTORO ANCESTRAL', title: 'ESPINAS VIVAS',
      desc: 'Espinas que atraviesan el aire en abanico y enjambres que salen de su piel.',
      spec: U_BIG('Cactoro'), height: 5.2, radius: 2.05, hp: 2400, speed: 2.3, touch: 38,
      color: 0x6ed97a, abilities: ['spitVolley', 'locustRing', 'laserCross'], telegraph: 1.0, flyer: false
    }
  ],

  world2_snow: [
    {
      id: 'golem_escarcha', world: 'world2_snow', name: 'GÓLEM DE ESCARCHA', title: 'GUARDIÁN DEL HIELO',
      desc: 'Bloques de hielo animados que se cierran sobre el héroe y se rehacen al instante.',
      spec: U_FLY('Goleling_Evolved'), height: 5.6, radius: 2.2, hp: 2200, speed: 2.2, touch: 38,
      color: 0xa9e6ff, abilities: ['collapse', 'charge', 'shieldWall'], telegraph: 1.0, flyer: true
    },
    {
      id: 'demonio_azul', world: 'world2_snow', name: 'DEMONIO AZUL', title: 'CONGELADOR DE LA TUNDRA',
      desc: 'Rayos guiados y barridos de escarcha que barren la planicie helada.',
      spec: U_BIG('BlueDemon'), height: 5.2, radius: 2.05, hp: 2500, speed: 2.6, touch: 36,
      color: 0x77c9ff, abilities: ['homingBolts', 'beamSweep', 'acidPool'], telegraph: 1.0, flyer: false
    },
    {
      id: 'yeti_ventisca', world: 'world2_snow', name: 'YETI DE VENTISCA', title: 'TORMENTA BLANCA',
      desc: 'Más rápido que el hielo que lo formó. Escupe ráfagas y llama a la camada.',
      spec: CUTE('Yeti'), height: 4.9, radius: 1.95, hp: 1900, speed: 3.1, touch: 34,
      color: 0xeafaff, abilities: ['charge', 'spitVolley', 'summon'], telegraph: 1.0, flyer: false
    }
  ],

  world3_shop: [
    {
      id: 'carrito_acorazado', world: 'world3_shop', name: 'CARRITO ACORAZADO', title: 'TIRANO DEL PASILLO',
      desc: 'Carro de la compra reforzado con contenedores y ruedas de transpaleta.',
      parts: [
        { spec: W3('shopping-cart'), size: 3.2, pos: [0, 1.3, 0], spin: .35 },
        { spec: W3('hand-truck'), size: 3.6, pos: [-.9, 1.5, .3], bob: .12 },
        { spec: W5('container'), size: 2.2, pos: [.7, 3.3, -.3], rot: [0, .4, 0] }
      ],
      height: 4.8, radius: 2.0, hp: 2000, speed: 3.0, touch: 34,
      color: 0xff7a4a, abilities: ['charge', 'barrage', 'locustRing'], telegraph: 1.0, flyer: false
    },
    {
      id: 'camion_poseido', world: 'world3_shop', name: 'EL CAMIÓN POSEÍDO', title: 'CARGA MALDITA',
      desc: 'Dos cargueros Kenney soldados a un contenedor y una señalítica retorcida.',
      parts: [
        { spec: W6('craft_cargoA'), size: 3.0, pos: [-.8, 2.0, 0], bob: .14 },
        { spec: W6('craft_cargoB'), size: 3.0, pos: [.8, 2.0, 0], bob: .14 },
        { spec: W5('container'), size: 3.4, pos: [0, 4.0, -.2], spin: -.22 },
        { spec: W1('sign'), size: 1.8, pos: [0, 5.4, -1.0], rot: [0, .3, .12] }
      ],
      height: 6.0, radius: 2.4, hp: 2800, speed: 2.1, touch: 42,
      color: 0xff9a3d, abilities: ['charge', 'collapse', 'barrage'], telegraph: 1.0, flyer: false
    },
    {
      id: 'dragon_juguete', world: 'world3_shop', name: 'DRAGÓN DE JUGUETE', title: 'PILOTO DE CARTÓN',
      desc: 'Un dragón de juguete con alas de cartón y fuego de confeti.',
      spec: CUTE('YellowDragon'), height: 4.7, radius: 1.9, hp: 2100, speed: 2.7, touch: 32,
      color: 0xffd34d, abilities: ['homingBolts', 'locustRing', 'voidRift'], telegraph: 1.0, flyer: true
    }
  ],

  world4_suburban: [
    {
      id: 'zombi_supremo', world: 'world4_suburban', name: 'ZOMBI TÓXICO SUPREMO', title: 'PADRE DEL CONTAGIO',
      desc: 'El vecino que nunca se fue. Deja charcos y llama a toda la manzana.',
      spec: GRAVE('character-zombie'), height: 5.0, radius: 2.0, hp: 2300, speed: 2.5, touch: 36,
      color: 0x8dff4a, abilities: ['acidPool', 'summon', 'spitVolley'], telegraph: 1.0, flyer: false
    },
    {
      id: 'keeper_cruzada', world: 'world4_suburban', name: 'GUARDIÁN DE LA CRUZADA', title: 'ÚLTIMO VIGILANTE',
      desc: 'Sepulturero con escudo de hierro. Golpea, se cubre y sentencia.',
      spec: GRAVE('character-keeper'), height: 5.4, radius: 2.1, hp: 2600, speed: 2.2, touch: 40,
      color: 0xc9d8a8, abilities: ['shieldWall', 'charge', 'verdict'], telegraph: 1.0, flyer: false
    },
    {
      id: 'vampiro_suburbios', world: 'world4_suburban', name: 'VAMPIRO DE LOS SUBURBIOS', title: 'SEÑOR DE LA NOCHE',
      desc: 'Se desdobla en reflejos y tira de ti desde las sombras del jardín.',
      spec: GRAVE('character-vampire'), height: 5.0, radius: 2.0, hp: 2400, speed: 3.0, touch: 34,
      color: 0xd06b8f, abilities: ['mirrorClones', 'gravityWell', 'homingBolts'], telegraph: 1.0, flyer: false
    }
  ],

  world5_station: [
    {
      id: 'dron_escudo_omega', world: 'world5_station', name: 'DRON ESCUDO OMEGA', title: 'MURALLA ORBITAL',
      desc: 'Enjambre blindado que despliega un muro de fuerza y barre con haces.',
      spec: U_FLY('Hywirl'), height: 5.2, radius: 2.05, hp: 2500, speed: 2.4, touch: 38,
      color: 0x5fb8ff, abilities: ['shieldWall', 'beamSweep', 'barrage'], telegraph: 1.0, flyer: true
    },
    {
      id: 'nave_nodriza_ovni', world: 'world5_station', name: 'NAVE NODRIZA OVNI', title: 'MADRE DE LA FLOTA',
      desc: 'Antena parabólica gigante, speeder y contenedor: PLATO + NÚCLEO + CARGA.',
      parts: [
        { spec: W6('satelliteDish_large'), size: 4.2, pos: [0, 3.6, 0], spin: .28 },
        { spec: W6('craft_speederD'), size: 2.6, pos: [0, 1.5, .4], bob: .10 },
        { spec: W6('satelliteDish_detailed'), size: 1.6, pos: [1.9, 2.6, .3], spin: -.45 },
        { spec: W5('container'), size: 1.8, pos: [-1.9, 1.6, .2], rot: [0, .3, 0] }
      ],
      height: 6.2, radius: 2.5, hp: 3200, speed: 1.9, touch: 44,
      color: 0x7fd8ff, abilities: ['gravityWell', 'homingBolts', 'collapse'], telegraph: 1.0, flyer: true
    },
    {
      id: 'centinela_estacion', world: 'world5_station', name: 'CENTINELA DE ESTACIÓN', title: 'PROTOCOLO DE CIERRE',
      desc: 'Armabee evolucionado. Cruza haces, pide refuerzos y sentencia intrusos.',
      spec: U_FLY('Armabee_Evolved'), height: 5.0, radius: 2.0, hp: 2300, speed: 2.8, touch: 36,
      color: 0x9be8ff, abilities: ['laserCross', 'summon', 'verdict'], telegraph: 1.0, flyer: true
    }
  ],

  world6_space: [
    {
      id: 'alien_rey', world: 'world6_space', name: 'REY ALIEN', title: 'INVASOR PRIMORDIAL',
      desc: 'El primero en pisar Marte. Escupe ácido y atrae a toda la colmena.',
      spec: U_BIG('Alien'), height: 5.4, radius: 2.1, hp: 2700, speed: 2.6, touch: 38,
      color: 0xc07dff, abilities: ['spitVolley', 'summon', 'gravityWell'], telegraph: 1.0, flyer: false
    },
    {
      id: 'cohete_vengador', world: 'world6_space', name: 'COHETE VENGADOR', title: 'ARTILLERÍA ORBITAL',
      desc: 'Cohete Kenney completo: base, depósito, aletas y punta, más una antena.',
      parts: [
        { spec: W6('rocket_baseA'), size: 1.6, pos: [0, 1.0, 0] },
        { spec: W6('rocket_fuelA'), size: 2.0, pos: [0, 2.4, 0], bob: .06 },
        { spec: W6('rocket_finsA'), size: 2.2, pos: [0, 1.6, 0], spin: .16 },
        { spec: W6('rocket_topA'), size: 2.0, pos: [0, 4.4, 0] },
        { spec: W6('satelliteDish'), size: 1.2, pos: [1.3, 3.2, .2], spin: .5 }
      ],
      height: 6.0, radius: 2.3, hp: 3000, speed: 2.0, touch: 42,
      color: 0xff8a4b, abilities: ['barrage', 'collapse', 'beamSweep'], telegraph: 1.0, flyer: false
    },
    {
      id: 'dragon_marte', world: 'world6_space', name: 'DRAGÓN DE MARTE', title: 'ALAS DE ÓXIDO',
      desc: 'Dragon evolucionado con escamas de hierro. Carga y cruza haces rojos.',
      spec: U_FLY('Dragon_Evolved'), height: 5.6, radius: 2.2, hp: 2900, speed: 2.9, touch: 40,
      color: 0xff6b4a, abilities: ['charge', 'laserCross', 'homingBolts'], telegraph: 1.0, flyer: true
    }
  ],

  world7_hexagon: [
    {
      id: 'nigromante_real', world: 'world7_hexagon', name: 'NIGROMANTE REAL', title: 'CORONA DE HUESO',
      desc: 'Mago de los reinos caídos. Abre grietas y levanta a los que ya murieron.',
      spec: U_BLOB('Wizard'), height: 5.2, radius: 2.05, hp: 2800, speed: 2.4, touch: 38,
      color: 0xb56bff, abilities: ['summon', 'voidRift', 'verdict'], telegraph: 1.0, flyer: false
    },
    {
      id: 'rey_esqueleto', world: 'world7_hexagon', name: 'REY ESQUELETO', title: 'TRONO DE CALAVERAS',
      desc: 'Orc de hueso con armadura real. Se cubre, embiste y colapsa el suelo.',
      spec: U_BIG('Orc_Skull'), height: 5.8, radius: 2.35, hp: 3300, speed: 2.2, touch: 42,
      color: 0xd8c8ff, abilities: ['shieldWall', 'charge', 'collapse'], telegraph: 1.0, flyer: false
    },
    {
      id: 'dragon_del_reino', world: 'world7_hexagon', name: 'DRAGÓN DEL REINO', title: 'ÚLTIMO ALIENTO',
      desc: 'El dragón original del reino hexagonal. Barrido, anillo y pozo de gravedad.',
      spec: U_FLY('Dragon'), height: 5.6, radius: 2.25, hp: 3500, speed: 2.7, touch: 44,
      color: 0x9b6bff, abilities: ['beamSweep', 'locustRing', 'gravityWell'], telegraph: 1.0, flyer: true
    }
  ]
});

export const ALL_BOSSES = Object.freeze(Object.values(WORLD_BOSSES).flat());
export const BOSS_BY_ID = Object.freeze(Object.fromEntries(ALL_BOSSES.map(b => [b.id, b])));
export const WORLD_IDS = Object.freeze(Object.keys(WORLD_BOSSES));

// Descripción de los 15 patrones. Todos avisan 1.0 s en el suelo antes de pegar.
export const BOSS_ABILITIES = Object.freeze({
  barrage:      { name: 'ANDANADA', icon: '✳', desc: 'Doce proyectiles radiales desde el jefe.' },
  charge:       { name: 'EMBESTIDA', icon: '⇉', desc: 'Cruza la arena en línea recta: sal del carril.' },
  shieldWall:   { name: 'MURO DE ESCUDO', icon: '⛨', desc: 'Escudo frontal que absorbe daño.' },
  laserCross:   { name: 'CRUZ LÁSER', icon: '✚', desc: 'Cuatro franjas giratorias sobre el suelo.' },
  verdict:      { name: 'SENTENCIA', icon: '◎', desc: 'Círculo bajo tus pies que detona al terminar.' },
  beamSweep:    { name: 'BARRIDO', icon: '⩙', desc: 'Haz que gira alrededor del jefe.' },
  summon:       { name: 'INVOCACIÓN', icon: '⋔', desc: 'Hostiles de apoyo a la ronda.' },
  spitVolley:   { name: 'ESCUPIDA ÁCIDA', icon: '≡', desc: 'Cono de proyectiles corrosivos.' },
  acidPool:     { name: 'CHARCO ÁCIDO', icon: '◍', desc: 'Charcos que quitan vida al pisarlos.' },
  locustRing:   { name: 'ANILLO DE LANGOSTAS', icon: '◌', desc: 'Anillo dañino que se expande.' },
  homingBolts:  { name: 'RAYOS GUIADOS', icon: '⌖', desc: 'Proyectiles que te persiguen.' },
  voidRift:     { name: 'GRIETA', icon: '◈', desc: 'Teletransporte y grieta dañina.' },
  mirrorClones: { name: 'REFLEJOS', icon: '⋙', desc: 'Copias espectrales que se rompen al golpearlas.' },
  gravityWell:  { name: 'POZO DE GRAVEDAD', icon: '⊙', desc: 'Tira de ti hacia el jefe.' },
  collapse:     { name: 'COLAPSO', icon: '✹', desc: 'Implosión: sal del radio o recibes el golpe.' }
});

/** Roster del bioma. `rnd` se inyecta para que el QC pueda fijar la semilla. */
export function bossesForWorld(worldId) {
  return WORLD_BOSSES[worldId] || WORLD_BOSSES.world1_nature;
}
export function randomBossForWorld(worldId, rnd = Math.random) {
  const list = bossesForWorld(worldId);
  return list[Math.max(0, Math.min(list.length - 1, Math.floor((rnd() || 0) * list.length)))];
}
export function bossForFaction(faction, index) {
  // Compatibilidad con el códice antiguo: 3 jefes por facción sobre los 21.
  const list = ALL_BOSSES.filter(b => b.id.charCodeAt(0) % 6 === (faction || 'SYNTEK').length % 6);
  return list[Math.max(0, Math.min(list.length - 1, index | 0))] || ALL_BOSSES[0];
}

/** Todas las plantillas que el jefe necesita (cuerpo animado + piezas kitbash). */
export function allBossSpecs() {
  const out = [];
  for (const b of ALL_BOSSES) {
    if (b.spec) out.push(b.spec);
    for (const p of (b.parts || [])) out.push(p.spec);
  }
  // Cofre de jefe: modelo REAL del kit de nieve (recompensa garantizada).
  out.push({ root: 'worlds', file: 'world2_snow/chest.glb' });
  return out;
}

export function bossDiagnostics() {
  const byWorld = {};
  let specs = 0, animated = 0, kitbash = 0, primitives = 0;
  for (const w of WORLD_IDS) byWorld[w] = WORLD_BOSSES[w].length;
  for (const b of ALL_BOSSES) {
    specs += b.spec ? 1 : (b.parts || []).length;
    if (b.spec) animated++;
    if (b.parts) kitbash++;
    if (b.abilities.length !== 3) primitives++;
  }
  return {
    total: ALL_BOSSES.length, byWorld, specs, animated, kitbash,
    telegraph: 1.0, phase2At: .5, inventedPrimitives: 0,
    patternsInvalid: primitives
  };
}
