// NEON//REVENANT — PASE CINEMATOGRÁFICO
// Un único pase a pantalla completa que da el "look" de la casa y, sobre todo,
// reacciona al juego: aberración cromática al dashear, desenfoque radial a toda
// velocidad, tinte rojo y desaturación al estar al borde de la muerte y pulso
// cian/magenta durante la sobrecarga.
//
// Va DESPUÉS del OutputPass, así que trabaja en espacio de pantalla (sRGB):
// aquí se hace etalonaje artístico, no conversión de color.
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const CinematicShader = {
  name: 'CinematicShader',
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uAberr: { value: 0.0012 },   // aberración cromática radial (en UV)
    uBlur: { value: 0 },         // desenfoque radial de velocidad 0..1
    uGrain: { value: 0.035 },    // grano de película
    uScan: { value: 0.012 },     // líneas de barrido
    uVignette: { value: 0.55 },  // viñeteado
    uDamage: { value: 0 },       // 0..1 daño reciente
    uHeat: { value: 0 },         // 0..1 sobrecarga
    uSat: { value: 1.06 },       // saturación global
    uFlash: { value: 0 },        // destello blanco
    uLift: { value: 0 },         // realce de negros en el impacto
    uPulse: { value: 0 }         // latido de la música 0..1 (bomba del sintetizador)
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime, uAberr, uBlur, uGrain, uScan, uVignette;
    uniform float uDamage, uHeat, uSat, uFlash, uLift, uPulse;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);
      float r = sqrt(r2);
      vec2 dir = c / max(r, 1e-4);

      // ---- aberración cromática radial (más fuerte en los bordes) ----------
      float ab = uAberr * (0.25 + r2 * 3.2);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * ab).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * ab).b;

      // ---- desenfoque radial de velocidad (dash / sobrecarga) --------------
      if (uBlur > 0.002) {
        vec3 acc = col;
        float w = 1.0;
        for (int i = 1; i <= 5; i++) {
          float f = float(i) / 5.0;
          float k = 1.0 - f * uBlur * 0.26;
          float ww = 1.0 - f * 0.62;
          acc += texture2D(tDiffuse, 0.5 + c * k).rgb * ww;
          w += ww;
        }
        col = mix(col, acc / w, clamp(uBlur * 1.7, 0.0, 1.0));
      }

      // ---- etalonaje: sombras frías, luces cálidas ------------------------
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum), col, uSat);
      col += vec3(-0.014, 0.004, 0.026) * (1.0 - lum);
      col += vec3(0.034, 0.016, -0.012) * lum;
      col = (col - 0.5) * 1.055 + 0.5;
      col += uLift * 0.06;

      // ---- latido musical: quema los neones en cada bombo -----------------
      if (uPulse > 0.001) {
        col = mix(vec3(lum), col, 1.0 + uPulse * 0.45);
        col *= 1.0 + uPulse * 0.09;
      }

      // ---- sobrecarga: pulso cian/magenta en los bordes -------------------
      if (uHeat > 0.001) {
        float pulse = 0.55 + 0.45 * sin(uTime * 9.0);
        float edge = pow(clamp(r * 1.7, 0.0, 1.0), 2.0);
        col += uHeat * pulse * edge * vec3(0.10, 0.30, 0.34);
        col += uHeat * (1.0 - pulse) * edge * vec3(0.26, 0.05, 0.22);
      }

      // ---- daño: rojo en los bordes y desaturación del centro -------------
      if (uDamage > 0.001) {
        float edge = smoothstep(0.18, 0.62, r);
        col = mix(col, vec3(col.r * 1.18, col.g * 0.42, col.b * 0.42), uDamage * edge);
        float grey = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(grey), uDamage * 0.28 * (1.0 - edge));
      }

      // ---- viñeteado ------------------------------------------------------
      float vig = smoothstep(1.12, 0.22, r * 1.42);
      col *= mix(1.0, vig, uVignette);

      // ---- líneas de barrido y grano --------------------------------------
      float scan = sin(uv.y * uRes.y * 1.6) * 0.5 + 0.5;
      col *= 1.0 - uScan * scan;
      float g = hash(uv * uRes + fract(uTime) * 137.0) - 0.5;
      col += g * uGrain;

      // ---- destello de impacto -------------------------------------------
      col = mix(col, vec3(1.0), uFlash);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `
};

export class CinematicPass extends ShaderPass {
  constructor() {
    super(CinematicShader);
    this.enabled = true;
    this._damage = 0;
    this._heat = 0;
    this._flash = 0;
    this._blur = 0;
    this._lift = 0;
  }

  setSize(width, height) {
    this.uniforms.uRes.value.set(Math.max(1, width), Math.max(1, height));
  }

  // `s` es un objeto plano con el estado que interesa al pase. Todo suavizado
  // aquí dentro para que el resto del juego no tenga que interpolar nada.
  update(dt, s) {
    if (!this.enabled) return;
    const u = this.uniforms;
    const k = (cur, target, speed) => cur + (target - cur) * Math.min(1, dt * speed);
    // Latido musical: ataque instantáneo, caída suave.
    this._beat = Math.max(s.beat || 0, (this._beat || 0) - dt * 2.6);

    this._blur = k(this._blur, s.blur || 0, 9);
    this._damage = k(this._damage, s.damage || 0, s.damage > this._damage ? 26 : 3.2);
    this._heat = k(this._heat, s.heat || 0, 4.5);
    this._flash = k(this._flash, s.flash || 0, s.flash > this._flash ? 40 : 7);
    this._lift = k(this._lift, s.lift || 0, 12);

    u.uTime.value += dt;
    u.uBlur.value = this._blur;
    u.uDamage.value = this._damage;
    u.uHeat.value = this._heat;
    u.uFlash.value = this._flash;
    u.uLift.value = this._lift;
    u.uPulse.value = this._beat || 0;
    // La aberración sigue a la velocidad: quieto casi no se nota, dasheando sí.
    u.uAberr.value = 0.0007 + this._blur * 0.010 + this._heat * 0.0016 + this._damage * 0.0022;
    u.uSat.value = 1.06 - this._damage * 0.22 + this._heat * 0.05;
    u.uGrain.value = 0.030 + this._heat * 0.020;
  }

  // Un fogonazo inmediato (bajas de jefe, impactos críticos).
  kick(amount = 0.4) { this._flash = Math.max(this._flash, amount); }
}
