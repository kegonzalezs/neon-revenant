// NEON//REVENANT — los 12 escenarios.
// ---------------------------------------------------------------------------
// Cada mundo se compone con el mismo vocabulario de bloques (voxel.js) pero con
// su propia paleta, su silueta y sus piezas: praderas con castillo al fondo,
// bosque de setas gigantes, desierto, ciudad de neón, fábrica, hielo, castillo
// oscuro, ruinas, volcán, isla, espacio y ciudad celestial.
//
// El reparto de alturas siempre deja rutas transitables: meseta central, escaleras
// de 0,5 por peldaño, puentes y saltos de 2 bloques como máximo.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { WorldBuilder, ARENA, jit, shadeHex, mixHex, buildSky, blockFace } from './voxel.js';

// ---------------------------------------------------------------------------
// Arte por mundo: cielo, niebla, sol, relleno y post-proceso.
// ---------------------------------------------------------------------------
export const WORLD_ART = {
  // 1 · PRADERAS FELICES
  rooftop: {
    sky: 0x3fa2ff, skyTop: 0x1668d8, fog: 0xcfe9ff, fogDensity: 0.0022,
    hemiSky: 0xdcefff, hemiGround: 0x6a9a44, hemiInt: 0.88,
    sun: 0xfff4d8, sunInt: 4.3, sunPos: [38, 64, 44],
    fillA: 0xffe6b8, fillB: 0x9fd4ff, fillInt: 12,
    bloom: 0.10, exposure: 1.24, rain: 0,
    floor: 0x6fbe35, platform: 0x7f8b98, trim: 0x9be05a, trim2: 0xffd45e
  },
  // 2 · BOSQUE ENCANTADO
  hive: {
    sky: 0x1e9fb4, skyTop: 0x07303e, fog: 0x156674, fogDensity: 0.0048,
    hemiSky: 0x9fe8e0, hemiGround: 0x1d4a2a, hemiInt: 1.15,
    sun: 0xd8fff6, sunInt: 2.9, sunPos: [14, 46, -16],
    fillA: 0xff5ad0, fillB: 0x2fe8d8, fillInt: 44,
    bloom: 0.58, exposure: 1.02, rain: 0,
    floor: 0x4fae2a, platform: 0x4d5670, trim: 0x5affd0, trim2: 0xff5ad0
  },
  // 3 · DESIERTO SOLAR
  docks: {
    sky: 0xffb95e, skyTop: 0xe0662a, fog: 0xf0b070, fogDensity: 0.0042,
    hemiSky: 0xffd9a0, hemiGround: 0x8a5a30, hemiInt: 1.7,
    sun: 0xfff0c0, sunInt: 3.6, sunPos: [30, 54, -40],
    fillA: 0xffc070, fillB: 0xff8a4a, fillInt: 26,
    bloom: 0.16, exposure: 0.98, rain: 0,
    floor: 0xe0b878, platform: 0xc99a5e, trim: 0xffd27a, trim2: 0xff8a3c
  },
  // 4 · CIUDAD CYBERPUNK
  spire: {
    sky: 0x4a1a78, skyTop: 0x140428, fog: 0x33124f, fogDensity: 0.0052,
    hemiSky: 0xa866ff, hemiGround: 0x2e1444, hemiInt: 2.5,
    sun: 0xff7ae8, sunInt: 2.4, sunPos: [-20, 40, -30],
    fillA: 0xff3fd0, fillB: 0x3fe0ff, fillInt: 34,
    bloom: 0.55, exposure: 1.22, rain: 0.35,
    floor: 0x1a1424, platform: 0x2a2238, trim: 0xff3fd0, trim2: 0x3fe0ff
  },
  // 5 · FÁBRICA INFERNAL
  refinery: {
    sky: 0x8a2a10, skyTop: 0x2a0a04, fog: 0x6a2612, fogDensity: 0.005,
    hemiSky: 0xffa060, hemiGround: 0x3a1c14, hemiInt: 2.1,
    sun: 0xffa848, sunInt: 3.0, sunPos: [-26, 38, 22],
    fillA: 0xff6a1a, fillB: 0xffb040, fillInt: 36,
    bloom: 0.4, exposure: 1.12, rain: 0,
    floor: 0x3a2420, platform: 0x4a3228, trim: 0xff7a2f, trim2: 0xffc24a
  },
  // 6 · HIELO ETERNO
  scrapyard: {
    sky: 0xbfe4ff, skyTop: 0x4a8fd0, fog: 0xcfe8ff, fogDensity: 0.0058,
    hemiSky: 0xc0dcf0, hemiGround: 0x5a7f9e, hemiInt: 1.6,
    sun: 0xf0f8ff, sunInt: 2.6, sunPos: [26, 50, -26],
    fillA: 0xa8dcff, fillB: 0xd8f4ff, fillInt: 22,
    bloom: 0.18, exposure: 0.9, rain: 0,
    floor: 0xd8ecf8, platform: 0xa8c8e0, trim: 0x9fe4ff, trim2: 0xffffff
  },
  // 7 · CASTILLO OSCURO
  cathedral: {
    sky: 0x4a1a6e, skyTop: 0x18062a, fog: 0x4a2064, fogDensity: 0.0044,
    hemiSky: 0xa85ac8, hemiGround: 0x2a1230, hemiInt: 2.1,
    sun: 0xff7a9a, sunInt: 2.8, sunPos: [-18, 36, -34],
    fillA: 0xff5a7a, fillB: 0x9a4aff, fillInt: 34,
    bloom: 0.4, exposure: 1.3, rain: 0.15,
    floor: 0x2a1e30, platform: 0x3a2c40, trim: 0xff5a8a, trim2: 0xb05aff
  },
  // 8 · RUINAS ANTIGUAS
  undercity: {
    sky: 0x8fc4e8, skyTop: 0x3f78b8, fog: 0xa8d0ea, fogDensity: 0.006,
    hemiSky: 0xc0dcf0, hemiGround: 0x6a8a5a, hemiInt: 2.0,
    sun: 0xfff0d0, sunInt: 3.0, sunPos: [34, 52, -22],
    fillA: 0x9fe0ff, fillB: 0xd8f0ff, fillInt: 24,
    bloom: 0.2, exposure: 1.04, rain: 0,
    floor: 0x7a9a5a, platform: 0x9a9a92, trim: 0x8fe0ff, trim2: 0xd8c07a
  },
  // 9 · VOLCÁN ROJO
  terminus: {
    sky: 0xd04a20, skyTop: 0x3a0806, fog: 0x8a3018, fogDensity: 0.0044,
    hemiSky: 0xff8a5a, hemiGround: 0x3a1410, hemiInt: 2.2,
    sun: 0xff8a3a, sunInt: 3.2, sunPos: [-30, 42, -28],
    fillA: 0xff4a10, fillB: 0xffb040, fillInt: 38,
    bloom: 0.5, exposure: 1.20, rain: 0,
    floor: 0x3a2420, platform: 0x2a1e1c, trim: 0xff5a1a, trim2: 0xffc24a
  },
  // 10 · ISLA TROPICAL
  greenhouse: {
    sky: 0x8ee0ff, skyTop: 0x2a9ae0, fog: 0xbfeaf8, fogDensity: 0.004,
    hemiSky: 0xc0f0ff, hemiGround: 0x6a8a44, hemiInt: 1.8,
    sun: 0xfff8e0, sunInt: 3.2, sunPos: [36, 56, 26],
    fillA: 0xffe0a0, fillB: 0x8fe0ff, fillInt: 26,
    bloom: 0.14, exposure: 0.98, rain: 0,
    floor: 0xe8d29a, platform: 0xc9b483, trim: 0x8fe8ff, trim2: 0x5ad0a0
  },
  // 11 · ESPACIO INFINITO
  foundry: {
    sky: 0x2a0a4a, skyTop: 0x05000f, fog: 0x1e0a3e, fogDensity: 0.0038,
    hemiSky: 0xa86aff, hemiGround: 0x140828, hemiInt: 1.9,
    sun: 0xd0a0ff, sunInt: 2.3, sunPos: [-14, 40, -36],
    fillA: 0x8a3aff, fillB: 0x3fd8ff, fillInt: 30,
    bloom: 0.55, exposure: 1.0, rain: 0,
    floor: 0x2a2040, platform: 0x3a2c50, trim: 0x9a5aff, trim2: 0x3fd8ff
  },
  // 12 · CIUDAD CELESTIAL
  nullspace: {
    sky: 0xdfeeff, skyTop: 0x6aa8e8, fog: 0xe8f2ff, fogDensity: 0.0044,
    hemiSky: 0xdce8f8, hemiGround: 0x94a6c0, hemiInt: 1.7,
    sun: 0xfffaf0, sunInt: 2.6, sunPos: [28, 58, -30],
    fillA: 0xffe0a0, fillB: 0xbfe0ff, fillInt: 22,
    bloom: 0.2, exposure: 0.82, rain: 0,
    floor: 0xe8eef8, platform: 0xd0d8e8, trim: 0xffd27a, trim2: 0xffffff
  }
};

export const WORLD_NAMES = {
  rooftop: 'PRADERAS FELICES', hive: 'BOSQUE ENCANTADO', docks: 'DESIERTO SOLAR',
  spire: 'CIUDAD CYBERPUNK', refinery: 'FÁBRICA INFERNAL', scrapyard: 'HIELO ETERNO',
  cathedral: 'CASTILLO OSCURO', undercity: 'RUINAS ANTIGUAS', terminus: 'VOLCÁN ROJO',
  greenhouse: 'ISLA TROPICAL', foundry: 'ESPACIO INFINITO', nullspace: 'CIUDAD CELESTIAL'
};

// Paletas de material por mundo.
// Paleta medida sobre la referencia (cuantización de 16 colores). Lo que más
// cambia respecto a la versión anterior es la piedra: en la imagen es azul
// violácea, no gris neutro, y eso es lo que le da el aire de ilustración.
const P = {
  grass: 0x85d759, grassD: 0x4fa83c, stone: 0x52779a, stoneD: 0x3f487e,
  dirt: 0x8a5a33, sand: 0xbbb793, wood: 0x9a6a3c, woodD: 0x6f4a24,
  leaf: 0x5cbb3c, leafD: 0x2f8a2c, water: 0x55c2bc, bed: 0xbbb793,
  cloud: 0xffffff, path: 0xbbb793
};

// ---------------------------------------------------------------- utilidades
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Suelo base del mundo. Antes era una losa plana de lado a lado y el escenario
// se veía como una llanura con cuatro cajas encima. Ahora es una cubeta de agua:
// las mesetas que añade cada mundo quedan como islas y los cortados de piedra se
// ven desde cualquier ángulo, que es lo que hace la referencia.
function land(w, top = P.grass, side = P.stone, h = 0, water = -1.1) {
  // Altiplano macizo. Antes era una cubeta inundada y todos los mundos se veían
  // como islas flotando en un lago: el agua ahora solo aparece donde cada
  // escenario excava su propio cauce.
  w.slab(0, 0, ARENA * 2, ARENA * 2, h, top, side);
  w.waterFloor = water + 0.1;
}

// Barranco de agua: excava, llena y recorta las plataformas que pisa.
function ravine(w, x, z, wd, dp, water = -1.1, bed = -2.8, bedColor = P.bed) {
  w.channel(x, z, wd, dp, bed, water, bedColor);
}

// Cuenca de agua que cubre toda la arena (solo para mundos-isla).
function basin(w, y = -0.9, bed = -2, bedColor = P.bed, waterBed = 0x3fa8c8) {
  w.channel(0, 0, ARENA * 2, ARENA * 2, bed, y, bedColor);
}

// Borde de bloques que sobresale: da el remate "de ladrillo" de los acantilados.
function rim(w, x, z, wd, dp, h, color, step = 1) {
  const x0 = Math.round(x - wd / 2), x1 = Math.round(x + wd / 2);
  const z0 = Math.round(z - dp / 2), z1 = Math.round(z + dp / 2);
  for (let cx = x0; cx <= x1; cx += step) {
    w.blk('stone', cx, h - 0.5, z0, 1, 1, 1, color);
    w.blk('stone', cx, h - 0.5, z1, 1, 1, 1, color);
  }
  for (let cz = z0; cz <= z1; cz += step) {
    w.blk('stone', x0, h - 0.5, cz, 1, 1, 1, color);
    w.blk('stone', x1, h - 0.5, cz, 1, 1, 1, color);
  }
}

// Fila de árboles cúbicos repartidos por una zona.
function treeLine(w, n, x0, x1, z0, z1, y, s0 = 1, s1 = 1.6) {
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * (i + 0.5) / n + (w.rnd() - 0.5) * 2;
    const z = z0 + (z1 - z0) * w.rnd();
    w.tree(Math.round(x), Math.round(z), y, s0 + w.rnd() * (s1 - s0));
  }
}

// ===========================================================================
// 1 · PRADERAS FELICES
// ===========================================================================
function praderas(w) {
  const GR = P.grass, ST = P.stone, WD = P.wood;
  w.waterColor = 0x1f9fd8;
  w.waterGlow = 0.14;
  w.waterFloor = -2.6;

  // ---------------------------------------------------------------- terreno
  // La referencia no es un archipiélago de islas sueltas: es una meseta continua
  // con gargantas excavadas. Por eso se levanta primero el altiplano entero y
  // después se corta el agua, que es lo que deja ver los cortados de piedra.
  w.slab(0, 0, ARENA * 2, ARENA * 2, 0, GR, ST);

  // Terrazas. La central es el campo de batalla; el resto, miradores.
  w.slab(-4, 17.5, 44, 17, 1.5, GR, ST);      // delantera
  w.slab(0, 1, 30, 16, 5.0, GR, ST);          // central
  w.slab(-12, -17.5, 28, 17, 9.0, GR, ST);    // arco con estandartes
  w.slab(27, 6, 18, 22, 5.0, GR, ST);         // derecha (árbol grande)
  w.slab(-33, 14, 6, 20, 4.0, GR, ST);        // izquierda alta
  w.slab(20, -36, 28, 20, 10.0, GR, ST);      // colina del castillo
  w.slab(20, -38, 18, 12, 12.0, GR, ST);      // segundo escalón
  w.slab(20, -39, 13, 9, 13.5, GR, ST);       // remate de la colina

  // Gargantas. Van después de las terrazas para que las recorten de verdad.
  w.channel(0, 36, ARENA * 2, 20, -7.0, -3.4, P.bed);   // río delantero
  w.channel(-41, 6, 12, 58, -7.0, -3.4, P.bed);         // brazo izquierdo
  w.channel(17, 2, 5, 26, -7.0, -3.4, P.bed);           // foso central/derecha
  w.channel(35, 26, 22, 20, -7.0, -3.4, P.bed);         // charca derecha
  w.channel(-9, 24, 14, 7, -7.0, -3.4, P.bed);          // entrante del puente

  // ---------------------------------------------------------------- camino
  // Un solo camino de tierra que cruza el campo y sube hacia el arco: en la
  // referencia es la línea que ordena toda la composición.
  w.paint(0, 2, 7, 15, P.path);
  w.paint(-7, 5, 14, 6, P.path);
  w.paint(8, -1, 13, 5, P.path);
  w.paint(1, -8, 5, 8, P.path);
  w.paint(-4, 14, 8, 8, P.path);

  // ---------------------------------------------------------------- escaleras
  // Escalones de 0,5: se suben andando, sin salto.
  w.slab(-12, -10.5, 8, 7, 5.0, GR, ST);       // hueco donde encaja la escalera
  w.stairs(-12, -7, Math.PI / 2, 8, 0.5, 5, ST, 1, 5.0);
  w.stairs(8, 15, Math.PI / 2, 7, 0.5, 4, ST, 1, 1.5);
  w.stairs(18.4, 18, 0, 3, 0.5, 4, ST, 1, 0);
  w.stairs(-26.4, 2, 0, 8, 0.5, 4, ST, -1, 0);
  w.stairs(22, 16.6, 0, 3, 0.5, 4, ST, 1, 5.0);

  // ---------------------------------------------------------------- puentes
  // Puente de tablones sobre el entrante del río, con la cascada detrás.
  w.bridge(-9, 24, 8, Math.PI / 2, 1.6, 3.4, WD, P.woodD);
  w.waterfall(-9, 20.4, 1.5, -3.4, 13, 0);
  // Puente sobre el foso, entre la meseta central y la derecha.
  w.bridge(17, 4, 6.5, 0, 5.1, 3.4, WD, P.woodD);
  // Pasarela de piedra hacia el arco.
  w.stoneBridge(-12, -13.6, 6, 0, 9.0, 3, ST, 0x6f9a52);

  // ---------------------------------------------------------------- cascadas
  // Caen del borde de cada terraza al agua: son las líneas verticales que
  // sujetan la composición de la referencia.
  w.waterfall(6, 26.2, 1.5, -3.4, 5, 0);
  w.waterfall(-20, 26.2, 1.5, -3.4, 4, 0);
  w.waterfall(-35.6, 12, 4.0, -3.4, 6, Math.PI / 2);
  w.waterfall(18.2, 8, 5.0, -3.4, 5, Math.PI / 2);
  w.waterfall(27, 17.2, 5.0, -3.4, 4, 0);
  w.waterfall(26.2, -4, 5.0, -3.4, 4, Math.PI / 2);
  w.waterfall(-7, -9.2, 9.0, -3.4, 3, 0);

  // ---------------------------------------------------------------- arco
  // Arco de piedra con dos estandartes azules: el hito del escenario.
  w.arch(-12, -18, 9.0, 0, 1.15, 0x9aa2ac, 0x6f9a52, 0x4fc8ff);
  w.pillar(-22, -20, 9.0, 3, 0.9, 0x9aa2ac, 0x6f9a52);
  w.pillar(-2, -21, 9.0, 2, 0.9, 0x9aa2ac, 0x6f9a52);

  // ---------------------------------------------------------------- castillo
  castleBody(w, 22, -40, 13.5, 0.86, 0xffffff, 0x7f9bff, 0x6fe0ff);
  treeLine(w, 3, 8, 16, -46, -42, 10, 1.1, 1.4);
  

  // ---------------------------------------------------------------- vegetación
  w.tree(-33, 10, 4.0, 2.0);            // árbol alto de la izquierda
  w.tree(31, 4, 5.0, 1.9);              // árbol grande de la derecha
  w.tree(-24, -22, 9.0, 1.5);
  w.tree(-2, -24, 9.0, 1.4);
  treeLine(w, 3, -34, -24, -32, -20, 0, 1.3, 1.7);
  treeLine(w, 3, -20, -6, 22, 26, 1.5, 1.2, 1.6);
  w.tree(-31, 22, 4.0, 1.6);

  // Vallados de madera en los bordes de las terrazas.
  w.fence(-9, 26.4, 10, 0, 1.5, WD);
  w.fence(-22, 26.4, 10, 0, 1.5, WD);
  w.fence(31, -5, 12, Math.PI / 2, 5.0, WD);
  w.fence(18.4, 12, 10, 0, 1.5, WD);
  w.fence(-12, -6.4, 12, 0, 5.0, WD);

  // Detalle vegetal, cajas y bloques sueltos.
  w.flowers(-6, 12, 1.5, 10, 5, [0xff5a9e, 0xffffff, 0xffe45c]);
  w.flowers(6, 16, 1.5, 8, 4, [0xff5a9e, 0xffffff]);
  w.flowers(-2, -2, 5.0, 9, 5);
  w.flowers(10, 6, 5.0, 7, 4, [0xff5a9e, 0xffe45c]);
  w.flowers(-20, -22, 9.0, 8, 4);
  w.flowers(30, 10, 5.0, 8, 4);
  w.bush(-12, 14, 1.5, 1.1, P.leafD);
  w.bush(14, 20, 1.5, 1.0, P.leafD);
  w.bush(-26, 2, 0, 1.2, P.leafD);
  w.crate(12, 16, 1.5, 1);
  w.crate(-16, 8, 1.5, 0.9);
  w.lantern(-3, 22, 1.5, 0xffe6a0, 3);
  w.lantern(5, 22, 1.5, 0xffe6a0, 3);

  // Bloques de piedra sueltos: el detalle que rompe la superficie del prado.
  for (let i = 0; i < 16; i++) {
    const x = Math.round((w.rnd() - 0.5) * 40), z = Math.round(10 + w.rnd() * 16);
    w.blk('stone', x, 1.78, z, 0.95, 0.56, 0.95, jit(0x8f98ac, w.rnd, 0.12));
  }
  for (let i = 0; i < 12; i++) {
    const x = Math.round((w.rnd() - 0.5) * 26), z = Math.round(-5 + w.rnd() * 14);
    w.blk('stone', x, 5.28, z, 1.0, 0.56, 1.0, jit(0x8f98ac, w.rnd, 0.12));
  }

  // Matojos y piedrecillas: el prado de la referencia está erizado de detalle.

  // Bordes irregulares: un acantilado no acaba en línea recta.
  crumble(w, 0, 1, 30, 16, 5.0, P.stoneD);
  crumble(w, -4, 17.5, 44, 17, 1.5, P.stoneD);
  crumble(w, 27, 6, 18, 22, 5.0, P.stoneD);
  crumble(w, 20, -36, 28, 20, 10.0, P.stoneD);
  crumble(w, 20, -38, 18, 12, 12.0, P.stoneD);

  // ---------------------------------------------------------------- fondo
  // El paisaje no acaba en el borde de la arena: dos anillos de lomas tapan el
  // suelo de relleno y dejan un horizonte de campo, no una plancha verde.
  backdropFloor(w, 0x6a9450, -4.2);
  // Tres anillos: colinas cercanas con árboles, bosque medio, cordillera lejana.
  forestRing(w, 52, 74, 64, 1.6, 2.6, -1.5, 0x2f7a38);
  backHill(w, 4, -122, 78, 58, 12, 2, GR, ST, 0.5);
  backHill(w, -90, -152, 68, 50, 17, 3, GR, ST, 0.45);
  backHill(w, 98, -158, 70, 52, 15, 3, GR, ST, 0.45);
  backHill(w, -34, -220, 100, 66, 24, 5, GR, ST, 0.4);
  backHill(w, 74, -232, 104, 70, 21, 5, GR, ST, 0.4);
  for (let i = 0; i < 18; i++) {
    const a = w.rnd() * Math.PI * 2, r = 110 + w.rnd() * 130;
    w.cloud(Math.cos(a) * r, 58 + w.rnd() * 30, Math.sin(a) * r, 1.6 + w.rnd() * 2.0);
  }
}

// Cuerpo del castillo. La referencia tiene un castillo de cuento: muro
// almenado, nueve torres de alturas distintas, tejados cónicos de siete anillos,
// ventanas en arco, portón con estandarte y banderines en todas las puntas.
function castleBody(w, x, z, baseY, s, wall, roof, flag) {
  const T = (ox, oy, oz, ww, hh, dd, c, n = 'stone', ry = 0) =>
    w.blk(n, x + ox * s, baseY + oy * s, z + oz * s, ww * s, hh * s, dd * s, c, ry);
  const shade = (hex, k) => shadeHex(hex, k);
  const roofDark = shade(roof, 0.72);
  const roofLit = new THREE.Color(roof).lerp(new THREE.Color(0xffffff), 0.22).getHex();

  // --- recinto ------------------------------------------------------------
  T(0, 3.5, 0, 26, 7, 16, wall);
  T(0, 3.5, 0, 27, 2.2, 17, shade(wall, 0.9));
  // Almenas: merlones separados, no una fila continua.
  for (let i = -12; i <= 12; i += 2) {
    T(i, 7.6, -7.6, 1.1, 1.3, 1.8, wall);
    T(i, 7.6, 7.6, 1.1, 1.3, 1.8, wall);
  }
  for (let i = -6; i <= 6; i += 2) {
    T(-12.6, 7.6, i, 1.8, 1.3, 1.1, wall);
    T(12.6, 7.6, i, 1.8, 1.3, 1.1, wall);
  }
  // Contrafuertes.
  for (const sx of [-1, 1]) {
    for (const oz of [-5, 0, 5]) T(sx * 13.2, 2.8, oz, 2.2, 5.6, 2.2, shade(wall, 0.94));
  }

  // --- torres -------------------------------------------------------------
  // [x, z, altura, radio del tejado]
  const towers = [
    [-11.5, -8.5, 13, 3.4], [11.5, -8.5, 13, 3.4],
    [-11.5, 8.5, 10, 3.0], [11.5, 8.5, 10, 3.0],
    [-5.5, -9.5, 17, 3.2], [5.5, -9.5, 17, 3.2],
    [0, 1, 21, 4.0], [-3.6, 6.5, 12, 2.4], [3.6, 6.5, 12, 2.4]
  ];
  for (const [ox, oz, hh, rr] of towers) {
    const tw = rr * 1.55;
    T(ox, hh / 2, oz, tw, hh, tw, wall);
    // Anillo de cornisa bajo el tejado.
    T(ox, hh + 0.35, oz, tw + 1.2, 0.7, tw + 1.2, shade(wall, 1.05));
    // Tejado cónico: siete anillos que se estrechan y giran 45°.
    let r = rr;
    const base = new THREE.Color(roofDark);
    for (let k = 0; k < 8; k++) {
      const ry = k % 2 ? Math.PI / 4 : 0;
      // Degradado continuo de abajo arriba: con tres tonos fijos el tejado se
      // leía como una pila de platos.
      const t = k / 7;
      const c = base.clone().lerp(new THREE.Color(roofLit), 0.15 + t * 0.85).getHex();
      T(ox, hh + 0.9 + k * 0.74, oz, r * 2, 0.86, r * 2, c, 'stone', ry);
      r *= 0.82;
    }
    // Aguja y banderín.
    T(ox, hh + 6.4, oz, 0.28, 1.8, 0.28, shade(wall, 1.06));
    T(ox + 1.15, hh + 6.9, oz, 2.2, 1.2, 0.18, flag, 'glow');
    T(ox + 0.55, hh + 7.3, oz, 1.0, 0.7, 0.16, flag, 'glow');
    // Ventanas en arco: hueco oscuro con dintel redondeado.
    for (let k = 0; k < Math.max(1, Math.floor(hh / 6)); k++) {
      const wy = 2.2 + k * 4.2;
      T(ox, wy, oz - tw / 2 - 0.06, 1.1, 1.7, 0.3, 0x2c3a6e);
      T(ox, wy + 1.1, oz - tw / 2 - 0.06, 0.7, 0.5, 0.3, 0x2c3a6e);
    }
  }

  // --- portón -------------------------------------------------------------
  T(0, 2.4, 8.1, 4.2, 4.8, 0.6, 0x2c3a6e);
  T(0, 5.2, 8.1, 3.0, 0.9, 0.6, 0x2c3a6e);
  T(0, 6.2, 8.1, 5.4, 0.8, 0.7, shade(wall, 1.06));
  // Estandarte sobre el portón.
  T(0, 5.0, 8.5, 1.6, 3.2, 0.22, 0x3a6ad8, 'glow');
  T(0, 4.4, 8.6, 1.0, 1.0, 0.2, 0xffe45c, 'glow');

  // --- ventanas del cuerpo ------------------------------------------------
  for (let i = 0; i < 10; i++) {
    const ox = (i % 5 - 2) * 4.4;
    const oy = 3.0 + Math.floor(i / 5) * 2.6;
    T(ox, oy, -8.2, 1.2, 1.6, 0.4, 0x2c3a6e);
    T(ox, oy + 1.05, -8.2, 0.7, 0.4, 0.4, 0x2c3a6e);
  }

  // --- vegetación y roca en la base ---------------------------------------
  for (let i = 0; i < 14; i++) {
    const a = w.rnd() * Math.PI * 2, r = 12 + w.rnd() * 7;
    const px = x + Math.cos(a) * r * s, pz = z + Math.sin(a) * r * s * 0.8;
    w.tree(Math.round(px), Math.round(pz), baseY, 1.2 + w.rnd() * 0.9);
  }
}

// Castillo de fondo para los mundos que lo usan como paisaje: loma + cuerpo.
function castleBackdrop(w, x, z, y, s, wall, roof, flag) {
  for (let i = 0; i < 3; i++) {
    const r = (34 - i * 9) * s;
    w.blk('ground', x, y + i * 2.6 * s, z, r * 2, 2.6 * s, r * 1.6, 0x5f9a44);
    for (let k = 0; k < 4; k++) {
      const a = w.rnd() * Math.PI * 2, rr = r * (0.7 + w.rnd() * 0.3);
      w.tree(Math.round(x + Math.cos(a) * rr), Math.round(z + Math.sin(a) * rr * 0.7),
        y + i * 2.6 * s + 2.6 * s, 1.3 + w.rnd() * 0.6);
    }
  }
  castleBody(w, x, z, y + 7.8 * s, s * 0.8, wall, roof, flag);
}

// Disco de sol o luna hecho con bloques. Un cuadrado de 30x30 en el cielo se lee
// como un rectángulo pegado, no como un astro.
function astro(w, x, y, z, r, color, core = null) {
  const rr = Math.max(1, Math.round(r));
  for (let i = -rr; i <= rr; i++) {
    for (let j = -rr; j <= rr; j++) {
      const d = Math.hypot(i, j);
      if (d > rr + 0.4) continue;
      const c = core && d < rr * 0.55 ? core : color;
      w.blk('glow', x + i, y + j, z, 1, 1, 2, c);
    }
  }
}

// Suelo de relleno lejano: sin él, las lomas de fondo flotan sobre el cielo.
function backdropFloor(w, color, y = -2.2) {
  w.blk('ground', 0, y - 3, 0, 620, 6, 620, color);
}

// Loma lejana de relleno (fuera de la arena, solo paisaje). Domo de bloques de
// `cell` unidades: con bloques de 1 serían cientos de miles, y con bloques de
// 20 se lee como una muralla de cajas.
function backHill(w, cx, cz, rx, rz, h, cell, grass, stone, trees = 0.5, prop = null) {
  const baseY = -3.2;
  const nx = Math.ceil(rx / cell), nz = Math.ceil(rz / cell);
  for (let ix = -nx; ix <= nx; ix++) {
    for (let iz = -nz; iz <= nz; iz++) {
      const dx = (ix * cell) / rx, dz = (iz * cell) / rz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 1) continue;
      const y = baseY + h * Math.cos(d * Math.PI * 0.5) ** 1.35;
      const px = cx + ix * cell, pz = cz + iz * cell;
      // Roca solo en la falda; el resto de la loma va cubierto de verde. Una
      // columna de piedra con un sombrero de hierba se lee como un estratos.
      const rockTop = baseY + (y - baseY) * 0.42;
      w.blk('stone', px, (baseY + rockTop) / 2, pz, cell, rockTop - baseY, cell,
        jit(stone, w.rnd, 0.07));
      w.blk('ground', px, (rockTop + y) / 2, pz, cell * 1.02, y - rockTop, cell * 1.02,
        jit(shadeHex(grass, 0.9 + w.rnd() * 0.2), w.rnd, 0.07));
      if (w.rnd() < trees * 0.16) {
        // Cada bioma siembra su propia silueta (árbol, cactus, cristal...).
        propAt(w, Math.round(px), Math.round(pz), y, 1.2 + w.rnd() * 1.1, prop);
      }
    }
  }
}


// Reparto de siluetas por bioma: el árbol de hoja ancha es solo uno de los
// posibles. Cada mundo pide el suyo y el paisaje deja de repetirse.
const PROPS = {
  tree: (w, x, z, y, s, o) => w.tree(x, z, y, s, o.trunk, o.leaf),
  palm: (w, x, z, y, s, o) => w.palm(x, z, y, s, o.trunk, o.leaf),
  cactus: (w, x, z, y, s, o) => w.cactus(x, z, y, s, o.leaf),
  dead: (w, x, z, y, s, o) => w.deadTree(x, z, y, s, o.trunk),
  crystal: (w, x, z, y, s, o) => w.crystal(x, z, y, s * 1.1, o.leaf),
  ice: (w, x, z, y, s, o) => w.iceSpike(x, z, y, s * 1.2, 0xd8f4ff),
  silo: (w, x, z, y, s, o) => w.silo(x, z, y, s, o.stone),
  scrap: (w, x, z, y, s, o) => w.scrapPile(x, z, y, s * 1.3, o.stone),
  mushroom: (w, x, z, y, s, o) => w.mushroom(x, z, y, s * 0.6, o.leaf),
  none: () => {}
};
let propCtx = { trunk: 0x4a3a2e, leaf: 0x4f8a44, stone: 0x5a5a62 };
function propAt(w, x, z, y, s, kind) {
  const fn = PROPS[kind] || PROPS.tree;
  fn(w, x, z, y, s, propCtx);
}

// Pirámide escalonada: el hito del desierto.
function pyramid(w, x, z, baseY, size, color, steps = 5) {
  for (let i = 0; i < steps; i++) {
    const wd = size * (1 - i / steps) * 2;
    if (wd < 1) break;
    w.blk('stone', x, baseY + i + 0.5, z, wd, 1, wd, jit(shadeHex(color, 0.86 + i * 0.05), w.rnd, 0.06));
  }
  // Remate: no una punta de un bloque, un prisma pequeño.
  w.blk('stone', x, baseY + steps + 0.3, z, 0.8, 1.2, 0.8, shadeHex(color, 1.14));
  w.colliders.push({ x, z, hw: size, hd: size, h: baseY + steps, r: size, cos: 1, sin: 0 });
}

// Paisaje envolvente genérico. Los mundos que no están hechos a mano no tenían
// horizonte: la arena acababa y detrás había vacío. Esto les pone suelo lejano,
// lomas y arboleda con su propia paleta, así que todos ganan profundidad.
function surround(w, art, opts = {}) {
  const grass = opts.grass ?? art.floor ?? 0x4a6a3a;
  const stone = opts.stone ?? art.platform ?? 0x5a5a62;
  const treeLeaf = opts.leaf ?? shadeHex(grass, 0.72);
  const treeTrunk = opts.trunk ?? 0x4a3a2e;
  const density = opts.trees ?? 0.45;
  const prop = opts.prop ?? 'tree';
  propCtx = { trunk: treeTrunk, leaf: treeLeaf, stone };
  backdropFloor(w, shadeHex(grass, 0.62), -6);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * 0.5 + (i / 4 - 0.5) * 2.2;
    const r = 128 + w.rnd() * 40;
    backHill(w, Math.cos(a) * r, Math.sin(a) * r, 62 + w.rnd() * 26, 48 + w.rnd() * 20,
      12 + w.rnd() * 10, 2.5, grass, stone, density, prop);
  }
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI * 0.5 + (i / 3 - 0.5) * 2.4;
    const r = 205 + w.rnd() * 60;
    backHill(w, Math.cos(a) * r, Math.sin(a) * r, 92 + w.rnd() * 40, 70 + w.rnd() * 30,
      22 + w.rnd() * 16, 5, grass, stone, density * 0.8, prop);
  }
  // Silueta inmediata: tapa la costura entre la arena y el fondo. La pieza la
  // elige el bioma, así el desierto cría cactus y no un bosque de hoja ancha.
  for (let i = 0; i < 54; i++) {
    const a = (i / 54) * Math.PI * 2 + (w.rnd() - 0.5) * 0.08;
    const r = 52 + w.rnd() * 22;
    const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
    w.blk('ground', x, -0.6, z, 7, 1.4, 7, jit(grass, w.rnd, 0.07));
    propAt(w, x, z, 0.1, 1.5 + w.rnd() * 1.1, prop);
    if (w.rnd() < 0.4) {
      propAt(w, x + Math.round((w.rnd() - 0.5) * 8), z + Math.round((w.rnd() - 0.5) * 8),
        0.1, 1.2 + w.rnd() * 0.9, prop);
    }
  }
}

// Compatibilidad: otros mundos siguen llamando a la meseta lejana.
function distantMesa(w, x, z, wd, h, grass, stone) {
  backHill(w, x, z, wd * 0.5, wd * 0.4, h, Math.max(2, Math.round(wd / 8)), grass, stone, 0.5);
}

// Anillo de arboleda alrededor de la arena: tapa el suelo de relleno y hace de
// transición entre el diorama y las lomas de fondo.
function forestRing(w, r0, r1, count, s0, s1, y, top = 0x2f7a38) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (w.rnd() - 0.5) * 0.06;
    const r = r0 + w.rnd() * (r1 - r0);
    const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
    w.blk('ground', x, y - 0.5, z, 6, 1.2, 6, jit(0x5f9a44, w.rnd, 0.06));
    w.tree(x, z, y, s0 + w.rnd() * (s1 - s0), 0x7a5230, top);
    if (w.rnd() < 0.45) {
      w.tree(x + Math.round((w.rnd() - 0.5) * 7), z + Math.round((w.rnd() - 0.5) * 7),
        y, s0 * 0.8 + w.rnd() * (s1 - s0) * 0.7, 0x7a5230, top);
    }
  }
}

// Bloques sueltos en el borde de un acantilado: rompe la línea recta del slab.
function crumble(w, x, z, wd, dp, h, color) {
  const x0 = Math.round(x - wd / 2), x1 = Math.round(x + wd / 2);
  const z0 = Math.round(z - dp / 2), z1 = Math.round(z + dp / 2);
  for (let i = 0; i < Math.round((wd + dp) * 0.8); i++) {
    const edge = w.rnd();
    let cx, cz;
    if (edge < 0.5) { cx = w.rnd() < 0.5 ? x0 : x1; cz = z0 + Math.round(w.rnd() * dp); }
    else { cz = w.rnd() < 0.5 ? z0 : z1; cx = x0 + Math.round(w.rnd() * wd); }
    const s = 0.6 + w.rnd() * 0.7;
    w.blk('stone', cx + 0.5, h + s * 0.3, cz + 0.5, s, s * 0.6, s, jit(color, w.rnd, 0.12));
    if (w.rnd() < 0.35) {
      w.blk('stone', cx + 0.5, h + s * 0.9, cz + 0.5, s * 0.6, s * 0.6, s * 0.6, jit(color, w.rnd, 0.12));
    }
  }
}

// ===========================================================================
// 2 · BOSQUE ENCANTADO
// ===========================================================================
function bosque(w) {
  const GR = 0x63d63a, GRD = 0x46a826, ST = 0x556183, STD = 0x3d4566, WD = 0x35291f;
  const MOSS = 0x4fc22a, PAVE = 0x8d93a4, PAVE2 = 0x767c8e;

  // Bosque anegado: una lámina de agua luminosa bajo todo el terreno y las
  // terrazas emergiendo de ella. El agua es la fuente de luz del centro.
  basin(w, -1.2, -2.8, 0x2a6a5a);
  w.waterColor = 0x1cb4d6;
  w.waterGlow = 0.34;
  w.waterFloor = -1.1;

  // ------------------------------------------------------------- terrazas
  w.slab(0, 6, 26, 26, 3, GR, ST);
  w.slab(-30, 6, 18, 30, 2, GR, ST);
  w.slab(30, 8, 18, 30, 2, GR, ST);
  w.slab(-16, -22, 22, 18, 6, GR, ST);
  w.slab(16, -22, 22, 18, 6, GR, ST);
  w.slab(0, 30, 26, 14, 1, GR, ST);
  // Terrazas altas laterales: el agua corre entre paredes de piedra.
  w.slab(-36, -10, 14, 18, 5, GR, ST);
  w.slab(36, -12, 14, 18, 5, GR, ST);
  w.slab(-6, -34, 18, 12, 8, GR, ST);
  w.slab(12, -34, 14, 12, 7, GR, ST);

  // ------------------------------------------------------------- pavimento
  w.paint(0, 8, 11, 24, PAVE);
  w.paint(-6, -2, 15, 7, PAVE);
  w.paint(-20, 12, 12, 5, PAVE2);
  w.paint(10, 16, 9, 8, PAVE2);
  w.paint(14, -20, 11, 10, PAVE);
  w.paint(-16, -20, 11, 10, PAVE2);
  w.paint(0, 22, 7, 8, PAVE2);
  // Losas sueltas: el pavimento de la referencia está desportillado.
  for (let i = 0; i < 46; i++) {
    const x = Math.round((w.rnd() - 0.5) * 30), z = Math.round(-4 + w.rnd() * 26);
    w.blk('stone', x, 3.05, z, 0.86 + w.rnd() * 0.2, 0.14, 0.86 + w.rnd() * 0.2,
      jit(w.rnd() < 0.35 ? PAVE2 : PAVE, w.rnd, 0.12));
  }

  // ------------------------------------------------------------- ruinas
  w.arch(0, -26, 6, 0, 1.6, ST, MOSS, null);
  w.arch(-16, -27, 6, 0, 1.05, ST, MOSS, null);
  w.arch(16, -27, 6, 0, 1.05, ST, MOSS, null);
  w.arch(-40, -22, 5, Math.PI * 0.5, 1.0, ST, MOSS, null);
  w.arch(40, -24, 5, Math.PI * 0.5, 1.0, ST, MOSS, null);
  w.pillar(-6, -28, 6, 5, 1.1, ST, MOSS);
  w.pillar(7, -29, 6, 3, 1.0, ST, MOSS);
  w.pillar(-25, -18, 6, 4, 1.0, ST, MOSS);
  w.pillar(25, -20, 6, 6, 1.1, ST, MOSS);
  w.pillar(-30, 24, 2, 4, 1.0, ST, MOSS);
  w.pillar(30, 26, 1, 3, 1.0, ST, MOSS);
  w.ruin(-16, -30, 12, 0, 6, 5, ST, MOSS);
  w.ruin(17, -30, 10, 0, 6, 4, ST, MOSS);
  w.ruin(-30, 0, 14, Math.PI / 2, 2, 4, ST, MOSS);
  w.ruin(30, 2, 14, Math.PI / 2, 2, 4, ST, MOSS);

  // ------------------------------------------------------------- escaleras
  w.stairs(0, -8.6, Math.PI / 2, 6, 0.5, 4, ST, 1, 3);
  w.stairs(-18, -6.6, Math.PI / 2, 8, 0.5, 3, ST, 1, 2);
  w.stairs(18, -6.6, Math.PI / 2, 8, 0.5, 3, ST, 1, 2);
  w.stairs(0, 24.6, Math.PI / 2, 4, 0.5, 4, ST, -1, 3);
  w.stairs(-30, 20.4, Math.PI / 2, 4, 0.5, 3, ST, 1, 2);
  w.stairs(30, 22.4, Math.PI / 2, 4, 0.5, 3, ST, 1, 2);

  // ------------------------------------------------------------- puentes
  w.stoneBridge(-19, 8, 10, Math.PI / 2, 2.05, 3.6, ST, MOSS);
  w.stoneBridge(19, 10, 10, Math.PI / 2, 2.05, 3.6, ST, MOSS);
  w.stoneBridge(-8, 32, 9, 0, 1.05, 3.2, ST, MOSS);
  w.stoneBridge(9, 32, 9, 0, 1.05, 3.2, ST, MOSS);

  // ------------------------------------------------------------- cascadas
  w.waterfall(-21.6, 18, 2, -1.2, 5, Math.PI / 2, 0x4fe8e0, 0xd0ffff);
  w.waterfall(21.6, -4, 2, -1.2, 5, Math.PI / 2, 0x4fe8e0, 0xd0ffff);
  w.waterfall(-9, -14.4, 6, -1.2, 4, 0, 0x4fe8e0, 0xd0ffff);
  w.waterfall(13, -14.4, 6, -1.2, 4, 0, 0x4fe8e0, 0xd0ffff);
  w.waterfall(-27, -19.2, 6, -1.2, 4, 0, 0x4fe8e0, 0xd0ffff);
  w.waterfall(28, -21.2, 6, -1.2, 4, 0, 0x4fe8e0, 0xd0ffff);
  w.waterfall(-29.2, 0, 2, -1.2, 4, Math.PI / 2, 0x4fe8e0, 0xd0ffff);
  w.waterfall(29.2, 2, 2, -1.2, 4, Math.PI / 2, 0x4fe8e0, 0xd0ffff);
  w.waterfall(-44.2, -6, 5, -1.2, 4, Math.PI / 2, 0x4fe8e0, 0xd0ffff);
  w.waterfall(44.2, -8, 5, -1.2, 4, Math.PI / 2, 0x4fe8e0, 0xd0ffff);

  // ------------------------------------------------------------- setas
  // El motivo del mundo: familias de setas gigantes con crías alrededor. La
  // grande manda en cada grupo, como en la referencia.
  const MAG = [0xff3fb0, 0xff5ac8, 0xe83098, 0xff2f9a];
  const CYA = [0x28c8f0, 0x3fd8ff, 0x1aa8e0, 0x6fe8ff];
  const hAt = (x, z) => {
    const cx = Math.max(-ARENA + 1, Math.min(ARENA - 1, Math.round(x)));
    const cz = Math.max(-ARENA + 1, Math.min(ARENA - 1, Math.round(z)));
    return w.heights[w.idx(cx, cz)];
  };
  const clear = (x, z, r) => (x * x + (z - 10) * (z - 10)) > r * r;
  const clusters = [
    [-22, 16, 2.3, MAG], [24, 4, 2.0, CYA], [-11, 20, 1.7, MAG],
    [14, 18, 1.8, CYA], [-27, -6, 1.9, MAG], [27, -10, 1.8, MAG],
    [-8, -18, 2.1, CYA], [10, -22, 1.9, MAG], [0, 27, 1.7, MAG],
    [-34, 20, 1.7, CYA], [34, 22, 1.7, MAG], [6, 14, 1.6, CYA],
    [-37, -6, 2.0, MAG], [37, -8, 2.0, CYA], [-4, -32, 2.2, MAG],
    [13, -33, 2.0, CYA], [-26, 27, 1.6, CYA], [26, 28, 1.6, MAG]
  ];
  for (const [cx, cz, s0, pal] of clusters) {
    const base = hAt(cx, cz);
    if (base < 1 || !clear(cx, cz, 11)) continue;
    w.mushroom(cx, cz, base, s0, pal[0], 0xf6e6cf);
    const kids = 3 + Math.floor(w.rnd() * 4);
    for (let i = 0; i < kids; i++) {
      const a = w.rnd() * Math.PI * 2, r = 2.4 + w.rnd() * 3.6;
      const x = Math.round(cx + Math.cos(a) * r), z = Math.round(cz + Math.sin(a) * r);
      const hh = hAt(x, z);
      if (hh < 1 || Math.abs(hh - base) > 1 || !clear(x, z, 9)) continue;
      w.mushroom(x, z, hh, 0.5 + w.rnd() * 0.8, pal[Math.floor(w.rnd() * pal.length)]);
    }
  }
  // Setas sueltas y matas de setas diminutas: son las que dan la sensación de
  // que el bosque está vivo hasta el último rincón.
  for (let i = 0; i < 34; i++) {
    const x = Math.round((w.rnd() - 0.5) * 84), z = Math.round((w.rnd() - 0.5) * 80 + 4);
    const hh = hAt(x, z);
    if (hh < 1 || !clear(x, z, 8)) continue;
    const pal = w.rnd() < 0.55 ? MAG : CYA;
    w.mushroom(x, z, hh, 0.4 + w.rnd() * 0.6, pal[Math.floor(w.rnd() * pal.length)]);
  }
  for (let i = 0; i < 60; i++) {
    const x = Math.round((w.rnd() - 0.5) * 76), z = Math.round((w.rnd() - 0.5) * 72 + 4);
    const hh = hAt(x, z);
    if (hh < 1) continue;
    const c = w.rnd() < 0.5 ? 0xff8ae0 : 0x8ffff0;
    w.blk('glow', x + 0.5, hh + 0.14, z + 0.5, 0.22, 0.28, 0.22, c);
    w.blk('glow', x + 0.5, hh + 0.30, z + 0.5, 0.34, 0.12, 0.34, c);
  }

  // ------------------------------------------------------------- árboles
  // Anillo de árboles gigantes oscuros: cierran el horizonte y dejan el centro
  // como el único punto iluminado del cuadro.
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + w.rnd() * 0.16;
    const r = 54 + w.rnd() * 26;
    w.bigTree(Math.cos(a) * r, Math.sin(a) * r, -1.6, 1.0 + w.rnd() * 0.7, WD, 0x1d6b3c);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + w.rnd() * 0.3;
    const r = 92 + w.rnd() * 44;
    w.bigTree(Math.cos(a) * r, Math.sin(a) * r, -1.6, 1.3 + w.rnd() * 0.9, WD, 0x14563a);
  }
  // Árboles medianos dentro de la arena, en los bordes de las terrazas.
  const treeSpots = [[-24, 22], [26, 20], [-33, 2], [33, -2], [-14, 26], [16, 28], [-30, 26], [30, 28],
    [-38, 12], [38, 14], [-9, -38], [18, -38]];
  for (const [x, z] of treeSpots) {
    const hh = hAt(x, z);
    if (hh < 1) continue;
    w.tree(x, z, hh, 1.6 + w.rnd() * 0.8, WD, 0x2f8f38);
  }

  // ------------------------------------------------------------- enredaderas
  for (let i = 0; i < 150; i++) {
    const x = Math.round((w.rnd() - 0.5) * 88), z = Math.round((w.rnd() - 0.5) * 84 + 4);
    const cx = Math.max(-45, Math.min(44, x)), cz = Math.max(-45, Math.min(44, z));
    const h = w.heights[w.idx(cx, cz)];
    if (h < 2) continue;
    const edge = h - Math.min(hAt(cx + 1, cz), hAt(cx - 1, cz), hAt(cx, cz + 1), hAt(cx, cz - 1));
    if (edge < 1) continue;
    w.vineEdge(cx, cz, 5, w.rnd() < 0.4 ? 0x3f9a34 : 0x2f7f34);
  }

  // ------------------------------------------------------------- vegetación
  w.flowers(-8, 4, 3, 18, 6, [0xff5ad0, 0xffffff, 0xb44aff]);
  w.flowers(10, 12, 3, 16, 5, [0x3fd8ff, 0xff5ad0]);
  w.flowers(-22, 14, 2, 14, 5, [0xff5ad0, 0xffffff]);
  w.flowers(24, 16, 2, 14, 5, [0x3fd8ff, 0xffffff]);
  w.flowers(-14, -24, 6, 14, 5, [0xffffff, 0xff5ad0]);
  w.flowers(16, -24, 6, 14, 5, [0xb44aff, 0x3fd8ff]);
  w.flowers(-30, 6, 2, 12, 4, [0xffffff, 0x3fd8ff]);
  w.flowers(30, 8, 2, 12, 4, [0xff5ad0, 0xffffff]);
  w.bush(-6, 14, 3, 1, MOSS);
  w.bush(7, -2, 3, 1, MOSS);
  w.bush(-25, 20, 2, 1.2, GRD);
  w.bush(28, 14, 2, 1.2, GRD);
  w.bush(-12, -20, 6, 1, MOSS);
  w.bush(20, -18, 6, 1, MOSS);
  w.bush(-34, 18, 2, 1.3, MOSS);
  w.bush(34, 20, 2, 1.3, MOSS);

  // ------------------------------------------------------------- esporas
  for (let i = 0; i < 130; i++) {
    const a = w.rnd() * Math.PI * 2, r = Math.sqrt(w.rnd()) * 42;
    const x = Math.cos(a) * r, z = Math.sin(a) * r + 4;
    const y = 2.5 + w.rnd() * 13;
    const c = w.rnd() < 0.5 ? 0x7ffff0 : w.rnd() < 0.6 ? 0xff7fd8 : 0xd0b0ff;
    const k = 0.14 + w.rnd() * 0.22;
    w.blk('glow', x, y, z, k, k, k, c);
  }

  // ------------------------------------------------------------- fondo
  backdropFloor(w, 0x27663a, -2.2);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + w.rnd() * 0.25;
    const r = 112 + w.rnd() * 90;
    distantMesa(w, Math.cos(a) * r, Math.sin(a) * r, 16 + w.rnd() * 22, 12 + w.rnd() * 24,
      0x2f8a34, 0x333c58);
  }
}

// ===========================================================================
// 3 · DESIERTO SOLAR
// ===========================================================================
function desierto(w) {
  const SA = 0xe0b878, ST = 0xc99a5e, ROCK = 0xb8905a;
  land(w, SA, ST, 0, -1.6);

  // Dunas: mesetas bajas de arena que rompen la llanura.
  w.slab(0, 4, 30, 30, 3, SA, ST);
  w.slab(-32, 10, 18, 26, 2, SA, ST);
  w.slab(32, 12, 18, 26, 2, SA, ST);
  w.slab(-20, -24, 24, 18, 6, SA, ST);
  w.slab(20, -24, 24, 18, 6, SA, ST);
  w.slab(0, 32, 26, 16, 3, SA, ST);
  for (let i = 0; i < 6; i++) {
    w.slab(-40 + i * 15, 26 + (i % 2) * 9, 12, 9, 2, SA, ST);
  }

  // Barrancos secos: el agua queda muy abajo, casi no se ve.
  ravine(w, -18, 6, 8, 40, -2.6, -3.2, 0xc09a68);
  ravine(w, 18, 8, 8, 40, -2.6, -3.2, 0xc09a68);
  ravine(w, 0, -12.5, 30, 5, -2.6, -3.2, 0xc09a68);

  w.paint(0, 4, 6, 30, 0xd0a86a);
  w.paint(-6, 12, 14, 4, 0xd0a86a);
  w.bridge(-18, 8, 9, Math.PI / 2, 2.05, 3.4, 0x9a6a3c, 0x6f4a24);
  w.bridge(18, 10, 9, Math.PI / 2, 2.05, 3.4, 0x9a6a3c, 0x6f4a24);
  w.bridge(0, 21.5, 7, 0, 3.05, 4.2, 0x9a6a3c, 0x6f4a24);
  w.stairs(0, -11.5, Math.PI / 2, 6, 0.5, 4, ST, 1, 3);

  // Arcos de roca erosionada y templo en ruinas.
  w.arch(-20, -26, 6, 0, 1.35, ROCK, null, null);
  w.arch(20, -28, 6, Math.PI, 1.15, ROCK, null, null);
  for (let i = 0; i < 6; i++) {
    w.blk('stone', -10 + i * 4, 6 + 3, -31, 2.4, 6, 2.4, 0xd0a870);
    w.blk('stone', -10 + i * 4, 6 + 6.4, -31, 3, 1, 3, 0xc09a68);
  }

  // Cactus repartidos.
  for (let i = 0; i < 22; i++) {
    const a = w.rnd() * Math.PI * 2, r = 6 + w.rnd() * 34;
    const x = Math.round(Math.cos(a) * r), z = Math.round(4 + Math.sin(a) * r);
    const cx = Math.max(-45, Math.min(44, x)), cz = Math.max(-45, Math.min(44, z));
    const h = w.heights[w.idx(cx, cz)];
    if (h < 1) continue;
    if (Math.hypot(x, z - 10) < 4.5) continue;   // hueco de reaparición
    const s = 0.9 + w.rnd() * 0.8;
    w.cactus(x, z, h, s, w.rnd() < 0.5 ? 0x4f9a52 : 0x3f8a48);
  }

  // Rocas y huesos.
  for (let i = 0; i < 14; i++) {
    const x = Math.round((w.rnd() - 0.5) * 74), z = Math.round((w.rnd() - 0.5) * 60 + 6);
    const cx = Math.max(-45, Math.min(44, x)), cz = Math.max(-45, Math.min(44, z));
    const h = w.heights[w.idx(cx, cz)];
    if (h < 1) continue;
    if (Math.hypot(x, z - 10) < 4.5) continue;   // hueco de reaparición
    const s = 1 + w.rnd() * 1.8;
    w.blk('stone', x, h + s * 0.4, z, 2 * s, s * 0.9, 1.6 * s, jit(ROCK, w.rnd, 0.1), w.rnd() * 3);
  }
  for (let i = 0; i < 7; i++) w.blk('stone', 24 + i * 1.6, 3.5 + Math.sin(i) * 0.3, 4, 1.2, 0.8, 1.2, 0xe8e0cc);
  w.blk('stone', 24, 3.9, 4, 2.4, 2.4, 2.4, 0xf0e8d4);

  w.lantern(-4, 16, 3, 0xffd27a, 3);
  w.lantern(4, 16, 3, 0xffd27a, 3);

  backdropFloor(w, 0xd8b070);
  // Sol enorme y mesetas lejanas.
  astro(w, 44, 46, -110, 15, 0xfff0b0, 0xfffbe4);
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI * 0.5 + (i / 10 - 0.5) * 2.8;
    const r = 88 + w.rnd() * 56;
    distantMesa(w, Math.cos(a) * r, Math.sin(a) * r, 10 + w.rnd() * 10, 6 + w.rnd() * 12, SA, ST);
  }
  // Pirámides escalonadas: el horizonte del desierto no es una cordillera
  // verde, son monumentos de piedra comidos por la arena.
  // Van en el cinturón del fondo (r ≈ 64), no al final del mundo: más lejos
  // quedaban tapadas por las dunas y no se veía ni una.
  pyramid(w, -45, -45, 0, 9, 0xd0a870, 9);
  pyramid(w, 48, -42, 0, 7, 0xd0a870, 7);
  pyramid(w, 20, -62, 0, 6, 0xc9a06a, 6);
  pyramid(w, -70, -18, 0, 6, 0xc9a06a, 6);
  // Esfinge mínima delante de la pirámide grande.
  w.blk('stone', -45, 1.6, -30, 7, 3.2, 4.4, 0xc9a06a);
  w.blk('stone', -45, 3.8, -31.4, 4.4, 2.4, 3.4, 0xd0a870);
  w.blk('stone', -42.6, 5.0, -31.6, 2.4, 1.3, 2.6, 0xc9a06a);
  for (let i = 0; i < 7; i++) {
    const a = w.rnd() * Math.PI * 2, r = 150 + w.rnd() * 110;
    w.cloud(Math.cos(a) * r, 76 + w.rnd() * 20, Math.sin(a) * r, 2.4, 0xffe0c0);
  }
}

// ===========================================================================
// 4 · CIUDAD CYBERPUNK
// ===========================================================================
function cyberpunk(w) {
  const ASP = 0x1a1424, MET = 0x2a2238, NEON = 0xff3fd0, CY = 0x3fe0ff;
  w.waterColor = 0x3a1a6a;
  land(w, ASP, 0x14101c, 0, -1.3);

  // Calles elevadas.
  w.slab(0, 4, 28, 30, 3, ASP, MET);
  w.slab(-30, 4, 18, 34, 5, ASP, MET);
  w.slab(30, 4, 18, 34, 5, ASP, MET);
  w.slab(0, -26, 40, 14, 8, ASP, MET);
  w.slab(0, 32, 26, 16, 2, ASP, MET);

  // Canales de datos: el "agua" de la ciudad, neón líquido.
  ravine(w, -18, 4, 8, 40);
  ravine(w, 18, 4, 8, 40);
  ravine(w, 0, -13, 30, 6);

  w.paint(0, 4, 4, 30, 0x3a2a4a);
  w.paint(0, 4, 28, 3, 0x3a2a4a);
  w.stairs(0, -11.5, Math.PI / 2, 10, 0.5, 4, MET, 1, 3);
  w.stairs(0, 21.5, Math.PI / 2, -2, 0.5, 4, MET, 1, 2);
  w.bridge(-18, 4, 9, Math.PI / 2, 3.05, 4, 0x3a2a4a, NEON);
  w.bridge(18, 4, 9, Math.PI / 2, 3.05, 4, 0x3a2a4a, CY);
  w.bridge(0, 21.5, 7, 0, 2.05, 4, 0x3a2a4a, NEON);

  // Torres con ventanas encendidas.
  const towers = [
    [-38, -30, 12, 44, NEON], [38, -30, 12, 40, CY], [-40, 30, 10, 34, CY],
    [40, 30, 10, 38, NEON], [-30, -8, 8, 26, CY], [30, -8, 8, 28, NEON],
    [0, -42, 16, 54, NEON], [-14, -50, 9, 30, CY], [16, -52, 9, 26, NEON],
    [-46, 4, 8, 36, NEON], [46, 4, 8, 34, CY]
  ];
  for (const [x, z, wd, h, c] of towers) {
    w.blk('stone', x, h / 2 - 2, z, wd, h, wd * 0.8, 0x241c30);
    for (let i = 1; i < h / 5; i++) {
      w.blk('glow', x, i * 5 - 1, z - wd * 0.42, wd * 0.7, 0.6, 0.2, c);
      w.blk('glow', x + wd * 0.42, i * 5 - 1, z, 0.2, 0.6, wd * 0.6, c);
    }
    w.blk('glow', x, h - 1, z, wd * 1.05, 0.4, wd * 0.85, c);
  }

  // Carteles verticales.
  for (let i = 0; i < 6; i++) {
    const x = -34 + i * 13, z = i % 2 ? 24 : -18;
    const hh = 6 + (i % 3) * 3;
    w.blk('glow', x, 9 + hh / 2, z, 0.4, hh, 3, i % 2 ? NEON : CY);
  }

  // Líneas de neón en el pavimento.
  for (let i = -40; i <= 40; i += 8) {
    w.blk('glow', i, 3.06, 4, 0.3, 0.1, 28, CY);
  }
  for (let i = -40; i <= 40; i += 8) {
    w.blk('glow', 0, 0.06, i, 88, 0.1, 0.3, NEON);
  }
  w.lantern(-8, 16, 3, NEON, 4);
  w.lantern(8, 16, 3, CY, 4);
  w.crate(-6, 0, 3, 1);
  w.crate(7, 1, 3, 1.1);
  for (let i = 0; i < 24; i++) {
    w.blk('glow', (w.rnd() - 0.5) * 84, 2 + w.rnd() * 26, (w.rnd() - 0.5) * 84,
      0.3, 0.3, 0.3, i % 2 ? NEON : CY);
  }
}

// ===========================================================================
// 5 · FÁBRICA INFERNAL
// ===========================================================================
function fabrica(w) {
  const MET = 0x6a4a38, DARK = 0x4a3428, LAVA = 0xff7a24;
  w.waterColor = LAVA;
  land(w, DARK, MET, 0, -1.2);

  w.slab(0, 4, 30, 30, 3, DARK, MET);
  w.slab(-30, 8, 18, 30, 5, DARK, MET);
  w.slab(30, 8, 18, 30, 5, DARK, MET);
  w.slab(0, -26, 44, 14, 8, DARK, MET);

  // Canales de lava.
  ravine(w, -18, 6, 8, 40, -1.4, -3);
  ravine(w, 18, 8, 8, 40, -1.4, -3);
  ravine(w, 0, -12.5, 30, 5, -1.4, -3);

  w.paint(0, 4, 8, 30, 0x5a4436);
  w.stairs(0, -11.5, Math.PI / 2, 10, 0.5, 4, MET, 1, 3);
  w.bridge(-18, 6, 9, Math.PI / 2, 3.05, 4, 0x3a2a24, LAVA);
  w.bridge(18, 8, 9, Math.PI / 2, 3.05, 4, 0x3a2a24, LAVA);
  w.bridge(0, 21.5, 7, 0, 3.05, 4.2, 0x3a2a24, LAVA);

  // Chimeneas y hornos.
  for (let i = 0; i < 8; i++) {
    const x = -36 + i * 10, z = -34 + (i % 2) * 6;
    const h = 16 + (i % 3) * 8;
    w.blk('stone', x, h / 2, z, 6, h, 6, 0x3a2a24);
    w.blk('stone', x, h + 0.6, z, 6.6, 1.2, 6.6, 0x2a1e1a);
    w.blk('glow', x, h + 2, z, 4, 2, 4, LAVA);
  }

  // Tuberías horizontales y vagonetas.
  for (let i = 0; i < 6; i++) {
    w.blk('metal', 0, 12 + i * 4, -30 + i * 2, 80, 1.4, 1.4, 0x5a4034);
  }
  for (let i = 0; i < 10; i++) {
    const x = Math.round((w.rnd() - 0.5) * 60), z = Math.round((w.rnd() - 0.5) * 50 + 6);
    const cx = Math.max(-45, Math.min(44, x)), cz = Math.max(-45, Math.min(44, z));
    const h = w.heights[w.idx(cx, cz)];
    if (h < 1) continue;
    if (Math.hypot(x, z - 10) < 4.5) continue;   // hueco de reaparición
    w.blk('metal', x, h + 0.9, z, 2.4, 1.8, 2.4, 0x5a4034);
    w.blk('glow', x, h + 0.35, z, 2.5, 0.3, 2.5, LAVA);
  }
  for (let i = 0; i < 30; i++) {
    w.blk('glow', (w.rnd() - 0.5) * 84, 2 + w.rnd() * 22, (w.rnd() - 0.5) * 84,
      0.4, 0.4, 0.4, i % 3 ? LAVA : 0xffc24a);
  }
  backdropFloor(w, 0x5a3c30);
  for (let i = 0; i < 7; i++) {
    const a = w.rnd() * Math.PI * 2, r = 150 + w.rnd() * 110;
    w.cloud(Math.cos(a) * r, 76 + w.rnd() * 20, Math.sin(a) * r, 2.4, 0x6a3a28);
  }
}

// ===========================================================================
// 6 · HIELO ETERNO
// ===========================================================================
function hielo(w) {
  const ICE = 0xa8c4dc, ICE2 = 0x7f9fb8, SNOW = 0xd2e2f0;
  w.waterColor = 0x6fd0f0;
  land(w, SNOW, ICE2, 1, -1.4);

  w.slab(0, 4, 30, 30, 3, SNOW, ICE);
  w.slab(-30, 8, 18, 30, 5, SNOW, ICE);
  w.slab(30, 8, 18, 30, 5, SNOW, ICE);
  w.slab(0, -26, 44, 14, 8, SNOW, ICE);

  // Grietas heladas.
  ravine(w, -18, 6, 8, 40, -1.4, -3, 0xbfe0f0);
  ravine(w, 18, 8, 8, 40, -1.4, -3, 0xbfe0f0);
  ravine(w, 0, -12.5, 30, 5, -1.4, -3, 0xbfe0f0);

  w.paint(0, 4, 6, 30, 0xe4f0fa);
  w.stairs(0, -11.5, Math.PI / 2, 10, 0.5, 4, ICE, 1, 3);
  w.bridge(-18, 6, 9, Math.PI / 2, 3.05, 4, ICE, ICE2);
  w.bridge(18, 8, 9, Math.PI / 2, 3.05, 4, ICE, ICE2);
  w.bridge(0, 21.5, 7, 0, 3.05, 4.2, ICE, ICE2);

  // Agujas de hielo.
  for (let i = 0; i < 30; i++) {
    const a = w.rnd() * Math.PI * 2, r = 6 + w.rnd() * 36;
    const x = Math.round(Math.cos(a) * r), z = Math.round(4 + Math.sin(a) * r);
    const cx = Math.max(-45, Math.min(44, x)), cz = Math.max(-45, Math.min(44, z));
    const h = w.heights[w.idx(cx, cz)];
    if (h < 1) continue;
    if (Math.hypot(x, z - 10) < 4.5) continue;   // hueco de reaparición
    const s = 0.8 + w.rnd() * 1.5, hh = 3 + w.rnd() * 9;
    w.blk('glass', x, h + hh / 2, z, s, hh, s, 0xbfe6ff);
    w.blk('glass', x, h + hh + 0.9, z, s * 0.5, 1.8, s * 0.5, 0xe8f8ff);
  }
  backdropFloor(w, 0xe8f4ff, -2.2);
  castleBackdrop(w, 0, -150, 0, 1.5, 0xe4f2ff, 0x9fd4f8, 0xffffff);

  for (let i = 0; i < 24; i++) {
    w.blk('glow', (w.rnd() - 0.5) * 84, 4 + w.rnd() * 24, (w.rnd() - 0.5) * 84,
      0.35, 0.35, 0.35, 0xe8f8ff);
  }
  for (let i = 0; i < 9; i++) {
    const a = w.rnd() * Math.PI * 2, r = 150 + w.rnd() * 110;
    w.cloud(Math.cos(a) * r, 76 + w.rnd() * 20, Math.sin(a) * r, 2, 0xffffff);
  }
  w.lantern(-6, 16, 3, 0x9fe4ff, 3);
  w.lantern(6, 16, 3, 0x9fe4ff, 3);
}

// ===========================================================================
// 7 · CASTILLO OSCURO
// ===========================================================================
function castillo(w) {
  const DARK = 0x5c4c6c, ST = 0x6e5e80, MOON = 0xff5a7a;
  w.waterColor = 0x3a2456;
  land(w, 0x5a4c68, ST, 0, -1.3);

  w.slab(0, 4, 30, 30, 3, 0x463a50, ST);
  w.slab(-30, 8, 18, 30, 5, 0x463a50, ST);
  w.slab(30, 8, 18, 30, 5, 0x463a50, ST);
  w.slab(0, -26, 44, 16, 8, 0x463a50, ST);

  ravine(w, -18, 6, 8, 40, -1.3, -3, 0x241a30);
  ravine(w, 18, 8, 8, 40, -1.3, -3, 0x241a30);
  ravine(w, 0, -12.5, 30, 5, -1.3, -3, 0x241a30);

  w.paint(0, 4, 7, 30, 0x6a5670);
  w.stairs(0, -11.5, Math.PI / 2, 10, 0.5, 4, ST, 1, 3);
  w.bridge(-18, 6, 9, Math.PI / 2, 3.05, 4, 0x6a5670, 0x4a3a56);
  w.bridge(18, 8, 9, Math.PI / 2, 3.05, 4, 0x6a5670, 0x4a3a56);
  w.bridge(0, 21.5, 7, 0, 3.05, 4.2, 0x6a5670, 0x4a3a56);

  // Castillo gótico al fondo.
  const z0 = -128;
  for (let i = 0; i < 4; i++) {
    w.blk('stone', 0, i * 2.6, z0, 52 - i * 10, 2.6, 38 - i * 7, 0x241a2a);
  }
  w.blk('stone', 0, 24, z0, 34, 28, 20, 0x4a3a58);
  for (const [ox, hh] of [[-17, 46], [17, 46], [-9, 38], [9, 38], [0, 56]]) {
    w.blk('stone', ox, 14 + hh / 2, z0, 7, hh, 7, 0x463654);
    for (let i = 0; i < 4; i++) {
      const ww = (7 - i * 1.6);
      w.blk('stone', ox, 14 + hh + (i + 0.5) * 3.2, z0, ww, 3.2, ww, 0x3a2a44);
    }
    w.blk('glow', ox, 14 + hh * 0.7, z0 + 3.6, 1.4, 3, 0.3, MOON);
  }
  w.blk('glow', 0, 6, z0 + 10.2, 6, 11, 0.4, 0xff5a7a);
  astro(w, 40, 48, -140, 13, MOON, 0xffb0c4);

  // Lápidas, cruces y árboles muertos.
  for (let i = 0; i < 16; i++) {
    const a = w.rnd() * Math.PI * 2, r = 8 + w.rnd() * 32;
    const x = Math.round(Math.cos(a) * r), z = Math.round(4 + Math.sin(a) * r);
    const cx = Math.max(-45, Math.min(44, x)), cz = Math.max(-45, Math.min(44, z));
    const h = w.heights[w.idx(cx, cz)];
    if (h < 1) continue;
    if (Math.hypot(x, z - 10) < 4.5) continue;   // hueco de reaparición
    if (i % 3 === 0) {
      w.blk('stone', x, h + 2.6, z, 0.8, 5.2, 0.8, 0x3a2c3a);
      w.blk('stone', x, h + 3.6, z, 3, 0.6, 0.6, 0x3a2c3a);
      w.blk('stone', x - 1.4, h + 4.6, z, 0.5, 2.2, 0.5, 0x3a2c3a);
    } else {
      w.blk('stone', x, h + 1.6, z, 1.6, 3.2, 1.6, 0x3a2e3e);
      w.blk('glow', x, h + 2.6, z, 0.3, 1.4, 1.7, 0xff5a7a);
    }
  }
  for (let i = 0; i < 9; i++) {
    const a = w.rnd() * Math.PI * 2, r = 12 + w.rnd() * 28;
    const x = Math.round(Math.cos(a) * r), z = Math.round(4 + Math.sin(a) * r);
    const cx = Math.max(-45, Math.min(44, x)), cz = Math.max(-45, Math.min(44, z));
    const h = w.heights[w.idx(cx, cz)];
    if (h < 1) continue;
    if (Math.hypot(x, z - 10) < 4.5) continue;   // hueco de reaparición
    w.blk('wood', x, h + 3, z, 0.7, 6, 0.7, 0x241c28);
    w.blk('wood', x - 1.2, h + 5.4, z, 2.4, 0.5, 0.5, 0x241c28);
  }
  for (let i = 0; i < 12; i++) {
    const a = w.rnd() * Math.PI * 2, r = 10 + w.rnd() * 30;
    const x = Math.round(Math.cos(a) * r), z = Math.round(4 + Math.sin(a) * r);
    const cx = Math.max(-45, Math.min(44, x)), cz = Math.max(-45, Math.min(44, z));
    const h = w.heights[w.idx(cx, cz)];
    if (h < 1) continue;
    if (Math.hypot(x, z - 10) < 4.5) continue;   // hueco de reaparición
    w.lantern(x, z, h, 0xff7a4a, 2.6);
  }
  backdropFloor(w, 0x3a2c44);
  for (let i = 0; i < 20; i++) {
    w.blk('glow', (w.rnd() - 0.5) * 84, 3 + w.rnd() * 20, (w.rnd() - 0.5) * 84,
      0.3, 0.3, 0.3, i % 2 ? 0xff5a7a : 0xb05aff);
  }
}

// ===========================================================================
// 8 · RUINAS ANTIGUAS
// ===========================================================================
function ruinas(w) {
  const GR = 0x74a04e, ST = 0x9a9a92, MOSS = 0x5a9a4a;
  land(w, GR, ST, 0, -1.1);

  w.slab(0, 4, 28, 30, 3, GR, ST);
  w.slab(-32, 6, 18, 26, 2, GR, ST);
  w.slab(32, 8, 18, 26, 2, GR, ST);
  w.slab(-20, -24, 24, 18, 6, GR, ST);
  w.slab(20, -24, 24, 18, 6, GR, ST);
  w.slab(0, 32, 26, 16, 3, GR, ST);

  ravine(w, -18, 6, 8, 40);
  ravine(w, 18, 8, 8, 40);
  ravine(w, 0, -12.5, 30, 5);

  w.paint(0, 4, 6, 30, 0xa8a88a);
  w.paint(-6, 12, 14, 4, 0xa8a88a);
  w.stairs(0, -11.5, Math.PI / 2, 6, 0.5, 4, ST, 1, 3);
  w.bridge(-18, 6, 9, Math.PI / 2, 2.05, 3.6, 0x9a8a6a, 0x7a6a4a);
  w.bridge(18, 8, 9, Math.PI / 2, 2.05, 3.6, 0x9a8a6a, 0x7a6a4a);
  w.bridge(0, 21.5, 7, 0, 3.05, 4.2, 0x9a8a6a, 0x7a6a4a);

  // Arcos y columnas derruidas.
  w.arch(-20, -26, 6, 0, 1.45, ST, MOSS, null);
  w.arch(20, -26, 6, 0, 1.45, ST, MOSS, null);
  w.arch(0, -32, 6, 0, 1.8, ST, MOSS, null);
  for (let i = 0; i < 14; i++) {
    const x = Math.round((w.rnd() - 0.5) * 70), z = Math.round((w.rnd() - 0.5) * 60 + 6);
    const cx = Math.max(-45, Math.min(44, x)), cz = Math.max(-45, Math.min(44, z));
    const h = w.heights[w.idx(cx, cz)];
    if (h < 1) continue;
    if (Math.hypot(x, z - 10) < 4.5) continue;   // hueco de reaparición
    const hh = 2 + w.rnd() * 8;
    w.blk('stone', x, h + hh / 2, z, 1.6, hh, 1.6, ST);
    if (w.rnd() > 0.4) w.blk('leaf', x, h + hh + 0.2, z, 1.7, 0.4, 1.7, MOSS);
  }

  // Islas flotantes con ruinas. Van altas: a la altura de la cámara una de
  // ellas se plantaba delante del objetivo y tapaba medio escenario.
  for (let i = 0; i < 7; i++) {
    const a = w.rnd() * Math.PI * 2, r = 40 + w.rnd() * 36;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, y = 42 + w.rnd() * 16;
    const s = 2.0 + w.rnd() * 1.6;
    w.blk('ground', x, y, z, s * 4, 1.4, s * 3.4, GR);
    w.blk('stone', x, y - 2.6, z, s * 3.2, 4, s * 2.6, ST);
    w.blk('stone', x, y - 5.4, z, s * 1.6, 2.4, s * 1.4, ST);
    w.blk('stone', x, y + 2.2, z, 1.4, 4, 1.4, ST);
  }

  w.waterfall(-22.6, 14, 2, -1.2, 5, Math.PI / 2);
  w.waterfall(22.6, -2, 2, -1.2, 5, Math.PI / 2);
  // En unas ruinas los árboles están secos: la arboleda de hoja ancha que había
  // aquí rompía la temática del sector.
  for (let i = 0; i < 9; i++) {
    const x = Math.round(i < 4 ? -40 + w.rnd() * 14 : 24 + w.rnd() * 16);
    const z = Math.round(i < 4 ? -4 + w.rnd() * 20 : w.rnd() * 20);
    const cx = Math.max(-45, Math.min(44, x)), cz = Math.max(-45, Math.min(44, z));
    const hh = w.heights[w.idx(cx, cz)];
    if (hh < 1) continue;
    w.deadTree(x, z, hh, 1.2 + w.rnd() * 0.9, 0x5a4a3a);
  }
  w.flowers(-6, 10, 3, 12, 4, [0xffe45c, 0xffffff, 0xff5a9e]);
  w.bush(-9, 14, 3, 1, MOSS);
  backdropFloor(w, 0x6f9a4a);
  for (let i = 0; i < 10; i++) {
    const a = w.rnd() * Math.PI * 2, r = 150 + w.rnd() * 110;
    w.cloud(Math.cos(a) * r, 76 + w.rnd() * 20, Math.sin(a) * r, 1.8, 0xffffff);
  }
}

// ===========================================================================
// 9 · VOLCÁN ROJO
// ===========================================================================
function volcan(w) {
  const ROCK = 0x5c463e, LAVA = 0xff7a2e, ASH = 0x6e5448;
  w.waterColor = LAVA;
  land(w, ASH, ROCK, 0, -1.2);

  w.slab(0, 6, 30, 28, 3, ASH, ROCK);
  w.slab(-30, 8, 18, 30, 5, ASH, ROCK);
  w.slab(30, 8, 18, 30, 5, ASH, ROCK);
  w.slab(0, -24, 44, 14, 8, ASH, ROCK);

  ravine(w, -18, 6, 8, 40, -1.4, -3);
  ravine(w, 18, 8, 8, 40, -1.4, -3);
  ravine(w, 0, -12.5, 30, 5, -1.4, -3);

  w.paint(0, 6, 7, 28, 0x6a4a3a);
  w.stairs(0, -11.5, Math.PI / 2, 10, 0.5, 4, ROCK, 1, 3);
  w.bridge(-18, 6, 9, Math.PI / 2, 3.05, 4, 0x6a4a3a, LAVA);
  w.bridge(18, 8, 9, Math.PI / 2, 3.05, 4, 0x6a4a3a, LAVA);
  w.bridge(0, 21.5, 7, 0, 3.05, 4.2, 0x6a4a3a, LAVA);

  // Cono del volcán al fondo.
  for (let i = 0; i < 9; i++) {
    const r = 42 - i * 3.8;
    w.blk('stone', 0, 6 + i * 3, -80, r * 1.6, 3.2, r * 1.4, 0x2a1a18);
  }
  w.blk('glow', 0, 36, -80, 16, 2.4, 14, LAVA);
  for (let i = 0; i < 12; i++) {
    w.blk('glow', (w.rnd() - 0.5) * 10, 34 - i * 2.6, -80 + 6 + i * 1.6, 3.4, 0.6, 3, LAVA);
  }

  // Rocas volcánicas.
  for (let i = 0; i < 18; i++) {
    const x = Math.round((w.rnd() - 0.5) * 72), z = Math.round((w.rnd() - 0.5) * 60 + 8);
    const cx = Math.max(-45, Math.min(44, x)), cz = Math.max(-45, Math.min(44, z));
    const h = w.heights[w.idx(cx, cz)];
    if (h < 1) continue;
    if (Math.hypot(x, z - 10) < 4.5) continue;   // hueco de reaparición
    const s = 1.2 + w.rnd() * 1.8;
    w.blk('stone', x, h + s * 0.4, z, 2 * s, s * 0.9, 1.6 * s, 0x241816, w.rnd() * 3);
  }
  for (let i = 0; i < 34; i++) {
    w.blk('glow', (w.rnd() - 0.5) * 86, 2 + w.rnd() * 26, (w.rnd() - 0.5) * 86,
      0.35, 0.35, 0.35, i % 3 ? LAVA : 0xffc24a);
  }
  backdropFloor(w, 0x4a322c);
  for (let i = 0; i < 8; i++) {
    const a = w.rnd() * Math.PI * 2, r = 150 + w.rnd() * 110;
    w.cloud(Math.cos(a) * r, 76 + w.rnd() * 20, Math.sin(a) * r, 2.6, 0x4a2018);
  }
}

// ===========================================================================
// 10 · ISLA TROPICAL
// ===========================================================================
function isla(w) {
  const SAND = 0xe8d29a, SAND2 = 0xd0b878, GR = 0x5ab53a;
  w.waterColor = 0x2fc8e8;
  basin(w, -0.8, -3.2, 0xd8c48a);

  // Isla: arena baja con meseta de hierba en el centro.
  w.slab(0, 4, 40, 38, 1, SAND, SAND2);
  w.slab(0, 2, 24, 24, 3, GR, SAND2);
  w.slab(-30, 6, 16, 22, 1, SAND, SAND2);
  w.slab(30, 6, 16, 22, 1, SAND, SAND2);
  w.slab(0, -26, 24, 14, 4, GR, SAND2);

  w.paint(0, 2, 6, 24, 0xd8b878);
  w.stairs(0, -10.5, Math.PI / 2, 6, 0.5, 4, SAND2, 1, 3);
  w.bridge(-16, 4, 8, Math.PI / 2, 1.05, 4, 0x9a6a3c, 0x6f4a24);
  w.bridge(16, 6, 8, Math.PI / 2, 1.05, 4, 0x9a6a3c, 0x6f4a24);

  // Palmeras.
  for (let i = 0; i < 18; i++) {
    const a = w.rnd() * Math.PI * 2, r = 8 + w.rnd() * 30;
    const x = Math.round(Math.cos(a) * r), z = Math.round(4 + Math.sin(a) * r);
    const cx = Math.max(-45, Math.min(44, x)), cz = Math.max(-45, Math.min(44, z));
    const h = w.heights[w.idx(cx, cz)];
    if (h < 1) continue;
    if (Math.hypot(x, z - 10) < 4.5) continue;   // hueco de reaparición
    const s = 0.9 + w.rnd() * 0.6, th = 8 * s;
    for (let k = 0; k < th; k++) {
      w.blk('wood', x + Math.sin(k * 0.1) * 0.9, h + k + 0.5, z, 0.9, 1, 0.9, 0x8a6a44);
    }
    const ty = h + th;
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2;
      w.blk('leaf', x + Math.cos(ang) * 2, ty + 0.3, z + Math.sin(ang) * 2, 3, 0.4, 1, 0x3fa02a, ang);
      w.blk('leaf', x + Math.cos(ang) * 3.2, ty - 0.3, z + Math.sin(ang) * 3.2, 1.6, 0.35, 0.8, 0x4ab02e, ang);
    }
  }

  // Muelle y rocas.
  for (let i = 0; i < 9; i++) {
    w.blk('wood', -20 - i * 2.6, 0.2, 26, 2.6, 0.4, 4, 0x8a6a44);
    w.blk('wood', -20 - i * 2.6, -1, 24.2, 0.5, 3, 0.5, 0x6f4a24);
    w.blk('wood', -20 - i * 2.6, -1, 27.8, 0.5, 3, 0.5, 0x6f4a24);
  }
  for (let i = 0; i < 14; i++) {
    const a = w.rnd() * Math.PI * 2, r = 32 + w.rnd() * 12;
    const s = 1.4 + w.rnd() * 2.4;
    w.blk('stone', Math.cos(a) * r, -0.4, Math.sin(a) * r, 2.4 * s, 1.6 * s, 2 * s, 0x8a8a86, w.rnd() * 3);
  }

  w.flowers(-6, 8, 3, 12, 4, [0xff5a9e, 0xffe45c, 0xffffff]);
  w.bush(-10, 12, 1, 1, 0x3f9e2a);
  w.crate(8, 12, 1, 1);
  for (let i = 0; i < 11; i++) {
    const a = w.rnd() * Math.PI * 2, r = 150 + w.rnd() * 110;
    w.cloud(Math.cos(a) * r, 76 + w.rnd() * 20, Math.sin(a) * r, 1.8, 0xffffff);
  }
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.5 + (i / 6 - 0.5) * 2.4, r = 88 + w.rnd() * 44;
    distantMesa(w, Math.cos(a) * r, Math.sin(a) * r, 8 + w.rnd() * 8, 7 + w.rnd() * 9, GR, SAND2);
  }
}

// ===========================================================================
// 11 · ESPACIO INFINITO
// ===========================================================================
function espacio(w) {
  const ROCK = 0x3e3058, ROCK2 = 0x55406e, CRY = 0x9a5aff, CY = 0x3fd8ff;
  w.waterColor = 0x3a1a68;
  w.waterFloor = -4.9;
  // Sin suelo: islas flotantes sobre el vacío. La rejilla se rellena muy abajo
  // para que nadie caiga al infinito.
  w.channel(0, 0, ARENA * 2, ARENA * 2, -6, -5, 0x120a24);

  w.slab(0, 4, 28, 28, 3, ROCK2, ROCK);
  w.slab(-30, 4, 16, 28, 5, ROCK2, ROCK);
  w.slab(30, 4, 16, 28, 5, ROCK2, ROCK);
  w.slab(0, -26, 30, 14, 8, ROCK2, ROCK);

  w.paint(0, 4, 5, 28, 0x6a5590);
  w.stairs(0, -11.5, Math.PI / 2, 10, 0.5, 4, ROCK, 1, 3, -3);
  w.bridge(-18, 4, 8, Math.PI / 2, 3.05, 3.4, 0x3a2c50, CRY);
  w.bridge(18, 4, 8, Math.PI / 2, 3.05, 3.4, 0x3a2c50, CRY);

  // Islas flotantes alrededor.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + w.rnd() * 0.3;
    const r = 34 + w.rnd() * 30, y = 8 + w.rnd() * 26;
    const s = 2 + w.rnd() * 3;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    w.blk('ground', x, y, z, s * 3.4, 1.2, s * 3, ROCK2);
    w.blk('stone', x, y - 2.2, z, s * 2.8, 3.4, s * 2.4, ROCK);
    w.blk('stone', x, y - 4.6, z, s * 1.4, 1.8, s * 1.2, ROCK);
    w.blk('glow', x, y + 1.4, z, 0.9, 2.6, 0.9, i % 2 ? CRY : CY);
  }

  // Cristales en las mesetas.
  for (let i = 0; i < 18; i++) {
    const x = Math.round((w.rnd() - 0.5) * 60), z = Math.round((w.rnd() - 0.5) * 54 + 4);
    const cx = Math.max(-45, Math.min(44, x)), cz = Math.max(-45, Math.min(44, z));
    const h = w.heights[w.idx(cx, cz)];
    if (h < 1) continue;
    if (Math.hypot(x, z - 10) < 4.5) continue;   // hueco de reaparición
    const s = 0.7 + w.rnd() * 0.9, hh = 2 + w.rnd() * 4;
    w.blk('glass', x, h + hh / 2, z, s, hh, s, 0xbf8aff);
    w.blk('glow', x, h + hh + 0.4, z, s * 0.6, 0.8, s * 0.6, CY);
  }

  // Nebulosa al fondo: muchas motas pequeñas en espiral. Antes eran cinco
  // cuadrados de 80 unidades que se veían como una pared morada recortada.
  for (let i = 0; i < 260; i++) {
    const a = w.rnd() * Math.PI * 2, rr = Math.sqrt(w.rnd());
    const x = Math.cos(a) * rr * 90, y = 40 + Math.sin(a * 1.7) * rr * 26 + w.rnd() * 14;
    const k = 0.5 + w.rnd() * 1.6;
    const c = i % 3 === 0 ? 0x6a3aff : (i % 3 === 1 ? 0x3fd8ff : 0xb06aff);
    w.blk('glow', x, y, -130 + (w.rnd() - 0.5) * 30, k, k, 0.5, c);
  }
  for (let i = 0; i < 110; i++) {
    const a = w.rnd() * Math.PI * 2, r = 40 + w.rnd() * 120;
    w.blk('glow', Math.cos(a) * r, 6 + w.rnd() * 70, Math.sin(a) * r - 20,
      0.4 + w.rnd() * 0.6, 0.4 + w.rnd() * 0.6, 0.4, 0xffffff);
  }
}

// ===========================================================================
// 12 · CIUDAD CELESTIAL
// ===========================================================================
function celestial(w) {
  const MAR = 0xdae2ef, MAR2 = 0xbcc6da, GOLD = 0xffd27a;
  w.waterColor = 0xcfe4ff;
  w.waterFloor = -4.9;
  w.channel(0, 0, ARENA * 2, ARENA * 2, -6, -5, 0xdfe8f8);

  w.slab(0, 4, 32, 32, 4, MAR, MAR2);
  w.slab(-30, 4, 18, 30, 6, MAR, MAR2);
  w.slab(30, 4, 18, 30, 6, MAR, MAR2);
  w.slab(0, -26, 34, 14, 9, MAR, MAR2);

  w.paint(0, 4, 7, 32, 0xf4f8ff);
  w.stairs(0, -12.5, Math.PI / 2, 10, 0.5, 5, MAR2, 1, 4, -3);
  w.bridge(-19, 4, 9, Math.PI / 2, 4.05, 4, MAR, GOLD);
  w.bridge(19, 4, 9, Math.PI / 2, 4.05, 4, MAR, GOLD);

  // Columnas y templetes.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, r = 10 + w.rnd() * 24;
    const x = Math.round(Math.cos(a) * r), z = Math.round(4 + Math.sin(a) * r);
    const cx = Math.max(-45, Math.min(44, x)), cz = Math.max(-45, Math.min(44, z));
    const h = w.heights[w.idx(cx, cz)];
    if (h < 1) continue;
    if (Math.hypot(x, z - 10) < 4.5) continue;   // hueco de reaparición
    const hh = 5 + w.rnd() * 7;
    w.blk('stone', x, h + hh / 2, z, 1.6, hh, 1.6, MAR);
    w.blk('stone', x, h + hh + 0.4, z, 2.6, 0.8, 2.6, GOLD);
    w.blk('stone', x, h + 0.4, z, 2.6, 0.8, 2.6, MAR2);
  }

  backdropFloor(w, 0xdce8f8, -2.2);
  castleBackdrop(w, 0, -150, 0, 1.55, 0xf4f8ff, 0xffd27a, 0xbfe0ff);

  // Islas flotantes y aros dorados.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, r = 36 + w.rnd() * 26, y = 12 + w.rnd() * 22;
    const s = 2 + w.rnd() * 2.4;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    w.blk('ground', x, y, z, s * 3.2, 1.2, s * 2.8, MAR);
    w.blk('stone', x, y - 2, z, s * 2.4, 3, s * 2, MAR2);
    w.blk('stone', x, y + 2, z, 1.2, 3.4, 1.2, MAR);
    w.blk('glow', x, y + 4, z, 1.6, 0.6, 1.6, GOLD);
  }
  for (let i = 0; i < 3; i++) {
    const r = 22 + i * 7, y = 30 + i * 7;
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      w.blk('glow', Math.cos(a) * r, y + Math.sin(a) * 2, Math.sin(a) * r - 40, 1.4, 0.5, 1.4, GOLD);
    }
  }
  for (let i = 0; i < 18; i++) {
    const a = w.rnd() * Math.PI * 2, r = 150 + w.rnd() * 110;
    w.cloud(Math.cos(a) * r, 76 + w.rnd() * 20, Math.sin(a) * r, 2, 0xffffff);
  }
}

// ---------------------------------------------------------------------------
const BUILDERS = {
  rooftop: praderas,
  hive: bosque,
  docks: desierto,
  spire: cyberpunk,
  refinery: fabrica,
  scrapyard: hielo,
  cathedral: castillo,
  undercity: ruinas,
  terminus: volcan,
  greenhouse: isla,
  foundry: espacio,
  nullspace: celestial
};

// Paleta del paisaje envolvente por mundo (los que no están hechos a mano).
// `prop` es la silueta que cría cada bioma. Sin esto, todos los mundos
// acababan con la misma arboleda de hoja ancha: un desierto con árboles, una
// fábrica con árboles, el vacío con árboles.
const SURROUND = {
  // Desierto: cactus, y las pirámides se ponen a mano en desierto().
  docks: { grass: 0xe0b878, stone: 0xc99a5e, leaf: 0x4f9a52, trunk: 0x8a6a44, trees: 0.085, prop: 'cactus' },
  // Cyberpunk: obeliscos de neón, ni una hoja.
  spire: { grass: 0x241c30, stone: 0x3a2c50, leaf: 0xff3fd0, trunk: 0x2a1a30, trees: 0.30, prop: 'crystal' },
  // Fábrica: depósitos y chimeneas.
  refinery: { grass: 0x4a3228, stone: 0x7a5a48, leaf: 0xff8a3c, trunk: 0x3a2418, trees: 0.26, prop: 'silo' },
  // Hielo: agujas de hielo, no bosque.
  scrapyard: { grass: 0xcfe4f2, stone: 0xa8c0d8, leaf: 0xdff2ff, trunk: 0x6a7f92, trees: 0.34, prop: 'ice' },
  // Castillo oscuro: árboles secos.
  cathedral: { grass: 0x3a2c44, stone: 0x4a3a58, leaf: 0x4a2a5a, trunk: 0x241a2c, trees: 0.34, prop: 'dead' },
  // Ruinas: columnas y setas de cueva.
  undercity: { grass: 0x6f9a5a, stone: 0x8a8a82, leaf: 0x7fd88a, trunk: 0x4a3a2c, trees: 0.36, prop: 'dead' },
  // Volcán: árboles quemados.
  terminus: { grass: 0x4a2a22, stone: 0x3a2420, leaf: 0xff6a20, trunk: 0x241410, trees: 0.26, prop: 'dead' },
  // Isla: palmeras.
  greenhouse: { grass: 0xe8d29a, stone: 0xc9b483, leaf: 0x3f9a5a, trunk: 0x8a6a44, trees: 0.50, prop: 'palm' },
  // Espacio: cristales y roca flotante.
  foundry: { grass: 0x2a2040, stone: 0x3a2c50, leaf: 0x9a6aff, trunk: 0x241a34, trees: 0.34, prop: 'crystal' },
  // Ciudad celestial: cristales de luz.
  nullspace: { grass: 0xdce8f8, stone: 0xc8d4e8, leaf: 0xffe8a0, trunk: 0x8a94a8, trees: 0.34, prop: 'crystal' }
};

// Color y densidad de la vegetación rastrera por mundo. Es lo que hace que el
// suelo deje de ser una superficie lisa en los doce escenarios a la vez.
const DETAIL = {
  rooftop: [0x4fa83c, 0.13],
  hive: [0x2f9a5c, 0.15],
  docks: [0xa88a52, 0.05],
  spire: [0x3a5a6a, 0.04],
  refinery: [0x6a4a3a, 0.04],
  scrapyard: [0xa8c8e0, 0.05],
  cathedral: [0x5a3a6a, 0.05],
  undercity: [0x5a8a4a, 0.11],
  terminus: [0x6a3a2a, 0.04],
  greenhouse: [0x3f9a6a, 0.12],
  foundry: [0x4a3a6a, 0.05],
  nullspace: [0x8a9ac0, 0.05]
};

const waterMats = [];
const fallMats = [];

// ------------------------------------------------------------------ partículas
// Motas en el aire: polen en el prado, esporas en el bosque, chispas en la
// fábrica. Sin ellas el escenario es una maqueta; con ellas está vivo, que es
// la mitad del aire de la referencia.
const MOTE_ART = {
  rooftop: { color: 0xfff0a0, count: 240, size: 0.42, area: 120, height: 26, drift: 1.1, blend: 'add' },
  hive: { color: 0x8affd8, count: 460, size: 0.44, area: 118, height: 30, drift: 0.7, blend: 'add' },
  docks: { color: 0xffd9a0, count: 200, size: 0.4, area: 120, height: 26, drift: 0.8, blend: 'add' },
  spire: { color: 0xff8ae0, count: 260, size: 0.4, area: 120, height: 30, drift: 1.4, blend: 'add' },
  refinery: { color: 0xffb060, count: 240, size: 0.42, area: 120, height: 28, drift: 1.6, blend: 'add' },
  scrapyard: { color: 0xe8f8ff, count: 280, size: 0.36, area: 120, height: 28, drift: -0.9, blend: 'add' },
  cathedral: { color: 0xff9ad0, count: 220, size: 0.4, area: 120, height: 28, drift: 1.0, blend: 'add' },
  undercity: { color: 0xd8f0c0, count: 200, size: 0.4, area: 120, height: 26, drift: 0.9, blend: 'add' },
  terminus: { color: 0xff8a3a, count: 300, size: 0.46, area: 120, height: 30, drift: 2.0, blend: 'add' },
  greenhouse: { color: 0xfff4c0, count: 220, size: 0.4, area: 120, height: 26, drift: 0.9, blend: 'add' },
  foundry: { color: 0xc0a0ff, count: 300, size: 0.42, area: 130, height: 32, drift: 0.6, blend: 'add' },
  nullspace: { color: 0xffe8b0, count: 240, size: 0.4, area: 120, height: 28, drift: 0.9, blend: 'add' }
};

let moteTex = null;
function moteTexture() {
  if (moteTex) return moteTex;
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.28, 'rgba(255,255,255,0.72)');
  grd.addColorStop(0.62, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  moteTex = new THREE.CanvasTexture(cv);
  moteTex.colorSpace = THREE.SRGBColorSpace;
  return moteTex;
}

const moteSystems = [];

function buildMotes(parent, cfg) {
  const n = cfg.count;
  const pos = new Float32Array(n * 3);
  const phase = new Float32Array(n);
  const scale = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * cfg.area * 0.5;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.random() * cfg.height;
    pos[i * 3 + 2] = Math.sin(a) * r;
    phase[i] = Math.random() * Math.PI * 2;
    scale[i] = 0.6 + Math.random() * 0.9;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: cfg.color, size: cfg.size, map: moteTexture(), transparent: true,
    opacity: 0.9, depthWrite: false, sizeAttenuation: true,
    blending: cfg.blend === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = 'VX_motes';
  pts.frustumCulled = false;
  pts.userData.base = pos.slice();
  pts.userData.phase = phase;
  pts.userData.scale = scale;
  pts.userData.cfg = cfg;
  parent.add(pts);
  moteSystems.push(pts);
  return pts;
}


export function worldArt(id) { return WORLD_ART[id] || null; }

// Construye el escenario y devuelve el grupo. `platforms` y `colliders` son los
// arrays del juego: se rellenan aquí para que la colisión siga siendo barata.
export function buildWorld(id, parent, rnd, platforms, colliders) {
  const b = new WorldBuilder(hash(id));
  const fn = BUILDERS[id] || BUILDERS.rooftop;
  fn(b);
  // Paisaje envolvente: los dos primeros mundos lo construyen a mano, el resto
  // lo recibe de aquí para no acabar en una plataforma flotando en el vacío.
  if (SURROUND[id]) surround(b, worldArt(id) || {}, SURROUND[id]);
  // Detalle de suelo para todos los mundos por igual.
  const [dc, dd] = DETAIL[id] || DETAIL.rooftop;
  b.dressGround(dc, dd);
  b.renderTerrain();
  const g = new THREE.Group();
  g.name = 'World';
  b.flush(g);
  // Cúpula de cielo con nubes: es lo que impide que el horizonte sea una raya
  // de color y lo que da la sensación de estar dentro de un paisaje.
  const art = worldArt(id) || {};
  g.add(buildSky(art));
  parent.add(g);
  if (platforms) {
    // Suelo de agua: se puede vadear en vez de caer al vacío. Va primero para
    // que cualquier meseta o puente mande sobre él en groundAt().
    platforms.push({ x: 0, z: 0, hw: ARENA, hd: ARENA, top: b.waterFloor, noWall: true });
    for (const p of b.platforms) platforms.push(p);
  }
  if (colliders) for (const c of b.colliders) colliders.push(c);
  // Partículas del mundo.
  moteSystems.length = 0;
  const mc = MOTE_ART[id] || MOTE_ART.rooftop;
  buildMotes(g, mc);
  // Materiales de agua para animar el brillo y el oleaje.
  waterMats.length = 0;
  fallMats.length = 0;
  g.traverse(o => {
    if (!o.material) return;
    if (o.name === 'VX_water') waterMats.push(o.material);
    if (o.name === 'VX_fall') fallMats.push(o.material);
  });
  return g;
}

// Brillo del agua: una oscilación lenta evita que las cascadas parezcan congeladas.
export function updateWorld(t) {
  for (const m of waterMats) {
    const g = m.userData.glow ?? 0.34;
    m.emissiveIntensity = g * (1 + Math.sin(t * 2.1) * 0.22);
    // La lámina corre: la textura de ondas se desplaza despacio.
    if (m.map && m.map.offset) m.map.offset.set(t * 0.012, t * 0.020);
  }
  // Las cascadas caen: la veta vertical se desplaza hacia abajo.
  for (const m of fallMats) {
    const g = m.userData.glow ?? 0.55;
    m.emissiveIntensity = g * (1 + Math.sin(t * 3.4) * 0.16);
    if (m.map && m.map.offset) m.map.offset.y = -t * 0.85;
  }
  // Motas: suben despacio, se mecen y vuelven a empezar.
  for (const p of moteSystems) {
    const arr = p.geometry.attributes.position.array;
    const base = p.userData.base, ph = p.userData.phase, cfg = p.userData.cfg;
    const n = ph.length;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      const rise = (t * cfg.drift + ph[i] * 4.2) % cfg.height;
      arr[k] = base[k] + Math.sin(t * 0.5 + ph[i]) * 2.6;
      arr[k + 1] = rise < 0 ? rise + cfg.height : rise;
      arr[k + 2] = base[k + 2] + Math.cos(t * 0.42 + ph[i] * 1.7) * 2.6;
    }
    p.geometry.attributes.position.needsUpdate = true;
  }
}
