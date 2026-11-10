// Verificación headless del generador de hostiles: construye las 21 variantes
// (7 tipos × 3 facciones) y reporta mallas, vértices y tiempos.
import { buildEnemyModel } from '../src/enemies.js';

const types = ['chaser', 'tank', 'ranged', 'support', 'stalker', 'flyer', 'drone'];
const facs = ['SYNTEK', 'HIVE', 'UMBRA'];

let totalMeshes = 0, totalVerts = 0;
const t0 = Date.now();
for (const f of facs) {
  for (const t of types) {
    const g = buildEnemyModel(t, f, 0);
    let meshes = 0, verts = 0, shadows = 0;
    g.traverse(o => {
      if (o.isMesh) { meshes++; verts += o.geometry.attributes.position.count; if (o.castShadow) shadows++; }
    });
    totalMeshes += meshes; totalVerts += verts;
    console.log(`${f.padEnd(6)} ${t.padEnd(8)} mallas=${String(meshes).padStart(2)} sombras=${String(shadows).padStart(2)} verts=${String(verts).padStart(5)} legs=${g.userData.legs.length} arms=${g.userData.arms.length} dyn=${['orb', 'ring', 'rotor', 'core', 'wingL', 'wingR'].filter(k => g.userData[k]).join(',') || '-'}`);
  }
}
console.log('---');
console.log('total mallas por juego de 21 variantes:', totalMeshes, '· vértices:', totalVerts, '· ms:', Date.now() - t0);

// Reutilización: la segunda tanda debe ser casi gratis (solo clona Object3D).
const t1 = Date.now();
for (let i = 0; i < 200; i++) buildEnemyModel(types[i % 7], facs[i % 3], 0);
console.log('200 spawns reutilizando plantillas:', Date.now() - t1, 'ms');
