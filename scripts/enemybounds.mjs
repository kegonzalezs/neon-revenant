// Diagnóstico: mide la caja envolvente de cada malla horneada para detectar
// piezas con transformaciones absurdas (geometría estirada o mal ubicada).
import * as THREE from '../node_modules/three/build/three.module.js';
import { buildEnemyModel } from '../src/enemies.js';

const types = ['chaser', 'tank', 'ranged', 'support', 'stalker', 'flyer', 'drone'];
for (const t of types) {
  const g = buildEnemyModel(t, 'SYNTEK', 0);
  const rows = [];
  g.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    rows.push(`${o.parent.name || 'root'}:${o.material.type === 'MeshBasicMaterial' ? 'g' : 's'} x[${b.min.x.toFixed(2)},${b.max.x.toFixed(2)}] y[${b.min.y.toFixed(2)},${b.max.y.toFixed(2)}] z[${b.min.z.toFixed(2)},${b.max.z.toFixed(2)}]`);
  });
  console.log('== ' + t);
  rows.forEach(r => console.log('   ' + r));
}
