// NEON//REVENANT — BACKEND DE EFECTOS
// Reemplaza el patrón antiguo "una malla + una geometría + un material nuevos por
// partícula" por un sistema con memoria fija:
//   · Chispas y motas: UNA malla instanciada por forma (1 draw call cada una).
//   · Tracers y arcos: UN LineSegments con buffer dinámico (1 draw call).
//   · Anillos, cúpulas, marcas y núcleos: objetos reciclados de un pool.
//   · Luces de impacto: pool fijo de 4 luces (el número de luces nunca cambia,
//     así three.js no recompila materiales cada vez que explota algo).
// La API imita a la anterior para que el resto del juego no cambie de forma.

import * as THREE from 'three';

const SPARK_MAX = 1100;   // metralla / escombros
const MOTE_MAX = 700;     // motas y esquirlas brillantes
const LINE_MAX = 640;     // segmentos de tracer (cada arco gasta varios)
const LIGHT_MAX = 4;

// ---------------------------------------------------------------------------
// Sistema de partículas instanciado con estado en arrays paralelos.
class SparkSystem {
  constructor(scene, geometry, max, renderOrder) {
    this.max = max;
    this.n = 0;
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: .95, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geometry, mat, max);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.renderOrder = renderOrder;
    const colors = new Float32Array(max * 3);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    this.mesh = mesh;
    this.colors = colors;

    this.px = new Float32Array(max); this.py = new Float32Array(max); this.pz = new Float32Array(max);
    this.vx = new Float32Array(max); this.vy = new Float32Array(max); this.vz = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max); this.sx = new Float32Array(max); this.sy = new Float32Array(max); this.sz = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    this.cr = new Float32Array(max); this.cg = new Float32Array(max); this.cb = new Float32Array(max);
    this.stretch = new Uint8Array(max);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._e = new THREE.Euler();
  }
  add(x, y, z, vx, vy, vz, life, size, color, opts = {}) {
    let i;
    if (this.n < this.max) i = this.n++;
    else i = (Math.random() * this.max) | 0;      // presupuesto lleno: recicla al azar
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.maxLife[i] = life;
    this.size[i] = size;
    this.grav[i] = opts.gravity === undefined ? 7 : opts.gravity;
    this.drag[i] = opts.drag || 0;
    this.stretch[i] = opts.stretch ? 1 : 0;
    this.sx[i] = (Math.random() - .5) * 8; this.sy[i] = (Math.random() - .5) * 8; this.sz[i] = (Math.random() - .5) * 8;
    const c = color.isColor ? color : _c.setHex(color);
    this.cr[i] = c.r; this.cg[i] = c.g; this.cb[i] = c.b;
    return i;
  }
  update(dt) {
    const m = this._m, q = this._q, p = this._p, s = this._s, e = this._e;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap-remove: el último ocupa el hueco
        const j = --this.n;
        if (j !== i) {
          this.px[i] = this.px[j]; this.py[i] = this.py[j]; this.pz[i] = this.pz[j];
          this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j]; this.vz[i] = this.vz[j];
          this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j];
          this.size[i] = this.size[j]; this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j];
          this.sx[i] = this.sx[j]; this.sy[i] = this.sy[j]; this.sz[i] = this.sz[j];
          this.cr[i] = this.cr[j]; this.cg[i] = this.cg[j]; this.cb[i] = this.cb[j];
          this.stretch[i] = this.stretch[j];
        }
        i--; continue;
      }
      if (this.drag[i]) { const d = 1 - Math.min(1, dt * this.drag[i]); this.vx[i] *= d; this.vy[i] *= d; this.vz[i] *= d; }
      this.vy[i] -= this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      if (this.py[i] < .04) { this.py[i] = .04; this.vy[i] *= -.34; this.vx[i] *= .7; this.vz[i] *= .7; }
      const k = this.life[i] / this.maxLife[i];
      // La partícula se encoge y se apaga: no necesita material propio.
      const sz = this.size[i] * (.35 + k * .65);
      p.set(this.px[i], this.py[i], this.pz[i]);
      e.set(this.sx[i] * this.life[i], this.sy[i] * this.life[i], this.sz[i] * this.life[i]);
      q.setFromEuler(e);
      s.set(sz, sz, sz);
      m.compose(p, q, s);
      this.mesh.setMatrixAt(i, m);
      const fade = .25 + k * .75;
      this.colors[i * 3] = this.cr[i] * fade;
      this.colors[i * 3 + 1] = this.cg[i] * fade;
      this.colors[i * 3 + 2] = this.cb[i] * fade;
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { this.n = 0; this.mesh.count = 0; }
}

// ---------------------------------------------------------------------------
// Tracers: un único buffer de líneas para todos los disparos y arcos.
class LineSystem {
  constructor(scene, max) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 6);
    this.col = new Float32Array(max * 6);
    this.life = new Float32Array(max);
    this.baseCol = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .95, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.LineSegments(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);
    this.geo = geo;
  }
  add(ax, ay, az, bx, by, bz, color, life) {
    let i;
    if (this.n < this.max) i = this.n++;
    else i = (Math.random() * this.max) | 0;
    const o = i * 6;
    this.pos[o] = ax; this.pos[o + 1] = ay; this.pos[o + 2] = az;
    this.pos[o + 3] = bx; this.pos[o + 4] = by; this.pos[o + 5] = bz;
    const c = color.isColor ? color : _c.setHex(color);
    this.baseCol[i * 3] = c.r; this.baseCol[i * 3 + 1] = c.g; this.baseCol[i * 3 + 2] = c.b;
    this.life[i] = life;
    return i;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n;
        if (j !== i) {
          const o = i * 6, p = j * 6;
          for (let k = 0; k < 6; k++) { this.pos[o + k] = this.pos[p + k]; }
          this.baseCol[i * 3] = this.baseCol[j * 3];
          this.baseCol[i * 3 + 1] = this.baseCol[j * 3 + 1];
          this.baseCol[i * 3 + 2] = this.baseCol[j * 3 + 2];
          this.life[i] = this.life[j];
        }
        i--; continue;
      }
      // Apagado por color de vértice (el material es compartido).
      const k = Math.min(1, this.life[i] * 18);
      const o = i * 6;
      const r = this.baseCol[i * 3] * k, g = this.baseCol[i * 3 + 1] * k, b = this.baseCol[i * 3 + 2] * k;
      this.col[o] = r; this.col[o + 1] = g; this.col[o + 2] = b;
      this.col[o + 3] = r; this.col[o + 4] = g; this.col[o + 5] = b;
    }
    this.geo.setDrawRange(0, this.n * 2);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
}

const _c = new THREE.Color();

// ---------------------------------------------------------------------------
// Pool genérico de mallas (anillos, cúpulas, marcas, núcleos).
class MeshPool {
  constructor(scene, geometry, materialFactory, max) {
    this.scene = scene; this.geo = geometry; this.make = materialFactory; this.max = max;
    this.items = []; this.free = [];
  }
  take(color, opacity) {
    let it = this.free.pop();
    if (!it) {
      if (this.items.length >= this.max) {
        // recicla el más antiguo
        it = this.items[0];
        this.items.shift(); this.items.push(it);
      } else {
        const mat = this.make();
        const m = new THREE.Mesh(this.geo, mat);
        m.frustumCulled = false;
        m.renderOrder = 2;
        this.scene.add(m);
        it = { m, mat, life: 0, max: 1 };
        this.items.push(it);
      }
    }
    it.mat.color.setHex(color);
    it.mat.opacity = opacity;
    it.m.visible = true;
    return it;
  }
  update(dt, onTick) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.life <= 0) continue;
      it.life -= dt;
      const k = Math.max(0, it.life / it.max);
      if (onTick) onTick(it, k, dt);
      if (it.life <= 0) { it.m.visible = false; this.free.push(it); }
    }
  }
  clear() { for (const it of this.items) { it.life = 0; it.m.visible = false; } this.free = this.items.slice(); }
}

// ---------------------------------------------------------------------------
export class FxPool {
  constructor(scene) {
    this.scene = scene;
    this.sparks = new SparkSystem(scene, new THREE.BoxGeometry(1, 1, 1), SPARK_MAX, 3);
    this.motes = new SparkSystem(scene, new THREE.OctahedronGeometry(.5, 0), MOTE_MAX, 3);
    this.lines = new LineSystem(scene, LINE_MAX);

    // Anillos expansivos en el suelo.
    this.rings = new MeshPool(scene, new THREE.RingGeometry(.78, 1, 40),
      () => new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }), 40);
    // Cúpulas / envolventes cristalinas.
    this.shells = new MeshPool(scene, new THREE.IcosahedronGeometry(1, 1),
      () => new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, depthWrite: false, toneMapped: false }), 18);
    // Marcas de suelo (anillo plano grande).
    this.marks = new MeshPool(scene, new THREE.RingGeometry(.4, 1, 44),
      () => new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }), 26);
    // Núcleos de impacto (esfera sólida translúcida).
    this.cores = new MeshPool(scene, new THREE.IcosahedronGeometry(.5, 1),
      () => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }), 20);
    // Columnas orbitales (haces verticales de los satélites).
    this.columns = new MeshPool(scene, new THREE.CylinderGeometry(1, .92, 30, 18, 1, true),
      () => new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }), 8);
    // Planos de suelo (marcas de derrape).
    this.quads = new MeshPool(scene, new THREE.PlaneGeometry(1, 1),
      () => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }), 10);

    // Pool de luces: el recuento de luces es constante -> sin recompilar materiales.
    this.lights = [];
    for (let i = 0; i < LIGHT_MAX; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 14, 2);
      l.visible = false;
      scene.add(l);
      this.lights.push({ l, life: 0, max: 1, peak: 0, next: i });
    }
    this.lightCursor = 0;
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
  }

  // -- metralla / escombros (cajas) ----------------------------------------
  burst(pos, color, count = 8, power = 3) {
    const n = Math.min(count, 90);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, up = Math.random();
      const sp = power * (.35 + Math.random());
      this.sparks.add(
        pos.x, pos.y, pos.z,
        Math.cos(a) * sp * .6, up * sp * .9 + .6, Math.sin(a) * sp * .6,
        .3 + Math.random() * .45,
        .035 + Math.random() * .05,
        color, { gravity: 8, drag: 1.2 }
      );
    }
  }
  // -- motas brillantes que suben (octaedros) ------------------------------
  glowMotes(pos, color, count = 10, radius = 2, rise = 1.8) {
    const n = Math.min(count, 60);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = radius * (.3 + Math.random() * .7);
      this.motes.add(
        pos.x + Math.cos(a) * d, pos.y + .2 + Math.random() * 1.4, pos.z + Math.sin(a) * d,
        (Math.random() - .5) * .5, rise * (.5 + Math.random()), (Math.random() - .5) * .5,
        .7 + Math.random() * .8,
        .05 + Math.random() * .06,
        color, { gravity: -1.2, drag: 1.1 }
      );
    }
  }
  // -- esquirlas radiales (anillo de cristales) ----------------------------
  shards(pos, color, radius, count = 14, up = 5) {
    const n = Math.min(count, 40);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * .3;
      const sp = radius * .5 + Math.random() * 2.2;
      this.motes.add(
        pos.x + Math.cos(a) * .9, pos.y + .12, pos.z + Math.sin(a) * .9,
        Math.cos(a) * sp, up * (.55 + Math.random() * .7), Math.sin(a) * sp,
        .5 + Math.random() * .5,
        .07 + Math.random() * .07,
        color, { gravity: 7, drag: .6 }
      );
    }
  }
  // -- tracer recto --------------------------------------------------------
  tracer(from, to, color = 0x6ef7e7, life = .07) {
    this.lines.add(from.x, from.y, from.z, to.x, to.y, to.z, color, life);
  }
  // -- arco quebrado (rayo) ------------------------------------------------
  arc(from, to, color = 0x9ff7ff, forks = 3, jitter = 1.1) {
    const steps = 5;
    let ax = from.x, ay = from.y, az = from.z;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      let bx = from.x + (to.x - from.x) * t;
      let by = from.y + (to.y - from.y) * t;
      let bz = from.z + (to.z - from.z) * t;
      if (i < steps) {
        bx += (Math.random() - .5) * jitter; by += (Math.random() - .5) * jitter * .8; bz += (Math.random() - .5) * jitter;
      }
      this.lines.add(ax, ay, az, bx, by, bz, color, .17);
      ax = bx; ay = by; az = bz;
    }
    // Ramificaciones
    const dirx = to.x - from.x, diry = to.y - from.y, dirz = to.z - from.z;
    for (let f = 0; f < forks; f++) {
      const t = .2 + Math.random() * .6;
      const px = from.x + dirx * t, py = from.y + diry * t, pz = from.z + dirz * t;
      const side = Math.random() > .5 ? 1 : -1;
      const bx = px + (-dirz) * .8 * side + (Math.random() - .5) * 2;
      const by = py - .3 - Math.random() * .9;
      const bz = pz + (dirx) * .8 * side + (Math.random() - .5) * 2;
      this.lines.add(px, py, pz, bx, by, bz, color, .13);
    }
  }
  // -- anillo que se expande ----------------------------------------------
  ring(pos, color, radius, life = .5) {
    const it = this.rings.take(color, .85);
    it.life = it.max = life;
    it.m.position.set(pos.x, (pos.y || 0) + .1, pos.z);
    it.m.rotation.set(-Math.PI / 2, 0, 0);
    it.m.scale.setScalar(.25);
    it.growTo = radius;
    it.kind = 'ring';
    return it;
  }
  shell(pos, radius, color, life = .6) {
    const it = this.shells.take(color, .85);
    it.life = it.max = life;
    it.m.position.copy(pos);
    it.m.rotation.set(0, 0, 0);
    it.m.scale.setScalar(radius * .4);
    it.growTo = radius;
    it.kind = 'shell';
    return it;
  }
  mark(pos, color, radius, life = 1.4, opacity = .45) {
    const it = this.marks.take(color, opacity);
    it.life = it.max = life;
    it.m.position.set(pos.x, (pos.y || 0) + .07, pos.z);
    it.m.rotation.set(-Math.PI / 2, 0, 0);
    it.m.scale.setScalar(radius * .5);
    it.growTo = radius * .5;
    it.baseOpacity = opacity;
    it.kind = 'mark';
    return it;
  }
  core(pos, color, radius = 1.5, life = .24) {
    const it = this.cores.take(color, .95);
    it.life = it.max = life;
    it.m.position.copy(pos);
    it.m.rotation.set(0, 0, 0);
    it.m.scale.setScalar(.3);
    it.growTo = radius * 2.2;
    it.kind = 'core';
    return it;
  }
  // -- columna vertical (haz orbital) --------------------------------------
  column(pos, color, radius = 1.1, life = .45, opacity = .4) {
    const it = this.columns.take(color, opacity);
    it.life = it.max = life;
    it.m.position.set(pos.x, 15, pos.z);
    it.m.scale.set(radius, 1, radius);
    it.growTo = radius;
    it.baseOpacity = opacity;
    it.kind = 'column';
    return it;
  }
  // -- marca plana en el suelo (derrape) -----------------------------------
  skid(pos, color, w, h, yaw, life = .6, opacity = .4) {
    const it = this.quads.take(color, opacity);
    it.life = it.max = life;
    it.m.position.set(pos.x, pos.y + .05, pos.z);
    it.m.rotation.set(-Math.PI / 2, 0, -(yaw || 0));
    it.m.scale.set(w, h, 1);
    it.baseOpacity = opacity;
    it.kind = 'skid';
    return it;
  }
  // -- luz de impacto (pool fijo) -----------------------------------------
  flash(pos, color, intensity = 60, distance = 14, life = .16) {
    const slot = this.lights[this.lightCursor++ % LIGHT_MAX];
    slot.l.position.copy(pos);
    slot.l.color.setHex(color);
    slot.l.distance = distance;
    slot.l.intensity = intensity;
    slot.l.visible = true;
    slot.life = slot.max = life;
    slot.peak = intensity;
  }

  update(dt) {
    this.sparks.update(dt);
    this.motes.update(dt);
    this.lines.update(dt);
    this.rings.update(dt, (it, k) => {
      const s = it.growTo * (1 - k * k * .85);
      it.m.scale.setScalar(s);
      it.mat.opacity = .85 * k;
    });
    this.shells.update(dt, (it, k) => {
      it.m.scale.setScalar(it.growTo * (.4 + (1 - k) * .6));
      it.m.rotation.y += dt * 2.2; it.m.rotation.x += dt * 1.1;
      it.mat.opacity = .85 * k;
    });
    this.marks.update(dt, (it, k) => {
      it.mat.opacity = (it.baseOpacity || .45) * k;
      it.m.rotation.z += dt * .4;
    });
    this.cores.update(dt, (it, k) => {
      it.m.scale.setScalar(it.growTo * (.3 + (1 - k) * .7));
      it.mat.opacity = .95 * k;
      it.m.rotation.x += dt * 6; it.m.rotation.y += dt * 8;
    });
    this.columns.update(dt, (it, k) => {
      const s = it.growTo * (.65 + (1 - k) * .35);
      it.m.scale.x = s; it.m.scale.z = s;
      it.mat.opacity = (it.baseOpacity || .4) * k;
    });
    this.quads.update(dt, (it, k) => {
      it.mat.opacity = (it.baseOpacity || .4) * k;
    });
    for (const slot of this.lights) {
      if (slot.life <= 0) { if (slot.l.visible) { slot.l.visible = false; slot.l.intensity = 0; } continue; }
      slot.life -= dt;
      const k = Math.max(0, slot.life / slot.max);
      slot.l.intensity = slot.peak * k * k;
      if (slot.life <= 0) { slot.l.visible = false; slot.l.intensity = 0; }
    }
  }

  clear() {
    this.sparks.clear(); this.motes.clear(); this.lines.clear();
    this.rings.clear(); this.shells.clear(); this.marks.clear(); this.cores.clear(); this.columns.clear(); this.quads.clear();
    for (const slot of this.lights) { slot.life = 0; slot.l.visible = false; slot.l.intensity = 0; }
  }

  stats() {
    return {
      sparks: this.sparks.n, motes: this.motes.n, lines: this.lines.n,
      rings: this.rings.items.length, shells: this.shells.items.length,
      marks: this.marks.items.length, cores: this.cores.items.length
    };
  }
}
