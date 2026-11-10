// NEON//REVENANT — fachadas procedurales para los edificios del fondo.
// Método barato: en vez de pegar ventanas caja a caja (miles de draw calls),
// se pinta UNA textura canvas con la retícula de ventanas y se envuelve la caja.
// Se generan 4 variantes compartidas: 4 materiales para todos los edificios.

import * as THREE from 'three';

// Dibuja una fachada en un canvas y devuelve la textura.
// w/h en "plantas": la retícula se dibuja en coordenadas de módulo para que
// cualquier edificio escale la textura sin deformar demasiado las ventanas.
export function facadeTexture(opts = {}) {
  const {
    wall = '#8f9497', wall2 = '#7c8285', lit = 0.42, litColor = '#ffd9a0',
    cols = 6, rows = 10, ledColor = null, seed = 1
  } = opts;
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 512;
  const ctx = cv.getContext('2d');
  // pared con dos tonos: banda inferior más oscura (zócalo)
  ctx.fillStyle = wall; ctx.fillRect(0, 0, 256, 512);
  ctx.fillStyle = wall2; ctx.fillRect(0, 512 - 90, 256, 90);
  // panelado sutil
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  for (let y = 0; y < rows; y++) ctx.fillRect(0, y * (512 / rows), 256, 2);
  // retícula de ventanas
  const padX = 256 / (cols * 3.2), padY = 512 / (rows * 2.6);
  const cw = (256 - padX * (cols + 1)) / cols, ch = (512 - padY * (rows + 1)) / rows;
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return (s % 1000) / 1000; };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = padX + c * (cw + padX), y = padY + r * (ch + padY);
      const on = rand() < lit;
      ctx.fillStyle = on ? (rand() < .18 ? '#cfe6ee' : litColor) : '#39424a';
      ctx.globalAlpha = on ? .85 + rand() * .15 : .9;
      ctx.fillRect(x, y, cw, ch);
      // marco
      ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cw, ch);
    }
  }
  // banda LED opcional (neón tenue en algún piso)
  if (ledColor) {
    const y = Math.floor(rand() * rows) * (512 / rows) + 512 / rows - 6;
    ctx.fillStyle = ledColor; ctx.globalAlpha = .75;
    ctx.fillRect(padX, y, 256 - padX * 2, 4);
    ctx.globalAlpha = 1;
  }
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.wrapS = THREE.RepeatWrapping; tx.wrapT = THREE.RepeatWrapping;
  return tx;
}

// Crea el banco de materiales compartidos de fachada: 4 estilos × 3 alturas
// (repetición de la retícula pre-escalada). 12 texturas para toda la ciudad:
// nada de clonar texturas por edificio (cada clon sería una subida a GPU).
export function makeFacadeBank(seed = 7) {
  const styles = [
    { wall: '#98a0a2', wall2: '#828a8c', lit: .38, litColor: '#ffd9a0', ledColor: '#6ef7e7' },
    { wall: '#a8a49b', wall2: '#8f8c83', lit: .5, litColor: '#ffbf47', ledColor: null },
    { wall: '#7f878b', wall2: '#6d757a', lit: .3, litColor: '#bfe6ff', ledColor: '#ff4d38' },
    { wall: '#8b9093', wall2: '#767c80', lit: .44, litColor: '#ffd7a0', ledColor: '#b56bff' }
  ];
  const heightRows = [[6, 8], [10, 12], [14, 18]];
  const bank = [];
  for (let si = 0; si < styles.length; si++) {
    for (let hi = 0; hi < heightRows.length; hi++) {
      const [rows] = heightRows[hi];
      const st = { ...styles[si], cols: 4 + ((si + hi) % 3), rows, seed: seed + (si * 3 + hi) * 131 };
      const tex = facadeTexture(st);
      bank.push(new THREE.MeshStandardMaterial({
        map: tex, roughness: .88, metalness: .06,
        emissive: 0x1a1510, emissiveIntensity: .12
      }));
    }
  }
  return bank;
}
