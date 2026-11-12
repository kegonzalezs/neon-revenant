// NEON//REVENANT — Registro de los 7 mundos Kenney.
// ---------------------------------------------------------------------------
// Fuente de verdad de la arquitectura modular. SUSTITUYE a los 12 escenarios
// voxel: LEVELS sigue siendo la lista de sectores jugables (dificultad, botin,
// objetivos) pero cada sector se resuelve a uno de estos 7 mundos mediante
// LEVEL_TO_WORLD. Mientras los mundos 3-7 no esten construidos, el gestor
// delega en el builder voxel antiguo como fallback TEMPORAL de la fase de QC.
//
// Todas las paletas pasan por comfortArt() antes de llegar al renderer: aqui
// solo se describe la intencion artistica por bioma (tonos pastel, mate).
// ---------------------------------------------------------------------------

export const UNIT = 2.6;          // 1 bloque Kenney = 2.6 unidades de juego
export const ARENA = 46;          // limite jugable ±46 (coincide con voxel.js)

export const WORLD_DEFS = {
  world1_nature: {
    id: 'world1_nature', index: 1, dir: 'world1_nature', kit: 'nature-kit',
    name: 'VALLE TURQUESA', subtitle: 'PRADERA / BOSQUE',
    implemented: true, builder: 'world1-nature.js',
    // Cielo azul pastel cálido #9ad4f5 (peticion) y océano turquesa alrededor.
    art: {
      sky: 0x9ad4f5, skyTop: 0x6fbce8, fog: 0xaadcee, fogDensity: 0.0045,
      hemiSky: 0xe8f3ee, hemiGround: 0x8fae83, hemiInt: 1.18,
      ambient: 0.38, ambientColor: 0xfff2dc,
      sun: 0xffeed2, sunInt: 1.42, sunPos: [34, 52, 28],
      fillA: 0xffe6c4, fillB: 0xbfe4ec, fillInt: 6.5,
      bloom: 0.10, exposure: 0.96, rain: 0,
      floor: 0x4d8c3a, platform: 0x3f6b31, trim: 0xa8d86a, trim2: 0xffd45e
    }
  },
  world2_snow: {
    id: 'world2_snow', index: 2, dir: 'world2_snow', kit: 'platformer-kit (snow)',
    name: 'TUNDRA NEVADA', subtitle: 'HIELO / PLATAFORMAS',
    implemented: true, builder: 'world2-snow.js',
    // La nieve NUNCA es 0xffffff: blanco hueso ligeramente azulado y mate.
    // Cielo invernal suave #8fb8de con mar helado y neblina fría alrededor.
    art: {
      sky: 0x8fb8de, skyTop: 0x6fa0cf, fog: 0x9cc2e0, fogDensity: 0.0042,
      hemiSky: 0xeaf2f6, hemiGround: 0xb4c2cc, hemiInt: 1.24,
      ambient: 0.46, ambientColor: 0xeaf4ff,
      sun: 0xf2f6fa, sunInt: 1.16, sunPos: [-28, 46, 22],
      fillA: 0xd9ecf7, fillB: 0xffe9d6, fillInt: 5.2,
      bloom: 0.08, exposure: 0.90, rain: 0,
      floor: 0xe7ecee, platform: 0xd6dfe4, trim: 0xa9d8e8, trim2: 0xf3d3ad
    }
  },
  world3_shop: {
    id: 'world3_shop', index: 3, dir: 'world3_shop', kit: 'mini-shop',
    name: 'MINIMERCADO', subtitle: 'INTERIOR GIGANTE',
    implemented: true, builder: 'world3-shop.js',
    // Interior cálido/neutro: nunca blanco puro. La niebla hace de aire del
    // local y el builder añade techo y paredes perimetrales lejanas.
    art: {
      sky: 0xb9a68c, skyTop: 0x8f7f68, fog: 0xc2b09a, fogDensity: 0.0056,
      hemiSky: 0xfff4e2, hemiGround: 0xb9a893, hemiInt: 1.22,
      ambient: 0.44, ambientColor: 0xfff0d8,
      sun: 0xffeed8, sunInt: 1.20, sunPos: [24, 48, 30],
      fillA: 0xffe8cc, fillB: 0xd8ecf0, fillInt: 6.0,
      bloom: 0.09, exposure: 0.94, rain: 0,
      floor: 0xb9b4ac, platform: 0xa39a8a, trim: 0xf2c46a, trim2: 0x86c9b0
    }
  },
  world4_suburban: {
    id: 'world4_suburban', index: 4, dir: 'world4_suburban', kit: 'city-kit-suburban',
    name: 'BARRIO RESIDENCIAL', subtitle: 'CALLES / JARDINES',
    implemented: true, builder: 'world4-suburban.js',
    // Día suave con horizonte verde-urbano; el asfalto es malla procedural
    // mate porque city-kit-suburban no trae piezas de carretera.
    art: {
      sky: 0xa5d0ec, skyTop: 0x7fb4dd, fog: 0xbcd8e6, fogDensity: 0.0046,
      hemiSky: 0xeef4ee, hemiGround: 0x9aa88f, hemiInt: 1.20,
      ambient: 0.40, ambientColor: 0xffefd8,
      sun: 0xffeed0, sunInt: 1.38, sunPos: [30, 50, 24],
      fillA: 0xffe4c0, fillB: 0xc4e2ec, fillInt: 6.2,
      bloom: 0.09, exposure: 0.95, rain: 0,
      floor: 0x8ba07e, platform: 0x74886c, trim: 0xa8d86a, trim2: 0xe8b870
    }
  },
  world5_station: {
    id: 'world5_station', index: 5, dir: 'world5_station', kit: 'space-station-kit',
    name: 'ESTACIÓN ORBITAL', subtitle: 'INTERIOR INDUSTRIAL',
    implemented: true, builder: 'world5-station.js',
    // Espacio profundo #0b1021: pastel DESACTIVADO para respetar el hex
    // exacto; el builder añade estrellas procedurales.
    art: {
      pastel: false,
      sky: 0x0b1021, skyTop: 0x0b1021, fog: 0x101830, fogDensity: 0.0028,
      hemiSky: 0xcfd8e4, hemiGround: 0x3a4250, hemiInt: 1.05,
      ambient: 0.36, ambientColor: 0xd8e4f2,
      sun: 0xf0f4f2, sunInt: 1.30, sunPos: [-26, 44, 26],
      fillA: 0xd8e8f2, fillB: 0xf6dcc0, fillInt: 6.4,
      bloom: 0.11, exposure: 0.93, rain: 0,
      floor: 0x8c9498, platform: 0x6f7a80, trim: 0xe0a05a, trim2: 0x8fc4d4
    }
  },
  world6_space: {
    id: 'world6_space', index: 6, dir: 'world6_space', kit: 'space-kit',
    name: 'COLONIA MARTE', subtitle: 'SUPERFICIE ROJA',
    implemented: true, builder: 'world6-space.js',
    // Cielo marciano polvoriento #c96a4b exacto (pastel desactivado).
    art: {
      pastel: false,
      sky: 0xc96a4b, skyTop: 0xa85540, fog: 0xd08a68, fogDensity: 0.0046,
      hemiSky: 0xfae6d2, hemiGround: 0xa8785f, hemiInt: 1.16,
      ambient: 0.40, ambientColor: 0xffe6cc,
      sun: 0xffeeda, sunInt: 1.34, sunPos: [32, 46, -26],
      fillA: 0xffdcc0, fillB: 0xc8d8ee, fillInt: 5.8,
      bloom: 0.10, exposure: 0.92, rain: 0,
      floor: 0xc08058, platform: 0x9c6848, trim: 0xe8a86a, trim2: 0x8fc4d4
    }
  },
  world7_hexagon: {
    id: 'world7_hexagon', index: 7, dir: 'world7_hexagon', kit: 'hexagon-kit',
    name: 'REINO HEXAGONAL', subtitle: 'ISLA / CASTILLOS',
    implemented: true, builder: 'world7-hexagon.js',
    // Cielo azul despejado sobre océano estilizado que rodea la isla.
    art: {
      sky: 0x87c7ea, skyTop: 0x5fa8d8, fog: 0xa5d4e8, fogDensity: 0.0040,
      hemiSky: 0xf0f6ea, hemiGround: 0x9aab88, hemiInt: 1.20,
      ambient: 0.40, ambientColor: 0xfff2dc,
      sun: 0xfff0d4, sunInt: 1.36, sunPos: [28, 50, 26],
      fillA: 0xffe8c8, fillB: 0xc8e6e2, fillInt: 6.0,
      bloom: 0.09, exposure: 0.95, rain: 0,
      floor: 0x7fae62, platform: 0x668f50, trim: 0xe8c87a, trim2: 0x8fc9d8
    }
  }
};

export const WORLD_IDS = Object.keys(WORLD_DEFS);

// Los 12 sectores de content.js se reparten entre los 7 mundos. Cuando los
// mundos 3-7 esten listos este mapa sera la unica relacion sector -> escenario.
export const LEVEL_TO_WORLD = {
  rooftop: 'world1_nature', hive: 'world1_nature', greenhouse: 'world1_nature',
  scrapyard: 'world2_snow', nullspace: 'world2_snow',
  docks: 'world3_shop', undercity: 'world3_shop',
  foundry: 'world4_suburban', spire: 'world4_suburban',
  refinery: 'world5_station', terminus: 'world6_space',
  cathedral: 'world7_hexagon'
};

export function worldIdForLevel(levelId) {
  return LEVEL_TO_WORLD[levelId] || 'world1_nature';
}

// ---------------------------------------------------------------------------
// Techo de confort visual. Se aplica a CUALQUIER paleta (nueva o legacy) para
// que ningun escenario pueda volver a quemar blancos o dejar sombras negras:
//  · bloom <= 0.22 y umbral del pasaporte alto (solo proyectiles/laseres)
//  · exposicion 0.88..1.00 con ACESFilmic
//  · sol <= 1.6, hemisfera <= 1.35, rellenos <= 8
//  · ambiente >= 0.30 => las sombras nunca son negro puro
//  · colores de luz pastelizados (nunca blanco puro al 100%)
// ---------------------------------------------------------------------------
export const COMFORT = {
  maxBloom: 0.22, minExposure: 0.88, maxExposure: 1.0,
  maxHemi: 1.35, maxSun: 1.6, maxFill: 8, minAmbient: 0.30,
  bloomThreshold: 0.92, bloomRadius: 0.32,
  grade: { sat: 1.02, contrast: 0.965, lift: 0.035, vig: 0.10 }
};

const _c = (hex) => [
  (hex >> 16) & 255, (hex >> 8) & 255, hex & 255
];
// Mezcla con un gris calido: quita el blanco puro sin cambiar el tono del bioma.
export function pastelize(hex, amount = 0.22) {
  const [r, g, b] = _c(hex);
  const soft = (v) => Math.round(v * (1 - amount) + 226 * amount);
  return (soft(r) << 16) | (soft(g) << 8) | soft(b);
}

export function comfortArt(raw = {}) {
  const a = { ...raw };
  a.bloom = Math.min(COMFORT.maxBloom, Math.max(0, a.bloom ?? 0.12));
  a.exposure = Math.min(COMFORT.maxExposure, Math.max(COMFORT.minExposure, a.exposure ?? 0.95));
  a.hemiInt = Math.min(COMFORT.maxHemi, a.hemiInt ?? 1.15);
  a.sunInt = Math.min(COMFORT.maxSun, a.sunInt ?? 1.35);
  a.fillInt = Math.min(COMFORT.maxFill, a.fillInt ?? 6);
  a.ambient = Math.max(COMFORT.minAmbient, a.ambient ?? 0.30);
  // pastel:false (espacio profundo / Marte) respeta los hex exactos del bioma:
  // aclarar el #0b1021 del espacio destrozaria la lectura de estrellas.
  if (a.pastel !== false) {
    for (const k of ['sky', 'skyTop', 'fog', 'hemiSky', 'hemiGround', 'sun', 'fillA', 'fillB', 'ambientColor']) {
      if (a[k] != null) a[k] = pastelize(a[k]);
    }
  }
  a.fogDensity = Math.min(0.0062, a.fogDensity ?? 0.0054);
  return a;
}

export function artForLevel(levelId, legacy = {}) {
  const def = WORLD_DEFS[worldIdForLevel(levelId)];
  // Los mundos ya construidos imponen su paleta; los pendientes usan la
  // paleta voxel antigua pero SIEMPRE pasada por el techo de confort.
  const base = def?.implemented ? def.art : (legacy || {});
  return comfortArt({ ...(legacy || {}), ...base });
}
