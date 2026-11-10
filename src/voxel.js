// NEON//REVENANT — motor de escenarios voxel.
// ---------------------------------------------------------------------------
// Los 12 sectores dejan de ser arenas planas con neón y pasan a ser dioramas de
// bloques: terreno escalonado, acantilados, cascadas, puentes, arcos, setas y
// castillos. Todo se dibuja con cubos de 1 unidad agrupados en InstancedMesh
// (una llamada de dibujo por familia de material), así que el coste es bajo
// aunque el escenario tenga decenas de miles de bloques.
//
// Reglas del sistema:
//   · La rejilla de altura es de 1 unidad por columna (92 × 92 columnas).
//   · Cada columna dibuja su bloque superior (hierba, arena, piedra...) y solo
//     los bloques laterales que quedan a la vista: los interiores no existen.
//   · `slab()` registra además la plataforma de juego, de modo que la colisión
//     sigue siendo barata (decenas de rectángulos, no miles de bloques).
//   · Los peldaños llevan `noWall` para que se puedan subir andando.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

export const ARENA = 46;
const N = ARENA * 2;
const WATER_BED = -4;

// ------------------------------------------------------------------ azar
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

// Variación de tono por bloque: es lo que hace que una pared parezca de bloques.
function jit(hex, rnd, amount = 0.06) {
  _c.setHex(hex);
  const k = 1 + (rnd() - 0.5) * amount * 2;
  _c.multiplyScalar(k);
  return _c.getHex();
}

// ------------------------------------------------------------ ruido de manchas
// La referencia no tiene un verde plano: tiene manchas claras y oscuras que
// pintan el prado. Un ruido de valor de baja frecuencia sobre la rejilla da
// exactamente eso sin coste por bloque.
function hash2(x, z) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z, s) {
  const fx = x / s, fz = z / s;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx - ix, tz = fz - iz;
  const u = tx * tx * (3 - 2 * tx), v = tz * tz * (3 - 2 * tz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
// Factor de brillo para una columna: mancha grande + moteado fino + azar.
function patchTone(x, z, big = 7, fine = 2.2, amp = 0.17) {
  const a = vnoise(x, z, big) - 0.5;
  const b = vnoise(x + 137, z + 71, fine) - 0.5;
  return 1 + a * amp * 2 + b * 0.12;
}

// Multiplica un color por un factor. Se hace en espacio lineal (que es donde
// trabaja THREE.Color), así que el degradado se ve como lo vería la luz.
function shadeHex(hex, k) {
  _c.setHex(hex);
  _c.multiplyScalar(k);
  return _c.getHex();
}

// Tinte por canal: en la referencia dos bloques vecinos no solo cambian de
// brillo, cambian de tono (uno tira a amarillo, el de al lado a verde azulado).
function tintHex(hex, kr, kg, kb) {
  _c.setHex(hex);
  _c.setRGB(_c.r * kr, _c.g * kg, _c.b * kb);
  return _c.getHex();
}

// Mezcla lineal entre dos colores. Sirve para el musgo: en la referencia no
// sustituye a la piedra, la tiñe a medias y deja ver el sillar debajo.
function mixHex(a, b, t) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  ca.lerp(cb, Math.max(0, Math.min(1, t)));
  return ca.getHex();
}

// --------------------------------------------------------------- materiales
// Cada familia tiene su propia cara. Es la diferencia entre "un cubo de color"
// y "un bloque de sillería": la referencia no tiene cuadros planos, tiene
// piedras pequeñas, tablones, césped erizado y hojas amontonadas dentro de cada
// bloque. Todo se genera en un canvas de 64 px, así que no hay que cargar nada.
const TEX = new Map();

function noiseOver(g, S, n, dark, light) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * dark;
    g.fillStyle = `rgba(0,0,0,${a})`;
    g.fillRect(Math.random() * S | 0, Math.random() * S | 0, 2, 2);
  }
  for (let i = 0; i < n * 0.35; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * light})`;
    g.fillRect(Math.random() * S | 0, Math.random() * S | 0, 2, 2);
  }
}

// Sillería: tres hiladas de sillares irregulares, con juntas hundidas, grietas
// y vetas. La versión anterior era una rejilla 3×3 perfecta y por eso el
// acantilado se leía como un damero; ahora cada piedra tiene su ancho, su tono
// y su grieta, que es lo que hace que la pared parezca roca.
function stoneFace() {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#fbfbfd';
  g.fillRect(0, 0, S, S);

  const rows = 3;
  const rh = S / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    // Anchos irregulares: se reparte la hilada en piedras de 26..58 px.
    const cuts = [0];
    let x = 0;
    while (x < S - 8) {
      x += 26 + Math.random() * 34;
      if (x > S - 22) break;
      cuts.push(x);
    }
    cuts.push(S);
    for (let i = 0; i < cuts.length - 1; i++) {
      const x0 = cuts[i] + 1.6, x1 = cuts[i + 1] - 1.6;
      const y0 = y + 1.6, y1 = y + rh - 1.6;
      const k = 0.78 + Math.random() * 0.34;
      const bl = 1 + (Math.random() - 0.5) * 0.05;
      g.fillStyle = `rgb(${(255 * k * bl) | 0},${(255 * k) | 0},${(255 * k * (2 - bl)) | 0})`;
      // Piedra con esquinas comidas: un rectángulo con las puntas cortadas.
      const c = 2 + Math.random() * 3;
      g.beginPath();
      g.moveTo(x0 + c, y0); g.lineTo(x1 - c, y0);
      g.lineTo(x1, y0 + c); g.lineTo(x1, y1 - c);
      g.lineTo(x1 - c, y1); g.lineTo(x0 + c, y1);
      g.lineTo(x0, y1 - c); g.lineTo(x0, y0 + c);
      g.closePath(); g.fill();
      // Bisel: luz arriba, sombra abajo. Da volumen a cada sillar.
      g.fillStyle = 'rgba(255,255,255,0.20)';
      g.fillRect(x0 + c, y0, x1 - x0 - c * 2, 1.6);
      g.fillStyle = 'rgba(0,0,0,0.20)';
      g.fillRect(x0 + c, y1 - 2, x1 - x0 - c * 2, 2);
      // Grieta vertical: no en todas, pero en muchas.
      if (Math.random() < 0.55) {
        g.strokeStyle = `rgba(0,0,0,${0.10 + Math.random() * 0.12})`;
        g.lineWidth = 1;
        g.beginPath();
        let cx = x0 + 6 + Math.random() * (x1 - x0 - 12), cy = y0 + 2;
        g.moveTo(cx, cy);
        while (cy < y1 - 2) {
          cy += 5 + Math.random() * 7;
          cx += (Math.random() - 0.5) * 5;
          g.lineTo(cx, Math.min(cy, y1 - 2));
        }
        g.stroke();
      }
      // Mota de musgo/óxido: manchitas que rompen el gris uniforme.
      for (let m = 0; m < 3; m++) {
        g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.07})`;
        g.beginPath();
        g.arc(x0 + Math.random() * (x1 - x0), y0 + Math.random() * (y1 - y0),
          2 + Math.random() * 5, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Junta horizontal: hundida y oscura.
    g.fillStyle = 'rgba(0,0,0,0.30)';
    g.fillRect(0, y + rh - 1.4, S, 1.4);
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fillRect(0, y + rh + 0.2, S, 1);
  }
  noiseOver(g, S, 3200, 0.11, 0.10);
  return cv;
}

// Tablones: cuatro duelas verticales con veta y clavos.
function woodFace() {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const planks = 4;
  const pw = S / planks;
  for (let i = 0; i < planks; i++) {
    const k = 0.84 + Math.random() * 0.24;
    g.fillStyle = `rgb(${(255 * k) | 0},${(232 * k) | 0},${(198 * k) | 0})`;
    g.fillRect(i * pw, 0, pw, S);
    // Veta.
    for (let j = 0; j < 5; j++) {
      g.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.09})`;
      g.lineWidth = 1;
      g.beginPath();
      const x = i * pw + 3 + Math.random() * (pw - 6);
      g.moveTo(x, 0);
      g.bezierCurveTo(x + 2, S * 0.33, x - 2, S * 0.66, x + 1, S);
      g.stroke();
    }
    // Separación entre duelas.
    g.fillStyle = 'rgba(0,0,0,0.20)';
    g.fillRect(i * pw, 0, 1.5, S);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(i * pw + 1.5, 0, 1, S);
  }
  // Clavos.
  for (let i = 0; i < planks; i++) {
    for (const y of [7, S - 9]) {
      g.fillStyle = 'rgba(40,30,20,0.55)';
      g.fillRect(i * pw + pw / 2 - 1, y, 2.5, 2.5);
    }
  }
  noiseOver(g, S, 900, 0.10, 0.07);
  g.strokeStyle = 'rgba(0,0,0,0.30)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, S - 2, S - 2);
  return cv;
}

// Césped: manchas suaves, briznas y tréboles. El detalle tiene que estar a la
// escala del bloque (manchas de 20-40 px), no en motas de 2 px: al alejarse la
// cámara el moteado fino se pierde en el filtrado y el suelo queda liso.
function grassFace() {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#f4f7f2';
  g.fillRect(0, 0, S, S);

  // Manchas grandes: el prado de la referencia tiene calvas claras y zonas
  // hondas. Se equilibran (mismas claras que oscuras) para no cambiar el tono.
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 14 + Math.random() * 30;
    const dark = Math.random() < 0.5;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, dark ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.20)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  // Briznas: trazos cortos y curvados, medio oscuros y medio claros.
  for (let i = 0; i < 340; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const len = 4 + Math.random() * 9;
    const lean = (Math.random() - 0.5) * 5;
    g.strokeStyle = Math.random() < 0.5
      ? `rgba(0,0,0,${0.10 + Math.random() * 0.14})`
      : `rgba(255,255,255,${0.16 + Math.random() * 0.18})`;
    g.lineWidth = 1 + Math.random() * 0.9;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + lean * 0.5, y - len * 0.6, x + lean, y - len);
    g.stroke();
  }

  // Tréboles y florecillas mínimas incrustadas en el césped.
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.16)';
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.arc(x + (Math.random() - 0.5) * 5, y + (Math.random() - 0.5) * 5, 1.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  noiseOver(g, S, 1500, 0.07, 0.07);
  return cv;
}

// Follaje: bolas de hoja amontonadas, con huecos oscuros. Sin marco: el borde
// negro de cada cara dibujaba una rejilla sobre la copa y la copa dejaba de ser
// una masa de hojas para ser un montón de cajas.
function leafFace() {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#f6f8f4';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 120; i++) {
    const r = 5 + Math.random() * 16;
    const k = 0.80 + Math.random() * 0.34;
    g.fillStyle = `rgba(${(255 * k) | 0},${(255 * k) | 0},${(255 * k) | 0},0.80)`;
    g.beginPath();
    g.arc(Math.random() * S, Math.random() * S, r, 0, Math.PI * 2);
    g.fill();
  }
  // Hojas sueltas: hojitas de 3-6 px que dan la silueta deshilachada.
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.20)' : 'rgba(255,255,255,0.30)';
    g.save();
    g.translate(x, y);
    g.rotate(Math.random() * Math.PI);
    g.fillRect(-2.4, -1.2, 4.8, 2.4);
    g.restore();
  }
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.20})`;
    g.fillRect(Math.random() * S | 0, Math.random() * S | 0, 2, 2);
  }
  return cv;
}

// Cortina de agua: vetas verticales alargadas, espuma y algún destello. Con
// esto la cascada deja de ser una barra de color y se lee como agua cayendo.
function fallFace() {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#eaf6ff';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * S, w = 1 + Math.random() * 5;
    const a = 0.05 + Math.random() * 0.30;
    const light = Math.random() < 0.55;
    const grad = g.createLinearGradient(0, 0, 0, S);
    const col = light ? `255,255,255` : `40,120,170`;
    grad.addColorStop(0, `rgba(${col},${a * 0.35})`);
    grad.addColorStop(0.35, `rgba(${col},${a})`);
    grad.addColorStop(0.8, `rgba(${col},${a * 0.8})`);
    grad.addColorStop(1, `rgba(${col},${a * 0.3})`);
    g.fillStyle = grad;
    g.fillRect(x, 0, w, S);
  }
  // Burbujas y espuma.
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.5})`;
    g.beginPath();
    g.arc(Math.random() * S, Math.random() * S, 0.8 + Math.random() * 2.2, 0, Math.PI * 2);
    g.fill();
  }
  return cv;
}

// Lámina de agua: ondas concéntricas suaves. Se repite y se desplaza en
// updateWorld, así el río corre en vez de quedarse quieto como una losa.
function waterFace() {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#e8f4ff';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const r = 6 + Math.random() * 26;
    const light = Math.random() < 0.6;
    g.strokeStyle = light
      ? `rgba(255,255,255,${0.26 + Math.random() * 0.44})`
      : `rgba(20,90,140,${0.12 + Math.random() * 0.22})`;
    g.lineWidth = 1 + Math.random() * 2.4;
    g.beginPath();
    g.ellipse(x, y, r, r * (0.35 + Math.random() * 0.3), Math.random() * 0.4, 0, Math.PI * 2);
    g.stroke();
  }
  return cv;
}

// Metal: paneles remachados.
function metalFace() {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#f2f4f8';
  g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, S / 2 - 1, S, 2);
  g.fillRect(S / 2 - 1, 0, 2, S);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(0, S / 2 + 1, S, 1);
  for (const [x, y] of [[6, 6], [S - 10, 6], [6, S - 10], [S - 10, S - 10], [S / 2 + 6, 6]]) {
    g.fillStyle = 'rgba(0,0,0,0.34)';
    g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.30)';
    g.beginPath(); g.arc(x - 0.8, y - 0.8, 1.2, 0, Math.PI * 2); g.fill();
  }
  noiseOver(g, S, 700, 0.10, 0.12);
  g.strokeStyle = 'rgba(0,0,0,0.34)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, S - 2, S - 2);
  return cv;
}

const FACE = {
  ground: grassFace, stone: stoneFace, wood: woodFace,
  leaf: leafFace, metal: metalFace, fall: fallFace, water: waterFace
};

function blockFace(kind = 'stone') {
  let t = TEX.get(kind);
  if (t) return t;
  const fn = FACE[kind] || stoneFace;
  t = new THREE.CanvasTexture(fn());
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  TEX.set(kind, t);
  return t;
}

const MATERIALS = {
  // Matas: hierba, tierra, arena, nieve. Muy mate.
  ground: () => new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.98, metalness: 0,
    map: blockFace('ground'), bumpMap: blockFace('ground'), bumpScale: 0.35
  }),
  // Piedra y roca: sillería con relieve real (bumpMap de la misma textura).
  stone: () => new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.92, metalness: 0,
    map: blockFace('stone'), bumpMap: blockFace('stone'), bumpScale: 0.9
  }),
  // Madera y tablones: duelas con veta y clavos.
  wood: () => new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.88, metalness: 0,
    map: blockFace('wood'), bumpMap: blockFace('wood'), bumpScale: 0.7
  }),
  // Hojas y setas: un punto de translucidez para que la luz las atraviese.
  leaf: () => new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.95, metalness: 0,
    map: blockFace('leaf'), bumpMap: blockFace('leaf'), bumpScale: 0.55
  }),
  // Cristal, hielo, agua sólida.
  glass: () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.18, metalness: 0.1, transparent: true, opacity: 0.82 }),
  // Metal: fábrica, naves, vías.
  metal: () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.45, map: blockFace('metal'), bumpMap: blockFace('metal'), bumpScale: 0.4 }),
  // Emisivo puro: neón, lava, setas luminosas, cristales. Sin luz, color plano.
  glow: () => new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true }),
  // Agua: transparente y algo emisiva para que el fondo se lea.
  water: () => new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.10, metalness: 0.20, transparent: true, opacity: 0.88,
    depthWrite: false, emissive: 0x0a3b46, emissiveIntensity: 0.6,
    map: blockFace('water'), bumpMap: blockFace('water'), bumpScale: 0.25
  }),
  // Cascadas: agua en movimiento. Con `glow` se leían como paneles de neón
  // porque no reciben luz; con un estándar emisivo tienen volumen.
  fall: () => new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.10, metalness: 0.05, transparent: true,
    opacity: 0.95, emissive: 0x2a9cc0, emissiveIntensity: 0.55, depthWrite: false,
    map: blockFace('fall'), bumpMap: blockFace('fall'), bumpScale: 0.3
  }),
  // Nubes: sin sombreado, siempre claras. Sí reciben niebla: sin ella, a
  // distancia se recortaban como rectángulos de papel sobre el cielo.
  cloud: () => new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true, fog: true, transparent: true, opacity: 0.72, depthWrite: false }),
  // Follaje denso de fondo (bosque): mate y oscuro.
  dark: () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: blockFace('leaf'), bumpMap: blockFace('leaf'), bumpScale: 0.5 }),
};

class Batch {
  constructor(name) {
    this.name = name;
    this.items = [];   // { x,y,z,w,h,d,ry,c }
  }
  push(x, y, z, w, h, d, c, ry) {
    this.items.push({ x, y, z, w, h, d, c, ry: ry || 0 });
  }
  build() {
    const n = this.items.length;
    if (!n) return null;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = MATERIALS[this.name]();
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.name = 'VX_' + this.name;
    const arr = mesh.instanceColor || new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    for (let i = 0; i < n; i++) {
      const it = this.items[i];
      _v.set(it.x, it.y, it.z);
      _s.set(it.w, it.h, it.d);
      if (it.ry) { _e.set(0, it.ry, 0); _q.setFromEuler(_e); } else _q.identity();
      _m.compose(_v, _q, _s);
      mesh.setMatrixAt(i, _m);
      _c.setHex(it.c);
      arr.setXYZ(i, _c.r, _c.g, _c.b);
    }
    mesh.instanceColor = arr;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    // El culling por esfera no sirve: la geometría es un cubo y las instancias
    // se reparten por toda la arena.
    mesh.frustumCulled = false;
    mesh.receiveShadow = this.name !== 'glow' && this.name !== 'cloud' && this.name !== 'water';
    mesh.castShadow = this.name !== 'glow' && this.name !== 'cloud' && this.name !== 'water';
    this.items.length = 0;
    return mesh;
  }
}

// ------------------------------------------------------------------ builder
export class WorldBuilder {
  constructor(seed = 1) {
    this.rnd = mulberry32(seed);
    this.batches = new Map();
    this.heights = new Int16Array(N * N).fill(0);
    this.topCol = new Int32Array(N * N).fill(-1);
    this.sideCol = new Int32Array(N * N).fill(-1);
    this.waterY = new Float32Array(N * N).fill(NaN);
    this.platforms = [];
    this.colliders = [];
    this.anim = [];
    this.group = null;
    // Altura a la que se puede caminar sobre el agua (vadear). Los mundos sin
    // suelo firme la bajan para que el vacío no quede a ras de suelo.
    this.waterFloor = -0.85;
    // Extensión de la lámina de agua. Los mundos con mar la estiran hasta el
    // horizonte; los que flotan en el vacío la dejan en el borde de la arena.
    this.waterExtent = ARENA * 2;
    this.waterCells = [];
    this.pendingMeshes = [];
    this.waterMesh = null;
    this.waterColor = 0x2fb6e0;
    // Cuánto brilla el agua por sí misma. El prado apenas; el bosque encantado
    // mucho, que es lo que le da el aire de bioluminiscencia.
    this.waterGlow = 0.34;
    // Halos aditivos (setas, cristales, antorchas). Se resuelven como sprites.
    this.halos = [];
  }

  batch(name) {
    let b = this.batches.get(name);
    if (!b) { b = new Batch(name); this.batches.set(name, b); }
    return b;
  }

  // Un bloque centrado en (x,y,z) con tamaño (w,h,d).
  blk(name, x, y, z, w, h, d, color, ry) { this.batch(name).push(x, y, z, w, h, d, color, ry); }

  // Bloque de rejilla: ocupa la columna entera y la altura [y, y+1].
  cell(name, cx, cz, y, color, w = 1, d = 1) {
    this.batch(name).push(cx + 0.5, y + 0.5, cz + 0.5, w, 1, d, color, 0);
  }

  idx(cx, cz) { return (cx + ARENA) * N + (cz + ARENA); }

  // ------------------------------------------------------------ terreno
  // Rellena una zona rectangular (en coordenadas de mundo) con una altura.
  slab(x, z, w, d, h, top, side, opts = {}) {
    const x0 = Math.round(x - w / 2), x1 = Math.round(x + w / 2);
    const z0 = Math.round(z - d / 2), z1 = Math.round(z + d / 2);
    for (let cx = x0; cx < x1; cx++) {
      for (let cz = z0; cz < z1; cz++) {
        if (cx < -ARENA || cx >= ARENA || cz < -ARENA || cz >= ARENA) continue;
        const i = this.idx(cx, cz);
        this.heights[i] = h;
        if (top != null) this.topCol[i] = top;
        if (side != null) this.sideCol[i] = side;
      }
    }
    if (h >= 0) {
      this.platforms.push({ x, z, hw: w / 2, hd: d / 2, top: h, noWall: !!opts.noWall });
    }
    return this;
  }

  // Cambia solo el color superior (caminos, placas, musgo).
  paint(x, z, w, d, color) {
    const x0 = Math.round(x - w / 2), x1 = Math.round(x + w / 2);
    const z0 = Math.round(z - d / 2), z1 = Math.round(z + d / 2);
    for (let cx = x0; cx < x1; cx++) {
      for (let cz = z0; cz < z1; cz++) {
        if (cx < -ARENA || cx >= ARENA || cz < -ARENA || cz >= ARENA) continue;
        this.topCol[this.idx(cx, cz)] = color;
      }
    }
    return this;
  }

  // Excava un canal y lo llena de agua hasta `y`. Además recorta las
  // plataformas que pisa: si no, se podría caminar por encima del barranco.
  channel(x, z, w, d, bed, y, bedColor) {
    this.slab(x, z, w, d, bed, bedColor, bedColor);
    const x0 = Math.round(x - w / 2), x1 = Math.round(x + w / 2);
    const z0 = Math.round(z - d / 2), z1 = Math.round(z + d / 2);
    for (let cx = x0; cx < x1; cx++) {
      for (let cz = z0; cz < z1; cz++) {
        if (cx < -ARENA || cx >= ARENA || cz < -ARENA || cz >= ARENA) continue;
        this.waterY[this.idx(cx, cz)] = y;
      }
    }
    this.cutPlatforms(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
    return this;
  }

  // Resta un rectángulo de las plataformas existentes (partición exacta).
  cutPlatforms(rx0, rz0, rx1, rz1) {
    const out = [];
    const mk = (cx, cz, hw, hd, p) => ({ x: cx, z: cz, hw, hd, top: p.top, noWall: p.noWall });
    for (const p of this.platforms) {
      const px0 = p.x - p.hw, px1 = p.x + p.hw, pz0 = p.z - p.hd, pz1 = p.z + p.hd;
      const ix0 = Math.max(px0, rx0), ix1 = Math.min(px1, rx1);
      const iz0 = Math.max(pz0, rz0), iz1 = Math.min(pz1, rz1);
      if (ix1 <= ix0 || iz1 <= iz0) { out.push(p); continue; }
      if (iz0 > pz0) out.push(mk(p.x, (pz0 + iz0) / 2, p.hw, (iz0 - pz0) / 2, p));
      if (iz1 < pz1) out.push(mk(p.x, (iz1 + pz1) / 2, p.hw, (pz1 - iz1) / 2, p));
      const zc = (iz0 + iz1) / 2, zh = (iz1 - iz0) / 2;
      if (ix0 > px0) out.push(mk((px0 + ix0) / 2, zc, (ix0 - px0) / 2, zh, p));
      if (ix1 < px1) out.push(mk((ix1 + px1) / 2, zc, (px1 - ix1) / 2, zh, p));
    }
    this.platforms = out;
  }

  // Dibuja el terreno a partir de la rejilla. Solo lo que se ve.
  // La diferencia entre un diorama plano y la referencia no es geometría, son
  // tres detalles baratos: manchas de tono sobre la hierba, un labio verde que
  // sobresale del cortado (y deja sombra debajo) y musgo/lianas en la piedra.
  renderTerrain(opts = {}) {
    const H = this.heights, T = this.topCol, S = this.sideCol, W = this.waterY;
    const rnd = this.rnd;
    const defTop = opts.top ?? 0x6cba33;
    const defSide = opts.side ?? 0x8a8f93;
    const mossy = opts.mossy !== false;
    const vines = opts.vines !== false;
    const lip = opts.lip !== false;
    // El musgo sale del propio suelo: así la misma rutina vale para el prado
    // verde, la nieve o la lava sin que haya que pasar una paleta a mano.
    const mossBase = opts.moss != null ? opts.moss : shadeHex(defTop, 0.72);
    const at = (cx, cz) => (cx < -ARENA || cx >= ARENA || cz < -ARENA || cz >= ARENA)
      ? -99 : H[this.idx(cx, cz)];
    for (let cx = -ARENA; cx < ARENA; cx++) {
      for (let cz = -ARENA; cz < ARENA; cz++) {
        const i = this.idx(cx, cz);
        const h = H[i];
        const wy = W[i];
        if (h > WATER_BED) {
          const rawTop = T[i] >= 0 ? T[i] : defTop;
          const side = S[i] >= 0 ? S[i] : defSide;
          const tone = patchTone(cx, cz, 9, 2.6, 0.20) * (0.86 + rnd() * 0.30);
          const hl = at(cx - 1, cz), hr = at(cx + 1, cz);
          const hd = at(cx, cz - 1), hu = at(cx, cz + 1);
          // Oclusión horneada: un bloque que tiene vecinos más altos vive en un
          // rincón y va más oscuro. Sin esto el prado es una alfombra plana; con
          // esto cada escalón y cada rincón tiene su sombra de contacto.
          const occ = (hl > h ? 1 : 0) + (hr > h ? 1 : 0) + (hd > h ? 1 : 0) + (hu > h ? 1 : 0);
          const hs = (rnd() - 0.5) * 0.10;
          const topC = tintHex(shadeHex(rawTop, tone * (1 - occ * 0.11)),
            1 + hs, 1 - hs * 0.35, 1 - hs * 0.8);
          const lo = Math.min(h - 1, hl, hr, hd, hu);
          // Bloque superior.
          this.blk('ground', cx + 0.5, h - 0.5, cz + 0.5, 1, 1, 1, topC);
          // Labio: la hierba se derrama sobre el cortado en lenguas irregulares.
          // Una banda recta de 0,30 se lee como una moldura; tres cajas de
          // profundidad y ancho aleatorios, superpuestas con las del bloque de
          // al lado, forman un borde deshilachado como el de la referencia.
          if (lip) {
            const drip = (dx, dz) => {
              const n = 2 + (rnd() < 0.45 ? 1 : 0);
              for (let i = 0; i < n; i++) {
                const out = 0.10 + rnd() * 0.42;
                const th = 0.26 + rnd() * 0.26;
                const sh = (rnd() - 0.5) * 0.62;
                const px = cx + 0.5 + dx * (0.5 + out / 2) + (dx ? 0 : sh);
                const pz = cz + 0.5 + dz * (0.5 + out / 2) + (dz ? 0 : sh);
                const w = dx ? 1 + out : 0.52 + rnd() * 0.48;
                const d = dz ? 1 + out : 0.52 + rnd() * 0.48;
                this.blk('ground', px, h - th * 0.5 + 0.03, pz, w, th, d,
                  shadeHex(rawTop, tone * (0.92 + rnd() * 0.18)));
              }
            };
            if (h > hl + 1) drip(-1, 0);
            if (h > hr + 1) drip(1, 0);
            if (h > hd + 1) drip(0, -1);
            if (h > hu + 1) drip(0, 1);
          }
          // Laterales visibles, con musgo pegado arriba.
          const span = Math.max(1, h - 1 - lo);
          for (let y = lo; y < h - 1; y++) {
            let c = side;
            if (mossy) {
              const depth = h - 2 - y;
              const p = depth === 0 ? 0.86 : depth <= 2 ? 0.42 : 0.12;
              // El musgo tiñe la piedra, no la sustituye: así se sigue viendo
              // el sillar debajo, que es lo que hace la referencia.
              if (rnd() < p) c = mixHex(c, mossBase, 0.42 + rnd() * 0.46);
            }
            // Perfil de oclusión del cortado: contacto oscuro justo bajo el
            // labio de hierba, primer tercio a plena luz y caída hacia el
            // fondo. Sin esto el acantilado es una pared de color plano.
            const t = (y - lo + 1) / span;
            let ao;
            if (t > 0.84) ao = 1.04 - ((t - 0.84) / 0.16) * 0.38;
            else ao = 0.70 + 0.34 * (1 - Math.pow(1 - t / 0.84, 2));
            this.cell('stone', cx, cz, y, jit(shadeHex(c, ao), rnd, 0.20));
          }
          // Lianas: tiras finas colgando de la piedra, solo en cortados altos.
          if (vines && h - lo >= 3) {
            const vc = shadeHex(mossBase, 0.66 + rnd() * 0.24);
            const hang = (px, pz, w, d) => {
              const drop = 2 + Math.floor(rnd() * 3);
              const y1 = h - 1;
              const y0 = Math.max(lo, y1 - drop);
              if (y1 - y0 < 2) return;
              this.blk('leaf', px, (y0 + y1) / 2, pz, w, y1 - y0, d, vc);
            };
            if (h > hl + 1 && rnd() < 0.10) hang(cx - 0.05, cz + 0.5, 0.10, 0.30 + rnd() * 0.34);
            if (h > hr + 1 && rnd() < 0.10) hang(cx + 1.05, cz + 0.5, 0.10, 0.30 + rnd() * 0.34);
            if (h > hd + 1 && rnd() < 0.10) hang(cx + 0.5, cz - 0.05, 0.30 + rnd() * 0.34, 0.10);
            if (h > hu + 1 && rnd() < 0.10) hang(cx + 0.5, cz + 1.05, 0.30 + rnd() * 0.34, 0.10);
          }
        }
        if (!Number.isNaN(wy) && h < wy) this.waterCells.push(cx, cz, wy, i);
      }
    }
    this.buildWater();
    return this;
  }

  // Lámina de agua: una geometría fusionada de quad por columna. Se dibuja solo
  // la cara superior, así que no hay costuras ni caras interiores.
  buildWater() {
    const c = this.waterCells;
    if (!c.length) return;
    const n = c.length / 4;
    const pos = new Float32Array(n * 12);
    const col = new Float32Array(n * 12);
    const uv = new Float32Array(n * 8);
    const idx = new Uint32Array(n * 6);
    const base = new THREE.Color(this.waterColor);
    const H = this.heights;
    const shore = (cx, cz, y) => {
      if (cx < -ARENA || cx >= ARENA || cz < -ARENA || cz >= ARENA) return false;
      return H[this.idx(cx, cz)] >= y;
    };
    for (let k = 0; k < n; k++) {
      const cx = c[k * 4], cz = c[k * 4 + 1], y = c[k * 4 + 2];
      const x0 = cx, x1 = cx + 1, z0 = cz, z1 = cz + 1;
      const o = k * 12;
      pos[o] = x0; pos[o + 1] = y; pos[o + 2] = z0;
      pos[o + 3] = x1; pos[o + 4] = y; pos[o + 5] = z0;
      pos[o + 6] = x1; pos[o + 7] = y; pos[o + 8] = z1;
      pos[o + 9] = x0; pos[o + 10] = y; pos[o + 11] = z1;
      // Orilla: la lámina se aclara contra la roca, como la espuma de la
      // referencia. Sin esto el agua queda como una plancha uniforme.
      const edge = shore(cx - 1, cz, y) || shore(cx + 1, cz, y)
        || shore(cx, cz - 1, y) || shore(cx, cz + 1, y);
      let k2 = 0.86 + this.rnd() * 0.10;
      if (edge) k2 = 1.38 + this.rnd() * 0.12;
      for (let v = 0; v < 4; v++) {
        col[o + v * 3] = Math.min(1, base.r * k2);
        col[o + v * 3 + 1] = Math.min(1, base.g * k2);
        col[o + v * 3 + 2] = Math.min(1, base.b * k2);
      }
      const b = k * 4;
      // UV a escala de mundo: la onda mide siempre lo mismo, no se estira con
      // el tamaño de la lámina.
      const U = 0.5;
      uv[b * 2] = x0 * U; uv[b * 2 + 1] = z0 * U;
      uv[b * 2 + 2] = x1 * U; uv[b * 2 + 3] = z0 * U;
      uv[b * 2 + 4] = x1 * U; uv[b * 2 + 5] = z1 * U;
      uv[b * 2 + 6] = x0 * U; uv[b * 2 + 7] = z1 * U;
      idx[k * 6] = b; idx[k * 6 + 1] = b + 2; idx[k * 6 + 2] = b + 1;
      idx[k * 6 + 3] = b; idx[k * 6 + 4] = b + 3; idx[k * 6 + 5] = b + 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, transparent: true, opacity: 0.9, roughness: 0.06,
      metalness: 0.42, depthWrite: false, side: THREE.DoubleSide,
      map: blockFace('water'), bumpMap: blockFace('water'), bumpScale: 0.45,
      emissive: 0x2a9cc0, emissiveIntensity: 0.34
    });
    mat.userData.glow = this.waterGlow ?? 0.34;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'VX_water';
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    this.waterMesh = mesh;
    this.pendingMeshes.push(mesh);
    this.waterCells.length = 0;
  }

  // ------------------------------------------------------- detalle de suelo
  // El prado de la referencia no es una alfombra: está erizado de matojos y
  // piedrecillas. Se siembran sobre la rejilla ya construida, así que respetan
  // escalones, agua y caminos.
  // Una mata de hierba en una celda concreta.
  tuftAt(cx, cz, color = 0x5cbb3c, hgt = 0.4, rnd = this.rnd) {
    const k = this.idx(cx, cz);
    const h = this.heights[k];
    if (h <= WATER_BED) return;
    const wy = this.waterY[k];
    if (!Number.isNaN(wy) && h < wy) return;
    const c = jit(color, rnd, 0.14);
    const c2 = shadeHex(color, 0.84);
    const sc = 0.75 + rnd() * 0.55;
    const px = cx + 0.2 + rnd() * 0.6, pz = cz + 0.2 + rnd() * 0.6;
    this.blk('leaf', px, h + hgt * sc * 0.5, pz, 0.30 * sc, hgt * sc, 0.10, c);
    this.blk('leaf', px, h + hgt * sc * 0.44, pz, 0.10, hgt * sc * 0.88, 0.30 * sc, c2);
    if (rnd() < 0.30) this.blk('leaf', px + 0.1, h + hgt * sc * 0.66, pz - 0.1, 0.11, hgt * sc * 1.3, 0.11, c);
  }

  // Pasada de detalle sobre TODO el terreno: matojos donde hay hierba y
  // guijarros sueltos. Se llama una vez por mundo y es lo que hace que el suelo
  // deje de ser una superficie lisa, sea cual sea el escenario.
  dressGround(leafColor = 0x4fa83c, density = 0.11, pebbleColor = 0x9aa0a8, pebbleDensity = 0.010) {
    const H = this.heights, T = this.topCol, W = this.waterY;
    const rnd = this.rnd;
    for (let cx = -ARENA; cx < ARENA; cx++) {
      for (let cz = -ARENA; cz < ARENA; cz++) {
        const k = this.idx(cx, cz);
        const h = H[k];
        if (h <= WATER_BED) continue;
        const wy = W[k];
        if (!Number.isNaN(wy) && h < wy) continue;
        const tc = T[k];
        if (tc < 0) continue;
        const r = (tc >> 16) & 255, g = (tc >> 8) & 255, b = tc & 255;
        // Solo superficies vegetales: la hierba es lo único con el verde
        // dominante. La piedra, la arena y el camino se quedan lisos.
        const soft = g > r * 1.06 && g > b * 1.15;
        if (soft && rnd() < density) this.tuftAt(cx, cz, leafColor, 0.30 + rnd() * 0.22, rnd);
        else if (rnd() < pebbleDensity) {
          const s = 0.16 + rnd() * 0.16;
          this.blk('stone', cx + 0.15 + rnd() * 0.7, h + s * 0.34, cz + 0.15 + rnd() * 0.7,
            s, s * 0.7, s * 0.86, jit(pebbleColor, rnd, 0.14), rnd() * 0.8);
        }
      }
    }
    return this;
  }

  tufts(x, z, wd, dp, n, color = 0x5cbb3c, hgt = 0.5, avoid = null, rnd = this.rnd) {
    const H = this.heights, T = this.topCol, W = this.waterY;
    for (let i = 0; i < n; i++) {
      const cx = Math.round(x + (rnd() - 0.5) * wd);
      const cz = Math.round(z + (rnd() - 0.5) * dp);
      if (cx < -ARENA || cx >= ARENA || cz < -ARENA || cz >= ARENA) continue;
      const k = this.idx(cx, cz);
      const h = H[k];
      if (h <= WATER_BED) continue;
      if (!Number.isNaN(W[k]) && h < W[k]) continue;
      if (avoid != null && T[k] === avoid) continue;
      const c = jit(color, rnd, 0.14);
      const c2 = shadeHex(color, 0.84);
      const s = 0.75 + rnd() * 0.55;
      const px = cx + 0.2 + rnd() * 0.6, pz = cz + 0.2 + rnd() * 0.6;
      // Tres briznas finas cruzadas: se lee como hierba, no como una seta.
      this.blk('leaf', px, h + hgt * s * 0.5, pz, 0.30 * s, hgt * s, 0.10, c);
      this.blk('leaf', px, h + hgt * s * 0.44, pz, 0.10, hgt * s * 0.88, 0.30 * s, c2);
      if (rnd() < 0.30) this.blk('leaf', px + 0.1, h + hgt * s * 0.66, pz - 0.1, 0.11, hgt * s * 1.3, 0.11, c);
    }
    return this;
  }

  // Guijarros: piedrecillas de medio bloque, casi planas.
  pebbles(x, z, wd, dp, n, color = 0x8a93a8, rnd = this.rnd) {
    const H = this.heights, W = this.waterY;
    for (let i = 0; i < n; i++) {
      const cx = Math.round(x + (rnd() - 0.5) * wd);
      const cz = Math.round(z + (rnd() - 0.5) * dp);
      if (cx < -ARENA || cx >= ARENA || cz < -ARENA || cz >= ARENA) continue;
      const k = this.idx(cx, cz);
      const h = H[k];
      if (h <= WATER_BED) continue;
      if (!Number.isNaN(W[k]) && h < W[k]) continue;
      const s = 0.28 + rnd() * 0.3;
      this.blk('stone', cx + 0.15 + rnd() * 0.7, h + s * 0.34, cz + 0.15 + rnd() * 0.7,
        s, s * 0.7, s * 0.86, jit(color, rnd, 0.14), rnd() * 0.8);
    }
    return this;
  }

  // ------------------------------------------------------------ piezas
  // Árbol de copa cúbica, el árbol base del mundo de praderas. Tronco corto y
  // grueso, copa ancha: en la referencia el árbol es casi todo hoja.
  tree(x, z, baseY, s = 1, trunk = 0x8a5a33, leaf = 0x4fae2e, rnd = this.rnd) {
    const th = Math.round(3 * s);
    const tw = Math.max(1, Math.round(1.15 * s));
    for (let i = 0; i < th; i++) {
      // Corteza: la mitad de los bloques del tronco van más oscuros, así no es
      // un palo de color plano.
      const bark = rnd() < 0.42 ? shadeHex(trunk, 0.74) : trunk;
      this.blk('wood', x, baseY + i + 0.5, z, tw, 1, tw, jit(bark, rnd, 0.07));
      if (tw > 1 && rnd() < 0.5) {
        this.blk('wood', x + (rnd() < 0.5 ? -0.5 : 0.5) * (tw - 1) * 0.5,
          baseY + i + 0.5, z + 0.5, 0.24, 1, tw * 0.7, shadeHex(trunk, 0.6));
      }
    }
    const r = Math.max(1, Math.round(2.0 * s));
    const cy = baseY + th - 0.4;
    // Copa redondeada en cinco pisos: ancha abajo, cerrada arriba. La cara
    // superior va aclarada, que es lo que da volumen al bloque.
    const top = new THREE.Color(leaf).lerp(new THREE.Color(0xffffff), 0.24).getHex();
    const under = shadeHex(leaf, 0.62);
    const prof = [r, r, r, Math.max(1, r - 1), Math.max(1, r - 2), Math.max(0, r - 3)];
    for (let iy = 0; iy < prof.length; iy++) {
      const rr = prof[iy];
      for (let ix = -rr; ix <= rr; ix++) {
        for (let iz = -rr; iz <= rr; iz++) {
          const d = Math.hypot(ix, iz);
          if (d > rr + 0.45) continue;
          if (iy === prof.length - 1 && d > rr - 0.2) continue;
          if (d > rr - 0.3 && rnd() < 0.22) continue;   // borde deshilachado
          // Tres tonos: undersombra oscura, cuerpo medio y cresta iluminada.
          const tone = iy === 0 ? under : iy >= prof.length - 2 ? top : leaf;
          this.blk('leaf', x + ix, cy + iy + 0.5, z + iz, 1, 1, 1, jit(tone, rnd, 0.11));
        }
      }
    }
    // Mechones que sobresalen de la copa: rompen la silueta redonda.
    for (let i = 0; i < r * 3; i++) {
      const a = rnd() * Math.PI * 2, rr = r + 0.5;
      const px = x + Math.round(Math.cos(a) * rr), pz = z + Math.round(Math.sin(a) * rr);
      this.blk('leaf', px, cy + 1 + Math.floor(rnd() * prof.length - 1) + 0.5, pz,
        0.8, 0.8, 0.8, jit(rnd() < 0.5 ? top : leaf, rnd, 0.12));
    }
    this.colliders.push({ x, z, hw: tw / 2, hd: tw / 2, h: baseY + th, r: tw, cos: 1, sin: 0 });
  }

  // Árbol gigante del bosque encantado: tronco grueso y copa enorme.
  bigTree(x, z, baseY, s = 1, trunk = 0x3a2a22, leaf = 0x1d6b3c, rnd = this.rnd) {
    const th = Math.round(8 * s);
    const tw = Math.max(2, Math.round(3.2 * s));
    for (let i = 0; i < th; i++) {
      const shrink = i > th - 4 ? 1 : 0;
      this.blk('wood', x, baseY + i + 0.5, z, Math.max(1, tw - shrink), 1, Math.max(1, tw - shrink), jit(trunk, rnd, 0.06));
    }
    const cy = baseY + th;
    const r = Math.max(3, Math.round(5 * s));
    // Copa esférica: antes era una lente de 3 bloques y a distancia parecía un
    // plato verde sobre un palo. Ahora la altura va con el radio.
    const hh = Math.max(3, Math.round(r * 0.8));
    const cyMid = hh * 0.42;
    const top = new THREE.Color(leaf).lerp(new THREE.Color(0xffffff), 0.17).getHex();
    for (let iy = -1; iy <= hh; iy++) {
      for (let ix = -r; ix <= r; ix++) {
        for (let iz = -r; iz <= r; iz++) {
          const dy = iy - cyMid;
          const d2 = (ix * ix + iz * iz) / (r * r) + (dy * dy) / ((hh * 0.68) * (hh * 0.68));
          if (d2 > 1) continue;
          if (d2 > 0.74 && rnd() < 0.38) continue;   // borde deshilachado
          this.blk('dark', x + ix, cy + iy + 0.5, z + iz, 1, 1, 1,
            jit(iy > cyMid + hh * 0.2 ? top : leaf, rnd, 0.08));
        }
      }
    }
    this.colliders.push({ x, z, hw: tw / 2, hd: tw / 2, h: baseY + th, r: tw, cos: 1, sin: 0 });
  }

  // Seta gigante: tallo con anillo, sombrero en cúpula con sombreado real,
  // láminas encendidas y motas. La versión plana se leía como un hongo de
  // juguete; esta tiene volumen porque cada bloque del sombrero cambia de tono
  // según su altura y su distancia al centro.
  mushroom(x, z, baseY, s = 1, cap = 0xe040b0, stem = 0xf6e6cf, spot = 0xffffff, rnd = this.rnd) {
    const sh = Math.max(2, Math.round(3.2 * s));
    const sw = Math.max(1, Math.round(s * 1.05));
    const stemDark = shadeHex(stem, 0.62);
    // Tallo: base ensanchada, fuste y un anillo claro bajo el sombrero.
    for (let i = 0; i < sh; i++) {
      const flare = i === 0 ? 0.55 : 0;
      const taper = i >= sh - 2 ? 0.34 : 0;
      const w = Math.max(0.6, sw + flare - taper);
      this.blk('glow', x, baseY + i + 0.5, z, w, 1.02, w,
        jit(i === 0 ? stemDark : stem, rnd, 0.05));
    }
    if (s > 0.8) {
      this.blk('glow', x, baseY + sh - 1.1, z, sw + 0.5, 0.28, sw + 0.5,
        shadeHex(stem, 1.12));
    }

    const cy = baseY + sh;
    const r = Math.max(1, Math.round(1.7 * s));
    // Perfil: dos anillos de borde, luego la cúpula cerrando.
    const prof = [r, r];
    for (let k = r - 1; k >= 0; k--) prof.push(k);
    const H = prof.length;
    const top = mixHex(cap, 0xffffff, 0.34);
    for (let iy = 0; iy < H; iy++) {
      const rr = prof[iy];
      // Tono por altura: borde oscuro, cúpula iluminada.
      const k = 0.52 + 0.60 * (iy / (H - 1));
      for (let ix = -rr; ix <= rr; ix++) {
        for (let iz = -rr; iz <= rr; iz++) {
          const d = Math.hypot(ix, iz);
          if (d > rr + 0.35) continue;
          // El centro de la cúpula es más claro que el borde: eso es lo que
          // convierte el sombrero en una cúpula y no en un disco.
          const radial = 1 + (1 - Math.min(1, d / Math.max(1, rr))) * 0.16;
          let c = iy >= H - 1 ? top : shadeHex(cap, k * radial);
          // Motas blancas repartidas por la cúpula, integradas en el bloque.
          if (iy > 0 && rnd() < 0.14) c = mixHex(c, spot, 0.82);
          this.blk('glow', x + ix, cy + iy + 0.5, z + iz, 1, 1, 1, jit(c, rnd, 0.05));
        }
      }
    }
    // Láminas: el borde inferior brilla más que el sombrero. Es el halo que en
    // la referencia hace que la seta parezca una lámpara.
    const gill = mixHex(cap, 0xffffff, 0.55);
    for (let ix = -r; ix <= r; ix++) {
      for (let iz = -r; iz <= r; iz++) {
        const d = Math.hypot(ix, iz);
        if (d > r + 0.3 || d < r - 1.4) continue;
        this.blk('glow', x + ix, cy - 0.30, z + iz, 1, 0.38, 1, jit(gill, rnd, 0.05));
      }
    }
    // Motas: se pintan sobre el propio sombrero, no como cajas encima. Una caja
    // suelta se lee como un cubo flotante; un bloque del sombrero aclarado se
    // lee como una mota de la seta. (Se hace dentro del bucle de la cúpula.)
    // Halo: un sprite aditivo sobre el sombrero. Sin él, con la niebla del
    // bosque, las setas se apagan a diez pasos.
    this.halo(x, cy + H * 0.5, z, cap, (r + 2.2) * 1.5);
    this.colliders.push({ x, z, hw: sw / 2, hd: sw / 2, h: cy, r: sw, cos: 1, sin: 0 });
  }

  // Mancha de luz aditiva. Se resuelve como sprite en flush(): es la forma más
  // barata de tener un foco volumétrico sin tocar la iluminación de la escena.
  halo(x, y, z, color, size = 4) {
    this.halos.push({ x, y, z, color, size });
  }

  // Arco de piedra con dintel escalonado y musgo opcional.
  arch(x, z, baseY, ry = 0, s = 1, stone = 0x8e9296, moss = null, banner = null) {
    const cos = Math.cos(ry), sin = Math.sin(ry);
    const put = (ox, y, oz, w, h, d, color, name = 'stone') => {
      this.blk(name, x + ox * cos + oz * sin, y, z - ox * sin + oz * cos, w, h, d, color, ry);
    };
    const pw = Math.max(1, Math.round(1.4 * s));
    const ph = Math.round(6 * s);
    const span = Math.round(3.4 * s);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < ph; i++) {
        put(sx * span, baseY + i + 0.5, 0, pw, 1, pw * 1.4, jit(stone, this.rnd, 0.06));
      }
      put(sx * span, baseY + ph + 0.5, 0, pw, 1, pw * 1.4, jit(stone, this.rnd, 0.05));
    }
    // Dintel: bloques que suben y bajan formando el arco.
    for (let ix = -span; ix <= span; ix++) {
      const t = 1 - Math.abs(ix) / (span + 0.6);
      const lift = Math.round(t * 2 * s);
      for (let k = 0; k <= lift; k++) {
        put(ix, baseY + ph + 1 + k + 0.5, 0, 1, 1, pw * 1.4, jit(stone, this.rnd, 0.06));
      }
      if (moss) put(ix, baseY + ph + 1 + lift + 1.5, 0, 1, 0.4, pw * 1.4, moss, 'leaf');
    }
    if (banner) {
      // Colgados por delante del pilar: si van en el mismo plano que la piedra,
      // no se ven desde la cámara.
      for (const sx of [-1, 1]) {
        put(sx * span, baseY + ph - 1.6, pw * 0.75, 0.26, 3.4, 1.5, banner, 'glow');
        put(sx * span, baseY + ph - 3.6, pw * 0.75, 0.26, 1.1, 1.1, banner, 'glow');
      }
    }
    // Dos pilares sólidos, no un bloque: se pasa por debajo del arco.
    for (const sx of [-1, 1]) {
      this.colliders.push({
        x: x + sx * span * cos, z: z - sx * span * sin,
        hw: pw / 2, hd: (pw * 1.4) / 2, h: baseY + ph, r: pw, cos, sin
      });
    }
  }

  // Columna rota: fuste de sillares con capitel y musgo en la cima. Es el
  // detalle que hace que un arco suelto parezca un templo en ruinas.
  pillar(x, z, baseY, h = 5, s = 1, stone = 0x8e9296, moss = null, rnd = this.rnd) {
    const pw = Math.max(1, Math.round(1.3 * s));
    for (let i = 0; i < h; i++) {
      const k = i === h - 1 && rnd() < 0.55 ? 1 : 0;   // borde partido
      this.blk('stone', x, baseY + i + 0.5, z, Math.max(1, pw - k), 1, Math.max(1, pw - k), jit(stone, rnd, 0.08));
    }
    this.blk('stone', x, baseY + h + 0.3, z, pw + 1, 0.6, pw + 1, jit(stone, rnd, 0.05));
    if (moss) this.blk('leaf', x, baseY + h + 0.9, z, pw + 0.5, 0.35, pw + 0.5, jit(moss, rnd, 0.1));
    this.colliders.push({ x, z, hw: pw / 2, hd: pw / 2, h: baseY + h, r: pw, cos: 1, sin: 0 });
  }

  // Muro en ruina: hiladas de sillares con la cresta comida y musgo arriba.
  ruin(x, z, len, ry = 0, baseY = 0, h = 4, stone = 0x8e9296, moss = null, rnd = this.rnd) {
    const cos = Math.cos(ry), sin = Math.sin(ry);
    const put = (ox, oy, w, hh, c, name = 'stone') =>
      this.blk(name, x + ox * cos, baseY + oy, z - ox * sin, w, hh, 1.2, c, ry);
    for (let ix = 0; ix < len; ix++) {
      const ox = ix - len / 2 + 0.5;
      const top = Math.max(1, h - Math.floor(rnd() * 2) - (rnd() < 0.2 ? 2 : 0));
      for (let iy = 0; iy < top; iy++) put(ox, iy + 0.5, 1, 1, jit(stone, rnd, 0.08));
      if (moss && rnd() < 0.72) put(ox, top + 0.15, 1, 0.3, jit(moss, rnd, 0.1), 'leaf');
    }
    this.colliders.push({ x, z, hw: len / 2, hd: 0.6, h: baseY + h, r: 1, cos, sin });
  }

  // Puente de tablones con barandilla.
  bridge(x, z, len, ry = 0, y = 0, width = 3, wood = 0x9a6a3c, rail = 0x7d5228) {
    const cos = Math.cos(ry), sin = Math.sin(ry);
    const put = (ox, oy, oz, w, h, d, color, name = 'wood') =>
      this.blk(name, x + ox * cos + oz * sin, y + oy, z - ox * sin + oz * cos, w, h, d, color, ry);
    for (let i = 0; i < len; i++) {
      const ox = i - len / 2 + 0.5;
      for (let k = 0; k < width; k++) {
        put(ox, 0, k - (width - 1) / 2, 1, 0.3, 1, jit(wood, this.rnd, 0.08));
      }
    }
    // Largueros y postes.
    for (const side of [-1, 1]) {
      const oz = side * (width / 2 - 0.1);
      put(0, -0.28, oz, len, 0.35, 0.35, rail);
      for (let i = 0; i <= len; i += 3) {
        const ox = i - len / 2;
        put(ox, 0.75, oz, 0.4, 1.6, 0.4, rail);
        put(ox, 1.35, oz, 0.3, 0.25, 0.3, rail);
      }
      put(0, 1.45, oz, len, 0.25, 0.28, rail);
    }
    this.footprint(x, z, len, width, ry, y + 0.15);
  }

  // Puente de piedra: losa plana con musgo en los bordes.
  stoneBridge(x, z, len, ry = 0, y = 0, width = 3, stone = 0x8e9296, moss = null) {
    const cos = Math.cos(ry), sin = Math.sin(ry);
    const put = (ox, oy, oz, w, h, d, color, name = 'stone') =>
      this.blk(name, x + ox * cos + oz * sin, y + oy, z - ox * sin + oz * cos, w, h, d, color, ry);
    put(0, 0, 0, len, 0.55, width, stone);
    for (const side of [-1, 1]) {
      const oz = side * (width / 2 - 0.15);
      if (moss) put(0, 0.35, oz, len, 0.3, 0.5, moss, 'leaf');
      // Pretiles bajos cada dos bloques.
      for (let i = 0; i <= len; i += 2) {
        put(i - len / 2, 0.75, oz, 0.5, 0.9, 0.5, stone);
      }
    }
    this.footprint(x, z, len, width, ry, y + 0.3);
  }

  // Huella AABB de un rectángulo girado, para las plataformas de juego.
  footprint(x, z, len, width, ry, top, noWall = true) {
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
    this.platforms.push({
      x, z,
      hw: (len / 2) * c + (width / 2) * s,
      hd: (len / 2) * s + (width / 2) * c,
      top, noWall
    });
  }

  // Escalera de piedra: peldaños bajos transitables. `base` es el escalón de
  // partida, para subir de una meseta a otra sin cortar el terreno.
  stairs(x, z, ry, steps, rise, width = 3, stone = 0x8e9296, dir = 1, base = 0, bottom = -2.6) {
    const cos = Math.cos(ry), sin = Math.sin(ry);
    for (let i = 0; i < steps; i++) {
      const ox = (i + 0.5) * dir;
      const top = base + rise * (i + 1);
      const hh = Math.max(0.4, top - bottom);
      this.blk('stone', x + ox * cos, bottom + hh / 2, z - ox * sin, 1, hh, width, jit(stone, this.rnd, 0.05), ry);
      this.footprint(x + ox * cos, z - ox * sin, 1, width, ry, top);
    }
  }

  // Valla de madera: postes con remate y dos travesaños gruesos. En la
  // referencia la valla es el elemento que más repite y el que da escala; con
  // listones finos desaparecía a poca distancia.
  fence(x, z, len, ry = 0, y = 0, wood = 0x8a5a33) {
    const cos = Math.cos(ry), sin = Math.sin(ry);
    const put = (ox, oy, w, h, d, color) =>
      this.blk('wood', x + ox * cos, y + oy, z - ox * sin, w, h, d, color, ry);
    const dark = shadeHex(wood, 0.70);
    const light = shadeHex(wood, 1.16);
    const step = 1.5;
    for (let i = 0; i <= len + 0.01; i += step) {
      const ox = i - len / 2;
      put(ox, 0.66, 0.36, 1.32, 0.36, jit(wood, this.rnd, 0.10));
      put(ox, 1.38, 0.48, 0.14, 0.48, light);   // remate del poste
    }
    put(0, 1.00, len, 0.24, 0.22, jit(dark, this.rnd, 0.05));
    put(0, 0.50, len, 0.24, 0.22, jit(dark, this.rnd, 0.05));
  }

  // Cascada: cortina de agua con espuma. La cortina se anima en update().
  waterfall(x, z, topY, bottomY, w = 3, ry = 0, color = 0x2ab4dc, foam = 0x9fe0f8) {
    const cos = Math.cos(ry), sin = Math.sin(ry);
    const n = Math.max(1, Math.round(w));
    for (let i = 0; i < n; i++) {
      const ox = i - (n - 1) / 2;
      const px = x + ox * cos, pz = z - ox * sin;
      // Vetas verticales: una columna clara de cada cuatro. El patrón diagonal
      // anterior se leía como un damero y no como agua cayendo.
      const isFoam = (i % 4) === 1;
      // Grosor alterno: la cortina deja de ser un plano perfecto.
      const dep = 0.6 + (i % 2) * 0.34;
      for (let y = bottomY; y < topY; y += 1) {
        this.blk('fall', px, y + 0.5, pz, 0.94, 1, dep, jit(isFoam ? foam : color, this.rnd, 0.07));
      }
      // Espuma al pie, abriéndose en abanico.
      for (let k = 0; k < 3; k++) {
        this.blk('fall', px + (this.rnd() - 0.5) * 2.2, bottomY + 0.12 + this.rnd() * 0.4,
          pz + (this.rnd() - 0.5) * 2.2, 1.05, 0.38, 1.05, foam);
      }
    }
  }

  // Flor de pétalos: tallo, dos hojas, cinco pétalos y centro. En la
  // referencia las flores son pequeñas pero están modeladas, no son un cubo.
  flower(x, z, baseY, petal = 0xffffff, core = 0xffe45c, rnd = this.rnd) {
    this.blk('leaf', x, baseY + 0.23, z, 0.09, 0.46, 0.09, 0x3d8a28);
    this.blk('leaf', x + 0.11, baseY + 0.17, z, 0.15, 0.06, 0.10, 0x4aa832);
    this.blk('leaf', x - 0.11, baseY + 0.27, z, 0.15, 0.06, 0.10, 0x4aa832);
    const y = baseY + 0.52;
    const pc = jit(petal, rnd, 0.08);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rnd() * 0.2;
      this.blk('glow', x + Math.cos(a) * 0.125, y, z + Math.sin(a) * 0.125,
        0.13, 0.08, 0.13, pc);
    }
    this.blk('glow', x, y + 0.015, z, 0.10, 0.10, 0.10, core);
  }

  // Grupo de flores sobre el terreno.
  flowerPatch(x, z, baseY, count = 8, radius = 3,
    colors = [0xffffff, 0xff5a9e, 0xffe45c], rnd = this.rnd) {
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * radius;
      const px = Math.round(x + Math.cos(a) * r) + 0.5;
      const pz = Math.round(z + Math.sin(a) * r) + 0.5;
      const c = colors[Math.floor(rnd() * colors.length)];
      this.flower(px, pz, baseY, c, rnd() < 0.5 ? 0xffe45c : 0xffd24a, rnd);
    }
  }

  // Mancha de flores / matojos.
  flowers(x, z, baseY, count = 8, radius = 3, colors = [0xff5a9e, 0xffe45c, 0xffffff], rnd = this.rnd) {
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * radius;
      const px = Math.round(x + Math.cos(a) * r), pz = Math.round(z + Math.sin(a) * r);
      const c = colors[Math.floor(rnd() * colors.length)];
      // Escala de adorno: tallo fino y flor de un tercio de bloque, como en la
      // referencia. Antes medían casi un bloque y parecían losas flotantes.
      this.blk('leaf', px, baseY + 0.12, pz, 0.18, 0.24, 0.18, 0x3f8f2a);
      this.blk('glow', px, baseY + 0.38, pz, 0.36, 0.28, 0.36, c);
    }
  }

  bush(x, z, baseY, s = 1, color = 0x3f9e2a) {
    const r = Math.max(1, Math.round(s));
    for (let ix = -r; ix <= r; ix++) {
      for (let iz = -r; iz <= r; iz++) {
        if (Math.hypot(ix, iz) > r + 0.3) continue;
        if (this.rnd() < 0.18) continue;
        this.blk('leaf', x + ix, baseY + 0.4, z + iz, 1, 0.8, 1, jit(color, this.rnd, 0.1));
      }
    }
  }

  crate(x, z, baseY, s = 1) {
    const w = 1.6 * s;
    this.blk('wood', x, baseY + w / 2, z, w, w, w, 0xa87844);
    this.blk('wood', x, baseY + w / 2, z, w * 1.02, 0.18, w * 1.02, 0x6f4a24);
    this.colliders.push({ x, z, hw: w / 2, hd: w / 2, h: baseY + w, r: w, cos: 1, sin: 0 });
  }

  lantern(x, z, baseY, color = 0xffd27a, h = 3) {
    this.blk('wood', x, baseY + h / 2, z, 0.28, h, 0.28, 0x4a3a2c);
    this.blk('glow', x, baseY + h + 0.3, z, 0.7, 0.7, 0.7, color);
  }

  // ------------------------------------------------------ vegetación por bioma
  // El paisaje de fondo tiene que hablar el idioma de cada mundo: un desierto
  // con árboles de hoja no es un desierto. Estas piezas sustituyen al árbol
  // genérico según la temática del sector.

  // Cactus columnar con brazos y costillas.
  cactus(x, z, baseY, s = 1, color = 0x3f8f4a, rnd = this.rnd) {
    const h = Math.max(2, Math.round(3.4 * s));
    const w = Math.max(0.8, 0.95 * s);
    const dark = shadeHex(color, 0.72);
    const lit = shadeHex(color, 1.22);
    for (let i = 0; i < h; i++) {
      // Costillas: dos caras del fuste van más oscuras.
      this.blk('leaf', x, baseY + i + 0.5, z, w, 1, w, jit(color, rnd, 0.06));
      this.blk('leaf', x - w * 0.32, baseY + i + 0.5, z, w * 0.22, 0.96, w * 0.9, dark);
      this.blk('leaf', x, baseY + i + 0.5, z - w * 0.32, w * 0.9, 0.96, w * 0.22, shadeHex(color, 0.86));
    }
    this.blk('leaf', x, baseY + h + 0.15, z, w * 0.7, 0.3, w * 0.7, lit);
    // Brazos: codo horizontal y tramo vertical.
    const arms = 1 + Math.floor(rnd() * 2);
    for (let a = 0; a < arms; a++) {
      const side = rnd() < 0.5 ? -1 : 1;
      const y0 = baseY + Math.round(h * (0.42 + rnd() * 0.3));
      const len = 0.9 + rnd() * 0.8;
      const up = 1 + Math.floor(rnd() * 2);
      this.blk('leaf', x + side * (w * 0.5 + len * 0.5), y0, z, len, w * 0.72, w * 0.72, jit(color, rnd, 0.06));
      for (let i = 0; i < up; i++) {
        this.blk('leaf', x + side * (w * 0.5 + len), y0 + i + 0.5, z, w * 0.7, 1, w * 0.7, jit(color, rnd, 0.06));
      }
      this.blk('leaf', x + side * (w * 0.5 + len), y0 + up + 0.15, z, w * 0.5, 0.28, w * 0.5, lit);
    }
    this.colliders.push({ x, z, hw: w / 2, hd: w / 2, h: baseY + h, r: w, cos: 1, sin: 0 });
  }

  // Palmera: tronco curvado por segmentos y corona de frondas.
  palm(x, z, baseY, s = 1, trunk = 0x8a6a44, leaf = 0x3f9a44, rnd = this.rnd) {
    const h = Math.max(3, Math.round(4.5 * s));
    let px = x, pz = z;
    const lean = (rnd() - 0.5) * 0.5;
    for (let i = 0; i < h; i++) {
      px += lean * (i / h) * 1.6;
      pz += lean * (i / h) * 1.6;
      this.blk('wood', px, baseY + i + 0.5, pz, 0.72, 1, 0.72,
        jit(i % 2 ? trunk : shadeHex(trunk, 0.82), rnd, 0.06));
    }
    const ty = baseY + h;
    this.blk('leaf', px, ty + 0.3, pz, 0.9, 0.5, 0.9, shadeHex(leaf, 0.8));
    // Frondas: cuatro brazos que caen hacia fuera, en dos alturas.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rnd() * 0.2;
      const dx = Math.cos(a), dz = Math.sin(a);
      for (let k = 1; k <= 3; k++) {
        const drop = k * 0.30;
        // Frondas gruesas y encadenadas: con placas finas se leían como discos
        // verdes flotando sobre un palo.
        this.blk('leaf', px + dx * k * 1.0, ty + 0.55 - drop, pz + dz * k * 1.0,
          1.15, 0.30, 1.15, jit(k > 2 ? shadeHex(leaf, 0.74) : leaf, rnd, 0.08));
      }
    }
    this.colliders.push({ x, z, hw: 0.4, hd: 0.4, h: ty, r: 0.8, cos: 1, sin: 0 });
  }

  // Árbol seco: tronco y ramas sin hoja. Para el castillo, el volcán y las
  // ruinas, donde un árbol frondoso rompe la temática.
  deadTree(x, z, baseY, s = 1, trunk = 0x4a3a30, rnd = this.rnd) {
    const h = Math.max(2, Math.round(3.2 * s));
    for (let i = 0; i < h; i++) {
      const w = Math.max(0.5, 0.8 * s * (1 - i / (h * 1.6)));
      this.blk('wood', x, baseY + i + 0.5, z, w, 1, w, jit(trunk, rnd, 0.1));
    }
    const branches = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < branches; i++) {
      const a = rnd() * Math.PI * 2;
      const y0 = baseY + h * (0.45 + rnd() * 0.5);
      const len = 1 + rnd() * 1.8;
      const dx = Math.cos(a) * len, dz = Math.sin(a) * len;
      this.blk('wood', x + dx * 0.5, y0, z + dz * 0.5, Math.abs(dx) + 0.22, 0.22, Math.abs(dz) + 0.22, shadeHex(trunk, 0.9));
      this.blk('wood', x + dx, y0 + 0.45, z + dz, 0.22, 0.9, 0.22, shadeHex(trunk, 0.8));
      if (rnd() < 0.6) {
        this.blk('wood', x + dx * 1.25, y0 + 0.95, z + dz * 1.25, 0.18, 0.7, 0.18, shadeHex(trunk, 0.72));
      }
    }
    this.colliders.push({ x, z, hw: 0.4, hd: 0.4, h: baseY + h, r: 0.8, cos: 1, sin: 0 });
  }

  // Cristal: racimo de prismas inclinados que brillan.
  crystal(x, z, baseY, s = 1, color = 0x8a5aff, rnd = this.rnd) {
    const n = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = rnd() * 0.9 * s;
      const hh = (1.2 + rnd() * 2.4) * s;
      const w = (0.35 + rnd() * 0.35) * s;
      const ox = Math.cos(a) * r, oz = Math.sin(a) * r;
      // Prisma en tres tramos que se afinan: da la silueta de cristal.
      const seg = 3;
      for (let k = 0; k < seg; k++) {
        const t = k / seg;
        const ww = w * (1 - t * 0.62);
        this.blk('glow', x + ox * (1 - t * 0.5), baseY + hh * t + hh / seg * 0.5,
          z + oz * (1 - t * 0.5), ww, hh / seg + 0.02, ww,
          jit(k === 0 ? shadeHex(color, 0.8) : color, rnd, 0.08));
      }
    }
    this.halo(x, baseY + s * 1.4, z, color, s * 4.2);
    this.colliders.push({ x, z, hw: 0.5 * s, hd: 0.5 * s, h: baseY + s * 2, r: s, cos: 1, sin: 0 });
  }

  // Aguja de hielo: cristal alto, translúcido y azul.
  iceSpike(x, z, baseY, s = 1, color = 0xbfe8ff, rnd = this.rnd) {
    const h = (2 + rnd() * 4) * s;
    const w = (0.7 + rnd() * 0.6) * s;
    const seg = 4;
    for (let k = 0; k < seg; k++) {
      const t = k / seg;
      const ww = w * (1 - t * 0.85);
      this.blk('glass', x, baseY + h * t + h / seg * 0.5, z, ww, h / seg + 0.02, ww,
        jit(color, rnd, 0.08));
    }
    this.blk('glass', x, baseY + h + 0.2, z, w * 0.2, 0.5, w * 0.2, shadeHex(color, 1.1));
  }

  // Depósito industrial: cilindro de chapa con anillos y escalera.
  silo(x, z, baseY, s = 1, color = 0x8a8f96, rnd = this.rnd) {
    const h = (3 + rnd() * 3) * s;
    const w = (1.4 + rnd() * 0.8) * s;
    this.blk('metal', x, baseY + h / 2, z, w, h, w, jit(color, rnd, 0.05));
    for (let i = 1; i < 4; i++) {
      this.blk('metal', x, baseY + (h * i) / 4, z, w * 1.06, 0.16, w * 1.06, shadeHex(color, 0.7));
    }
    this.blk('metal', x, baseY + h + 0.12, z, w * 0.86, 0.24, w * 0.86, shadeHex(color, 1.15));
    // Chimenea y escalera: dos detalles que lo alejan del simple cilindro.
    this.blk('metal', x + w * 0.34, baseY + h * 1.15, z, 0.3, h * 0.5, 0.3, shadeHex(color, 0.78));
    for (let i = 0; i < 5; i++) {
      this.blk('metal', x - w * 0.52, baseY + 0.5 + i * (h / 5), z, 0.14, 0.14, 0.5, shadeHex(color, 0.6));
    }
    this.colliders.push({ x, z, hw: w / 2, hd: w / 2, h: baseY + h, r: w, cos: 1, sin: 0 });
  }

  // Montón de chatarra: cajas y vigas apiladas sin orden.
  scrapPile(x, z, baseY, s = 1, color = 0x7a8590, rnd = this.rnd) {
    const n = 4 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const ox = (rnd() - 0.5) * 2.6 * s, oz = (rnd() - 0.5) * 2.6 * s;
      const oy = rnd() * 1.8 * s;
      const w = (0.5 + rnd() * 0.9) * s;
      const c = jit(rnd() < 0.5 ? color : shadeHex(color, 0.72), rnd, 0.12);
      this.blk('metal', x + ox, baseY + oy + w * 0.3, z + oz, w, w * 0.5, w * 0.8, c, rnd() * 1.2);
    }
  }

  // Roca flotante: isla del vacío con la base en punta.
  floatRock(x, y, z, s = 1, top = 0x8a94a8, rnd = this.rnd) {
    this.blk('stone', x, y, z, 3.2 * s, 1.4 * s, 3.2 * s, jit(top, rnd, 0.08));
    this.blk('stone', x, y - 1.1 * s, z, 2.1 * s, 1.2 * s, 2.1 * s, shadeHex(top, 0.8));
    this.blk('stone', x, y - 2.2 * s, z, 1.1 * s, 1.2 * s, 1.1 * s, shadeHex(top, 0.62));
    if (rnd() < 0.6) this.crystal(x, y + 0.9 * s, z, 0.7 * s, 0x9fd8ff);
  }

  cloud(x, y, z, s = 1, color = 0xffffff) {
    // Muchas bolas pequeñas en vez de pocas grandes: con cuatro cajas anchas la
    // nube se recortaba como un rectángulo de papel sobre el cielo.
    const puffs = 7 + Math.floor(this.rnd() * 5);
    for (let i = 0; i < puffs; i++) {
      const w = (1.4 + this.rnd() * 2.2) * s, h = (0.9 + this.rnd() * 0.8) * s, d = (1.4 + this.rnd() * 2) * s;
      const ox = (this.rnd() - 0.5) * 11 * s, oz = (this.rnd() - 0.5) * 7 * s;
      // El centro un poco más alto: la silueta se redondea.
      const oy = (0.5 - Math.min(1, Math.hypot(ox, oz) / (6 * s))) * 1.2 * s;
      this.blk('cloud', x + ox, y + oy + (this.rnd() - 0.5) * 0.8 * s, z + oz, w, h, d, color);
    }
  }

  // Enredaderas colgando de un borde.
  vines(x, z, topY, len = 3, color = 0x2f7f34) {
    for (let i = 0; i < len; i++) {
      this.blk('leaf', x, topY - i - 0.5, z, 0.7, 1, 0.35, jit(color, this.rnd, 0.12));
      if (this.rnd() < 0.35) this.blk('leaf', x + 0.4, topY - i - 0.6, z, 0.35, 0.6, 0.3, jit(color, this.rnd, 0.15));
    }
  }

  // Enredaderas sobre la cara expuesta de un acantilado. La versión anterior
  // las ponía en el centro de la columna y quedaban enterradas dentro del
  // terreno: por eso no se veía ni una.
  vineEdge(cx, cz, len = 4, color = 0x2f7f34) {
    if (cx < -ARENA || cx >= ARENA || cz < -ARENA || cz >= ARENA) return;
    const h = this.heights[this.idx(cx, cz)];
    if (h <= WATER_BED) return;
    const at = (x, z) => (x < -ARENA || x >= ARENA || z < -ARENA || z >= ARENA)
      ? -99 : this.heights[this.idx(x, z)];
    const drop = 1 + Math.floor(this.rnd() * len);
    const put = (px, pz, w, d) => {
      for (let i = 0; i < drop; i++) {
        const c = jit(color, this.rnd, 0.14);
        this.blk('leaf', px, h - 0.5 - i, pz, w, 1, d, c);
        if (this.rnd() < 0.30) {
          const ww = w > d ? w * 0.45 : d * 0.9;
          const dd = w > d ? w * 0.9 : d * 0.45;
          this.blk('leaf', px + (w > d ? 0.06 : 0), h - 0.85 - i, pz + (w > d ? 0 : 0.06),
            ww, 0.6, dd, shadeHex(color, 0.78));
        }
      }
    };
    if (at(cx - 1, cz) < h - 1) put(cx - 0.02, cz + 0.5, 0.18, 0.55 + this.rnd() * 0.45);
    if (at(cx + 1, cz) < h - 1) put(cx + 1.02, cz + 0.5, 0.18, 0.55 + this.rnd() * 0.45);
    if (at(cx, cz - 1) < h - 1) put(cx + 0.5, cz - 0.02, 0.55 + this.rnd() * 0.45, 0.18);
    if (at(cx, cz + 1) < h - 1) put(cx + 0.5, cz + 1.02, 0.55 + this.rnd() * 0.45, 0.18);
  }

  // ------------------------------------------------------------ cierre
  flush(parent) {
    this.group = parent;
    for (const [name, b] of this.batches) {
      const mesh = b.build();
      if (mesh) parent.add(mesh);
    }
    this.batches.clear();
    for (const m of this.pendingMeshes) parent.add(m);
    this.pendingMeshes.length = 0;
    if (this.halos.length) parent.add(buildHalos(this.halos));
    this.halos.length = 0;
    return parent;
  }
}

// Halo radial compartido por todos los sprites de luz.
let haloTex = null;
function haloTexture() {
  if (haloTex) return haloTex;
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const rg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  rg.addColorStop(0, 'rgba(255,255,255,0.95)');
  rg.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  rg.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);
  haloTex = new THREE.CanvasTexture(cv);
  haloTex.colorSpace = THREE.SRGBColorSpace;
  return haloTex;
}

function buildHalos(list) {
  const grp = new THREE.Group();
  grp.name = 'VX_halos';
  for (const h of list) {
    const mat = new THREE.SpriteMaterial({
      map: haloTexture(), color: h.color, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 0.55, toneMapped: true
    });
    const sp = new THREE.Sprite(mat);
    sp.position.set(h.x, h.y, h.z);
    sp.scale.set(h.size, h.size, 1);
    grp.add(sp);
  }
  grp.renderOrder = 4;
  return grp;
}

// ------------------------------------------------------------------ cielo
// Cúpula de cielo con nubes pintadas. Un `scene.background` de color plano da
// un horizonte de cartulina: aquí hay degradado, cúmulos con volumen y un
// halo de sol, que es la mitad del aspecto de las referencias.
const SKY_TEX = new Map();

function skyTexture(art = {}) {
  const key = [art.skyTop, art.sky, art.fog].join('|');
  const hit = SKY_TEX.get(key);
  if (hit) return hit;

  const W = 2048, H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const col = (h, k = 1) => '#' + shadeHex(h ?? 0xbfe8ff, k).toString(16).padStart(6, '0');
  const top = art.skyTop ?? 0x3a92f2;
  const mid = art.sky ?? 0xbfe8ff;
  const hor = art.fog ?? 0xc6e4fa;

  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.00, col(top));
  grad.addColorStop(0.28, col(mid, 0.88));
  grad.addColorStop(0.44, col(mid, 1.00));
  grad.addColorStop(0.487, col(mid, 1.04));
  grad.addColorStop(0.500, '#' + mixHex(mid, hor, 0.72).toString(16).padStart(6, '0'));
  grad.addColorStop(0.512, col(hor));
  grad.addColorStop(0.560, col(hor));
  grad.addColorStop(1.00, col(hor, 0.90));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  const rnd = mulberry32(0x5eed);
  const puff = (cx, cy, r, a, rgb) => {
    const rg = g.createRadialGradient(cx, cy, r * 0.10, cx, cy, r);
    rg.addColorStop(0, `rgba(${rgb},${a})`);
    rg.addColorStop(0.52, `rgba(${rgb},${a * 0.66})`);
    rg.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = rg;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  };

  // Cúmulos: cuerpo blanco, panza azulada y remate brillante. Se pintan tres
  // veces (a -W, 0 y +W) para que la costura del panorama no se note.
  for (let i = 0; i < 15; i++) {
    const cx = rnd() * W;
    // Pegadas al horizonte: en la referencia los cúmulos se apoyan sobre la
    // línea del paisaje, no flotan en lo alto del cielo. Si se suben, quedan
    // fuera del encuadre y el cielo se ve vacío.
    const cy = H * (0.424 + rnd() * 0.052);
    const s = 15 + rnd() * 26;
    const n = 6 + Math.floor(rnd() * 7);
    const puffs = [];
    for (let k = 0; k < n; k++) {
      puffs.push({
        ox: (rnd() - 0.5) * s * 3.4,
        oy: (rnd() - 0.5) * s * 0.6,
        r: s * (0.42 + rnd() * 0.58)
      });
    }
    for (const dx of [-W, 0, W]) {
      const x = cx + dx;
      if (x < -s * 3 || x > W + s * 3) continue;
      // Panza: sombra fría bajo la nube.
      for (const p of puffs) puff(x + p.ox, cy + p.oy + s * 0.26, p.r * 1.02, 0.10, '120,168,220');
      // Cuerpo.
      for (const p of puffs) puff(x + p.ox, cy + p.oy, p.r, 0.17, '255,255,255');
      // Cresta iluminada.
      for (let k = 0; k < 4; k++) {
        const p = puffs[k % puffs.length];
        puff(x + p.ox * 0.8, cy + p.oy - s * 0.22, p.r * 0.60, 0.30, '255,255,255');
      }
    }
  }

  // Halo de sol: una mancha cálida y difusa en el cuadrante alto.
  const sg = g.createRadialGradient(W * 0.28, H * 0.12, 0, W * 0.28, H * 0.12, W * 0.30);
  sg.addColorStop(0, 'rgba(255,252,232,0.55)');
  sg.addColorStop(0.35, 'rgba(255,250,225,0.18)');
  sg.addColorStop(1, 'rgba(255,250,225,0)');
  g.fillStyle = sg;
  g.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  SKY_TEX.set(key, tex);
  return tex;
}

// Malla de la cúpula. Va con `fog:false` (si no, la niebla la tiñe de un color
// plano) y `depthWrite:false` para que todo se dibuje encima.
export function buildSky(art = {}, radius = 330) {
  const geo = new THREE.SphereGeometry(radius, 40, 24);
  const mat = new THREE.MeshBasicMaterial({
    map: skyTexture(art), side: THREE.BackSide, fog: false,
    depthWrite: false, toneMapped: true
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'VX_sky';
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  return mesh;
}

export { MATERIALS, mulberry32, jit, shadeHex, mixHex, blockFace };
