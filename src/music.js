// NEON//REVENANT — música procedural (synthwave industrial) con intensidad dinámica.

const SCALES = { SYNTEK: [0, 3, 5, 7, 10], HIVE: [0, 1, 5, 7, 8], UMBRA: [0, 2, 3, 7, 9] };
const ROOTS = { SYNTEK: 55, HIVE: 58.27, UMBRA: 49 };
const SEMI = (root, s) => root * Math.pow(2, s / 12);

export class MusicEngine {
  constructor() {
    this.ctx = null; this.bus = null; this.delay = null;
    this.playing = false; this.step = 0; this.nextTime = 0;
    this.bpm = 132; this.intensity = 0; this.mood = 'SYNTEK';
    this.timer = null; this.enabled = true; this.volume = .55;
    this.bars = 0;
    this._kickAt = -10;   // marca de tiempo del último bombo (en tiempo de audio)
  }
  // 0..1: vale 1 justo en el bombo y cae en ~.26 s. Lo consume el pase
  // cinematográfico para que el neón lata con la música.
  get beat() {
    if (!this.ctx || !this._kickAt) return 0;
    const d = Math.abs(this.ctx.currentTime - this._kickAt);
    return d < .26 ? (1 - d / .26) : 0;
  }
  init(ctx) {
    if (this.ctx) return;
    this.ctx = ctx;
    this.bus = ctx.createGain(); this.bus.gain.value = this.volume;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 2600;
    this.bus.connect(filter); filter.connect(ctx.destination);
    const delay = ctx.createDelay(1); delay.delayTime.value = .34;
    const fb = ctx.createGain(); fb.gain.value = .32;
    const wet = ctx.createGain(); wet.gain.value = .22;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(filter);
    this.delay = delay;
  }
  setVolume(v) { this.volume = v; if (this.bus) this.bus.gain.value = this.enabled ? v : 0; }
  setEnabled(on) { this.enabled = on; if (this.bus) this.bus.gain.value = on ? this.volume : 0; return on; }
  setMood(mood) { if (SCALES[mood]) this.mood = mood; }
  setIntensity(v) { this.intensity = Math.max(0, Math.min(1, v)); this.bpm = 128 + Math.round(this.intensity * 34); }
  start() {
    if (!this.ctx || this.playing) return;
    this.playing = true; this.step = 0; this.bars = 0; this.nextTime = this.ctx.currentTime + .08;
    this.timer = setInterval(() => this._tick(), 30);
  }
  stop() {
    this.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
  _tick() {
    if (!this.playing || !this.ctx) return;
    const spb = 60 / this.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + .18) {
      this._play(this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step = (this.step + 1) % 32;
      if (this.step === 0) this.bars++;
    }
  }
  _env(node, time, dur, peak) {
    const g = node.gain;
    g.setValueAtTime(0.0001, time);
    g.exponentialRampToValueAtTime(Math.max(.001, peak), time + .012);
    g.exponentialRampToValueAtTime(0.0001, time + dur);
  }
  _tone(freq, time, dur, type, peak, dest, detune = 0) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    this._env(g, time, dur, peak);
    o.connect(g); g.connect(dest || this.bus);
    o.start(time); o.stop(time + dur + .05);
    return o;
  }
  _noise(time, dur, peak, hp) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    s.buffer = buf; f.type = 'highpass'; f.frequency.value = hp;
    this._env(g, time, dur, peak);
    s.connect(f); f.connect(g); g.connect(this.bus);
    s.start(time); s.stop(time + dur + .02);
  }
  _play(step, time, spb) {
    if (!this.enabled) return;
    const i = this.intensity, root = ROOTS[this.mood], scale = SCALES[this.mood];
    const bar = Math.floor(step / 16), s = step % 16;
    // percusión
    if (s === 0 || s === 6 || s === 10 || (s === 14 && i > .45)) {
      this._kickAt = time;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(120, time); o.frequency.exponentialRampToValueAtTime(42, time + .13);
      this._env(g, time, .2, .55); o.connect(g); g.connect(this.bus); o.start(time); o.stop(time + .25);
    }
    if (s === 4 || s === 12) this._noise(time, .16, .22 + i * .12, 1400);
    if (s % 2 === 1) this._noise(time, .045, .05 + i * .09, 6500);
    // bajo
    const bassSteps = { 0: 0, 3: 0, 6: 3, 8: 0, 11: 7, 14: 5 };
    if (bassSteps[s] !== undefined) {
      const f = SEMI(root, scale[bassSteps[s] % scale.length]);
      const o = this.ctx.createOscillator(), g = this.ctx.createGain(), fil = this.ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = f;
      fil.type = 'lowpass'; fil.frequency.setValueAtTime(320 + i * 900, time);
      fil.frequency.exponentialRampToValueAtTime(180, time + spb * 2.4);
      this._env(g, time, spb * 2.6, .3);
      o.connect(fil); fil.connect(g); g.connect(this.bus); o.start(time); o.stop(time + spb * 3);
    }
    // acorde pad al inicio de cada compás
    if (s === 0) {
      [0, 3, 7].forEach((deg, k) => {
        const f = SEMI(root, scale[deg % scale.length] + 24);
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        this._env(g, time, spb * 14, .07 + i * .05);
        o.connect(g); g.connect(this.bus); o.start(time); o.stop(time + spb * 15);
      });
    }
    // arpegio / lead (entra con intensidad)
    if (i > .3 && (s === 2 || s === 7 || s === 9 || s === 13 || s === 15)) {
      const deg = scale[(bar * 3 + s) % scale.length];
      const f = SEMI(root, deg + 36);
      this._tone(f, time, spb * 1.6, 'square', .05 + i * .07, this.delay);
      this._tone(f, time, spb * 1.2, 'square', .035 + i * .05, this.bus, 6);
    }
    // acento final de compás
    if (s === 15 && bar % 4 === 3) this._noise(time, .5, .18, 300);
  }
}
