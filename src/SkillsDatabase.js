// ===========================================================================
// NEON//REVENANT — CATÁLOGO UNIFICADO DE PROGRESIÓN  (80 objetos + 5 sinergias)
// ---------------------------------------------------------------------------
// Arquitectura pensada para el futuro mapa de nodos (Slay the Spire):
//   * Cada entrada es DATO PURO, sin lógica de juego ni referencias a `state`.
//     Un nodo del mapa solo tiene que entregar un `id` a SkillManager.grant().
//   * `type` separa las tres fuentes: 'skill' (6 slots, niveles 1-5),
//     'relic' y 'pact_relic' (pasivas únicas, sin límite de slots).
//   * `mods` es un objeto de modificadores DECLARATIVOS por nivel. SkillManager
//     los suma y expone `mods` ya resuelto; el combate solo lee ese objeto.
//   * `flags` son comportamientos booleanos que el combate consulta por nombre.
//   * `power` describe habilidades periódicas; los cooldowns SOLO avanzan
//     mientras hay enemigos vivos (ver SkillManager.update).
//   * `icon` es una clave de skill-icons.js (game-icons.net, currentColor).
//   * `sfx` / `particle` referencian /assets/audio y /assets/vfx/particles.
// ===========================================================================

export const MAX_SLOTS = 6;
export const MAX_LEVEL = 5;

// Colores por clase y rareza (CSS, sin brillos: todos mate).
export const HERO_THEME = Object.freeze({
  seraph: { name: 'EL ARQUERO', theme: 'arrow', color: '#9ade86', accent: '#e6cd76', dark: '#2c4a2c' },
  ronin:  { name: 'EL BÁRBARO', theme: 'blade', color: '#f2964b', accent: '#d9533d', dark: '#4d2a1c' },
  glitch: { name: 'LA BRUJA',   theme: 'magic', color: '#bd93ef', accent: '#8258c9', dark: '#382650' },
  vanta:  { name: 'EL ROBOT',   theme: 'scifi', color: '#6ad2e8', accent: '#3e8fd0', dark: '#163043' },
  kira:   { name: 'EL VAMPIRO', theme: 'creature', color: '#e06078', accent: '#93233d', dark: '#481622' }
});

export const RARITY = Object.freeze({
  COMUN:   { label: 'COMÚN',    color: '#9fb0bb', weight: 5.0 },
  RARA:    { label: 'RARA',     color: '#5f9fe0', weight: 2.6 },
  EPICA:   { label: 'ÉPICA',    color: '#b57ce8', weight: 1.3 },
  MALDITO: { label: 'MALDITO',  color: '#b3354b', weight: 1.7 },
  SINERGIA:{ label: 'SINERGIA', color: '#f0c65a', weight: 0 }
});

// --- Mapas de recursos -----------------------------------------------------
// Los nombres "powerUp"/"jingles"/"spell" no existen en los packs Kenney
// descargados: se resuelven a un sonido equivalente del banco real.
export const SFX = Object.freeze({
  levelUp:    ['scifi/forceField_000.ogg', 'rpg/handleCoins.ogg'],
  synergy:    ['scifi/forceField_002.ogg', 'rpg/handleCoins2.ogg'],
  relic:      ['rpg/bookFlip1.ogg', 'rpg/bookPlace1.ogg'],
  pact:       ['scifi/explosionCrunch_000.ogg', 'scifi/lowFrequency_explosion_000.ogg'],
  energy:     ['scifi/laserSmall_000.ogg', 'scifi/laserRetro_000.ogg', 'scifi/forceField_000.ogg'],
  physical:   ['rpg/knifeSlice.ogg', 'rpg/chop.ogg', 'rpg/drawKnife1.ogg'],
  spell:      ['scifi/laserRetro_002.ogg', 'scifi/computerNoise_000.ogg'],
  hit:        ['scifi/impactMetal_000.ogg']
});

export const PARTICLES = Object.freeze({
  arrow:    ['spark_01', 'circle_05', 'slash_01'],
  blade:    ['slash_01', 'slash_02', 'spark_03'],
  magic:    ['magic_01', 'twirl_01', 'star_04'],
  scifi:    ['spark_05', 'circle_05', 'spark_06'],
  creature: ['smoke_07', 'spark_02', 'circle_05'],
  tarot:    ['star_04', 'smoke_07', 'magic_01'],
  object:   ['star_04', 'circle_05', 'spark_04']
});

const pfx = theme => PARTICLES[theme] || PARTICLES.object;

// --- Fábricas --------------------------------------------------------------
// `mods` se interpretan POR NIVEL. Ej.: damage:.12 + nivel 3 => +36% daño.
const skill = (id, name, hero, icon, rarity, desc, mods = {}, flags = [], extra = {}) => ({
  id, name, type: 'skill', hero, icon, rarity, max: MAX_LEVEL,
  theme: HERO_THEME[hero].theme, desc, mods, flags,
  particle: pfx(HERO_THEME[hero].theme),
  sfx: extra.sfx || (HERO_THEME[hero].theme === 'scifi' ? SFX.energy :
                     HERO_THEME[hero].theme === 'magic' ? SFX.spell : SFX.physical),
  power: extra.power || null, ...extra
});

const relic = (id, name, icon, rarity, desc, mods = {}, flags = [], extra = {}) => ({
  id, name, type: 'relic', icon, rarity, hero: null, max: 1, theme: 'object',
  desc, mods, flags, particle: pfx('object'), sfx: SFX.relic,
  power: extra.power || null, ...extra
});

const pact = (id, name, icon, curse, desc, mods = {}, curseMods = {}, flags = [], extra = {}) => ({
  id, name, type: 'pact_relic', icon, rarity: 'MALDITO', hero: null, max: 1,
  theme: 'tarot', curse, desc, mods, curseMods, flags,
  particle: pfx('tarot'), sfx: SFX.pact, power: extra.power || null, ...extra
});

// ===========================================================================
// A. EL ARQUERO — 10 exclusivas
// ===========================================================================
const ARCHER = [
  skill('arr_shower', 'LLUVIA DE FLECHAS', 'seraph', 'arr_shower', 'COMUN',
    l => `+${2 * l} flechas extra en abanico por disparo.`,
    { pellets: 2 }, ['arrowFan']),
  skill('arr_pierce', 'PUNTAS PERFORANTES', 'seraph', 'arr_pierce', 'COMUN',
    l => `Las flechas atraviesan hasta ${Math.min(3, l + 1)} enemigos.`,
    { pierce: 1 }, ['pierce']),
  skill('arr_bounce', 'FLECHAS REBOTADORAS', 'seraph', 'arr_bounce', 'RARA',
    l => `Tras impactar rebotan hacia ${l} enemigo(s) cercano(s).`,
    { bounce: 1 }, ['bounce']),
  skill('arr_venom', 'CARCAJ VENENOSO', 'seraph', 'arr_venom', 'RARA',
    l => `Aplican veneno: ${(2 + l * 1.5).toFixed(1)} dmg/s durante ${2 + l}s y tinte verde.`,
    { poisonDps: 1.5, poisonTime: 1 }, ['poison']),
  skill('arr_sniper', 'TIRO DE FRANCOTIRADOR', 'seraph', 'arr_sniper', 'RARA',
    l => `+${(l * .18).toFixed(2)}x crítico a larga distancia (máx +${(l * .35).toFixed(2)}x).`,
    { critRange: .18 }, ['sniper']),
  skill('arr_explosive', 'FLECHA EXPLOSIVA', 'seraph', 'arr_explosive', 'EPICA',
    l => `Cada ${Math.max(2, 5 - l)}º disparo detona en área (${30 + l * 14} daño).`,
    { explosiveEvery: -1, explodeDmg: 14 }, ['explosiveShot']),
  skill('arr_tailwind', 'VIENTO A FAVOR', 'seraph', 'arr_tailwind', 'COMUN',
    l => `Disparar da +${(l * .06).toFixed(2)} velocidad de movimiento durante 1.5s.`,
    { speedOnShot: .06 }, ['tailwind']),
  skill('arr_caltrops', 'TRAMPA DE ESPINAS', 'seraph', 'arr_caltrops', 'COMUN',
    l => `El Dash deja ${l + 2} abrojos que ralentizan y dañan ${8 + l * 6}/s.`,
    { trapDmg: 6 }, ['caltrops']),
  skill('arr_hawkeye', 'OJO DE HALCÓN', 'seraph', 'arr_hawkeye', 'RARA',
    l => `+${l * 3}% probabilidad de crítico y flechas +${l * 8}% más grandes.`,
    { crit: .03, projScale: .08 }, ['hawkEye']),
  skill('arr_vertical', 'TORMENTA VERTICAL', 'seraph', 'arr_vertical', 'EPICA',
    l => `Cada ${(6 - l * .5).toFixed(1)}s caen ${l + 2} flechas sobre el grupo más denso.`,
    { arrowRain: 1 }, ['arrowRain'], { power: { every: 6, kind: 'arrowRain' } })
];

// ===========================================================================
// B. EL BÁRBARO — 10 exclusivas
// ===========================================================================
const BARBARIAN = [
  skill('bar_giant', 'HACHA GIGANTE', 'ronin', 'bar_giant', 'COMUN',
    l => `+${l * 6}% escala del hacha y radio de corte, +${l * 4}% daño.`,
    { area: .06, damage: .04 }, ['giantAxe']),
  skill('bar_whirl', 'TORBELLINO', 'ronin', 'bar_whirl', 'RARA',
    l => `Cada ${Math.max(2, 4 - Math.floor(l / 2))} ataques hace un giro de 360° (${20 + l * 12} daño).`,
    { whirlDmg: 12 }, ['whirlwind']),
  skill('bar_ember', 'FILO INCANDESCENTE', 'ronin', 'bar_ember', 'RARA',
    l => `Los cortes dejan fuego ${(1 + l * .4).toFixed(1)}s (${6 + l * 4} dmg/s).`,
    { burnDps: 4 }, ['fireGround']),
  skill('bar_quake', 'TERREMOTO', 'ronin', 'bar_quake', 'EPICA',
    l => `Onda de choque frontal cada ${(8 - l).toFixed(0)}s que aturde ${(1 + l * .3).toFixed(1)}s.`,
    { quakeDmg: 10 }, ['quake'], { power: { every: 8, kind: 'quake' } }),
  skill('bar_throw', 'LANZAMIENTO DE HACHA', 'ronin', 'bar_throw', 'COMUN',
    l => `Lanza ${l} hacha(s) espectral(es) giratoria(s) además del golpe.`,
    { axeThrow: 1 }, ['axeThrow']),
  skill('bar_stone', 'PIEL DE PIEDRA', 'ronin', 'bar_stone', 'COMUN',
    l => `-${l * 3}% daño recibido y devuelve ${l * 8} al contacto.`,
    { dmgTaken: -.03, thornsFlat: 8 }, ['stoneSkin']),
  skill('bar_cry', 'GRITO DE GUERRA', 'ronin', 'bar_cry', 'RARA',
    l => `Al recibir daño fuerte empuja la horda ${3 + l}m (${10 + l * 8} daño).`,
    { warCry: 8 }, ['warCry']),
  skill('bar_thirst', 'SED DE BATALLA', 'ronin', 'bar_thirst', 'COMUN',
    l => `Cada enemigo golpeado reduce el siguiente ataque un ${l * 2}%.`,
    { hasteOnHit: .02 }, ['battleThirst']),
  skill('bar_rift', 'GRIETA VOLCÁNICA', 'ronin', 'bar_rift', 'EPICA',
    l => `Críticos hacen brotar pilares de lava (${20 + l * 16} daño).`,
    { lavaDmg: 16 }, ['lavaPillar']),
  skill('bar_unstop', 'IMPARABLE', 'ronin', 'bar_unstop', 'COMUN',
    l => `+${l * 10}% empuje en cada golpe.`,
    { knockback: .1 }, ['unstoppable'])
];

// ===========================================================================
// C. LA BRUJA — 10 exclusivas
// ===========================================================================
const WITCH = [
  skill('wit_seek', 'ORBES BUSCADORES', 'glitch', 'wit_seek', 'RARA',
    l => `Los proyectiles curvan su trayectoria con fuerza ${(l * .22).toFixed(2)}.`,
    { homing: .22 }, ['homing']),
  skill('wit_chain', 'CADENA DE RELÁMPAGOS', 'glitch', 'wit_chain', 'RARA',
    l => `Al impactar, un rayo salta a ${l + 1} enemigos (${12 + l * 9} daño).`,
    { chain: 1, chainDmg: 9 }, ['chain']),
  skill('wit_singularity', 'SINGULARIDAD', 'glitch', 'wit_singularity', 'EPICA',
    l => `Cada ${(10 - l).toFixed(0)}s crea un agujero negro que atrae y aplasta (${20 + l * 15} dmg/s).`,
    { singularityDmg: 15 }, ['singularity'], { power: { every: 10, kind: 'singularity' } }),
  skill('wit_nova', 'NOVA ARCANA', 'glitch', 'wit_nova', 'RARA',
    l => `Onda púrpura cada ${(6 - l * .4).toFixed(1)}s (${14 + l * 11} daño en ${3 + l}m).`,
    { novaDmg: 11 }, ['nova'], { power: { every: 6, kind: 'nova' } }),
  skill('wit_crystal', 'CRISTAL SOBRECARGANDO', 'glitch', 'wit_crystal', 'COMUN',
    l => `+${l * 8}% tamaño y daño de orbes, -${l * 2}% velocidad.`,
    { projScale: .08, damage: .08, projSpeed: -.02 }, ['bigOrbs']),
  skill('wit_familiar', 'FAMILIAR ESPECTRAL', 'glitch', 'wit_familiar', 'EPICA',
    l => `Cristal flotante que dispara ${l} mini-orbes automáticos cada 1.4s.`,
    { familiar: 1 }, ['familiar'], { power: { every: 1.4, kind: 'familiar' } }),
  skill('wit_curse', 'MALDICIÓN DEBILITANTE', 'glitch', 'wit_curse', 'RARA',
    l => `Enemigos golpeados reciben +${l * 5}% daño extra durante 4s.`,
    { vulnerable: .05 }, ['weaken']),
  skill('wit_blink', 'TELETRANSPORTE EXPLOSIVO', 'glitch', 'wit_blink', 'COMUN',
    l => `El Dash explota al salir y al llegar (${10 + l * 10} daño).`,
    { blinkDmg: 10 }, ['blinkNova']),
  skill('wit_meteor', 'LLUVIA DE METEORITOS', 'glitch', 'wit_meteor', 'EPICA',
    l => `Cada ${(7 - l * .5).toFixed(1)}s caen ${l} meteoritos (${30 + l * 18} daño).`,
    { meteorDmg: 18 }, ['meteor'], { power: { every: 7, kind: 'meteor' } }),
  skill('wit_echo', 'ECO MÍSTICO', 'glitch', 'wit_echo', 'RARA',
    l => `${l * 6}% de que los orbes vuelvan como bumerán con doble daño.`,
    { echo: .06 }, ['echo'])
];

// ===========================================================================
// D. EL ROBOT — 10 exclusivas
// ===========================================================================
const ROBOT = [
  skill('bot_beam', 'RAYO PERFORADOR', 'vanta', 'bot_beam', 'RARA',
    l => `El láser atraviesa ${l + 1} filas completas de enemigos.`,
    { pierce: 1 }, ['piercingBeam']),
  skill('bot_drone', 'DRON DE COMBATE', 'vanta', 'bot_drone', 'EPICA',
    l => `Mini-dron que dispara ${l} láser(es) cada 0.9s al enemigo más cercano.`,
    { drone: 1 }, ['drone'], { power: { every: .9, kind: 'drone' } }),
  skill('bot_emp', 'GRANADA PEM', 'vanta', 'bot_emp', 'RARA',
    l => `Cada ${(8 - l * .5).toFixed(1)}s paraliza en ${3 + l}m durante ${(1 + l * .3).toFixed(1)}s.`,
    { empDmg: 8 }, ['emp'], { power: { every: 8, kind: 'emp' } }),
  skill('bot_overload', 'SOBRECARGA DE NÚCLEO', 'vanta', 'bot_overload', 'COMUN',
    l => `+${l * 8}% cadencia durante 3s tras ${Math.max(5, 15 - l)} bajas.`,
    { overloadHaste: .08 }, ['coreOverload']),
  skill('bot_split', 'LÁSER DIVIDIDO', 'vanta', 'bot_split', 'RARA',
    l => `El rayo se divide en ${l + 1} rayos secundarios en cono al impactar.`,
    { split: 1 }, ['splitLaser']),
  skill('bot_turret', 'TORRETA DESPLEGABLE', 'vanta', 'bot_turret', 'EPICA',
    l => `Coloca una torreta cada ${(15 - l).toFixed(0)}s que dispara ${8 + l * 7} daño.`,
    { turretDmg: 7 }, ['turret'], { power: { every: 15, kind: 'turret' } }),
  skill('bot_magnet', 'CAMPO MAGNÉTICO', 'vanta', 'bot_magnet', 'COMUN',
    l => `Los láseres empujan ${l * 20}% más lejos a los enemigos.`,
    { knockback: .2 }, ['magnetic']),
  skill('bot_missile', 'MISILES TÉRMICOS', 'vanta', 'bot_missile', 'RARA',
    l => `Cada ${Math.max(3, 6 - l)} disparos lanza ${Math.ceil(l / 2)} micro-misil(es) (${20 + l * 12}).`,
    { missileDmg: 12 }, ['missiles']),
  skill('bot_shield', 'ESCUDO DE ENERGÍA', 'vanta', 'bot_shield', 'RARA',
    l => `Escudo que absorbe ${l} golpe(s) cada ${(13 - l).toFixed(0)}s y explota al romperse.`,
    { shieldCharges: 1 }, ['energyShield']),
  skill('bot_cooling', 'ENFRIAMIENTO LÍQUIDO', 'vanta', 'bot_cooling', 'COMUN',
    l => `-${l * 3}% en todos los cooldowns.`,
    { cooldown: .03 }, ['cooling'])
];

// ===========================================================================
// E. EL VAMPIRO — 10 exclusivas
// ===========================================================================
const VAMPIRE = [
  skill('vam_bats', 'ENJAMBRE DE MURCIÉLAGOS', 'kira', 'vam_bats', 'EPICA',
    l => `${l + 1} murciélagos muerden (${6 + l * 5}) y vuelven curando ${1 + l} HP.`,
    { bats: 1, batDmg: 5 }, ['bats'], { power: { every: 2.2, kind: 'bats' } }),
  skill('vam_daggers', 'DAGAS VOLADORAS', 'kira', 'vam_daggers', 'COMUN',
    l => `Lanza ${l + 1} dagas carmesí (${8 + l * 6}) con cada corte.`,
    { daggers: 1 }, ['flyingDaggers']),
  skill('vam_pool', 'CHARCO DE SANGRE', 'kira', 'vam_pool', 'RARA',
    l => `Bajas dejan un charco ${2 + l}s que daña ${6 + l * 5}/s.`,
    { poolDps: 5 }, ['bloodPool']),
  skill('vam_overheal', 'SOBRECURACIÓN', 'kira', 'vam_overheal', 'RARA',
    l => `Curarte con vida llena genera ${8 + l * 7} de escudo carmesí.`,
    { overheal: 7 }, ['overheal']),
  skill('vam_frenzy', 'FRENESÍ SANGUÍNEO', 'kira', 'vam_frenzy', 'COMUN',
    l => `+${l}% cadencia por cada enemigo sangrando en pantalla.`,
    { hastePerBleed: .01 }, ['bloodFrenzy']),
  skill('vam_shadow', 'CORTE SOMBRÍO', 'kira', 'vam_shadow', 'COMUN',
    l => `+${l * 7}% alcance y +${l * 4}% cadencia con la daga.`,
    { area: .07, haste: .04 }, ['shadowCut']),
  skill('vam_mist', 'FORMA DE NIEBLA', 'kira', 'vam_mist', 'RARA',
    l => `El Dash atraviesa enemigos (${10 + l * 9} daño) y roba ${1 + l} HP por cada uno.`,
    { mistDmg: 9 }, ['mistForm']),
  skill('vam_stake', 'ESTACA EMPALADORA', 'kira', 'vam_stake', 'EPICA',
    l => `Cada ${Math.max(2, 5 - Math.floor(l / 2))}º ataque lanza una estaca (${25 + l * 18}) perforante.`,
    { stakeDmg: 18 }, ['stake']),
  skill('vam_pact', 'PACTO DE SANGRE', 'kira', 'vam_pact', 'RARA',
    l => `+${l * 7}% daño total, pero recibes +${l * 2}% de daño.`,
    { damage: .07, dmgTaken: .02 }, ['bloodPact']),
  skill('vam_burst', 'EXPLOSIÓN HEMÁTICA', 'kira', 'vam_burst', 'EPICA',
    l => `Enemigos sangrando explotan en 8 espinas (${10 + l * 9} daño).`,
    { burstDmg: 9 }, ['hematicBurst'])
];

// ===========================================================================
// F. 20 RELIQUIAS GENERALES  (type: 'relic', sin límite de slots)
// ===========================================================================
const RELICS = [
  relic('rel_magnet', 'IMÁN DE ALMAS', 'rel_magnet', 'COMUN',
    () => '+35% radio de recolección de XP y monedas.', { magnet: .35 }, ['soulMagnet']),
  relic('rel_mercury', 'BOTAS DE MERCURIO', 'rel_mercury', 'COMUN',
    () => '+12% velocidad de movimiento y -20% cooldown del Dash.',
    { speed: .12, dashCd: .2 }, ['mercuryBoots']),
  relic('rel_titan', 'CORAZÓN DE TITÁN', 'rel_titan', 'RARA',
    () => '+25 HP máxima y regeneración lenta de salud.',
    { maxHp: 25, regen: .8 }, ['titanHeart']),
  relic('rel_prism', 'PRISMA DIVISORIO', 'rel_prism', 'EPICA',
    () => '20% de probabilidad de duplicar cualquier proyectil u onda.',
    { dup: .2 }, ['splitPrism']),
  relic('rel_static', 'AURA ESTÁTICA', 'rel_static', 'RARA',
    () => 'Anillo eléctrico que daña enemigos cercanos cada segundo.',
    { staticDps: 12 }, ['staticAura'], { power: { every: 1, kind: 'staticAura' } }),
  relic('rel_vamp', 'VAMPIRISMO MENOR', 'rel_vamp', 'COMUN',
    () => '5% de curar 2 HP al eliminar enemigos.', { healOnKill: .05 }, ['minorVamp']),
  relic('rel_berserk', 'FURIA BERSERKER', 'rel_berserk', 'RARA',
    () => '+15% cadencia cuando la salud está por debajo del 50%.',
    { lowHpHaste: .15 }, ['berserkerFury']),
  relic('rel_orbital', 'ESCUDO ORBITAL', 'rel_orbital', 'EPICA',
    () => 'Orbes giratorios bloquean proyectiles y empujan enemigos.',
    { orbital: 1 }, ['orbitalShield']),
  relic('rel_echo', 'ECO EXPLOSIVO', 'rel_echo', 'RARA',
    () => '15% de que los enemigos exploten al morir (35 daño en área).',
    { explode: .15, killExplodeDmg: 35 }, ['explosiveEcho']),
  relic('rel_greed', 'CODICIA DORADA', 'rel_greed', 'COMUN',
    () => '+20% XP y mayor probabilidad de cofres.',
    { xp: .2, chest: .15 }, ['goldenGreed']),
  relic('rel_hourglass', 'RELOJ DE ARENA ROTO', 'rel_hourglass', 'RARA',
    () => 'Al recibir daño, ralentiza enemigos cercanos 50% durante 2.5s.',
    { slowOnHurt: 2.5 }, ['brokenHourglass']),
  relic('rel_bag', 'BOLSA SIN FONDO', 'rel_bag', 'COMUN',
    () => '+1% de daño por cada 25 monedas acumuladas (máx +40%).',
    { goldDamage: .01 }, ['bottomlessBag']),
  relic('rel_thrusters', 'BOTAS PROPULSORAS', 'rel_thrusters', 'RARA',
    () => 'El Dash deja un rastro de fuego que quema enemigos.',
    { trailDps: 14 }, ['thrusterBoots']),
  relic('rel_amulet', 'AMULETO DEL MAESTRO', 'rel_amulet', 'EPICA',
    () => '+20% probabilidad de cartas raras, épicas y sinergias.',
    { rare: .2 }, ['masterAmulet']),
  relic('rel_whetstone', 'PIEDRA DE AFILAR', 'rel_whetstone', 'RARA',
    () => 'Cada 5º ataque es un golpe crítico garantizado.',
    { guaranteedCrit: 5 }, ['whetstone']),
  relic('rel_scrap', 'IMÁN DE CHATARRERO', 'rel_scrap', 'COMUN',
    () => 'Abrir cofres libera 6 proyectiles perforantes en círculo.',
    { scrapBurst: 6 }, ['scrapMagnet']),
  relic('rel_thorns', 'CORAZA DE ESPINAS', 'rel_thorns', 'RARA',
    () => 'Devuelve 150% del daño recibido a atacantes cuerpo a cuerpo.',
    { thorns: 1.5 }, ['thornMail']),
  relic('rel_totem', 'TÓTEM DE FURIA', 'rel_totem', 'EPICA',
    () => 'Quedarse quieto 1.5s activa +35% daño y cadencia.',
    { idleBonus: .35 }, ['furyTotem']),
  relic('rel_mirror', 'ESPEJO ARCANO', 'rel_mirror', 'RARA',
    () => '15% de reflejar proyectiles enemigos con doble daño.',
    { reflect: .15 }, ['arcaneMirror']),
  relic('rel_core', 'NÚCLEO DE SOBRECARGA', 'rel_core', 'EPICA',
    () => 'Subir de nivel o abrir cofres desata una explosión eléctrica aturdidora.',
    { coreBurst: 45 }, ['overloadCore'])
];

// ===========================================================================
// G. 10 PACTOS MALDITOS  (type: 'pact_relic', borde carmesí)
// ===========================================================================
const PACTS = [
  pact('pct_glass', 'PACTO DEL CAÑÓN DE CRISTAL', 'pct_glass',
    '-50% SALUD MÁXIMA · PROHÍBE ESCUDOS',
    '+200% daño total.', { damage: 2.0 }, { maxHpMult: -.5, noShields: 1 }, ['glassCannon']),
  pact('pct_greed', 'PACTO DE LA AVARICIA SANGRIENTA', 'pct_greed',
    'ENEMIGOS +25% VELOCIDAD',
    '+100% oro y XP obtenida.', { xp: 1, gold: 1 }, { enemySpeed: .25 }, ['bloodyGreed']),
  pact('pct_blind', 'PACTO DEL BERSERKER CIEGO', 'pct_blind',
    '-30% ALCANCE DE ARMAS Y PROYECTILES',
    '+60% cadencia de ataque.', { haste: .6 }, { range: -.3 }, ['blindBerserker']),
  pact('pct_death', 'PACTO DE LA MUERTE SÚBITA', 'pct_death',
    'DESACTIVA CURACIÓN PASIVA Y ORBES DE VIDA',
    '+35% probabilidad de crítico.', { crit: .35 }, { noHeal: 1 }, ['suddenDeath']),
  pact('pct_giant', 'PACTO DEL GIGANTE LENTO', 'pct_giant',
    '-25% VELOCIDAD DE MOVIMIENTO',
    '+100% tamaño y área de efecto de armas y habilidades.',
    { area: 1, projScale: 1 }, { speed: -.25 }, ['slowGiant']),
  pact('pct_unstable', 'PACTO DE LA SOBRECARGA INESTABLE', 'pct_unstable',
    'ACTIVAR HABILIDADES CONSUME 2 HP (MÍNIMO 1 HP)',
    '-50% en todos los cooldowns.', { cooldown: .5 }, { spellCost: 2 }, ['unstableOverload']),
  pact('pct_solitary', 'PACTO DEL SOLITARIO', 'pct_solitary',
    'BLOQUEA 2 DE LOS 6 SLOTS DE HABILIDADES',
    '+50% daño base.', { damage: .5 }, { slotLock: 2 }, ['solitary']),
  pact('pct_chaos', 'PACTO DEL CAOS ELEMENTAL', 'pct_chaos',
    'DISPERSIÓN ALEATORIA EN LOS DISPAROS',
    'Cada golpe aplica Fuego, Veneno, Rayo o Sangrado aleatorio.',
    { elemental: 1 }, { spread: .06 }, ['elementalChaos']),
  pact('pct_collector', 'PACTO DEL COLECCIONISTA MALDITO', 'pct_collector',
    'ÉLITES +100% DE SALUD',
    '+15% daño por cada Reliquia/Pacto equipado.',
    { collector: .15 }, { eliteHp: 1 }, ['cursedCollector']),
  pact('pct_phoenix', 'PACTO DEL FÉNIX OSCURO', 'pct_phoenix',
    '+20% DE DAÑO RECIBIDO SIEMPRE',
    'Revive una vez por mundo al morir con 50% HP y onda explosiva.',
    { phoenix: 1 }, { dmgTaken: .2 }, ['darkPhoenix'])
];

// ===========================================================================
// SINERGIAS — 2 requisitos cada una; el cofre las otorga AUTOMÁTICAMENTE
// ===========================================================================
export const SYNERGIES = Object.freeze([
  { id: 'syn_plague', name: 'PLAGA VIRAL', hero: 'seraph', type: 'synergy',
    req: ['arr_bounce', 'arr_venom'], icon: 'syn_plague', rarity: 'SINERGIA',
    theme: 'arrow',
    desc: 'Las flechas rebotan infinitamente entre enemigos envenenados dejando nubes tóxicas.',
    mods: { bounce: 99, poisonDps: 4, poisonCloud: 1 },
    flags: ['plagueViral'], sfx: SFX.synergy, particle: pfx('arrow') },
  { id: 'syn_magma', name: 'CICLÓN DE MAGMA', hero: 'ronin', type: 'synergy',
    req: ['bar_whirl', 'bar_ember'], icon: 'syn_magma', rarity: 'SINERGIA',
    theme: 'blade',
    desc: 'Todos los ataques son giros de 360° que disparan bolas de fuego en todas direcciones.',
    mods: { whirlDmg: 40, fireball: 1 }, flags: ['magmaCyclone'],
    sfx: SFX.synergy, particle: pfx('blade') },
  { id: 'syn_tesla', name: 'TORMENTA TESLA', hero: 'glitch', type: 'synergy',
    req: ['wit_seek', 'wit_chain'], icon: 'syn_tesla', rarity: 'SINERGIA',
    theme: 'magic',
    desc: 'Los orbes se conectan con rayos láser continuos que electrocutan todo lo que cruzan.',
    mods: { chain: 4, teslaDps: 22 }, flags: ['teslaStorm'],
    sfx: SFX.synergy, particle: pfx('magic') },
  { id: 'syn_prism', name: 'PRISMA ORBITAL', hero: 'vanta', type: 'synergy',
    req: ['bot_beam', 'bot_split'], icon: 'syn_prism', rarity: 'SINERGIA',
    theme: 'scifi',
    desc: 'Haz láser continuo grueso que refracta decenas de rayos secundarios por la pantalla.',
    mods: { prismBeam: 1, split: 6 }, flags: ['orbitalPrism'],
    sfx: SFX.synergy, particle: pfx('scifi') },
  { id: 'syn_night', name: 'SEÑOR DE LA NOCHE', hero: 'kira', type: 'synergy',
    req: ['vam_bats', 'vam_overheal'], icon: 'syn_night', rarity: 'SINERGIA',
    theme: 'creature',
    desc: 'Aura permanente de murciélagos drena vida y lanza ondas de sangre.',
    mods: { nightAura: 1, bats: 3, lifesteal: 2 }, flags: ['nightLord'],
    sfx: SFX.synergy, particle: pfx('creature') }
]);

// ===========================================================================
// MEJORAS DE ESTADÍSTICAS BASE — ÚNICO contenido del menú de fin de ronda.
// No son parte del catálogo de 80: son incrementos directos al `state`.
// ===========================================================================
export const STAT_UPGRADES = Object.freeze([
  { id: 'stat_strength', name: '+FUERZA', icon: 'stat_strength', color: '#e0705a',
    desc: '+8% de daño con todas las armas y habilidades.', apply: s => { s.damage *= 1.08; } },
  { id: 'stat_firerate', name: '+VELOCIDAD DE ATAQUE', icon: 'stat_firerate', color: '#e6c464',
    desc: '+7% de cadencia de disparo y cuerpo a cuerpo.', apply: s => { s.fireRate *= .93; } },
  { id: 'stat_hp', name: '+VIDA MÁXIMA', icon: 'stat_hp', color: '#7fd08a',
    desc: '+18 HP máxima y cura esa misma cantidad.', apply: s => { s.maxHp += 18; s.hp = Math.min(s.maxHp, s.hp + 18); } },
  { id: 'stat_speed', name: '+VELOCIDAD DE MOVIMIENTO', icon: 'stat_speed', color: '#6dc9e8',
    desc: '+6% de velocidad de movimiento.', apply: s => { s.speed *= 1.06; } },
  { id: 'stat_luck', name: '+SUERTE', icon: 'stat_luck', color: '#bd93ef',
    desc: '+3% de probabilidad de crítico.', apply: s => { s.critChance = Math.min(.85, s.critChance + .03); } }
]);

// ===========================================================================
// EXPORTACIONES
// ===========================================================================
export const SKILLS = Object.freeze([...ARCHER, ...BARBARIAN, ...WITCH, ...ROBOT, ...VAMPIRE]);
export const RELIC_LIST = Object.freeze(RELICS);
export const PACT_LIST = Object.freeze(PACTS);
export const ALL_ITEMS = Object.freeze([...SKILLS, ...RELICS, ...PACTS, ...SYNERGIES]);
export const ITEMS_BY_ID = Object.freeze(Object.fromEntries(ALL_ITEMS.map(i => [i.id, i])));

export const itemById = id => ITEMS_BY_ID[id] || null;
export const skillsFor = hero => SKILLS.filter(s => s.hero === hero);
export const synergyFor = hero => SYNERGIES.find(s => s.hero === hero) || null;
export const synergyReady = (syn, skillLevels) => syn.req.every(id => (skillLevels[id] || 0) > 0);
export const baseStatById = id => STAT_UPGRADES.find(s => s.id === id) || null;

// Descripción resuelta para una carta: `level` es el nivel que TENDRÁ tras
// elegirla (1 = nueva). Las reliquias/pactos describen el efecto y la maldición.
export function describe(item, level = 1) {
  if (typeof item.desc === 'function') return item.desc(Math.max(1, level));
  return item.desc;
}

// Rareza efectiva para el borde de la carta (CSS), por clase y tipo.
export function cardColor(item, hero) {
  if (item.type === 'pact_relic') return RARITY.MALDITO.color;
  if (item.type === 'synergy') return RARITY.SINERGIA.color;
  if (item.rarity && RARITY[item.rarity]) return RARITY[item.rarity].color;
  return hero ? HERO_THEME[hero]?.color : RARITY.COMUN.color;
}

// Catálogo para diagnósticos / QC.
export function catalogDiagnostics() {
  const byType = { skill: 0, relic: 0, pact_relic: 0, synergy: 0 };
  const byHero = {};
  for (const i of ALL_ITEMS) {
    byType[i.type] = (byType[i.type] || 0) + 1;
    if (i.type === 'skill') byHero[i.hero] = (byHero[i.hero] || 0) + 1;
  }
  return { total: ALL_ITEMS.length, byType, byHero, synergies: SYNERGIES.length,
           baseStats: STAT_UPGRADES.length, maxSlots: MAX_SLOTS, maxLevel: MAX_LEVEL };
}
