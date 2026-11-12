// NEON//REVENANT — ARSENAL DE INTERFERENCIA
// Capa de construcción de build al estilo de los mejores roguelites del género:
//   · MÓDULOS apilables por FAMILIA (sinergia horizontal, no solo números).
//   · RESONANCIAS: reunir niveles de una familia enciende bonificaciones de set.
//   · EVOLUCIONES: un arma + su módulo saturado se transforma en otra arma.
//   · ÉLITES con AFIJOS: cada élite impone una regla distinta al combate.
//   · PACTO DE INTERFERENCIA: riesgo explícito a cambio de potencia real.
// Todo el texto está en la voz del juego (señal, interferencia, sector).

// ---------------------------------------------------------------------------
// Familias: el color identifica la familia en el HUD y en el botín.
export const FAMILIES = {
  pulso:   { id: 'pulso',   name: 'PULSO',   icon: '✦', color: '#ff4d38', desc: 'Daño bruto y penetración de blindaje.' },
  flujo:   { id: 'flujo',   name: 'FLUJO',   icon: '»', color: '#ffbf47', desc: 'Cadencia, movimiento y recarga.' },
  coraza:  { id: 'coraza',  name: 'CORAZA',  icon: '⛨', color: '#6ef7e7', desc: 'Aguantar el sector sin ceder terreno.' },
  sistema: { id: 'sistema', name: 'SISTEMA', icon: '⚡', color: '#b56bff', desc: 'Sobrecarga, habilidades y tempo.' },
  bio:     { id: 'bio',     name: 'BIO',     icon: '✚', color: '#b6ff3d', desc: 'Vida, regeneración y drenaje.' },
  ruido:   { id: 'ruido',   name: 'RUIDO',   icon: '◈', color: '#9ff7ff', desc: 'Críticos, azar y datos sucios.' }
};

// ---------------------------------------------------------------------------
// Módulos: se acumulan nivel a nivel. `apply` se llama UNA vez por nivel.
export const MODULES = [
  // ---- PULSO ---------------------------------------------------------------
  {
    id: 'filo', name: 'FILO DE DATOS', family: 'pulso', icon: '✦', rarity: 'COMÚN', max: 6,
    desc: '+14% de daño de pulso por nivel.',
    how: 'Reescribe la firma del proyectil: cada nivel añade daño puro. La base de cualquier build ofensiva.',
    apply: s => { s.damage *= 1.14; }
  },
  {
    id: 'perf', name: 'PERFORADOR', family: 'pulso', icon: '➶', rarity: 'RARA', max: 3,
    desc: '+1 enemigo atravesado y +8% de daño por nivel.',
    how: 'Alinea el núcleo del arma con la trayectoria: los disparos siguen de largo tras el primer impacto.',
    apply: s => { s.pierceBonus += 1; s.damage *= 1.08; }
  },
  {
    id: 'detonador', name: 'DETONADOR', family: 'pulso', icon: '✹', rarity: 'ÉPICA', max: 3,
    desc: 'Cada baja tiene 18% (+12% por nivel) de provocar una detonación en cadena.',
    how: 'El hostil cae, pero su núcleo sigue cargado: revienta y arrastra a los que estén cerca.',
    apply: s => { s.killExplode = Math.min(.72, (s.killExplode || 0) + .18); }
  },
  // ---- FLUJO ---------------------------------------------------------------
  {
    id: 'turbo', name: 'TURBO DE FASE', family: 'flujo', icon: '»', rarity: 'COMÚN', max: 5,
    desc: '+9% de velocidad de movimiento por nivel.',
    how: 'Los servos trabajan por encima de su especificación. Moverse más es recibir menos.',
    apply: s => { s.speed *= 1.09; }
  },
  {
    id: 'gatillo', name: 'GATILLO FANTASMA', family: 'flujo', icon: '⇶', rarity: 'RARA', max: 5,
    desc: '+11% de cadencia por nivel.',
    how: 'El percutor deja de esperar al dedo. Cada nivel acorta el ciclo de disparo.',
    apply: s => { s.fireRate *= .89; }
  },
  {
    id: 'recarga', name: 'RECARGA CINÉTICA', family: 'flujo', icon: '▮', rarity: 'RARA', max: 4,
    desc: '-14% de tiempo de recarga y +6 de cargador por nivel.',
    how: 'El cargador se eyecta con la inercia del propio movimiento. Recargar deja de ser una pausa.',
    apply: s => { s.reloadMult = (s.reloadMult || 1) * .86; s.baseAmmo += 6; }
  },
  // ---- CORAZA --------------------------------------------------------------
  {
    id: 'placa', name: 'PLACA REACTIVA', family: 'coraza', icon: '⛨', rarity: 'COMÚN', max: 5,
    desc: '-7% de daño recibido por nivel.',
    how: 'Cerámica que se endurece al impacto. Se acumula de forma multiplicativa: nunca llega a cero.',
    apply: s => { s.damageTaken *= .93; }
  },
  {
    id: 'barrera', name: 'BARRERA DE FASE', family: 'coraza', icon: '◈', rarity: 'RARA', max: 4,
    desc: '+35 de escudo máximo por nivel y recarga inmediata.',
    how: 'Una piel de energía que absorbe el daño antes que la carne. Se regenera sola tras unos segundos sin golpes.',
    apply: s => { s.maxShield += 35; s.shield = s.maxShield; }
  },
  {
    id: 'retro', name: 'RETROALIMENTACIÓN', family: 'coraza', icon: '⟲', rarity: 'ÉPICA', max: 3,
    desc: 'Al recibir daño: +14% de cadencia durante 4 s por nivel. Se acumula.',
    how: 'El dolor se convierte en señal. Cuanto más te pegan, más rápido disparas.',
    apply: s => { s.retaliate = (s.retaliate || 0) + .14; }
  },
  // ---- SISTEMA -------------------------------------------------------------
  {
    id: 'bateria', name: 'BATERÍA DE SOBRECARGA', family: 'sistema', icon: '⚡', rarity: 'RARA', max: 4,
    desc: '+22% de carga de sobrecarga por nivel.',
    how: 'El condensador acepta más tensión: la sobrecarga llega antes y se usa más veces por ronda.',
    apply: s => { s.chargeMult *= 1.22; }
  },
  {
    id: 'nucleo', name: 'NÚCLEO TEMPORAL', family: 'sistema', icon: '◴', rarity: 'ÉPICA', max: 3,
    desc: '+1.6 s de duración de sobrecarga por nivel.',
    how: 'Estira el instante en el que el mundo va lento y tú no.',
    apply: s => { s.overdriveDuration += 1.6; }
  },
  {
    id: 'eco', name: 'ECO DE HABILIDAD', family: 'sistema', icon: '⌁', rarity: 'RARA', max: 4,
    desc: '-12% de recarga de las habilidades automáticas por nivel.',
    how: 'Las habilidades orbitales y los satélites repiten su ciclo antes. Se nota en todo el arsenal pasivo.',
    apply: s => { s.abilityHaste = (s.abilityHaste || 1) * .88; }
  },
  // ---- BIO -----------------------------------------------------------------
  {
    id: 'nano', name: 'NANOENJAMBRE', family: 'bio', icon: '✚', rarity: 'COMÚN', max: 5,
    desc: '+1.8 de regeneración por segundo por nivel.',
    how: 'Micro-reparadores en el torrente. Regenera escudo primero y vida cuando el escudo está lleno.',
    apply: s => { s.regen += 1.8; }
  },
  {
    id: 'tejido', name: 'TEJIDO SINTÉTICO', family: 'bio', icon: '♥', rarity: 'COMÚN', max: 5,
    desc: '+24 de vida máxima y cura 24 al instalarlo.',
    how: 'Malla viva que sustituye lo que la ciudad te arrancó. Cada nivel aguanta un impacto más.',
    apply: s => { s.maxHp += 24; s.hp = Math.min(s.maxHp, s.hp + 24); }
  },
  {
    id: 'drenaje', name: 'DRENAJE SIMPÁTICO', family: 'bio', icon: '❥', rarity: 'ÉPICA', max: 4,
    desc: '+3 de vida por baja, y +25% de curación por baja por nivel.',
    how: 'Cada señal apagada te devuelve un poco de integridad. Con builds de área se convierte en una fuente infinita.',
    apply: s => { s.lifeOnKill += 3; s.healMult = (s.healMult || 1) * 1.25; }
  },
  // ---- RUIDO ---------------------------------------------------------------
  {
    id: 'oraculo', name: 'VISOR ORÁCULO', family: 'ruido', icon: '◉', rarity: 'RARA', max: 4,
    desc: '+5% de crítico y +0.2 de multiplicador de headshot por nivel.',
    how: 'El visor calcula el punto débil antes de que exista. Convierte la puntería en daño real.',
    apply: s => { s.critChance += .05; s.headshotMult += .2; }
  },
  {
    id: 'caos', name: 'CAOS PROGRAMADO', family: 'ruido', icon: '☣', rarity: 'ÉPICA', max: 3,
    desc: '+18% de daño, pero +6% de daño recibido por nivel.',
    how: 'Un módulo que no debería estar en tu armadura. Rompe el equilibrio a tu favor... casi siempre.',
    apply: s => { s.damage *= 1.18; s.damageTaken *= 1.06; }
  },
  {
    id: 'suerte', name: 'PROBABILIDAD SESGADA', family: 'ruido', icon: '◆', rarity: 'RARA', max: 4,
    desc: '+40% de chips de datos por nivel y +4% de puntuación.',
    how: 'El sector empieza a soltar datos de más. Nada de eso es gratis: alguien lo está pagando.',
    apply: s => { s.chipMult += .4; s.buildScore = (s.buildScore || 1) * 1.04; }
  }
];

export function moduleById(id) { return MODULES.find(m => m.id === id) || null; }

// ---------------------------------------------------------------------------
// Resonancias: se encienden al acumular NIVELES TOTALES de una familia.
// t1 a 4 niveles, t2 a 8 niveles. Cada familia tiene un carácter propio.
export const RESONANCES = {
  pulso: {
    color: '#ff4d38', name: 'CADENA DE PULSO',
    t1: { at: 4, name: 'CADENA DE PULSO', desc: '+15% de daño y las bajas pueden detonar (20%).', apply: s => { s.damage *= 1.15; s.killExplode = Math.max(s.killExplode || 0, .2); } },
    t2: { at: 8, name: 'SATURACIÓN TOTAL', desc: '+30% de daño y +3 de perforación.', apply: s => { s.damage *= 1.3; s.pierceBonus += 3; } }
  },
  flujo: {
    color: '#ffbf47',
    t1: { at: 4, name: 'FLUJO CONSTANTE', desc: '+10% de cadencia y +8% de velocidad.', apply: s => { s.fireRate *= .9; s.speed *= 1.08; } },
    t2: { at: 8, name: 'MODO DESLIZAMIENTO', desc: 'Recarga -30% y el dash se recupera 30% antes.', apply: s => { s.reloadMult = (s.reloadMult || 1) * .7; s.dashRecovery *= .7; } }
  },
  coraza: {
    color: '#6ef7e7',
    t1: { at: 4, name: 'CHASIS REFORZADO', desc: '+40 de escudo máximo y -8% de daño recibido.', apply: s => { s.maxShield += 40; s.shield = s.maxShield; s.damageTaken *= .92; } },
    t2: { at: 8, name: 'BALUARTE', desc: '-20% de daño recibido y el escudo se regenera el doble de rápido.', apply: s => { s.damageTaken *= .8; s.shieldRegen = (s.shieldRegen || 1) * 2; } }
  },
  sistema: {
    color: '#b56bff',
    t1: { at: 4, name: 'BUCLE ABIERTO', desc: '+25% de carga de sobrecarga y -10% de recarga de habilidades.', apply: s => { s.chargeMult *= 1.25; s.abilityHaste = (s.abilityHaste || 1) * .9; } },
    t2: { at: 8, name: 'SINGULARIDAD', desc: 'La sobrecarga dura +3 s y otorga +20% de daño.', apply: s => { s.overdriveDuration += 3; s.overdriveDamage = (s.overdriveDamage || 1.25) + .2; } }
  },
  bio: {
    color: '#b6ff3d',
    t1: { at: 4, name: 'SIMBIOSIS', desc: '+3 de vida por baja y +2/s de regeneración.', apply: s => { s.lifeOnKill += 3; s.regen += 2; } },
    t2: { at: 8, name: 'CARNE INFINITA', desc: '+60 de vida máxima y la regeneración no se interrumpe al recibir daño.', apply: s => { s.maxHp += 60; s.hp = Math.min(s.maxHp, s.hp + 60); s.regenAlways = true; } }
  },
  ruido: {
    color: '#9ff7ff',
    t1: { at: 4, name: 'SEÑAL SUCIA', desc: '+10% de crítico y +50% de chips.', apply: s => { s.critChance += .1; s.chipMult += .5; } },
    t2: { at: 8, name: 'RUIDO BLANCO', desc: 'Los críticos detonan y +30% de puntuación.', apply: s => { s.critExplode = true; s.buildScore = (s.buildScore || 1) * 1.3; } }
  }
};

// ---------------------------------------------------------------------------
// BENDICIONES del arma única: saturar un don clave potencia el arma que el
// héroe ya empuña (+18% daño, +10% cadencia). Antes cada entrada sustituía un
// arma intercambiable por otra (`base` / `out`); ese catálogo se eliminó junto
// con el arsenal de botín, así que aquí solo queda el disparador y el nombre.
export const EVOLUTIONS = [
  { id: 'singularidad', need: 'perf', color: '#6ef7e7', name: 'SINGULARIDAD',
    desc: 'El arma única gana +18% de daño y +10% de cadencia permanentes durante la incursión.' },
  { id: 'ruptor', need: 'gatillo', color: '#ff4d38', name: 'RUPTOR DE FASE',
    desc: 'El arma única gana +18% de daño y +10% de cadencia permanentes durante la incursión.' },
  { id: 'trueno', need: 'detonador', color: '#ffbf47', name: 'TRUENO ORBITAL',
    desc: 'El arma única gana +18% de daño y +10% de cadencia permanentes durante la incursión.' },
  { id: 'riego', need: 'recarga', color: '#ffbf47', name: 'RIEGO INFINITO',
    desc: 'El arma única gana +18% de daño y +10% de cadencia permanentes durante la incursión.' },
  { id: 'enjambre', need: 'oraculo', color: '#9ff7ff', name: 'ENJAMBRE AA',
    desc: 'El arma única gana +18% de daño y +10% de cadencia permanentes durante la incursión.' }
];

// ---------------------------------------------------------------------------
// EVOLUCIONES DE HABILIDAD: al saturar una habilidad, la siguiente mejora la
// TRANSFORMA. Cambian el comportamiento, no solo el número (Vampire Survivors).
// `flag` se consulta con hasEvo(base) desde game.js.
export const ABILITY_EVOLUTIONS = [
  { id:'evo_orbit',        base:'orbit',        name:'GUADAÑA ESPECTRAL',  icon:'✧', color:'#6ef7e7', flag:'orbit',
    desc:'Las hojas se funden en una guadaña doble: +1 cuchilla, +80% de daño y radio ampliado.' },
  { id:'evo_tesla',        base:'tesla',        name:'TORMENTA IÓNICA',    icon:'⚡', color:'#9ff7ff', flag:'tesla',
    desc:'Cada descarga salta a +3 objetivos y deja a los tocados aturdidos un segundo.' },
  { id:'evo_frost',        base:'frost',        name:'INVIERNO ABSOLUTO',  icon:'❄', color:'#8fdfff', flag:'frost',
    desc:'La escarcha congela en seco: los ralentizados reciben +30% de daño de tus disparos.' },
  { id:'evo_aura',         base:'aura',         name:'SINGULARIDAD',       icon:'◈', color:'#b56bff', flag:'aura',
    desc:'El aura del vacío ATRAE a los hostiles hacia ti mientras los desintegra.' },
  { id:'evo_mines',        base:'mines',        name:'MINAS DE FUSIÓN',    icon:'◉', color:'#ffbf47', flag:'mines',
    desc:'Las minas dejan un charco incendiario y pueden activarse 2 más a la vez.' },
  { id:'evo_swarm',        base:'swarm',        name:'ENJAMBRE ALFA',      icon:'⋔', color:'#b56bff', flag:'swarm',
    desc:'Dos drones adicionales y tus drones disparan al objetivo marcado más dañino.' },
  { id:'evo_dashwave',     base:'dashwave',     name:'ONDA GRAVITATORIA',  icon:'⌁', color:'#ff4d38', flag:'dashwave',
    desc:'El pulso del dash SUCCIONA primero a los hostiles y después explota el doble.' },
  { id:'evo_deathexplode', base:'deathexplode', name:'REACCIÓN TOTAL',     icon:'✹', color:'#ff4d38', flag:'deathexplode',
    desc:'Todas las explosiones encadenan sin límite cercano y pegan un 40% más.' },
  { id:'evo_beam',         base:'beam',         name:'JUICIO ORBITAL',     icon:'⩙', color:'#6ef7e7', flag:'beam',
    desc:'El satélite dispara tres haces simultáneos y cura 15 por impacto.' },
  { id:'evo_regen',        base:'regen',        name:'SIMBIOSIS',          icon:'✚', color:'#6ef7e7', flag:'regen',
    desc:'La regeneración puede sobrecurarte: hasta +40 de escudo temporal extra.' },
  { id:'evo_chrono',       base:'chrono',       name:'DISTORSIÓN PERMANENTE', icon:'◴', color:'#b56bff', flag:'chrono',
    desc:'Fuera de sobrecarga los hostiles ya van al 85%; dentro, al 45%.' },
  { id:'evo_turret',       base:'turret',       name:'BATERÍA GÉMINIS',    icon:'⌂', color:'#ffbf47', flag:'turret',
    desc:'Despliegas DOS torretas gemelas con cadencia un 60% más rápida.' },
  { id:'evo_meteor',       base:'meteor',       name:'ÉPOCA DE METEOROS',  icon:'☄', color:'#ff4d38', flag:'meteor',
    desc:'Nueve impactos orbitales, radio mayor y cada bombardeo golpea un 30% más fuerte.' },
  { id:'evo_ghost',        base:'ghost',        name:'CORO ESPECTRAL',     icon:'❖', color:'#b56bff', flag:'ghost',
    desc:'El señuelo proyecta un coro de tres espectros que succionan con más fuerza y detona un 40% más fuerte.' },
  { id:'evo_spiral',       base:'spiral',       name:'ROSA ETERNA',        icon:'✺', color:'#6ef7e7', flag:'spiral',
    desc:'Cuatro brazos que nunca se apagan: la espiral rota de forma permanente y pega un 25% más.' },
  { id:'evo_chain',        base:'chain',        name:'HILERA INFINITA',    icon:'⛓', color:'#9ff7ff', flag:'chain',
    desc:'El arco salta al doble de objetivos y recupera daño en vez de perderlo.' },
  { id:'evo_singularity',  base:'singularity',  name:'COLAPSO DE EVENTO',  icon:'◍', color:'#b56bff', flag:'singularity',
    desc:'El pozo se queda abierto: arrastra de forma continua y implosiona dos veces.' },
  { id:'evo_spikes',       base:'spikes',       name:'CORONA DEL MÁRTIR',  icon:'✳', color:'#ff4d38', flag:'spikes',
    desc:'Las espinas erupcionan en dos anillos y devuelven el daño como escudo.' },
  { id:'evo_rain',         base:'rain',         name:'DILUVIO',            icon:'☄', color:'#ffbf47', flag:'rain',
    desc:'La lluvia cae en espiral sobre ti de forma continua durante 6 segundos.' },
  { id:'evo_echo',         base:'echo',         name:'CÁMARA DE RESONANCIA', icon:'⌁', color:'#9ff7ff', flag:'echo',
    desc:'Cada réplica genera a su vez otra réplica más débil. El eco se multiplica.' },
  { id:'evo_harvest',      base:'harvest',      name:'SEGADORA',           icon:'⌾', color:'#ff4d38', flag:'harvest',
    desc:'El umbral de ejecución sube al 35% y cada ejecución reinicia el dash.' }
];
export function abilityEvolution(base) { return ABILITY_EVOLUTIONS.find(e => e.base === base) || null; }

// ---------------------------------------------------------------------------
// Afijos de élite. Un élite siempre lleva UNO; los de ronda alta pueden llevar dos.
export const AFFIXES = [
  {
    id: 'igneo', name: 'ÍGNEO', color: 0xff6a3d, hex: '#ff6a3d',
    desc: 'Al morir detona. Mientras vive, su contacto quema.',
    hp: 1.9, dmg: 1.2, speed: 1.02,
    onDeath: (e, api) => api.explode(e.group.position.clone().add(new api.V3(0, 1, 0)), 6.5, 120 + api.wave * 22, 0xff6a3d)
  },
  {
    id: 'gelido', name: 'GÉLIDO', color: 0x8fdfff, hex: '#8fdfff',
    desc: 'Sus golpes te ralentizan. Aguanta mucho más daño.',
    hp: 2.3, dmg: 1.05, speed: .92,
    onHit: (e, api) => api.slowPlayer(1.6, .55)
  },
  {
    id: 'voltaico', name: 'VOLTAICO', color: 0x9ff7ff, hex: '#9ff7ff',
    desc: 'Muy rápido y descarga un arco eléctrico al golpear.',
    hp: 1.7, dmg: 1.1, speed: 1.3,
    onHit: (e, api) => api.arc(e, 3)
  },
  {
    id: 'blindado', name: 'BLINDADO', color: 0xffbf47, hex: '#ffbf47',
    desc: 'Placas extra: hay que romperlas antes de hacer daño real.',
    hp: 2.6, dmg: 1.15, speed: .88,
    onSpawn: (e) => { e.armor = (e.armor || 0) + e.maxHp * .8; e.armorMax = e.armor; }
  },
  {
    id: 'vacio', name: 'VACÍO', color: 0xb56bff, hex: '#b56bff',
    desc: 'Se teletransporta y al caer deja una grieta que quema el suelo.',
    hp: 2.1, dmg: 1.25, speed: 1.05,
    onDeath: (e, api) => api.hazard(e.group.position.clone(), 4.2, 7, 16 + api.wave * 3, 0xb56bff),
    onTick: (e, api, dt) => {
      e.blink = (e.blink || 3) - dt;
      if (e.blink <= 0 && !e.dead && e.spawn <= 0) {
        e.blink = 5 + Math.random() * 3;
        const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 4;
        api.blink(e, Math.cos(a) * r, Math.sin(a) * r);
      }
    }
  }
];
export function affixById(id) { return AFFIXES.find(a => a.id === id) || null; }

// ---------------------------------------------------------------------------
// Pactos: se ofrecen al cerrar ronda. Potencia real con un precio real.
export const PACTS = [
  {
    id: 'frenesi', name: 'PACTO DEL FRENESÍ', icon: '⇶', color: '#ff4d38', curse: 'VIDA MÁXIMA -20%',
    desc: '+35% de cadencia permanente.',
    how: 'El sistema nervioso va por delante del cuerpo. Disparas antes de decidir, y eso también te cuesta carne.',
    apply: s => { s.fireRate *= .65; s.maxHp = Math.max(60, Math.round(s.maxHp * .8)); s.hp = Math.min(s.hp, s.maxHp); },
    score: 1.15
  },
  {
    id: 'hambre', name: 'PACTO DEL HAMBRE', icon: '✹', color: '#b56bff', curse: 'SIN CURACIÓN POR BAJA',
    desc: '+30% de daño permanente.',
    how: 'Dejas de repararte para golpear más fuerte. El sector te devuelve el favor con intereses.',
    apply: s => { s.damage *= 1.3; s.lifeOnKill = 0; s.regen *= .4; },
    score: 1.2
  },
  {
    id: 'cristal', name: 'PACTO DE CRISTAL', icon: '◈', color: '#9ff7ff', curse: 'DAÑO RECIBIDO +30%',
    desc: '+45% de daño y +15% de crítico.',
    how: 'Tu armadura se vuelve vidrio: hiere como nada, pero cualquier golpe te atraviesa.',
    apply: s => { s.damage *= 1.45; s.critChance += .15; s.damageTaken *= 1.3; },
    score: 1.3
  },
  {
    id: 'senal', name: 'PACTO DE SEÑAL', icon: '⚡', color: '#ffbf47', curse: 'EL DOBLE DE ÉLITES',
    desc: '+45% de puntuación y +25% de chips.',
    how: 'Emites más fuerte. Todo lo que hay en el sector sabe exactamente dónde estás.',
    apply: s => { s.buildScore = (s.buildScore || 1) * 1.45; s.chipMult += .25; s.pactElites = (s.pactElites || 0) + 1; },
    score: 1
  },
  {
    id: 'tiempo', name: 'PACTO DEL TIEMPO', icon: '◴', color: '#b6ff3d', curse: 'ENEMIGOS +18% RÁPIDOS',
    desc: '+3 s de sobrecarga y +30% de carga.',
    how: 'Robas segundos al sector. El sector recupera el préstamo moviéndose más rápido.',
    apply: s => { s.overdriveDuration += 3; s.chargeMult *= 1.3; s.enemySpeed = (s.enemySpeed || 1) * 1.18; },
    score: 1.15
  },
  {
    id: 'hueco', name: 'PACTO DEL HUECO', icon: '◍', color: '#6ef7e7', curse: 'ESCUDO MÁXIMO -50%',
    desc: '+70 de vida máxima y +4 de regeneración.',
    how: 'Cambias blindaje por carne. La piel aguanta lo que el escudo ya no cubre.',
    apply: s => { s.maxHp += 70; s.hp += 70; s.regen += 4; s.maxShield = Math.round(s.maxShield * .5); s.shield = Math.min(s.shield, s.maxShield); },
    score: 1.1
  }
];

// ---------------------------------------------------------------------------
// RELIQUÍAS: piezas únicas que no se acumulan. Cada una es UNA regla que no
// existe en ningún otro sitio y se concede al derribar a un jefe de sector.
// Se guardan en orden de obtención y se muestran en el panel de build.
export const RELICS = [
  { id:'core_inestable', name:'NÚCLEO INESTABLE', icon:'✦', color:'#ff4d38', tier:'COMBUSTIBLE',
    desc:'Cada 12 disparos sale un proyectil puro que atraviesa la arena entera.',
    how:'No es un multiplicador: es un disparo que no se parece a los tuyos.' },
  { id:'reloj_roto', name:'RELOJ DE ARENA ROTO', icon:'◴', color:'#b56bff', tier:'TIEMPO',
    desc:'Al recibir un golpe mortal con sobrecarga disponible, la activas sola.',
    how:'La muerte se cobra en tiempo, no en vida.' },
  { id:'peonza', name:'PEONZA DE FASE', icon:'◍', color:'#6ef7e7', tier:'MOVIMIENTO',
    desc:'Dashear deja una peonza giratoria que corta durante 3 s.',
    how:'Tu huella sigue peleando cuando tú ya no estás.' },
  { id:'moneda_partida', name:'MONEDA PARTIDA', icon:'◆', color:'#ffbf47', tier:'ECONOMÍA',
    desc:'Los chips valen el doble, pero pierdes un 8% de vida máxima por ronda.',
    how:'La ciudad cobra por cada dato que le arrancas.' },
  { id:'catalizador', name:'CATALIZADOR DE PLAGA', icon:'☣', color:'#b6ff3d', tier:'ELEMENTO',
    desc:'Tu veneno y tu quemadura se propagan al hostile más cercano al morir.',
    how:'El veneno no se apaga con el cuerpo: busca otro.' },
  { id:'espejo_negro', name:'ESPEJO NEGRO', icon:'◈', color:'#9ff7ff', tier:'REFLEJO',
    desc:'Copias el 25% del daño que recibes y se lo devuelves al atacante.',
    how:'No esquiva: responde.' },
  { id:'imantadora', name:'BOBINA IMANTADORA', icon:'◉', color:'#ffbf47', tier:'CONTROL',
    desc:'Todos los chips del sector viajan hacia ti sin que tengas que ir.',
    how:'Dejas de perseguir el botín; el botín te persigue.' },
  { id:'amalgama', name:'AMALGAMA', icon:'⋔', color:'#b56bff', tier:'ALIADOS',
    desc:'Tus aliados duran el doble y explotan al caducar en lugar de desaparecer.',
    how:'Nada de lo que convocas se va sin despedirse.' },
  { id:'segadora', name:'HOJA DEL VERDUGO', icon:'⌾', color:'#ff4d38', tier:'EJECUCIÓN',
    desc:'El umbral de ejecución sube al 30%: rematas mucho antes.',
    how:'La muerte deja de ser el final: es el principio del remate.' },
  { id:'sobrecarga', name:'CONDENSADOR ETERNO', icon:'⚡', color:'#9ff7ff', tier:'SISTEMA',
    desc:'La sobrecarga se recarga un 60% más rápido y dura 2 s más.',
    how:'El condensador ya no se vacía: se impacienta.' },
  { id:'coraza_viva', name:'CORAZA VIVA', icon:'⛨', color:'#6ef7e7', tier:'DEFENSA',
    desc:'Tu escudo se recarga al instante cada vez que ejecutas a un hostile.',
    how:'Cada remate te devuelve la piel entera.' },
  { id:'triangulo', name:'TRIÁNGULO DE DATOS', icon:'⩙', color:'#8fdfff', tier:'PRECISIÓN',
    desc:'Los headshots encadenan: rebotan al hostile más cercano al 60%.',
    how:'Una cabeza bien puesta no debería bastar.' },
  { id:'jaula', name:'JAULA DE INTERFERENCIA', icon:'⛓', color:'#b56bff', tier:'CONTROL',
    desc:'Los hostiles que entren a 4 m de ti quedan anclados 1 s.',
    how:'El espacio que ocupas deja de ser suyo.' },
  { id:'ultimo_aliento', name:'ÚLTIMO ALIENTO', icon:'✚', color:'#ff4d38', tier:'SUPERVIVENCIA',
    desc:'La primera vez que caigas en una incursión, revives con el 40% de vida.',
    how:'Una sola vez. La segunda ya es definitiva.' },
  { id:'voracidad', name:'VORACIDAD', icon:'❥', color:'#ff4d38', tier:'DRENAJE',
    desc:'Robas el 6% del daño que haces como vida, sin límite por golpe.',
    how:'Cada proyectil es una transfusión.' },
  { id:'satélite', name:'SATÉLITE CAÍDO', icon:'☄', color:'#ffbf47', tier:'ARTILLERÍA',
    desc:'Cada 20 s cae un impacto orbital automático sobre el grupo más grande.',
    how:'Algo ahí arriba sigue apuntando por ti.' }
];
export function relicById(id) { return RELICS.find(r => r.id === id) || null; }

// ---------------------------------------------------------------------------
// Director de amenaza: la presión ya no depende solo de la ronda. Sube con el
// tiempo real de incursión (como en Risk of Rain) y con las rondas ganadas.
export const THREAT = {
  perMinute: .085,     // amenaza por minuto de incursión
  perRound: .055,      // amenaza por ronda superada
  softCap: 3.4,        // techo de multiplicador
  hordeEvery: 42,      // segundos entre hordas dirigidas
  hordeBase: 4,        // hostiles de la primera horda
  hordePerMin: 2.2     // hostiles extra por minuto
};
