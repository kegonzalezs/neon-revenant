// NEON//REVENANT — gestor de efectos de sonido (Kenney RPG Audio + Sci-Fi Sounds).
//
// Web Audio API puro, sin Howler. Características:
//   · Banco de .ogg leído por IPC (file:// bloquea fetch) y decodificado BAJO
//     DEMANDA: el arranque no espera 124 decodeAudioData().
//   · Pitch aleatorio 0.90–1.10 en cada voz para que el spam de disparo no
//     suene en bucle.
//   · Polifonía máxima configurable (22 voces) + estrangulado por archivo.
//   · Mapa semántico por personaje: shoot / impact / lifesteal.

import { WEAPON_DEFS } from './weapons.js';

const MAX_VOICES = 22;
const MIN_GAP = .045;

let raw = Object.create(null);       // nombre -> Uint8Array
const buffers = Object.create(null); // nombre -> AudioBuffer
const pending = Object.create(null); // nombre -> Promise
const lastPlay = Object.create(null);
let ctx = null, master = null, voices = 0;
const diag = { ok: false, files: 0, decoded: 0, played: 0, blocked: 0, voices: 0, error: null };

export function loadSfxBank() {
  return (async () => {
    try {
      if (!window.desktop?.loadSfxBank) throw new Error('puente IPC de audio no disponible');
      raw = await window.desktop.loadSfxBank() || {};
      diag.files = Object.keys(raw).length;
      diag.ok = diag.files > 0;
    } catch (err) {
      diag.error = String(err && err.message || err);
      console.log('SFX_BANK_ERROR: ' + diag.error);
    }
    window.__NR_SFX = diag;
    return diag;
  })();
}

export function bindSfxContext(audioCtx, masterNode) {
  ctx = audioCtx; master = masterNode;
}

function decode(name) {
  if (buffers[name]) return Promise.resolve(buffers[name]);
  if (pending[name]) return pending[name];
  const data = raw[name];
  if (!data || !ctx) return Promise.resolve(null);
  pending[name] = ctx.decodeAudioData(new Uint8Array(data).buffer.slice(0))
    .then(buf => { buffers[name] = buf; diag.decoded++; delete pending[name]; return buf; })
    .catch(() => { delete pending[name]; return null; });
  return pending[name];
}

/**
 * Reproduce un nombre de archivo (o una lista, eligiendo uno al azar).
 * opts: { volume, pitch, rate, throttle }
 */
export function playSfx(name, opts = {}) {
  if (!ctx || !master) return;
  const pick = Array.isArray(name) ? name[Math.floor(Math.random() * name.length)] : name;
  if (!pick || !raw[pick]) return;
  const now = ctx.currentTime;
  const gap = opts.throttle ?? MIN_GAP;
  if (now - (lastPlay[pick] || -1) < gap) { diag.blocked++; return; }
  if (voices >= MAX_VOICES) { diag.blocked++; return; }
  lastPlay[pick] = now;

  const buf = buffers[pick];
  if (!buf) { decode(pick); return; }
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = buf;
  src.playbackRate.value = (opts.rate ?? 1) *
    (opts.pitch === false ? 1 : .9 + Math.random() * .2);
  gain.gain.value = opts.volume ?? .55;
  src.connect(gain); gain.connect(master);
  voices++;
  diag.voices = voices;
  src.onended = () => { voices = Math.max(0, voices - 1); diag.voices = voices; };
  src.start();
  diag.played++;
}

export function playCharacterSfx(characterId, event, opts = {}) {
  const def = WEAPON_DEFS[characterId] || WEAPON_DEFS.vanta;
  const list = def.sfx?.[event];
  if (!list) return;
  playSfx(list, opts);
}

/** Precalienta los clips más usados para que el primer disparo no haga silencio. */
export function warmSfx(characterId) {
  const def = WEAPON_DEFS[characterId] || WEAPON_DEFS.vanta;
  if (!ctx) return;
  for (const key of ['shoot', 'impact', 'lifesteal']) {
    for (const n of (def.sfx?.[key] || [])) decode(n);
  }
}

export function sfxDiagnostics() { return { ...diag }; }

export function disposeSfxBank() {
  for (const k of Object.keys(buffers)) delete buffers[k];
  for (const k of Object.keys(pending)) delete pending[k];
  raw = Object.create(null);
  ctx = null; master = null; voices = 0;
}
