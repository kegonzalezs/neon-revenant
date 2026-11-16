// NEON//REVENANT — STEERING BOIDS DE HORDAS (Fase 2)
// ---------------------------------------------------------------------------
// El `separateEnemies()` original solo hacía un empuje simétrico cuando dos
// hostiles ya se solapaban: la horda convergía en un único punto y se apilaba.
// Aquí se añade un steering CONTINUO por vecindario (rejilla espacial, O(n)):
//
//   · Separación  : repulsión inversa al cuadrado de la distancia.
//   · Alineación  : copia débil de la velocidad media de los vecinos.
//   · Cohesión    : atracción muy débil al centro del grupo.
//   · Órbita      : componente tangencial alrededor del héroe (signo alterno),
//                   para que la horda lo RODEE en lugar de embestir en fila.
//   · Standoff    : cada arquetipo mantiene su radio de acoso (melé 1.7,
//                   tirador 10, tanque 2.4, volador 5). Empuja hacia fuera si
//                   se mete demasiado, evitando el "amontonamiento" final.
//
// Se aplica como desplazamiento suave ANTES del empuje duro de
// separateEnemies(), que queda como red de seguridad para colisiones exactas.

const CELL = 4.0;
const SEP_R = 2.6;
const NEIGHBOR_R = 5.0;
const grid = new Map();

const STANDOFF = { melee: 1.7, ranged: 10, tank: 2.4, flyer: 5.0 };

export const boidsDiagnostics = {
  updates: 0, neighbors: 0, minPair: 999, maxPair: 0, applied: 0
};

const key = (x, z) => (((x / CELL) | 0) + 2048) * 8192 + (((z / CELL) | 0) + 2048);

/**
 * @param {Array} enemies   hostiles vivos (con .group, .radius, .archetype)
 * @param {THREE.Vector3} playerPos
 * @param {number} dt
 */
export function applyBoids(enemies, playerPos, dt) {
  if (!enemies.length || dt <= 0) return;
  const d = boidsDiagnostics;
  d.updates++;
  grid.clear();
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.dead || e.spawn > 0 || e.type === 'boss' || e.type === 'turret') continue;
    const k = key(e.group.position.x, e.group.position.z);
    let cell = grid.get(k);
    if (!cell) { cell = []; grid.set(k, cell); }
    cell.push(i);
  }
  let minPair = 999, maxPair = 0, pairs = 0;

  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (a.dead || a.spawn > 0 || a.type === 'boss' || a.type === 'turret') continue;
    const p = a.group.position;
    const aFly = a.archetype === 'flyer';
    let sx = 0, sz = 0, ax = 0, az = 0, cx = 0, cz = 0, n = 0;

    const gx = (p.x / CELL) | 0, gz = (p.z / CELL) | 0;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const cell = grid.get(key((gx + ox) * CELL, (gz + oz) * CELL));
        if (!cell) continue;
        for (let c = 0; c < cell.length; c++) {
          const j = cell[c];
          if (j === i) continue;
          const b = enemies[j];
          if (b.dead || b.spawn > 0) continue;
          // Voladores y terrestres se ignoran entre sí: pueden cruzarse en Y.
          if ((b.archetype === 'flyer') !== aFly) continue;
          const dx = p.x - b.group.position.x, dz = p.z - b.group.position.z;
          const d2 = dx * dx + dz * dz;
          if (d2 > NEIGHBOR_R * NEIGHBOR_R || d2 < 1e-6) continue;
          const dist = Math.sqrt(d2);
          if (dist < minPair) minPair = dist;
          if (dist > maxPair) maxPair = dist;
          pairs++;
          // Separación: más fuerte cuanto más cerca.
          if (dist < SEP_R) { const w = (SEP_R - dist) / (SEP_R * dist); sx += dx * w; sz += dz * w; }
          // Alineación + cohesión sobre el mismo vecindario.
          ax += b.velX || 0; az += b.velZ || 0;
          cx += b.group.position.x; cz += b.group.position.z;
          n++;
        }
      }
    }
    d.neighbors += n;

    let vx = sx * 1.35, vz = sz * 1.35;
    if (n > 0) {
      vx += (ax / n - (a.velX || 0)) * .22;
      vz += (az / n - (a.velZ || 0)) * .22;
      vx += (cx / n - p.x) * .035;
      vz += (cz / n - p.z) * .035;
    }

    // Vector radial al héroe + tangente (órbita). Signo estable por hostil.
    const rx = playerPos.x - p.x, rz = playerPos.z - p.z;
    const rd = Math.hypot(rx, rz) || 1;
    const nx = rx / rd, nz = rz / rd;
    if (a.orbitSign === undefined) a.orbitSign = (i % 2) ? 1 : -1;
    const orbit = a.archetype === 'tank' ? .12 : .34;
    vx += -nz * orbit * a.orbitSign;
    vz += nx * orbit * a.orbitSign;

    // Radio de acoso: empuja hacia fuera si se metió demasiado.
    const want = STANDOFF[a.archetype] || 2.2;
    if (rd < want) { const push = (want - rd) / want * .8; vx -= nx * push; vz -= nz * push; }

    const len = Math.hypot(vx, vz);
    if (len < 1e-4) continue;
    const speed = Math.min(a.speed || 3, 8.5) * .38;
    const step = Math.min(dt, .05) * speed;
    const mx = vx / len * step, mz = vz / len * step;
    p.x += mx; p.z += mz;
    // Velocidad observada (incluye el movimiento de la IA) para alineación.
    a.velX = (a.velX || 0) * .55 + (mx / Math.max(dt, .001)) * .45;
    a.velZ = (a.velZ || 0) * .55 + (mz / Math.max(dt, .001)) * .45;
    d.applied++;
  }
  if (pairs) { d.minPair = Math.min(d.minPair, minPair); d.maxPair = Math.max(d.maxPair, maxPair); }
}

export function resetBoidsDiagnostics() {
  dReset();
  function dReset() {
    boidsDiagnostics.updates = 0; boidsDiagnostics.neighbors = 0;
    boidsDiagnostics.minPair = 999; boidsDiagnostics.maxPair = 0;
    boidsDiagnostics.applied = 0;
  }
}
