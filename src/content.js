// NEON//REVENANT — contenido del juego (datos puros, sin dependencias)

export const CHARACTERS = {
  vanta: {
    name: 'VANTA', role: 'ESPECTRO TÁCTICO', color: 0x6ef7e7, hex: '#6ef7e7',
    hp: 120, damage: 36, speed: 8.4, fireRate: .12, maxAmmo: 26, damageTaken: 1,
    headshotMult: 1.85, chargeMult: 1.3, dashRecovery: 1.55, overdriveDuration: 7,
    scale: 1, weapon: 'smg', emblem: '✦',
    description: 'Unidad versátil. Controla el ritmo y castiga cada error.',
    passive: 'SINERGIA // +30% carga de sobrecarga'
  },
  kira: {
    name: 'KIRA', role: 'HOSTIGADORA', color: 0xffbf47, hex: '#ffbf47',
    hp: 85, damage: 32, speed: 10.6, fireRate: .09, maxAmmo: 22, damageTaken: 1.05,
    headshotMult: 2.45, chargeMult: 1, dashRecovery: 1.05, overdriveDuration: 6,
    scale: .92, weapon: 'needle', emblem: '⟐',
    description: 'Rápida y quirúrgica. Apunta a la cabeza y nunca dejes de moverte.',
    passive: 'PUNTO CIEGO // +60% daño en headshots'
  },
  rook: {
    name: 'ROOK', role: 'FORTALEZA DE ASALTO', color: 0xff4d38, hex: '#ff4d38',
    hp: 185, damage: 44, speed: 6.8, fireRate: .16, maxAmmo: 34, damageTaken: .75,
    headshotMult: 1.7, chargeMult: .85, dashRecovery: 1.9, overdriveDuration: 8,
    scale: 1.13, weapon: 'cannon', emblem: '⬢',
    description: 'Avanza sin retroceder. Blindaje pesado y munición para resistir.',
    passive: 'BLINDAJE // -25% daño recibido'
  },
  // ---------------------------------------------------------------------
  // Segunda hornada: siete operadores con regla propia, no una variación de
  // color. Cada uno cambia CÓMO se juega la incursión.
  nyx: {
    name: 'NYX', role: 'SABOTEADORA', color: 0x9ff7ff, hex: '#9ff7ff',
    hp: 95, damage: 30, speed: 10.2, fireRate: .085, maxAmmo: 20, damageTaken: 1,
    headshotMult: 2.6, chargeMult: 1.15, dashRecovery: .95, overdriveDuration: 6.5,
    scale: .94, weapon: 'arcer', emblem: '⌖',
    description: 'Apaga señales en cadena. Su daño salta de cuerpo en cuerpo.',
    passive: 'SALTO // sus disparos encadenan a +2 hostiles extra',
    perk: { chain: 2 }
  },
  pyre: {
    name: 'PYRE', role: 'INCENDIARIA', color: 0xff6a3d, hex: '#ff6a3d',
    hp: 140, damage: 26, speed: 8.0, fireRate: .045, maxAmmo: 60, damageTaken: .95,
    headshotMult: 1.4, chargeMult: 1.1, dashRecovery: 1.4, overdriveDuration: 7,
    scale: 1.04, weapon: 'flamer', emblem: '✹',
    description: 'Rocía combustible y deja que el sector arda sin mirarlo.',
    passive: 'BRASA // sus impactos queman 4/s durante 3 s',
    perk: { burn: 4 }
  },
  aegis: {
    name: 'AEGIS', role: 'BALUARTE', color: 0x6ef7e7, hex: '#6ef7e7',
    hp: 205, damage: 34, speed: 6.4, fireRate: .18, maxAmmo: 30, damageTaken: .62,
    headshotMult: 1.6, chargeMult: .8, dashRecovery: 2.1, overdriveDuration: 9,
    scale: 1.18, weapon: 'sharder', emblem: '⛨',
    description: 'Un muro con piernas. Empieza con escudo y lo recupera al matar.',
    passive: 'MURALLA // +90 de escudo inicial y +6 por baja',
    perk: { startShield: 90, shieldOnKill: 6 }
  },
  glitch: {
    name: 'GLITCH', role: 'ANOMALÍA', color: 0xb56bff, hex: '#b56bff',
    hp: 110, damage: 38, speed: 9.0, fireRate: .11, maxAmmo: 24, damageTaken: 1.1,
    headshotMult: 2.0, chargeMult: 1.45, dashRecovery: 1.2, overdriveDuration: 7.5,
    scale: 1, weapon: 'prism', emblem: '☣',
    description: 'Impredecible a propósito. Cada disparo lanza un dado de cristal.',
    passive: 'DADO // 18% de probabilidad de golpe crítico x3',
    perk: { chaos: .18 }
  },
  seraph: {
    name: 'SERAPH', role: 'SOPORTE DE ESCUADRA', color: 0xb6ff3d, hex: '#b6ff3d',
    hp: 130, damage: 29, speed: 8.8, fireRate: .1, maxAmmo: 40, damageTaken: .9,
    headshotMult: 1.75, chargeMult: 1.25, dashRecovery: 1.3, overdriveDuration: 8,
    scale: 1.02, weapon: 'lmg', emblem: '✚',
    description: 'Levanta a la escuadra: empieza con dos drones de escolta.',
    passive: 'CORO // 2 drones de escolta desde el inicio y curan al jugador',
    perk: { startCompanions: 2 }
  },
  ronin: {
    name: 'RONIN', role: 'ESPADACHÍN', color: 0xffbf47, hex: '#ffbf47',
    hp: 125, damage: 40, speed: 9.6, fireRate: .14, maxAmmo: 18, damageTaken: 1,
    headshotMult: 1.9, chargeMult: 1.2, dashRecovery: .85, overdriveDuration: 6,
    scale: 1, weapon: 'rail', emblem: '⚔',
    description: 'Cuerpo a cuerpo primero. Cada baja cuerpo a cuerpo recupera dash.',
    passive: 'ACERO // +50% de daño cuerpo a cuerpo y dash extra al rematar',
    perk: { meleeMult: 1.5, meleeDash: true }
  },
  cipher: {
    name: 'CIPHER', role: 'FRANCOTIRADOR', color: 0x8fdfff, hex: '#8fdfff',
    hp: 100, damage: 58, speed: 7.6, fireRate: .34, maxAmmo: 12, damageTaken: 1.05,
    headshotMult: 3.1, chargeMult: .9, dashRecovery: 1.5, overdriveDuration: 6,
    scale: 1.06, weapon: 'lance', emblem: '➶',
    description: 'Un disparo, una baja. Atraviesa la fila entera de hostiles.',
    passive: 'PERFORACIÓN // +4 de perforación y +20% de multiplicador de headshot',
    perk: { pierce: 4, hsBonus: .2 }
  }
};

// fireRate/ammo son multiplicadores sobre el arma base del personaje.
export const WEAPONS = {
  smg:    { name:'VXR—9',  sub:'PULSE SMG',      damage:1,   fireRate:1,   ammo:1,   pellets:1, spread:.012, pierce:0, color:0x6ef7e7, kick:.08,  special:false },
  needle: { name:'HXF—2',  sub:'NEEDLE SMG',     damage:1,   fireRate:1,   ammo:1,   pellets:1, spread:.008, pierce:0, color:0xffbf47, kick:.06,  special:false },
  cannon: { name:'M90—R',  sub:'HEAVY REPEATER', damage:1,   fireRate:1,   ammo:1,   pellets:1, spread:.018, pierce:0, color:0xff4d38, kick:.16,  special:false },
  lmg:    { name:'RIEGO M-12', sub:'CINTURÓN LMG', damage:.62, fireRate:.55, ammo:2.8, pellets:1, spread:.055, pierce:1, color:0xffbf47, kick:.05, special:true,
            how:'Ametralladora de cinturón: cadencia altísima y cargador gigante, pero cada bala hace menos daño.' },
  shotgun:{ name:'RUPTOR 12',  sub:'PULSE SHOTGUN', damage:.42, fireRate:2.4, ammo:.6, pellets:9, spread:.085, pierce:0, color:0xff4d38, kick:.34, special:true,
            how:'Escopeta de pulso: dispara 9 perdigones en cono. Devastadora a quemarropa.' },
  rail:   { name:'AGUJA MK3',  sub:'RAIL LANCE',   damage:4.4, fireRate:3.4, ammo:.4, pellets:1, spread:0, pierce:6, color:0x6ef7e7, kick:.42, special:true,
            how:'Lanza de riel: disparo lento que ATRAVIESA hasta 6 enemigos en línea recta.' },
  flak:   { name:'FL-4 ANTIAÉREO', sub:'FLAK CANNON', damage:.78, fireRate:1.15, ammo:1.3, pellets:3, spread:.1, pierce:0, color:0xffbf47, kick:.22, special:true,
            how:'Cañón antiaéreo: tres proyectiles en abanico, ideal para enemigos voladores.' },
  mortar: { name:'TRUENO 8', sub:'MORTERO DE PULSO', damage:2.6, fireRate:2.8, ammo:.45, pellets:1, spread:.02, pierce:0, color:0xff4d38, kick:.3, special:true, explosive:true,
            how:'Mortero: proyectil pesado que explota en área al impactar.' },
  // ---- segunda hornada: armas de elemento y control ------------------------
  arcer:  { name:'ARCO VX',  sub:'ARC CHAIN',        damage:.9,  fireRate:1.05, ammo:1.1, pellets:1, spread:.03, pierce:1, color:0x9ff7ff, kick:.12, special:true, chain:2,
            how:'Cada impacto salta en arco a los hostiles cercanos. Cuanto más apiñados, mejor.' },
  flamer: { name:'FL-7 PYRO', sub:'LANZALLAMAS',     damage:.34, fireRate:.28, ammo:2.6, pellets:1, spread:.09, pierce:2, color:0xff6a3d, kick:.02, special:true, burn:3.4,
            how:'Chorro continuo de combustible: prende a todo lo que toca y lo consume por segundo.' },
  prism:  { name:'PRISMA 3', sub:'REFRACTOR',        damage:.72, fireRate:.85, ammo:1.2, pellets:3, spread:.13, pierce:1, color:0xb56bff, kick:.14, special:true, ricochet:2,
            how:'Tres fragmentos de luz que rebotan de un hostile al siguiente.' },
  sharder:{ name:'CRISTALIZADORA', sub:'SHARD CANNON', damage:1.5, fireRate:1.5, ammo:.9, pellets:2, spread:.07, pierce:1, color:0x6ef7e7, kick:.2, special:true, shatter:true,
            how:'Clava cristales que revientan en fragmentos al segundo impacto.' },
  disruptor:{ name:'DISRUPTOR', sub:'PULSE NULLIFIER', damage:1.9, fireRate:1.9, ammo:.8, pellets:1, spread:.015, pierce:4, color:0xb56bff, kick:.26, special:true, slow:.5,
            how:'Orbe pesado que atraviesa la fila y deja a los tocados moviéndose a cámara lenta.' },
  cyclone:{ name:'CICLÓN',   sub:'ROTOR GUN',        damage:.5,  fireRate:.34, ammo:2.2, pellets:2, spread:.05, pierce:2, color:0xffbf47, kick:.03, special:true,
            how:'Dos anillos de munición giratoria: cadencia absurda y daño sostenido.' },
  nailer: { name:'CLAVADOR N9', sub:'NAIL DRIVER',   damage:.44, fireRate:.22, ammo:2.4, pellets:1, spread:.02, pierce:2, color:0xffbf47, kick:.04, special:true,
            how:'Clava pernos a un ritmo imposible. Poca pegada por bala, mucha por segundo.' },
  voidcaster:{ name:'VACIADOR', sub:'VOID CASTER',   damage:1.7, fireRate:1.6, ammo:.7, pellets:2, spread:.06, pierce:0, color:0xb56bff, kick:.24, special:true, homing:true,
            how:'Dos orbes del vacío que corrigen el rumbo hacia el hostile más cercano.' },
  lance:  { name:'LANZA LARGA', sub:'RAIL LANCE MK9', damage:6.2, fireRate:4.2, ammo:.3, pellets:1, spread:0, pierce:12, color:0x8fdfff, kick:.55, special:true, trail:true,
            how:'Un solo disparo que atraviesa la fila entera. Lento, definitivo.' },
  beamgun:{ name:'LUMEN',    sub:'BEAM EMITTER',     damage:.58, fireRate:.16, ammo:3.0, pellets:1, spread:.008, pierce:6, color:0x9ff7ff, kick:.015, special:true,
            how:'Haz continuo: no hay proyectil, el daño llega al instante en línea recta.' },
  scatter:{ name:'LLUVIA DE FRAGMENTOS', sub:'FRAG SPRAY', damage:.36, fireRate:1.35, ammo:1.0, pellets:12, spread:.12, pierce:0, color:0x6ef7e7, kick:.28, special:true,
            how:'Doce fragmentos en abanico: barre grupos a corta distancia.' },
  thunder:{ name:'TRUENO 9', sub:'RAIL MORTAR',      damage:3.6, fireRate:3.4, ammo:.35, pellets:1, spread:.01, pierce:3, color:0xffbf47, kick:.44, special:true, explosive:true, doubleBlast:true,
            how:'Mortero de riel: dos detonaciones en cadena sobre el mismo punto.' }
};

// Habilidades especiales de botín (estilo supervivencia automática).
export const ABILITIES = [
  { id:'orbit', name:'HOJAS ORBITALES', icon:'✧', color:'#6ef7e7', max:4, trigger:'PASIVA PERMANENTE',
    how:'Unas cuchillas de energía giran sin parar alrededor de tu cuerpo y cortan automáticamente a todo enemigo que las toca.',
    desc:l=>`${l+1} cuchillas orbitales. Cada una inflige daño al contacto.` },
  { id:'tesla', name:'DESCARGA TESLA', icon:'⚡', color:'#6ef7e7', max:4, trigger:'CADA 3.5 S AUTOMÁTICO',
    how:'Cada pocos segundos un rayo cae sobre el enemigo más cercano y salta a los que tiene alrededor. No tienes que hacer nada.',
    desc:l=>`Rayo de ${Math.round(60+35*l)} de daño que salta a ${2+l} enemigos.` },
  { id:'frost', name:'NOVA DE ESCARCHA', icon:'❄', color:'#8fdfff', max:3, trigger:'CADA 5 S AUTOMÁTICO',
    how:'Una onda helada se expande desde ti y ralentiza a todos los enemigos cercanos durante unos segundos.',
    desc:l=>`Ralentiza un ${45+15*l}% durante ${(3+l*.6).toFixed(1)} s en un radio de ${8+l*1.5} m.` },
  { id:'aura', name:'AURA DEL VACÍO', icon:'◈', color:'#b56bff', max:3, trigger:'CONTINUO',
    how:'Un campo de energía te envuelve y desintegra poco a poco a todo lo que se acerque demasiado.',
    desc:l=>`${Math.round(26*(l+1))} de daño por segundo en un radio de ${(3.6+l*.8).toFixed(1)} m.` },
  { id:'mines', name:'CAMPO DE MINAS', icon:'◉', color:'#ffbf47', max:3, trigger:'CADA 4 S AUTOMÁTICO',
    how:'Vas soltando minas inteligentes al moverte. Se arman con retardo y explotan cuando un enemigo pisa cerca.',
    desc:l=>`Mina de ${Math.round(95+45*l)} de daño. Hasta ${3+l*2} activas a la vez.` },
  { id:'swarm', name:'ENJAMBRE WRAITH', icon:'⋔', color:'#b56bff', max:3, trigger:'PERMANENTE',
    how:'Micro drones de escolta que disparan solos al enemigo más cercano. Se suman a tus mascotas.',
    desc:l=>`+${1} dron de escolta adicional con cadencia propia.` },
  { id:'dashwave', name:'PULSO SÍSMICO', icon:'⌁', color:'#ff4d38', max:3, trigger:'AL USAR EL DASH',
    how:'Cada dash levanta una onda expansiva que revienta a los enemigos alrededor del punto de llegada.',
    desc:l=>`Onda de ${Math.round(55+30*l)} de daño en 6 m al dashear.` },
  { id:'deathexplode', name:'DETONACIÓN FINAL', icon:'✹', color:'#ff4d38', max:3, trigger:'AL MATAR UN ENEMIGO',
    how:'Los enemigos que matas explotan y arrastran a los que estén cerca. Las explosiones encadenadas son letales.',
    desc:l=>`Explosión de ${Math.round(45+25*l)} de daño en ${(3.2+l*.6).toFixed(1)} m.` },
  { id:'beam', name:'LÁSER CENTINELA', icon:'⩙', color:'#6ef7e7', max:3, trigger:'CADA 7 S AUTOMÁTICO',
    how:'Un satélite aliado dispara un haz vertical desde el cielo sobre un enemigo aleatorio.',
    desc:l=>`Haz de ${Math.round(130+70*l)} de daño en línea vertical.` },
  { id:'regen', name:'NANO-REGENERADOR', icon:'✚', color:'#6ef7e7', max:3, trigger:'CONTINUO',
    how:'Regeneras escudo (y vida cuando el escudo está lleno) de forma constante.',
    desc:l=>`+${(2.2*(l+1)).toFixed(1)} de escudo por segundo. Con el escudo lleno cura la mitad.` },
  { id:'chrono', name:'CAMPO CRONO', icon:'◴', color:'#b56bff', max:2, trigger:'DURANTE LA SOBRECARGA',
    how:'Mientras la sobrecarga está activa el tiempo de los enemigos se ralentiza: tú sigues a velocidad normal.',
    desc:l=>`Enemigos al ${Math.round(100-35*(l+1))}% de velocidad durante la sobrecarga.` },
  // ---- segunda hornada: habilidades de control, área y ejecución ----------
  { id:'chain', name:'CADENA DE PLASMA', icon:'⛓', color:'#9ff7ff', max:4, trigger:'CADA 3 S AUTOMÁTICO',
    how:'Un arco salta del hostil más cercano al siguiente y del siguiente al siguiente. Cuanto más apiñados estén, más brutal es.',
    desc:l=>`Arco de ${Math.round(45+28*l)} que salta a ${3+l} objetivos, perdiendo un 12% por salto.` },
  { id:'singularity', name:'POZO GRAVITATORIO', icon:'◍', color:'#b56bff', max:3, trigger:'CADA 9 S AUTOMÁTICO',
    how:'Abre un vórtice en el punto más concurrido de la arena: arrastra a todo lo que esté cerca y después implosiona.',
    desc:l=>`Atrae durante 1.2 s en ${(5+l).toFixed(0)} m e implosiona con ${Math.round(110+60*l)} de daño.` },
  { id:'spikes', name:'CORONA DE ESPINAS', icon:'✳', color:'#ff4d38', max:3, trigger:'AL RECIBIR DAÑO',
    how:'Cada golpe que encajas hace erupcionar espinas de fase a tu alrededor. Devuelves parte de lo que te dan.',
    desc:l=>`Erupción de ${Math.round(55+35*l)} de daño en 4.5 m y algo de escudo al instante.` },
  { id:'rain', name:'LLUVIA ORBITAL', icon:'☄', color:'#ffbf47', max:3, trigger:'CADA 8 S AUTOMÁTICO',
    how:'Un satélite marca puntos en el suelo y los pulveriza desde la órbita. Avisa antes de caer: aprende a leer el círculo.',
    desc:l=>`${1+l} impactos de ${Math.round(120+70*l)} de daño en 3.5 m.` },
  { id:'echo', name:'ECO DE COMBATE', icon:'⌁', color:'#9ff7ff', max:3, trigger:'AL DISPARAR',
    how:'Algunos disparos generan una réplica fantasma del proyectil. Con armas de muchos perdigones el efecto se multiplica.',
    desc:l=>`${15+9*l}% de probabilidad de una réplica al ${40+10*l}% del daño.` },
  { id:'harvest', name:'COSECHA', icon:'⌾', color:'#ff4d38', max:3, trigger:'PASIVA',
    how:'Los hostiles malheridos quedan marcados con un rombo. Un tiro a la cabeza o un golpe cuerpo a cuerpo los ejecuta al instante.',
    desc:l=>`Ejecuta automáticamente por debajo del ${12+6*l}% de vida. Cada ejecución suelta chips y frenesí.` },
  // ---- tercera hornada: despliegues, artillería y engaño -------------------
  { id:'turret', name:'CENTINELA AUTÓNOMA', icon:'⌂', color:'#ffbf47', max:3, trigger:'CADA 13 S AUTOMÁTICO',
    how:'Despliegas una torreta con trípode y ojo sensorial que apunta y dispara sola al hostil más cercano mientras dura.',
    desc:l=>`Torreta con ${(2.2+l*.7).toFixed(1)} disparos/s durante ${14+l*5} s.` },
  { id:'meteor', name:'BOMBARDEO ORBITAL', icon:'☄', color:'#ff4d38', max:3, trigger:'CADA 11 S AUTOMÁTICO',
    how:'Marcas el cielo sobre tus enemigos: tras el telegrafo en el suelo caen proyectiles orbitales en llamas. Devastador contra grupos.',
    desc:l=>`${3+l*2} impactos de ${Math.round(120+60*l)} de daño en área.` },
  { id:'ghost', name:'SEÑUELO ESPECTRAL', icon:'❖', color:'#b56bff', max:3, trigger:'CADA 12 S AUTOMÁTICO',
    how:'Proyecta un holograma de ti que atrae a los hostiles, absorbe su atención y después detona en plasma violeta.',
    desc:l=>`Señuelo de ${Math.round(4+l*2)} s que detona con ${Math.round(90+50*l)} de daño en 5 m.` },
  { id:'spiral', name:'ESPIRAL DE FASE', icon:'✺', color:'#6ef7e7', max:3, trigger:'CADA 6 S AUTOMÁTICO',
    how:'Cuchillas de fase giran a tu alrededor como una rosa de energía, cortando todo lo que tocan durante más de un segundo.',
    desc:l=>`Rosa de ${2+l} brazos: ${Math.round(26+14*l)} por corte durante 1.3 s.` },
  // ---- cuarta hornada: supervivencia, economía y caos ----------------------
  { id:'ward', name:'GUARDIÁN', icon:'⛨', color:'#6ef7e7', max:4, trigger:'PASIVA',
    how:'Una capa de energía absorbe parte de cada golpe y se recarga sola cuando dejas de recibir daño.',
    desc:l=>`-${Math.round(8+5*l)}% de daño recibido y el escudo se recarga un ${25*l}% más rápido.` },
  { id:'siphon', name:'SIFÓN VITAL', icon:'❥', color:'#ff4d38', max:4, trigger:'AL IMPACTAR',
    how:'Cada impacto arranca una fracción de integridad del hostile y te la devuelve.',
    desc:l=>`Roba ${(0.6+l*.5).toFixed(1)} de vida por impacto (el triple en headshot).` },
  { id:'venom', name:'VENENO DE DATOS', icon:'☣', color:'#b6ff3d', max:4, trigger:'AL IMPACTAR',
    how:'Tus balas inyectan un código corrupto que se come al hostile por segundo.',
    desc:l=>`Envenena ${(4+2.5*l).toFixed(1)} de daño por segundo durante 4 s.` },
  { id:'magnet', name:'IMÁN DE DATOS', icon:'◈', color:'#ffbf47', max:3, trigger:'PASIVA',
    how:'El campo magnético de tu armadura atrae los chips y el botín desde mucho más lejos.',
    desc:l=>`Recoges en un radio de ${(6+4*l).toFixed(0)} m y los chips valen un ${20+12*l}% más.` },
  { id:'ricochet', name:'MUNICIÓN REBOTANTE', icon:'⤡', color:'#9ff7ff', max:3, trigger:'PASIVA',
    how:'Tus disparos no se detienen: rebotan hacia el siguiente hostile de la fila.',
    desc:l=>`+${1+l} perforación y los tiros buscan al siguiente objetivo cercano.` },
  { id:'overclock', name:'OVERCLOCK', icon:'⇶', color:'#ffbf47', max:3, trigger:'AL MATAR',
    how:'Cada baja estira el frenesí. Encadenas muertes y el mundo va más despacio.',
    desc:l=>`+${(0.5+l*.35).toFixed(2)} s de frenesí por baja y +${6*l}% de cadencia mientras dure.` },
  { id:'comet', name:'COMETA', icon:'✦', color:'#8fdfff', max:3, trigger:'CADA 5 S AUTOMÁTICO',
    how:'Un núcleo helado orbita a tu alrededor y sale disparado hacia el hostile más lejano.',
    desc:l=>`Esfera de ${Math.round(70+45*l)} de daño que persigue y explota en 3 m.` },
  { id:'quake', name:'TREMOR', icon:'⌁', color:'#ff4d38', max:3, trigger:'CADA 7 S AUTOMÁTICO',
    how:'Golpeas el suelo: una onda expansiva recorre la arena y levanta a todo lo que pisa.',
    desc:l=>`Onda de ${Math.round(60+35*l)} de daño en ${(7+l*1.5).toFixed(1)} m que también aturde.` },
  { id:'legion', name:'LEGIONARIA', icon:'⋔', color:'#b56bff', max:3, trigger:'AL MATAR',
    how:'Los hostiles que caen dejan un eco leal que pelea a tu lado unos segundos.',
    desc:l=>`${20+12*l}% de probabilidad de un aliado espectral de ${Math.round(5+l*2)} s por baja.` },
  { id:'bulwark', name:'CONTRAEMBESTIDA', icon:'⇉', color:'#6ef7e7', max:3, trigger:'AL USAR EL DASH',
    how:'Dashear te vuelve intocable un instante y descarga el daño acumulado al salir.',
    desc:l=>`${(0.5+l*.25).toFixed(2)} s de invulnerabilidad y onda de ${Math.round(40+28*l)} al terminar.` }
];

// Combinaciones que se activan al reunir dos habilidades: effects implemented in game.js.
export const SYNERGIES = [
  { id:'glacial', req:['orbit','frost'], name:'BLOQUEO GLACIAL', color:'#8fdfff',
    desc:'Las hojas orbitales congelan a todo lo que cortan y pegan un 30% más fuerte.' },
  { id:'storm', req:['tesla','beam'], name:'TORMENTA ELÉCTRICA', color:'#9ff7ff',
    desc:'El haz centinela se divide en 3 rayos extra y la descarga Tesla recarga un 30% antes.' },
  { id:'demolition', req:['mines','deathexplode'], name:'CADENA DE DEMOLICIÓN', color:'#ffbf47',
    desc:'Cada explosión hace estallar las explosiones cercanas: cadena de detonaciones.' },
  { id:'vortex', req:['dashwave','orbit'], name:'VÓRTICE', color:'#b56bff',
    desc:'El pulso sísmico succiona a los enemigos y las hojas orbitan en un radio mayor.' },
  { id:'overheal', req:['regen','beam'], name:'CURA SATELITAL', color:'#6ef7e7',
    desc:'Cada impacto del láser centinela te devuelve 10 de vida.' },
  { id:'timefield', req:['aura','chrono'], name:'VACÍO TEMPORAL', color:'#b56bff',
    desc:'El aura del vacío ralentiza un 35% a todo lo que toca.' },
  { id:'swarmlord', req:['swarm','frost'], name:'ENJAMBRE HELADO', color:'#8fdfff',
    desc:'Tus drones ralentizan y congelan a sus objetivos.' },
  // ---- sinergias de la segunda y tercera hornada --------------------------
  { id:'fortaleza', req:['turret','ward'], name:'FORTALEZA', color:'#6ef7e7',
    desc:'Las torretas proyectan un escudo a tu alrededor mientras estén activas.' },
  { id:'apocalipsis', req:['meteor','rain'], name:'APOCALIPSIS', color:'#ff4d38',
    desc:'El cielo no descansa: los impactos orbitales dejan lluvia secundaria.' },
  { id:'teatro', req:['ghost','chain'], name:'TEATRO DE SOMBRAS', color:'#b56bff',
    desc:'El arco salta desde cada señuelo: más copias, más saltos.' },
  { id:'segadora', req:['harvest','spiral'], name:'SEGADORA', color:'#ff4d38',
    desc:'La espiral ejecuta a todo lo que quede por debajo del umbral.' },
  { id:'contragolpe', req:['spikes','bulwark'], name:'CONTRAGOLPE', color:'#ff4d38',
    desc:'Ser intocable ya no es defensa: devuelves el daño multiplicado.' },
  { id:'plaga', req:['venom','aura'], name:'PLAGA', color:'#b6ff3d',
    desc:'El aura contagia el veneno a todo lo que toca y lo propaga.' },
  { id:'imperio', req:['legion','swarm'], name:'IMPERIO', color:'#b56bff',
    desc:'Tus aliados espectrales duran el doble y disparan más rápido.' },
  { id:'avaricia', req:['magnet','harvest'], name:'AVARICIA', color:'#ffbf47',
    desc:'Cada ejecución suelta el triple de chips y los atrae al instante.' },
  { id:'guerra', req:['overclock','deathexplode'], name:'GUERRA TOTAL', color:'#ff4d38',
    desc:'Cada detonación suma frenesí: la matanza se autoalimenta.' },
  { id:'gravedad', req:['singularity','quake'], name:'GRAVEDAD', color:'#b56bff',
    desc:'El tremor arrastra hacia el centro antes de levantar a los hostiles.' },
  { id:'espejo', req:['echo','ricochet'], name:'ESPEJO INFINITO', color:'#9ff7ff',
    desc:'Cada rebote genera una réplica: los proyectiles se multiplican.' },
  { id:'martirio', req:['siphon','spikes'], name:'MARTIRIO', color:'#ff4d38',
    desc:'Robas vida de cada espina que erupciona. El daño te alimenta.' },
  { id:'tormenta', req:['comet','tesla'], name:'TORMENTA POLAR', color:'#8fdfff',
    desc:'El cometa deja un campo helado y la descarga salta desde él.' }
];

// Mejoras directas que también puede soltar el botín.
export const BOOSTS = [
  { id:'shield', name:'NÚCLEO DE ESCUDO', icon:'⛨', color:'#6ef7e7', max:4, kind:'boost', trigger:'INSTANTÁNEO',
    how:'Instala un escudo absorbente que recibe el daño antes que tu vida.',
    desc:()=>'+35 de escudo absorbente y recarga completa.', apply:s=>{s.maxShield+=35;s.shield=s.maxShield;} },
  { id:'stim', name:'ESTIMULANTE', icon:'↟', color:'#ffbf47', max:5, kind:'boost', trigger:'INSTANTÁNEO',
    how:'Inyección de combate: tu cadencia y tu velocidad suben de forma permanente durante esta partida.',
    desc:()=>'+12% cadencia y +8% velocidad.', apply:s=>{s.fireRate*=.88;s.speed*=1.08;} },
  { id:'ammo', name:'CARGADOR EXTENDIDO', icon:'▮', color:'#6ef7e7', max:5, kind:'boost', trigger:'INSTANTÁNEO',
    how:'Amplía el cargador de todas tus armas y rellena la munición al momento.',
    desc:()=>'+8 de munición por cargador y recarga inmediata.', apply:s=>{s.baseAmmo+=8;} },
  { id:'vitals', name:'SUERO DE CAMPO', icon:'✛', color:'#6ef7e7', max:5, kind:'boost', trigger:'INSTANTÁNEO',
    how:'Suero de regeneración: sube tu vida máxima y te cura una buena parte al instante.',
    desc:()=>'+20 vida máxima y curación de 45.', apply:s=>{s.maxHp+=20;s.hp=Math.min(s.maxHp,s.hp+45);} },
  { id:'crit', name:'OJO DEL ORÁCULO', icon:'◉', color:'#ff4d38', max:4, kind:'boost', trigger:'PASIVA',
    how:'El visor calcula el punto débil: tus disparos a la cabeza hacen mucho más daño.',
    desc:()=>'+30% multiplicador de headshot y +6% de crítico.', apply:s=>{s.headshotMult+=.3;s.critChance+=.06;} }
];

// Mutaciones roguelite que se eligen entre oleadas.
export const UPGRADES = [
  { id:'damage', name:'NÚCLEO INESTABLE', category:'ARMAS', icon:'✦', rarity:'COMÚN', color:'#6ef7e7', max:8, desc:'+20% daño de pulso.', apply:s=>s.damage*=1.2 },
  { id:'health', name:'PIEL FANTASMA', category:'CUERPO', icon:'✚', rarity:'COMÚN', color:'#6ef7e7', max:6, desc:'+25 vida máxima. Recupera 25.', apply:s=>{s.maxHp+=25;s.hp=Math.min(s.maxHp,s.hp+25);} },
  { id:'speed', name:'REFLEJO CERO', category:'MOVILIDAD', icon:'»', rarity:'COMÚN', color:'#6ef7e7', max:5, desc:'+11% velocidad de movimiento.', apply:s=>s.speed*=1.11 },
  { id:'firerate', name:'GATILLO DE FASE', category:'ARMAS', icon:'⇶', rarity:'RARA', color:'#ffbf47', max:5, desc:'+13% cadencia de disparo.', apply:s=>s.fireRate*=.87 },
  { id:'magazine', name:'CARGADOR INFINITO', category:'ARMAS', icon:'▮', rarity:'COMÚN', color:'#6ef7e7', max:4, desc:'+8 munición por cargador. Recarga completa.', apply:s=>{s.baseAmmo+=8;} },
  { id:'dash', name:'PASO DIMENSIONAL', category:'MOVILIDAD', icon:'⇉', rarity:'RARA', color:'#ffbf47', max:4, desc:'-18% recuperación del dash.', apply:s=>s.dashRecovery*=.82 },
  { id:'armor', name:'PLACAS DE TITANIO', category:'DEFENSA', icon:'⛨', rarity:'RARA', color:'#ffbf47', max:5, desc:'-10% daño recibido.', apply:s=>s.damageTaken*=.9 },
  { id:'leech', name:'SANGRE DIGITAL', category:'CUERPO', icon:'✚', rarity:'ÉPICA', color:'#ff4d38', max:4, desc:'Recupera 4 de vida con cada baja.', apply:s=>s.lifeOnKill+=4 },
  { id:'critical', name:'OJO DEL ORÁCULO', category:'PRECISIÓN', icon:'◉', rarity:'ÉPICA', color:'#ff4d38', max:5, desc:'+30% multiplicador de headshot y +5% de crítico.', apply:s=>{s.headshotMult+=.3;s.critChance+=.05;} },
  { id:'charge', name:'SOBRECARGA VIRAL', category:'SISTEMA', icon:'⚡', rarity:'RARA', color:'#ffbf47', max:4, desc:'+25% carga de sobrecarga.', apply:s=>s.chargeMult*=1.25 },
  { id:'duration', name:'TIEMPO ROBADO', category:'SISTEMA', icon:'◴', rarity:'ÉPICA', color:'#ff4d38', max:4, desc:'+1.5 s de duración de sobrecarga.', apply:s=>s.overdriveDuration+=1.5 },
  { id:'pierce', name:'MUNICIÓN PERFORANTE', category:'ARMAS', icon:'➶', rarity:'RARA', color:'#6ef7e7', max:3, desc:'Tus disparos atraviesan +2 enemigos.', apply:s=>s.pierceBonus+=2 },
  { id:'grenades', name:'LANZAGRANADAS', category:'ARMAS', icon:'◍', rarity:'RARA', color:'#ffbf47', max:2, desc:'Cada 5 disparos lanzas una granada automática. Al nivel 2, cada 3.', apply:s=>{ s.grenade = true; if (s.grenadeEvery > 3) s.grenadeEvery = 3; } },
  { id:'jump', name:'SERVOS DE SALTO', category:'MOVILIDAD', icon:'⤒', rarity:'COMÚN', color:'#6ef7e7', max:3, desc:'+1 salto extra en el aire.', apply:s=>s.maxJumps+=1 },
  { id:'frenzy', name:'ADRENALINA SINTÉTICA', category:'SISTEMA', icon:'✹', rarity:'ÉPICA', color:'#ff4d38', max:3, desc:'El frenesí dura +2 s y da +10% cadencia.', apply:s=>s.frenzyDuration+=2 },
  { id:'chips', name:'EXTRACTOR DE DATOS', category:'SISTEMA', icon:'◆', rarity:'RARA', color:'#ffbf47', max:3, desc:'+50% de chips de datos por baja.', apply:s=>s.chipMult+=.5 }
];

// ---------------------------------------------------------------------------
// Armas cuerpo a cuerpo (ranura E). Cada una tiene un especial propio.
export const MELEE = [
  {
    id:'blade', name:'HOJA DE FASE', sub:'CUCHILLA CORTA', icon:'⚔', color:'#6ef7e7',
    damage:2.35, cooldown:.42, range:3.2, arc:1.25, knock:6, unlock:'DESDE EL INICIO',
    how:'Barrido rápido delante de ti. Golpea a varios hostiles a la vez y empuja.',
    special:{ id:'phaseblink', name:'CORTE FANTASMA', desc:'Al rematar con la hoja recuperas un dash y ganas 1 s de invulnerabilidad.' }
  },
  {
    id:'hammer', name:'MARTILLO KINÉTICO', sub:'MAZA DE IMPACTO', icon:'⚒', color:'#ffbf47',
    damage:5.2, cooldown:1.15, range:3.6, arc:1.6, knock:14, unlock:'RONDA 4',
    how:'Golpe pesado en arco amplio. Lento, pero revienta blindaje y levanta a los hostiles.',
    special:{ id:'shatter', name:'QUEBRANTA', desc:'El impacto destruye el blindaje de un golpe y lanza una onda de daño en 4 m.' }
  },
  {
    id:'lance', name:'LANZA MONOFILAMENTO', sub:'ESTOCADA LARGA', icon:'➶', color:'#b56bff',
    damage:3.1, cooldown:.72, range:5.4, arc:.5, knock:4, unlock:'RONDA 7',
    how:'Estocada recta de largo alcance que ATRAVIESA a todos los hostiles en línea.',
    special:{ id:'lunge', name:'IMPULSO', desc:'La estocada te desplaza hacia delante y deja una estela que corta.' }
  },
  {
    id:'claws', name:'GARRAS DE PLASMA', sub:'CORTE RÁPIDO', icon:'✧', color:'#ff4d38',
    damage:1.5, cooldown:.24, range:2.8, arc:1.0, knock:2, unlock:'RONDA 10',
    how:'Dos zarpazos rapidísimos. Poco daño por golpe, pero aturde y roba vida.',
    special:{ id:'leech', name:'HEMORRAGIA', desc:'Cada golpe recupera 3 de vida. A los 8 golpes seguidos sueltas una descarga.' }
  },
  // ---- segunda hornada de cuerpo a cuerpo ---------------------------------
  {
    id:'scythe', name:'GUADAÑA DE FASE', sub:'BARRIDO AMPLIO', icon:'✂', color:'#9ff7ff',
    damage:2.9, cooldown:.62, range:4.4, arc:2.1, knock:5, unlock:'RONDA 5',
    how:'Barrido circular de 360°. Alcanza a todo lo que te rodea sin apuntar.',
    special:{ id:'whirl', name:'Torbellino', desc:'El barrido te levanta del suelo: esquivas disparos mientras giras.' }
  },
  {
    id:'fists', name:'PUÑOS DE PISTÓN', sub:'COMBATE CERRADO', icon:'✊', color:'#ffbf47',
    damage:1.9, cooldown:.18, range:2.4, arc:.9, knock:9, unlock:'RONDA 8',
    how:'Golpea con los dos puños alternos. Cada tercer golpe es un uppercut.',
    special:{ id:'uppercut', name:'UPPERCUT', desc:'El tercer golpe lanza al hostile por los aires y lo deja aturdido.' }
  },
  {
    id:'whip', name:'LÁTIGO DE DATOS', sub:'ALCANCE MEDIO', icon:'∿', color:'#b56bff',
    damage:2.2, cooldown:.5, range:6.2, arc:.35, knock:3, unlock:'RONDA 12',
    how:'Chasquido en línea recta que alcanza más lejos que cualquier hoja.',
    special:{ id:'pull', name:'ARRANQUE', desc:'Atrae al hostile hacia ti. Ideal para rematar con la espalda cubierta.' }
  },
  {
    id:'anchor', name:'ANCLA SÍSMICA', sub:'GOLPE DE SUELO', icon:'⚓', color:'#ff4d38',
    damage:6.4, cooldown:1.5, range:3.0, arc:2.6, knock:18, unlock:'RONDA 15',
    how:'Clavas el ancla y revientas el suelo en círculo. Lentísimo, definitivo.',
    special:{ id:'shock', name:'ONDASÍSMICA', desc:'Tres ondas concéntricas que se expanden y derriban a todo el grupo.' }
  }
];

// ---------------------------------------------------------------------------
// Ranura de utilidad (tecla G). Se recarga con el tiempo, no con munición.
export const UTILITY = [
  {
    id:'grenade', name:'GRANADA DE PULSO', icon:'◍', color:'#ffbf47', cooldown:7, charges:2,
    how:'Lanzas una granada que rebota y explota en área al detonar.',
    desc:'Explosión de 190 de daño en 6 m. Rebota una vez antes de detonar.'
  },
  {
    id:'medkit', name:'BOTIQUÍN DE CAMPO', icon:'✚', color:'#6ef7e7', cooldown:14, charges:1,
    how:'Instalas un botiquín: cura al instante y deja una zona que regenera durante 6 s.',
    desc:'Cura 55 de vida y deja un campo que regenera 9 por segundo mientras estés dentro.'
  },
  {
    id:'stim', name:'ESTIMULANTE DE COMBATE', icon:'↟', color:'#b56bff', cooldown:11, charges:1,
    how:'Te inyectas un estimulante: cadencia y velocidad disparadas durante 8 s.',
    desc:'+45% de cadencia y +35% de velocidad durante 8 s. Sin penalización al terminar.'
  },
  {
    id:'pylon', name:'TORRETA CENTINELA', icon:'⌂', color:'#ff4d38', cooldown:18, charges:1,
    how:'Despliegas un pilón que dispara solo al hostile más cercano durante 14 s.',
    desc:'Torreta fija: dispara cada 0.55 s al objetivo cercano. Los hostiles también la atacan.'
  },
  // ---- segunda hornada de utilidad ----------------------------------------
  {
    id:'phase', name:'PASO FANTASMA', icon:'◈', color:'#9ff7ff', cooldown:9, charges:2,
    how:'Atraviesas la materia durante un instante: ni daño ni colisiones.',
    desc:'1.2 s de intangibilidad total. Atraviesas hostiles, proyectiles y muros.'
  },
  {
    id:'beacon', name:'BALIZA DE EXTRACCIÓN', icon:'◆', color:'#ffbf47', cooldown:16, charges:1,
    how:'Una baliza atrae todos los chips del sector y los multiplica.',
    desc:'Recoge todos los chips en 30 m y los multiplica por 1.8 durante 8 s.'
  },
  {
    id:'emp', name:'PULSO EMP', icon:'⚡', color:'#b56bff', cooldown:20, charges:1,
    how:'Descarga electromagnética que paraliza y destruye proyectiles.',
    desc:'Aturde 2.5 s a todos los hostiles en 12 m y borra sus proyectiles.'
  },
  {
    id:'banner', name:'ESTANDARTE DE GUERRA', icon:'⚑', color:'#ff4d38', cooldown:24, charges:1,
    how:'Clavas un estandarte: todo el que pelee dentro gana cadencia y daño.',
    desc:'Zona de 9 m con +35% de daño y +25% de cadencia durante 15 s.'
  }
];

// ---------------------------------------------------------------------------
// Objetivos de ronda: rompen la monotonía de "mata a todos".
export const OBJECTIVES = [
  { id:'purge',    name:'EXTERMINIO',   icon:'✹', color:'#ff4d38', how:'Aviso clásico: elimina todas las señales hostiles de la ronda.' },
  { id:'survive',  name:'SUPERVIVENCIA',icon:'◴', color:'#ffbf47', how:'Aguanta vivo: la ronda termina cuando el cronómetro llegue a cero.' },
  { id:'collect',  name:'EXTRACCIÓN',   icon:'◆', color:'#6ef7e7', how:'Recoge los chips de datos que sueltan los hostiles antes de que caduquen.' },
  { id:'execute',  name:'EJECUCIÓN',    icon:'⌖', color:'#b56bff', how:'Remata con cuerpo a cuerpo: solo cuentan las bajas cuerpo a cuerpo.' },
  // ---- segunda hornada de objetivos ---------------------------------------
  { id:'protect', name:'DEFENSA', icon:'⛨', color:'#6ef7e7', how:'Un pilón aliado debe sobrevivir. Los hostiles irán a por él: defiéndelo.' },
  { id:'headhunt',name:'CABEZA DE CARTEL', icon:'⌖', color:'#ff4d38', how:'Un hostile marcado lleva tu recompensa. Solo cuentan los headshots.' },
  { id:'ritual',  name:'RITUAL', icon:'◍', color:'#b56bff', how:'Tres zonas: actívalas en orden mientras aguantas. No puedes salir corriendo.' },
  { id:'purge2',  name:'EXTERMINIO TOTAL', icon:'✹', color:'#ffbf47', how:'Doble de hostiles y sin refuerzos. La ronda termina cuando caiga el último.' }
];

// ---------------------------------------------------------------------------
// Logros locales: se guardan en el disco y se muestran en la biblioteca.
export const ACHIEVEMENTS = [
  { id:'firstblood',   name:'PRIMERA SANGRE',  icon:'✦', desc:'Consigue tu primera baja.' },
  { id:'bossdown',     name:'CAZADOR DE JEFES',icon:'☠', desc:'Derriba a un jefe de sector.' },
  { id:'worldclear',   name:'DOMADOR DE MUNDOS',icon:'★', desc:'Completa las 15 rondas de un mundo.' },
  { id:'round15',      name:'ZONA CRÍTICA',    icon:'⚠', desc:'Alcanza la ronda 15.' },
  { id:'synergy',      name:'ARQUITECTO',      icon:'◈', desc:'Activa una sinergia entre habilidades.' },
  { id:'melee50',      name:'CARNICERO',       icon:'⚔', desc:'Consigue 50 bajas con armas cuerpo a cuerpo.' },
  { id:'catdeploy',    name:'DUEÑO RESPONSABLE',icon:'❥', desc:'Invoca al gato robot 10 veces.' },
  { id:'nohit',        name:'INTOCABLE',       icon:'⛨', desc:'Termina una ronda de jefe sin recibir daño.' },
  { id:'combo50',      name:'SINCRONÍA TOTAL', icon:'⇶', desc:'Alcanza una sincronía de ×5.' },
  { id:'arsenal',      name:'ARSENAL COMPLETO',icon:'▮', desc:'Ten arma principal, cuerpo a cuerpo y utilidad equipados a la vez.' },
  // ---- segunda hornada de logros ------------------------------------------
  { id:'evolution',    name:'EVOLUCIONISTA',  icon:'★', desc:'Evoluciona una habilidad por primera vez.' },
  { id:'omnivore',     name:'OMNÍVORO',       icon:'☣', desc:'Activa tres sinergias distintas en la misma incursión.' },
  { id:'pactbound',    name:'EMPACTADO',      icon:'⛨', desc:'Acepta un pacto de interferencia.' },
  { id:'ghostwalker',  name:'CAMINANTE',      icon:'◈', desc:'Termina una ronda sin que te toquen.' },
  { id:'artillerist',  name:'ARTILLERO',      icon:'☄', desc:'Consigue 100 bajas con habilidades automáticas.' },
  { id:'swarmking',    name:'REY DEL ENJAMBRE',icon:'⋔', desc:'Ten seis aliados a la vez en el campo.' },
  { id:'deepdive',     name:'Buceo profundo', icon:'⚠', desc:'Alcanza la ronda 30.' },
  { id:'flawless',     name:'SIN FISURAS',    icon:'⛨', desc:'Derriba a un jefe sin perder escudo.' },
  { id:'collector',    name:'COLECCIONISTA',  icon:'◆', desc:'Junta 5.000 chips de datos en una sola incursión.' },
  { id:'speedrun',     name:'VELOCISTA',      icon:'»', desc:'Completa un mundo en menos de 9 minutos.' },
  { id:'executioner',  name:'VERDUGO',        icon:'⌾', desc:'Consigue 100 ejecuciones con COSECHA.' },
  { id:'factionkill',  name:'CAZADOR DE SECTORES', icon:'◈', desc:'Derriba al menos un jefe de cada facción.' }
];

// ---------------------------------------------------------------------------
// Ficha de biblioteca de cada hostile (texto para el códice).
export const ENEMY_CODEX = {
  chaser:  { name:'ACECHADOR DE CONTACTO', role:'INFANTERÍA DE CHOQUE', threat:1, tip:'Viene directo a por ti. Rodea y dispara mientras se acerca.' },
  ranged:  { name:'HOSTIGADOR', role:'FUEGO DE SUPRESIÓN', threat:2, tip:'Se para a distancia y dispara. Usa cobertura: los coches y los contenedores cortan sus tiros.' },
  tank:    { name:'UNIDAD BLINDADA', role:'RUPTOR DE LÍNEA', threat:3, tip:'Placas frontales: rompe el blindaje antes de buscar el punto débil.' },
  drone:   { name:'DRON DE ENJAMBRE', role:'RECONOCIMIENTO AÉREO', threat:1, tip:'Muy rápido y frágil. Un solo disparo bien puesto lo basta.' },
  flyer:   { name:'HOSTIL AÉREO', role:'ATAQUE EN PICADO', threat:3, tip:'Se cierne y pica. Dispara cuando baje; el arma antiaérea lo derriba de un tiro.' },
  stalker: { name:'SIGILOSO', role:'EMBOSCADA', threat:4, tip:'Casi invisible y muy rápido. Escucha el susurro y golpea antes de que llegue.' },
  support: { name:'NODO DE APOYO', role:'CURACIÓN Y ESCUDOS', threat:4, tip:'Refuerza a los demás. Mátalo primero o la ronda no terminará nunca.' },
  boss:    { name:'UNIDAD DE MANDO', role:'JEFE DE SECTOR', threat:5, tip:'Fases, telegrafía y habilidades propias. Lee el aviso antes de cada técnica.' },
  // ---- segunda hornada ------------------------------------------------------
  sapper:  { name:'ZAPADOR', role:'ARTILLERÍA EN ARCO', threat:4, tip:'Lanza orbes en parábola que reventan en área. El suelo te avisa dónde: muévete.' },
  brute:   { name:'BRUTO', role:'RUPTOR PESADO', threat:5, tip:'Más ancho que alto. Rompe sus placas antes de que embista: la carga es letal.' },
  swarmling:{ name:'CRÍA', role:'INUNDACIÓN', threat:2, tip:'Frágil y rapidísima. Nunca viene sola: usa área o te pasarán por encima.' },
  turret:  { name:'CENTINELA', role:'FUEGO ANCLADO', threat:3, tip:'No persigue. Barre con ráfagas largas: rómpelo desde lejos o flanquéalo.' },
  wraith:  { name:'ESPECTRO', role:'DESPLAZAMIENTO', threat:5, tip:'Se teletransporta a tu espalda cada pocos segundos. Escucha el chasquido.' }
};

// Modificadores aleatorios de oleada: suben el riesgo y la recompensa.
export const MODIFIERS = [
  { id:'fast', name:'ACELERADO', desc:'Los hostiles se mueven un 20% más rápido.', color:'#ffbf47', score:1.1 },
  { id:'elite', name:'CACERÍA DE ÉLITES', desc:'El doble de élites: más botín, más riesgo.', color:'#ff4d38', score:1.25 },
  { id:'shield', name:'ESCUDO REACTOR', desc:'Todos los hostiles nacen con escudo regenerativo.', color:'#6ef7e7', score:1.2 },
  { id:'tank', name:'BLINDAJE PESADO', desc:'Los hostiles tienen un 50% más de vida.', color:'#b56bff', score:1.15 },
  { id:'swarm', name:'ENJAMBRE', desc:'Aparecen voladores y acechadores de apoyo.', color:'#b6ff3d', score:1.2 },
  { id:'rage', name:'FURIA', desc:'Los hostiles golpean un 25% más fuerte.', color:'#ff4d38', score:1.3 },
  { id:'glass', name:'VIDRIO ROTO', desc:'Menos vida enemiga peroLiberan el doble de chips.', color:'#6ef7e7', score:1.15 },
  // ---- segunda hornada de modificadores -----------------------------------
  { id:'volatile', name:'VOLÁTIL', desc:'Al morir, los hostiles detonan en cadena.', color:'#ff4d38', score:1.25 },
  { id:'magnet', name:'CAMPO MAGNÉTICO', desc:'Los hostiles te persiguen con más tenacidad y más rápido.', color:'#ffbf47', score:1.15 },
  { id:'mirror', name:'ESPEJO', desc:'Cada hostile refleja una parte del daño que recibe.', color:'#9ff7ff', score:1.3 },
  { id:'famine', name:'ESCASEZ', desc:'No cae botín: solo cuentan las bajas. Los chips se triplican.', color:'#b56bff', score:1.35 },
  { id:'gravity', name:'GRAVEDAD BAJA', desc:'Saltas el doble de alto y caes más despacio.', color:'#6ef7e7', score:1.1 },
  { id:'overtime', name:'PRÓRROGA', desc:'Los refuerzos nunca dejan de llegar durante la ronda.', color:'#ff4d38', score:1.4 },
  { id:'fog', name:'NIEBLA DE SEÑAL', desc:'El radar se apaga: no ves los puntos hostiles.', color:'#b6ff3d', score:1.2 },
  { id:'bloodmoon', name:'LUNA ROJA', desc:'Todo el mundo pega el doble. Tú también.', color:'#ff4d38', score:1.45 }
];

export const DIFFICULTIES = [
  { id:'recruit', name:'RECRUTA', desc:'Hostiles débiles. Buen sitio para aprender.', hp:.78, speed:.9, damage:.8, reward:.8 },
  { id:'vet', name:'VETERANO', desc:'Equilibrio recomendado.', hp:1, speed:1, damage:1, reward:1 },
  { id:'elite', name:'ELITE', desc:'Brutal. Duplica el riesgo, triplica el botín.', hp:1.35, speed:1.12, damage:1.3, reward:1.6 },
  // ---- segunda hornada: dificultades extremas ------------------------------
  { id:'nightmare', name:'PESADILLA', desc:'Cada golpe duele. Para quien ya sabe moverse.', hp:1.8, speed:1.2, damage:1.7, reward:2.4 },
  { id:'revenant', name:'REVENANT', desc:'El sector va a por ti desde el segundo uno. Sin piedad.', hp:2.6, speed:1.35, damage:2.3, reward:4 },
  { id:'gauntlet', name:'GUANTELETE', desc:'Todo empieza en la ronda 10 y con un pacto ya sellado.', hp:2.2, speed:1.28, damage:2.0, reward:3.2 }
];

// Niveles: un mapa por facción. Se elige antes de la incursión y ya no rota.
export const LEVELS = [
  {
    id:'rooftop', name:'PRADERAS FELICES', faction:'SYNTEK', boss:'WARDEN', style:'plaza',
    tagline:'Praderas de bloques a mediodía: mesetas de hierba, cortados de piedra, riachuelos con puentes y un castillo blanco en el horizonte.',
    difficulty:'RIESGO MEDIO', rewardMult:1,
    floor:0x111a1e, accent:'#7fc9bd', accentHex:0x6ef7e7, fog:0x071014, sky:0x05090d, hemi:0x7cb5c4, moon:0xb8e9ef,
    layout:[
      [0,0,7,1.6,7],[0,-14,11,1.6,3],[0,14,11,1.6,3],[-17,0,3,1.6,11],[17,0,3,1.6,11],
      [0,-9,4,.8,2],[0,9,4,.8,2],[-11.5,0,2,.8,4],[11.5,0,2,.8,4],
      [-15,-15,4.4,2.6,4.4],[15,15,4.4,2.6,4.4],[15,-15,3.4,2.6,3.4],[-15,15,3.4,2.6,3.4],
      [-10,-11,3,1.4,3],[10,11,3,1.4,3],
      [0,-27,16,3.4,2.2],[0,27,16,3.4,2.2],[-27,0,2.2,3.4,16],[27,0,2.2,3.4,16],
      [-9,-23,3,1.8,3],[9,23,3,1.8,3],[-23,9,3,1.8,3],[23,-9,3,1.8,3],
      [-33,-33,5,8,5],[33,33,5,8,5],[-33,33,4,6,7],[33,-33,7,6,3],
      [0,-40,10,4.5,3],[0,40,10,4.5,3]
    ]
  },
  {
    id:'hive', name:'BOSQUE ENCANTADO', faction:'HIVE', boss:'MATRIARCA', style:'industrial',
    tagline:'Bosque de setas gigantes que brillan. Niebla turquesa, ruinas con musgo y agua que emite luz bajo los pies.',
    difficulty:'RIESGO ALTO', rewardMult:1.15,
    floor:0x131a10, accent:'#a9c469', accentHex:0xb6ff3d, fog:0x0a1409, sky:0x070d06, hemi:0xa8c46a, moon:0xdff3a8,
    layout:[
      [0,0,8,1.2,8],[0,-8,4,.9,4],[0,8,4,.9,4],[-13,0,4,.9,4],[13,0,4,.9,4],
      [-14,-8,5,2.4,5],[14,8,5,2.4,5],[-9,15,4.5,1.6,4.5],[9,-15,4.5,1.6,4.5],
      [0,-21,14,2.8,2.6],[0,21,14,2.8,2.6],[-21,0,2.6,2.8,14],[21,0,2.6,2.8,14],
      [-11,-17,3,1.5,3],[11,17,3,1.5,3],[-17,11,3,1.5,3],[17,-11,3,1.5,3],
      [-24,-24,6,3.6,6],[24,24,6,3.6,6],[-24,24,5,5.5,5],[24,-24,5,5.5,5],
      [-34,6,4,7,12],[34,-6,4,7,12],[6,-34,12,7,4],[-6,34,12,7,4],
      [0,-31,3,2,3],[0,31,3,2,3],[-31,0,3,2,3],[31,0,3,2,3]
    ]
  },
  {
    id:'docks', name:'DESIERTO SOLAR', faction:'UMBRA', boss:'HERALDO', style:'harbor',
    tagline:'Dunas y mesetas de arena roja bajo un sol partido. Sombra escasa, arena que cruje y ruinas enterradas.',
    difficulty:'RIESGO EXTREMO', rewardMult:1.32,
    floor:0x141022, accent:'#9d8ecb', accentHex:0xb56bff, fog:0x0b0818, sky:0x06040d, hemi:0x9a86d8, moon:0xc9b6ff,
    layout:[
      [-18,-10,6,1.8,10],[18,10,6,1.8,10],[-10,18,10,1.8,6],[10,-18,10,1.8,6],
      [-13,-4,3,1,5],[13,4,3,1,5],[-4,13,5,1,3],[4,-13,5,1,3],
      [-22,14,5,3.2,5],[22,-14,5,3.2,5],[-6,-24,8,2.6,3],[6,24,8,2.6,3],
      [-16,-20,3,1.6,3],[16,20,3,1.6,3],[-20,-16,3,1.6,3],[20,16,3,1.6,3],
      [0,0,5,4.2,5],[0,-6,3,1.5,3],[0,6,3,1.5,3],
      [0,-30,18,3.6,2.4],[0,30,18,3.6,2.4],[-30,0,2.4,3.6,18],[30,0,2.4,3.6,18],
      [-11,-27,3,2,3],[11,27,3,2,3],[-27,11,3,2,3],[27,-11,3,2,3],
      [-35,-35,6,9,6],[35,35,6,9,6],[-35,35,5,6,8],[35,-35,8,6,5]
    ]
  },
  // ---- segunda hornada: tres sectores por facción nueva y variantes -------
  {
    id:'spire', name:'CIUDAD CYBERPUNK', faction:'SYNTEK', boss:'ÁRBITRO PRIME', style:'spire',
    tagline:'Rascacielos de bloques y neón vertical. Azoteas de cristal, pasarelas y lluvia violeta sobre el vacío.',
    difficulty:'RIESGO ALTO', rewardMult:1.18,
    floor:0x10161c, accent:'#7fc9bd', accentHex:0x6ef7e7, fog:0x06090e, sky:0x04070b, hemi:0x6f9fae, moon:0xaee3ee,
    layout:[
      [0,0,9,1.2,9],[0,-11,6,.8,3],[0,11,6,.8,3],[-12,0,3,.8,6],[12,0,3,.8,6],
      [-13,-13,4,2.4,4],[13,13,4,2.4,4],[-13,13,3.4,3.2,3.4],[13,-13,3.4,3.2,3.4],
      [0,-22,14,2.2,2],[0,22,14,2.2,2],[-22,0,2,2.2,14],[22,0,2,2.2,14],
      [-8,-8,2.4,1,2.4],[8,8,2.4,1,2.4],[-8,8,2,1.4,2],[8,-8,2,1.4,2],
      [-26,-6,4,5,10],[26,6,4,5,10],[6,-26,10,5,4],[-6,26,10,5,4],
      [0,-33,10,3,2.4],[0,33,10,3,2.4],[-33,0,2.4,3,10],[33,0,2.4,3,10]
    ]
  },
  {
    id:'scrapyard', name:'HIELO ETERNO', faction:'SYNTEK', boss:'OVERSEER AXIOM', style:'waste',
    tagline:'Glaciar de bloques azules: plataformas de hielo, grietas profundas y ventisca a ras de suelo.',
    difficulty:'RIESGO MEDIO', rewardMult:1.08,
    floor:0x151311, accent:'#7fc9bd', accentHex:0x6ef7e7, fog:0x0a0908, sky:0x070605, hemi:0x8a7f6c, moon:0xb8e9ef,
    layout:[
      [0,0,6,1.4,6],[-9,-9,5,2.2,5],[9,9,5,2.2,5],[-9,9,4,3,4],[9,-9,4,3,4],
      [0,-14,10,1.8,3],[0,14,10,1.8,3],[-14,0,3,1.8,10],[14,0,3,1.8,10],
      [-16,-16,4,4.5,4],[16,16,4,4.5,4],[-16,16,3,2.5,3],[16,-16,3,2.5,3],
      [-6,-20,3,2,3],[6,20,3,2,3],[-20,6,3,2,3],[20,-6,3,2,3],
      [0,-27,15,3.5,2.4],[0,27,15,3.5,2.4],[-27,0,2.4,3.5,15],[27,0,2.4,3.5,15],
      [-24,-24,6,6,6],[24,24,6,6,6],[24,-24,5,4,7],[-24,24,7,4,5]
    ]
  },
  {
    id:'refinery', name:'FÁBRICA INFERNAL', faction:'HIVE', boss:'MATRIARCA', style:'industrial',
    tagline:'Naves de ladrillo, chimeneas encendidas y lava corriendo entre pasarelas de metal.',
    difficulty:'RIESGO ALTO', rewardMult:1.2,
    floor:0x111a0f, accent:'#a9c469', accentHex:0xb6ff3d, fog:0x08110a, sky:0x050a06, hemi:0x9cbe62, moon:0xdff3a8,
    layout:[
      [0,0,7,1.4,7],[-10,-6,4,2.6,6],[10,6,4,2.6,6],[-10,6,6,2.6,4],[10,-6,6,2.6,4],
      [0,-13,12,1.6,3],[0,13,12,1.6,3],[-13,0,3,1.6,12],[13,0,3,1.6,12],
      [-17,-4,5,3.6,10],[17,4,5,3.6,10],[4,-17,10,3.6,5],[-4,17,10,3.6,5],
      [-7,-7,2.6,1.2,2.6],[7,7,2.6,1.2,2.6],[-7,7,2,2,2],[7,-7,2,2,2],
      [0,-25,14,3,2.4],[0,25,14,3,2.4],[-25,0,2.4,3,14],[25,0,2.4,3,14],
      [-21,-21,5,7,5],[21,21,5,7,5],[-21,21,4,5,6],[21,-21,6,5,4]
    ]
  },
  {
    id:'undercity', name:'RUINAS ANTIGUAS', faction:'HIVE', boss:'HIDRA DE POLÍGONO', style:'waste',
    tagline:'Templo devorado por la selva: columnas caídas, escalinatas y agua verdosa entre los bloques.',
    difficulty:'RIESGO EXTREMO', rewardMult:1.35,
    floor:0x0e1410, accent:'#a9c469', accentHex:0xb6ff3d, fog:0x050a08, sky:0x030705, hemi:0x7f9c58, moon:0xdff3a8,
    layout:[
      [0,0,5,1.2,5],[-8,-8,6,2,3],[8,8,6,2,3],[-8,8,3,2,6],[8,-8,3,2,6],
      [0,-12,14,2.4,2],[0,12,14,2.4,2],[-12,0,2,2.4,14],[12,0,2,2.4,14],
      [-15,-15,4,4,4],[15,15,4,4,4],[-15,15,3,3,3],[15,-15,3,3,3],
      [-5,-18,3,1.8,3],[5,18,3,1.8,3],[-18,5,3,1.8,3],[18,-5,3,1.8,3],
      [0,-24,12,4,2],[0,24,12,4,2],[-24,0,2,4,12],[24,0,2,4,12],
      [-19,-19,6,8,6],[19,19,6,8,6],[19,-19,5,5,7],[-19,19,7,5,5],
      [0,-30,8,2.4,3],[0,30,8,2.4,3]
    ]
  },
  {
    id:'cathedral', name:'CASTILLO OSCURO', faction:'UMBRA', boss:'HERALDO', style:'spire',
    tagline:'Fortaleza de piedra negra con estandartes. Patio de losas, torres altas y una luna roja encima.',
    difficulty:'RIESGO EXTREMO', rewardMult:1.38,
    floor:0x120f1c, accent:'#9d8ecb', accentHex:0xb56bff, fog:0x08060f, sky:0x04030a, hemi:0x8d7ac4, moon:0xc9b6ff,
    layout:[
      [0,0,8,1,8],[-11,0,3,3.2,14],[11,0,3,3.2,14],[0,-11,14,3.2,3],[0,11,14,3.2,3],
      [-14,-14,4,4.5,4],[14,14,4,4.5,4],[-14,14,4,4.5,4],[14,-14,4,4.5,4],
      [-6,-18,3,2.4,3],[6,18,3,2.4,3],[-18,6,3,2.4,3],[18,-6,3,2.4,3],
      [0,-19,16,2,2],[0,19,16,2,2],[-19,0,2,2,16],[19,0,2,2,16],
      [-8,-8,2.4,1,2.4],[8,8,2.4,1,2.4],[-8,8,2.4,1,2.4],[8,-8,2.4,1,2.4],
      [0,-28,12,4,2.4],[0,28,12,4,2.4],[-28,0,2.4,4,12],[28,0,2.4,4,12],
      [-23,-23,5,9,5],[23,23,5,9,5],[-23,23,4,6,7],[23,-23,7,6,4]
    ]
  },
  {
    id:'terminus', name:'VOLCÁN ROJO', faction:'UMBRA', boss:'ANOMALÍA', style:'harbor',
    tagline:'Cráter abierto y ríos de magma. Ceniza en el aire y roca que se parte bajo las botas.',
    difficulty:'RIESGO CRÍTICO', rewardMult:1.5,
    floor:0x100c18, accent:'#9d8ecb', accentHex:0xb56bff, fog:0x070510, sky:0x030208, hemi:0x7f6cb4, moon:0xc9b6ff,
    layout:[
      [0,0,6,1.6,6],[-14,-14,5,2,5],[14,14,5,2,5],[-14,14,5,2,5],[14,-14,5,2,5],
      [-9,0,3,1.2,12],[9,0,3,1.2,12],[0,-9,12,1.2,3],[0,9,12,1.2,3],
      [-19,-6,4,3,8],[19,6,4,3,8],[6,-19,8,3,4],[-6,19,8,3,4],
      [-4,-13,2.4,1.6,2.4],[4,13,2.4,1.6,2.4],[-13,4,2.4,1.6,2.4],[13,-4,2.4,1.6,2.4],
      [0,-26,14,3.4,2.4],[0,26,14,3.4,2.4],[-26,0,2.4,3.4,14],[26,0,2.4,3.4,14],
      [-22,-22,6,8,6],[22,22,6,8,6],[22,-22,5,6,7],[-22,22,7,6,5]
    ]
  },
  {
    id:'greenhouse', name:'ISLA TROPICAL', faction:'HELIX', boss:'FLORACIÓN', style:'plaza',
    tagline:'Atolón de arena y palmeras rodeado de mar. Agua turquesa, pasarelas de madera y sol alto.',
    difficulty:'RIESGO ALTO', rewardMult:1.22,
    floor:0x0f1a17, accent:'#5fe6b0', accentHex:0x3dffb0, fog:0x08130f, sky:0x050b09, hemi:0x6fbfa0, moon:0xa8ffdc,
    layout:[
      [0,0,7,1.2,7],[-10,-10,5,2,5],[10,10,5,2,5],[-10,10,4,2.6,4],[10,-10,4,2.6,4],
      [0,-13,12,1.6,3],[0,13,12,1.6,3],[-13,0,3,1.6,12],[13,0,3,1.6,12],
      [-16,-6,4,3.4,10],[16,6,4,3.4,10],[6,-16,10,3.4,4],[-6,16,10,3.4,4],
      [-6,-6,2.6,1.2,2.6],[6,6,2.6,1.2,2.6],[-6,6,2.4,2,2.4],[6,-6,2.4,2,2.4],
      [0,-24,14,3,2.4],[0,24,14,3,2.4],[-24,0,2.4,3,14],[24,0,2.4,3,14],
      [-20,-20,5,7,5],[20,20,5,7,5],[20,-20,4,5,6],[-20,20,6,5,4]
    ]
  },
  {
    id:'foundry', name:'ESPACIO INFINITO', faction:'PYRE', boss:'FORJA', style:'industrial',
    tagline:'Asteroide a la deriva: bloques de basalto flotando sobre un cielo estrellado sin fondo.',
    difficulty:'RIESGO EXTREMO', rewardMult:1.4,
    floor:0x1a1109, accent:'#ff9a3d', accentHex:0xff7a2f, fog:0x120a05, sky:0x0a0603, hemi:0xc47a44, moon:0xffd0a0,
    layout:[
      [0,0,8,1.6,8],[-11,-11,5,2.4,5],[11,11,5,2.4,5],[-11,11,4,3,4],[11,-11,4,3,4],
      [0,-14,13,1.8,3],[0,14,13,1.8,3],[-14,0,3,1.8,13],[14,0,3,1.8,13],
      [-18,-6,5,4,10],[18,6,5,4,10],[6,-18,10,4,5],[-6,18,10,4,5],
      [-7,-7,2.6,1.4,2.6],[7,7,2.6,1.4,2.6],[-7,7,2.4,2.2,2.4],[7,-7,2.4,2.2,2.4],
      [0,-26,15,3.6,2.4],[0,26,15,3.6,2.4],[-26,0,2.4,3.6,15],[26,0,2.4,3.6,15],
      [-22,-22,6,8,6],[22,22,6,8,6],[22,-22,5,6,7],[-22,22,7,6,5]
    ]
  },
  {
    id:'nullspace', name:'CIUDAD CELESTIAL', faction:'NULL', boss:'OMEGA', style:'spire',
    tagline:'Ciudad de mármol blanco entre las nubes. Terrazas flotantes, cúpulas doradas y luz difusa.',
    difficulty:'RIESGO CRÍTICO', rewardMult:1.55,
    floor:0x0f1116, accent:'#d8e6ff', accentHex:0xd8e6ff, fog:0x070810, sky:0x04050a, hemi:0x8f9ab5, moon:0xe8f0ff,
    layout:[
      [0,0,6,1,6],[-9,-9,4,1.8,4],[9,9,4,1.8,4],[-9,9,4,1.8,4],[9,-9,4,1.8,4],
      [0,-11,10,1.2,2.4],[0,11,10,1.2,2.4],[-11,0,2.4,1.2,10],[11,0,2.4,1.2,10],
      [-14,-14,3.4,3,3.4],[14,14,3.4,3,3.4],[-14,14,3.4,3,3.4],[14,-14,3.4,3,3.4],
      [-5,-16,2.4,1.6,2.4],[5,16,2.4,1.6,2.4],[-16,5,2.4,1.6,2.4],[16,-5,2.4,1.6,2.4],
      [0,-22,12,3,2],[0,22,12,3,2],[-22,0,2,3,12],[22,0,2,3,12],
      [-18,-18,5,6,5],[18,18,5,6,5],[18,-18,4,4,6],[-18,18,6,4,4],
      [-28,0,3,7,3],[28,0,3,7,3],[0,-28,3,7,3],[0,28,3,7,3]
    ]
  }
];

// ---------------------------------------------------------------------------
// Arte por sector. Criterios de legibilidad (evita la fatiga visual):
//   · El suelo y la arquitectura van en valores medios y baja saturación.
//   · El color vivo queda para el jugador, los hostiles y el botín.
//   · La niebla es clara: da profundidad y separa planos sin oscurecer.
//   · Cielo con gradiente en vez de negro: da referencia y descansa la vista.
//   · Bloom bajo: el neón permanente en toda la escena cansa y reduce contraste.
export const LEVEL_ART = {
  rooftop: {
    floor: 0x7d766a, platform: 0x948d7e, trim: 0xc08a3e, trim2: 0x6f8b93,
    sky: 0xa9c2cd, skyTop: 0x6f9dc6, fog: 0xa8bcc4, fogDensity: .0062,
    hemiSky: 0xd7e0dc, hemiGround: 0x6b6559, hemiInt: 2.1,
    sun: 0xfff0d6, sunInt: 3.1, sunPos: [-22, 34, 16],
    fillA: 0xffd9a2, fillB: 0x8fc4d4, fillInt: 34,
    bloom: .16, rain: 0, exposure: 1.05
  },
  hive: {
    floor: 0x6d7269, platform: 0x82877c, trim: 0x8fa14e, trim2: 0x7d8790,
    sky: 0xb6bdb4, skyTop: 0x8fa6a8, fog: 0xb0b8b0, fogDensity: .0058,
    hemiSky: 0xdfe5da, hemiGround: 0x5f655c, hemiInt: 2.0,
    sun: 0xf4f0e2, sunInt: 2.7, sunPos: [18, 30, -14],
    fillA: 0xd9dcb0, fillB: 0x9fc0c8, fillInt: 30,
    bloom: .14, rain: .35, exposure: 1.02
  },
  docks: {
    floor: 0x6a6f74, platform: 0x7d8489, trim: 0xc98a52, trim2: 0x6f8fa0,
    sky: 0xd9c3ab, skyTop: 0x7e9cbe, fog: 0xc6b6a6, fogDensity: .0068,
    hemiSky: 0xffe6c8, hemiGround: 0x565d63, hemiInt: 1.95,
    sun: 0xffd9a8, sunInt: 3.3, sunPos: [26, 18, -22],
    fillA: 0xffbf80, fillB: 0x7fb4c8, fillInt: 36,
    bloom: .18, rain: .2, exposure: 1.06
  },
  spire: {
    floor: 0x767d86, platform: 0x8c949d, trim: 0x7fc9bd, trim2: 0x8fa7b4,
    sky: 0x8fa8c4, skyTop: 0x4a6f9e, fog: 0x93a8bd, fogDensity: .0052,
    hemiSky: 0xd3e2ee, hemiGround: 0x5b626b, hemiInt: 2.15,
    sun: 0xf2f6ff, sunInt: 2.9, sunPos: [-14, 40, 22],
    fillA: 0x8fd8e8, fillB: 0x7f9ec4, fillInt: 32,
    bloom: .20, rain: 0, exposure: 1.04
  },
  waste: {
    floor: 0x6f6656, platform: 0x847a68, trim: 0xb08348, trim2: 0x77838a,
    sky: 0xc0b49c, skyTop: 0x8a9aa8, fog: 0xb5aa96, fogDensity: .0072,
    hemiSky: 0xe0d8c4, hemiGround: 0x5d5648, hemiInt: 1.85,
    sun: 0xffe2b8, sunInt: 2.6, sunPos: [-30, 22, 12],
    fillA: 0xffcf94, fillB: 0x8fb0bc, fillInt: 28,
    bloom: .13, rain: .1, exposure: 1.0
  },
  refinery: {
    floor: 0x5f6a52, platform: 0x727d63, trim: 0xa9c469, trim2: 0x6f8088,
    sky: 0xa8b596, skyTop: 0x6f8a7e, fog: 0xa2b092, fogDensity: .0060,
    hemiSky: 0xdae4c8, hemiGround: 0x4e5644, hemiInt: 1.9,
    sun: 0xf0f4dc, sunInt: 2.5, sunPos: [16, 28, 18],
    fillA: 0xc8dc90, fillB: 0x8fb8c0, fillInt: 30,
    bloom: .15, rain: .3, exposure: 1.02
  },
  undercity: {
    floor: 0x4e5a4c, platform: 0x616d5e, trim: 0x9fd44a, trim2: 0x5e6f78,
    sky: 0x7d8a76, skyTop: 0x3f4d48, fog: 0x6e7a68, fogDensity: .0090,
    hemiSky: 0xb0c0a4, hemiGround: 0x3a4338, hemiInt: 1.5,
    sun: 0xd8e6c0, sunInt: 1.6, sunPos: [-8, 26, -18],
    fillA: 0xa8d46a, fillB: 0x7fa0ac, fillInt: 24,
    bloom: .17, rain: .25, exposure: .98
  },
  cathedral: {
    floor: 0x605a70, platform: 0x736d84, trim: 0xb56bff, trim2: 0x7a6f96,
    sky: 0x9a8cbe, skyTop: 0x554a7e, fog: 0x8e82b0, fogDensity: .0065,
    hemiSky: 0xd6c8f2, hemiGround: 0x484356, hemiInt: 1.8,
    sun: 0xf0e8ff, sunInt: 2.4, sunPos: [10, 38, -16],
    fillA: 0xc9a8ff, fillB: 0x8f9ad0, fillInt: 34,
    bloom: .22, rain: 0, exposure: 1.03
  },
  terminus: {
    floor: 0x5a5470, platform: 0x6d6684, trim: 0xb56bff, trim2: 0x74688f,
    sky: 0x7c6ea0, skyTop: 0x332c4e, fog: 0x6d6089, fogDensity: .0082,
    hemiSky: 0xc0b0e0, hemiGround: 0x423c54, hemiInt: 1.6,
    sun: 0xe8dcff, sunInt: 2.0, sunPos: [-18, 30, 14],
    fillA: 0xb98cff, fillB: 0x8490c4, fillInt: 30,
    bloom: .24, rain: .15, exposure: 1.01
  },
  greenhouse: {
    floor: 0x5d6f60, platform: 0x708370, trim: 0x5fe6b0, trim2: 0x6f8a80,
    sky: 0xa8c4ac, skyTop: 0x6f9a86, fog: 0xa0bca4, fogDensity: .0062,
    hemiSky: 0xd8ecd8, hemiGround: 0x4a5a4c, hemiInt: 2.05,
    sun: 0xf0fff0, sunInt: 2.8, sunPos: [20, 34, 10],
    fillA: 0x9fffc8, fillB: 0x8fc0b4, fillInt: 32,
    bloom: .18, rain: .4, exposure: 1.05
  },
  foundry: {
    floor: 0x6a5140, platform: 0x7d6350, trim: 0xff9a3d, trim2: 0x8a6a52,
    sky: 0xd8a074, skyTop: 0x8a4a2a, fog: 0xc08a60, fogDensity: .0075,
    hemiSky: 0xffd8b0, hemiGround: 0x54382a, hemiInt: 1.7,
    sun: 0xffc088, sunInt: 3.4, sunPos: [12, 24, -26],
    fillA: 0xff9a4a, fillB: 0xa07050, fillInt: 34,
    bloom: .26, rain: 0, exposure: 1.07
  },
  nullspace: {
    floor: 0x6c7280, platform: 0x808794, trim: 0xd8e6ff, trim2: 0x9aa4b4,
    sky: 0xb8c4d8, skyTop: 0x5c6a86, fog: 0xacb8cc, fogDensity: .0055,
    hemiSky: 0xe4ecff, hemiGround: 0x50555f, hemiInt: 2.25,
    sun: 0xffffff, sunInt: 3.0, sunPos: [-20, 42, -10],
    fillA: 0xd8e6ff, fillB: 0x8fa0c0, fillInt: 30,
    bloom: .21, rain: 0, exposure: 1.08
  }
};

// Sistema de rondas: cada ronda sube el nivel de amenaza de forma acumulativa.
export const ROUNDS = {
  hpPerRound: .155,        // vida por ronda (crecimiento compuesto)
  dmgPerRound: .062,       // daño que infligen
  speedPerRound: .013,     // velocidad
  countBase: 5, countPerRound: 2.5, countMax: 38,
  eliteFrom: 3,            // a partir de qué ronda aparecen élites
  eliteEvery: 3,
  modifierFrom: 2,         // modificador de ronda
  secondModifierFrom: 11,  // segundo modificador (rondas avanzadas)
  thirdModifierFrom: 19,
  bossEvery: 5,
  perWorld: 15,            // rondas por mundo: jefe en la 5, la 10 y la 15
  bossesPerFaction: 3,
  tierEvery: 4,            // cada cuántas rondas sube el aspecto de los hostiles
  armorFrom: 8             // a partir de aquí los normales pueden nacer blindados
};
// Nombres de los tramos de dificultad para el HUD.
export function roundLabel(round) {
  if (round >= 21) return 'ZONA CRÍTICA';
  if (round >= 16) return 'COLAPSO';
  if (round >= 11) return 'ESCALADA';
  if (round >= 6) return 'PRESIÓN';
  return 'CONTACTO';
}

export const SLOTS = {
  cost: 250,
  symbols: [
    { id:'dmg',  icon:'⚡', label:'DAÑO',     color:'#6ef7e7', plain:'Daño permanente durante esta partida' },
    { id:'def',  icon:'⛨', label:'ESCUDO',   color:'#6ef7e7', plain:'Escudo y vida extra' },
    { id:'wpn',  icon:'➶', label:'ARMA',     color:'#ffbf47', plain:'Una arma especial nueva' },
    { id:'epic', icon:'★', label:'ÉPICA',    color:'#ff4d38', plain:'Mutaciones épicas del arsenal' },
    { id:'chip', icon:'◆', label:'CHIPS',    color:'#ffbf47', plain:'Chips de datos para volver a girar' },
    { id:'skull',icon:'☠', label:'RIESGO',   color:'#b56bff', plain:'Más puntos, pero los hostiles se enfurecen' }
  ],
  rules: [
    ['3 IGUALES', 'Jackpot: mutaciones épicas + arma especial'],
    ['2 IGUALES', 'Premio parcial del símbolo repetido'],
    ['NINGUNO', 'Consuelo: 120 chips de datos'],
    ['☠ TRIPLE', 'Maldición: hostiles más rápidos, puntos ×1.75']
  ]
};
