// NEON//REVENANT — biblioteca de descubrimientos (códice).
// Renderiza lo que el jugador ya vio: hostiles, jefes, habilidades, armas,
// cuerpo a cuerpo, utilidad, sinergias y logros. Lo no descubierto se muestra
// como silueta sin datos para no desvelar el catálogo.

import { BOSSES, BOSS_ABILITIES } from './bosses.js';
import { ABILITIES, WEAPONS, MELEE, UTILITY, SYNERGIES, ACHIEVEMENTS, ENEMY_CODEX } from './content.js';

const FACTIONS = ['SYNTEK', 'HIVE', 'UMBRA'];
const FACTION_COLOR = { SYNTEK: '#6ef7e7', HIVE: '#b6ff3d', UMBRA: '#b56bff' };

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function card({ icon, color, name, sub, body, tags, locked, count }) {
  return `<div class="codex-card${locked ? ' locked' : ''}" style="--cc:${color}">
    <span class="codex-glyph">${locked ? '✖' : icon}</span>
    <div class="codex-copy">
      <b>${locked ? 'SIN DESCUBRIR' : esc(name)}</b>
      ${sub && !locked ? `<small>${esc(sub)}</small>` : ''}
      ${locked ? '<small>Se desvela al encontrarte con él.</small>' : body ? `<p>${body}</p>` : ''}
      ${tags && !locked ? `<div class="codex-tags">${tags.map(t => `<i>${esc(t)}</i>`).join('')}</div>` : ''}
    </div>
    ${count ? `<span class="codex-count">×${count}</span>` : ''}
  </div>`;
}

function section(title, note, cards) {
  const found = cards.filter(c => !c.locked).length;
  return `<div class="codex-section">
    <div class="codex-sec-head"><h3>${esc(title)}</h3><span>${found}/${cards.length}</span></div>
    ${note ? `<p class="codex-note">${note}</p>` : ''}
    <div class="codex-grid">${cards.join('')}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Construye el códice completo a partir del estado persistente.
// meta: módulo src/meta.js (getCodex/getAchievements...). opts: { kills? }
export function renderCodex(host, meta, opts = {}) {
  if (!host) return;
  const cx = meta.getCodex();
  const ach = meta.getAchievements();
  const killsOf = k => (opts.kills && opts.kills[k]) || 0;
  const parts = [];

  // ---- HOSTILES ------------------------------------------------------------
  const enemyCards = [];
  for (const type of Object.keys(ENEMY_CODEX)) {
    for (const f of FACTIONS) {
      const id = type + ':' + f;
      const seen = cx.enemies[id];
      const info = ENEMY_CODEX[type];
      const threat = '◆'.repeat(info.threat) + '◇'.repeat(5 - info.threat);
      enemyCards.push(card(seen ? {
        icon: '▲', color: FACTION_COLOR[f], name: info.name + ' — ' + f,
        sub: info.role, body: esc(info.tip),
        tags: [threat, 'NIVEL DE AMENAZA'], count: seen.kills || 0
      } : { locked: true, color: FACTION_COLOR[f] }));
    }
  }
  parts.push(section('HOSTILES', 'Cada facción tiene su propia variante. Las bajas acumuladas se anotan aquí.', enemyCards));

  // ---- JEFES ----------------------------------------------------------------
  const bossCards = BOSSES.map(k => {
    const seen = cx.bosses[k.id];
    if (!seen) return card({ locked: true, color: FACTION_COLOR[k.faction] });
    const abilities = k.abilities.map(a => {
      const ab = BOSS_ABILITIES[a]; return ab ? `${ab.icon} ${ab.name}` : a;
    });
    return card({
      icon: '☠', color: FACTION_COLOR[k.faction], name: k.name + ' — ' + k.title,
      sub: 'FACTION ' + k.faction, body: esc(k.desc) + '<br><b>HABILIDADES:</b> ' + abilities.join(' · '),
      tags: ['VIDA ' + k.hp, 'TELEGRAFÍA ' + k.telegraph + 's'], count: seen.kills || 0
    });
  });
  parts.push(section('JEFES DE SECTOR', 'Tres por facción. Uno cada cinco rondas: 5, 10 y 15.', bossCards));

  // ---- HABILIDADES ------------------------------------------------------------
  const abCards = ABILITIES.map(a => {
    const seen = cx.abilities[a.id];
    if (!seen) return card({ locked: true, color: a.color });
    return card({
      icon: a.icon, color: a.color, name: a.name, sub: a.trigger,
      body: esc(a.how), tags: ['NIVEL MÁX ' + a.max]
    });
  });
  parts.push(section('HABILIDADES DE BOTÍN', 'Se desbloquean en los cajones de suministros y en la pantalla de mejoras.', abCards));

  // ---- ARMAS ----------------------------------------------------------------
  const wpnCards = Object.entries(WEAPONS).map(([wid, w]) => {
    const seen = cx.weapons[wid];
    const hex = '#' + (w.color || 0x6ef7e7).toString(16).padStart(6, '0');
    if (!seen) return card({ locked: true, color: hex });
    return card({
      icon: '➶', color: hex,
      name: w.name + ' — ' + w.sub, sub: w.special ? 'ARMA ESPECIAL' : 'ARMA DE OPERADOR',
      body: esc(w.how || 'Arma de serie de tu operador.'), tags: w.special ? ['ESPECIAL'] : ['SERIE']
    });
  });
  parts.push(section('ARSENAL PRINCIPAL', 'Las armas de serie pertenecen al operador. Las especiales llegan del botín.', wpnCards));

  // ---- CUERPO A CUERPO ------------------------------------------------------
  const mlCards = MELEE.map(m => {
    const seen = cx.melee[m.id];
    if (!seen) return card({ locked: true, color: m.color });
    return card({
      icon: m.icon, color: m.color, name: m.name + ' — ' + m.sub,
      sub: 'CUERPO A CUERPO', body: esc(m.how) + '<br><b>ESPECIAL:</b> ' + m.special.name + ' — ' + m.special.desc,
      tags: ['DAÑO ×' + m.damage, 'ALCANCE ' + m.range + 'm']
    });
  });
  parts.push(section('CUERPO A CUERPO', 'Ranura E. Cada una con su técnica especial. Se desbloquean con las rondas.', mlCards));

  // ---- UTILIDAD ---------------------------------------------------------------
  const utCards = UTILITY.map(u => {
    const seen = cx.utility[u.id];
    if (!seen) return card({ locked: true, color: u.color });
    return card({
      icon: u.icon, color: u.color, name: u.name, sub: 'RANURA G // ' + u.cooldown + 's',
      body: esc(u.how) + ' ' + esc(u.desc), tags: ['CARGAS ' + u.charges]
    });
  });
  parts.push(section('UTILIDAD', 'Ranura G. Se recarga con el tiempo; no gastan munición.', utCards));

  // ---- SINERGIAS --------------------------------------------------------------
  const synCards = SYNERGIES.map(s => {
    const seen = cx.synergies[s.id];
    if (!seen) return card({ locked: true, color: s.color });
    return card({
      icon: '◈', color: s.color, name: s.name, sub: 'SINERGIA ACTIVA',
      body: esc(s.desc), tags: s.req.map(r => 'REQUIERE ' + (ABILITIES.find(a => a.id === r)?.name || r))
    });
  });
  parts.push(section('SINERGIAS', 'Combinaciones ocultas: consigue las dos habilidades que exige cada una.', synCards));

  // ---- LOGROS -----------------------------------------------------------------
  const achCards = ACHIEVEMENTS.map(a => {
    const got = !!ach[a.id];
    if (!got) return card({ locked: true, color: '#8b9694' });
    return card({
      icon: a.icon, color: '#ffd34d', name: a.name, sub: 'LOGRO DESBLOQUEADO',
      body: esc(a.desc), tags: [new Date(ach[a.id]).toLocaleDateString()]
    });
  });
  const gotAch = ACHIEVEMENTS.filter(a => ach[a.id]).length;
  parts.push(section(`LOGROS (${gotAch}/${ACHIEVEMENTS.length})`, 'Se guardan en tu disco. Algunos requieren dominar el combate.', achCards));

  host.innerHTML = `<div class="codex-root">${parts.join('')}</div>`;
}

// Resumen compacto para el HUD/aviso: cuántos registros llevas.
export function codexSummary(meta) {
  const cx = meta.getCodex();
  const enemies = Object.keys(cx.enemies).length;
  const bosses = Object.keys(cx.bosses).length;
  const abilities = Object.keys(cx.abilities).length;
  const ach = meta.achievementCount();
  return `${enemies} hostiles · ${bosses}/${BOSSES.length} jefes · ${abilities} habilidades · ${ach} logros`;
}
