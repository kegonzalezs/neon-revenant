// Prueba de concepto: hornear muchas piezas en una sola geometría con color por vértice.
import * as THREE from '../node_modules/three/build/three.module.js';
import { RoundedBoxGeometry } from '../node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from '../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';

function normalize(g, color) {
  let out = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(out.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv') out.deleteAttribute(k);
  }
  if (!out.attributes.uv) {
    out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
  }
  if (!out.attributes.normal) out.computeVertexNormals();
  const c = new THREE.Color(color);
  const n = out.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  out.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return out;
}

const pieces = [];
pieces.push(normalize(new RoundedBoxGeometry(1, 2, 1, 2, .1), 0x8899aa));
pieces.push(normalize(new THREE.CylinderGeometry(.2, .3, 1, 10), 0xff0000));
pieces.push(normalize(new THREE.ConeGeometry(.3, 1, 6), 0x00ff00));
pieces.push(normalize(new THREE.SphereGeometry(.4, 10, 8), 0x0000ff));
pieces.push(normalize(new THREE.TorusGeometry(.4, .05, 6, 16), 0xffff00));
pieces.push(normalize(new THREE.OctahedronGeometry(.3), 0xff00ff));
pieces.push(normalize(new THREE.IcosahedronGeometry(.3, 1), 0x00ffff));

const merged = mergeGeometries(pieces, false);
console.log('MERGED_OK', !!merged, 'verts', merged.attributes.position.count, 'attrs', Object.keys(merged.attributes).join(','));

// Simulación de coste: 40 piezas por modelo, 7 tipos, 3 facciones
const t0 = Date.now();
let total = 0;
for (let k = 0; k < 21; k++) {
  const list = [];
  for (let i = 0; i < 40; i++) {
    list.push(normalize(i % 4 === 0 ? new RoundedBoxGeometry(.2, .3, .25, 2, .03) : new THREE.CylinderGeometry(.05, .06, .3, 8), 0x334455));
  }
  const m = mergeGeometries(list, false);
  total += m.attributes.position.count;
  list.forEach(g => g.dispose());
}
console.log('21 modelos de 40 piezas en', Date.now() - t0, 'ms · verts totales', total);
