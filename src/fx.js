// NEON//REVENANT — efectos de pantalla: números de daño, impacto, hitstop, líneas de velocidad.

import * as THREE from 'three';

export class FX {
  constructor() {
    this.layer = document.createElement('div');
    this.layer.id = 'fx-layer';
    document.body.appendChild(this.layer);
    this.numbers = [];
    this.stopUntil = 0;
    this.slowUntil = 0;
    this.slowScale = 1;
    this.flashEl = document.createElement('div');
    this.flashEl.id = 'fx-flash';
    document.body.appendChild(this.flashEl);
    this.speedEl = document.createElement('div');
    this.speedEl.id = 'fx-speed';
    document.body.appendChild(this.speedEl);
    this.v = new THREE.Vector3();
  }
  damageNumber(worldPos, amount, crit = false, headshot = false) {
    const el = document.createElement('div');
    el.className = 'dmg-num' + (crit ? ' crit' : '') + (headshot ? ' head' : '');
    el.textContent = Math.round(amount);
    this.layer.appendChild(el);
    this.numbers.push({ el, pos: worldPos.clone(), life: .95, max: .95, drift: (Math.random() - .5) * 26, scale: crit ? 1.5 : 1 });
  }
  update(camera, dt) {
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.life -= dt;
      if (n.life <= 0) { n.el.remove(); this.numbers.splice(i, 1); continue; }
      const k = 1 - n.life / n.max;
      this.v.copy(n.pos);
      this.v.y += k * 1.1;
      this.v.project(camera);
      if (this.v.z > 1) { n.el.style.opacity = '0'; continue; }
      const x = (this.v.x * .5 + .5) * innerWidth + n.drift * k;
      const y = (-this.v.y * .5 + .5) * innerHeight;
      n.el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px) scale(${n.scale * (1 + (1 - Math.abs(k - .15) * 4) * .35)})`;
      n.el.style.opacity = String(Math.min(1, (1 - k) * 2.2));
    }
  }
  flash(color = '#ffffff', strength = .45, ms = 160) {
    this.flashEl.style.background = color;
    this.flashEl.style.opacity = String(strength);
    this.flashEl.style.transition = 'none';
    requestAnimationFrame(() => {
      this.flashEl.style.transition = `opacity ${ms}ms ease-out`;
      this.flashEl.style.opacity = '0';
    });
  }
  hitstop(ms = 45) { this.stopUntil = Math.max(this.stopUntil, performance.now() + ms); }
  slowmo(ms = 260, scale = .35) { this.slowUntil = Math.max(this.slowUntil, performance.now() + ms); this.slowScale = scale; }
  timeScale() {
    const now = performance.now();
    if (now < this.stopUntil) return .06;
    if (now < this.slowUntil) return this.slowScale;
    return 1;
  }
  speedLines(on) { this.speedEl.classList.toggle('on', !!on); }
  clear() {
    this.numbers.forEach(n => n.el.remove());
    this.numbers.length = 0;
    this.speedLines(false);
    this.flashEl.style.opacity = '0';
  }
}
