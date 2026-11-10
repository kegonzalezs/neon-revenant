// NEON//REVENANT — progresión persistente: árbol de habilidades en grafo por personaje.

const KEY = 'nr-meta-v3';

const LANES = [
  { id:'power', label:'PODER', color:'#ff4d38', y:100 },
  { id:'body', label:'CUERPO', color:'#6ef7e7', y:268 },
  { id:'system', label:'SISTEMA', color:'#b56bff', y:436 }
];
const XS = [216, 336, 456, 576, 696, 816, 936, 1056];
const JY = [-18, 18, -12, 20, -16, 14, -6, 16];
const KEY_SLOTS = [0, 3, 7];
const CANVAS_W = 1120, CANVAS_H = 510;

const BASE = {
  power: [
    { name:'NÚCLEO INESTABLE', icon:'⚡', desc:'Núcleo de carga sobrecargado: +12% de daño por nivel.', cost:3, max:3, bonus:{ damage:.12 } },
    { name:'CÁMARA RÁPIDA', icon:'⇶', desc:'Cámara de firing más ligera: +8% de cadencia por nivel.', cost:1, max:4, bonus:{ fireRate:-.08 } },
    { name:'PERFORACIÓN', icon:'➶', desc:'Los disparos atraviesan +1 enemigo por nivel.', cost:2, max:2, bonus:{ pierce:1 } },
    { name:'OJO DEL ORÁCULO', icon:'◉', desc:'El visor marca el punto débil: +25% de headshot por nivel.', cost:4, max:3, bonus:{ headshot:.25 } },
    { name:'CARGADOR DE PRUEBA', icon:'▮', desc:'+10 de munición por cargador y por nivel.', cost:1, max:3, bonus:{ maxAmmo:10 } },
    { name:'PUNTERÍA LÁSER', icon:'⌖', desc:'Cálculo de trayectoria mejorado: +8% de daño por nivel.', cost:1, max:4, bonus:{ damage:.08 } },
    { name:'GATILLO REACTIVO', icon:'✦', desc:'Disparo automático optimizado: +10% de cadencia por nivel.', cost:2, max:3, bonus:{ fireRate:-.1 } },
    { name:'VERDUGO', icon:'✹', desc:'+20% de daño por nivel. El nodo más caro del árbol.', cost:5, max:2, bonus:{ damage:.2 } }
  ],
  body: [
    { name:'CORAZA DE TITANIO', icon:'⛨', desc:'+30 de vida máxima por nivel.', cost:3, max:4, bonus:{ maxHp:30 } },
    { name:'FIBRA DE KEVLAR', icon:'▤', desc:'-6% de daño recibido por nivel.', cost:1, max:4, bonus:{ damageTaken:-.06 } },
    { name:'ESCUDO REACTOR', icon:'◈', desc:'Empiezas cada incursión con +30 de escudo.', cost:2, max:3, bonus:{ shield:30 } },
    { name:'CORAZÓN REACTOR', icon:'✚', desc:'+20 de escudo y regeneración continua de 1.5 por segundo.', cost:4, max:2, bonus:{ shield:20, regen:1.5 } },
    { name:'MUSCULATURA', icon:'»', desc:'+7% de velocidad de movimiento por nivel.', cost:1, max:4, bonus:{ speed:.07 } },
    { name:'PROPULSORES', icon:'⇉', desc:'-12% de recuperación del dash por nivel.', cost:2, max:3, bonus:{ dashRecovery:-.12 } },
    { name:'SUELO SEGURO', icon:'⤒', desc:'+1 salto extra en el aire por nivel.', cost:3, max:2, bonus:{ maxJumps:1 } },
    { name:'SEGUNDA PIEL', icon:'♥', desc:'+3 de vida recuperada por cada baja.', cost:4, max:3, bonus:{ lifeOnKill:3 } }
  ],
  system: [
    { name:'SOBRECARGA AMPLIFICADA', icon:'⚡', desc:'+20% de carga de sobrecarga por nivel.', cost:3, max:3, bonus:{ chargeMult:.2 } },
    { name:'DURACIÓN EXTENDIDA', icon:'◴', desc:'+1.5 s de duración de sobrecarga por nivel.', cost:2, max:3, bonus:{ overdrive:1.5 } },
    { name:'IMÁN DE CHIPS', icon:'◆', desc:'+50 chips de datos al empezar cada incursión.', cost:1, max:3, bonus:{ chips:50 } },
    { name:'EXTRACTOR AVANZADO', icon:'✧', desc:'+50% de chips de datos por baja.', cost:4, max:3, bonus:{ chipMult:.5 } },
    { name:'ECONOMÍA DE GUERRA', icon:'¤', desc:'+15% de puntos de clase al terminar la partida.', cost:1, max:3, bonus:{ creditGain:.15 } },
    { name:'RECONFIGURACIÓN', icon:'↻', desc:'+1 reconfiguración de mejora por partida.', cost:2, max:2, bonus:{ rerolls:1 } },
    { name:'INTERFERENCIA', icon:'✹', desc:'+1.5 s de frenesí por nivel.', cost:2, max:3, bonus:{ frenzyDuration:1.5 } },
    { name:'MASCOTA WRAITH', icon:'⋔', desc:'Empiezas cada incursión con un dron de escolta.', cost:5, max:1, bonus:{ companions:1 } }
  ]
};

// Flavor propio de cada operador sobre la base común.
const FLAVOR = {
  vanta: {},
  kira: {
    'power0': { name:'AGUJA DE FASE', desc:'Munición perforante de fase: +10% de daño y +10% de headshot por nivel.', bonus:{ damage:.1, headshot:.1 } },
    'power5': { name:'CRÍTICO LETAL', desc:'+20% de headshot por nivel.', bonus:{ headshot:.2 } },
    'body4': { name:'REFLEJO CERO', desc:'+10% de velocidad por nivel.', bonus:{ speed:.1 } },
    'body5': { name:'PASO FANTASMA', desc:'-16% de recuperación del dash por nivel.', bonus:{ dashRecovery:-.16 } },
    'system7': { name:'MODO FANTASMA', desc:'+2.5 s de frenesí.', bonus:{ frenzyDuration:2.5 } }
  },
  rook: {
    'power0': { name:'MARTILLO DE ASALTO', desc:'+15% de daño por nivel.', bonus:{ damage:.15 } },
    'power7': { name:'CAÑÓN DE ASALTO', desc:'+25% de daño por nivel.', bonus:{ damage:.25 } },
    'body0': { name:'BLINDAJE PESADO', desc:'+45 de vida máxima y -4% de daño recibido por nivel.', bonus:{ maxHp:45, damageTaken:-.04 } },
    'body3': { name:'PLACAS DE COMBATE', desc:'+30 de escudo y -5% de daño recibido por nivel.', bonus:{ shield:30, damageTaken:-.05 } },
    'system7': { name:'MUNICIÓN INFINITA', desc:'+20 de munición por cargador y +8 de escudo.', bonus:{ maxAmmo:20, shield:8 } }
  },
  // ---- segunda hornada: cada operador reescribe parte del árbol ------------
  nyx: {
    'power0': { name:'ARCO DERIVADO', desc:'+12% de daño y salta a un hostile más por nivel.', bonus:{ damage:.12 } },
    'power5': { name:'SALTO EN CADENA', desc:'+18% de daño por nivel.', bonus:{ damage:.18 } },
    'body4': { name:'PASO DE SOMBRA', desc:'+12% de velocidad por nivel.', bonus:{ speed:.12 } },
    'body5': { name:'ESCAPE', desc:'-18% de recuperación del dash por nivel.', bonus:{ dashRecovery:-.18 } },
    'system7': { name:'RED DE SEÑAL', desc:'+2 saltos de cadena y +1 de perforación.', bonus:{ frenzyDuration:1.5 } }
  },
  pyre: {
    'power0': { name:'MECHA', desc:'+10% de daño y la quemadura dura 1 s más por nivel.', bonus:{ damage:.1 } },
    'power7': { name:'COMBUSTIÓN', desc:'+22% de daño por nivel.', bonus:{ damage:.22 } },
    'body0': { name:'TRAE IGNÍFUGO', desc:'+30 de vida máxima y -3% de daño recibido por nivel.', bonus:{ maxHp:30, damageTaken:-.03 } },
    'body3': { name:'PIEL DE BRASA', desc:'+25 de escudo por nivel.', bonus:{ shield:25 } },
    'system7': { name:'LLAMA PERMANENTE', desc:'+2 s de frenesí y +10 de munición.', bonus:{ frenzyDuration:2, maxAmmo:10 } }
  },
  aegis: {
    'power0': { name:'PLACA OFENSIVA', desc:'+8% de daño por nivel.', bonus:{ damage:.08 } },
    'body0': { name:'MURALLA VIVA', desc:'+60 de vida máxima por nivel.', bonus:{ maxHp:60 } },
    'body3': { name:'BARRERA TOTAL', desc:'+45 de escudo y -3% de daño recibido por nivel.', bonus:{ shield:45, damageTaken:-.03 } },
    'body5': { name:'CONTRAPESO', desc:'-2% de daño recibido por nivel.', bonus:{ damageTaken:-.02 } },
    'system7': { name:'REDUNDANCIA', desc:'+40 de escudo y +2 de regeneración.', bonus:{ shield:40, regen:2 } }
  },
  glitch: {
    'power0': { name:'VARIANZA', desc:'+14% de daño por nivel.', bonus:{ damage:.14 } },
    'power5': { name:'DADO CARGADO', desc:'+25% de multiplicador de headshot por nivel.', bonus:{ headshot:.25 } },
    'power7': { name:'RUIDO BLANCO', desc:'+20% de daño por nivel.', bonus:{ damage:.2 } },
    'body0': { name:'INTEGRIDAD INESTABLE', desc:'+25 de vida máxima por nivel.', bonus:{ maxHp:25 } },
    'system7': { name:'BUCLE DE ERROR', desc:'+2.5 s de frenesí y +1 reconfiguración.', bonus:{ frenzyDuration:2.5 } }
  },
  seraph: {
    'power0': { name:'FUEGO DE COBERTURA', desc:'+9% de daño por nivel.', bonus:{ damage:.09 } },
    'power5': { name:'RÉPLICA', desc:'+15% de daño por nivel.', bonus:{ damage:.15 } },
    'body0': { name:'CONSTITUCIÓN', desc:'+35 de vida máxima por nivel.', bonus:{ maxHp:35 } },
    'body3': { name:'CAMPO DE CURA', desc:'+25 de escudo y +1 de regeneración por nivel.', bonus:{ shield:25, regen:1 } },
    'system7': { name:'CORO COMPLETO', desc:'+1 dron de escolta y +2 s de frenesí.', bonus:{ companions:1, frenzyDuration:2 } }
  },
  ronin: {
    'power0': { name:'FILO DE ACERO', desc:'+13% de daño por nivel.', bonus:{ damage:.13 } },
    'power7': { name:'CORTE PERFECTO', desc:'+24% de daño por nivel.', bonus:{ damage:.24 } },
    'body4': { name:'PASO DE ACERO', desc:'+13% de velocidad por nivel.', bonus:{ speed:.13 } },
    'body5': { name:'ESQUIVA', desc:'-20% de recuperación del dash por nivel.', bonus:{ dashRecovery:-.2 } },
    'system7': { name:'SEGUNDO AIRE', desc:'+2.5 s de frenesí.', bonus:{ frenzyDuration:2.5 } }
  },
  cipher: {
    'power0': { name:'MIRA LÁSER', desc:'+11% de daño por nivel.', bonus:{ damage:.11 } },
    'power5': { name:'PUNTO DÉBIL', desc:'+30% de multiplicador de headshot por nivel.', bonus:{ headshot:.3 } },
    'power7': { name:'PERFORANTE', desc:'+26% de daño por nivel.', bonus:{ damage:.26 } },
    'body0': { name:'PULSO FIRME', desc:'+20 de vida máxima por nivel.', bonus:{ maxHp:20 } },
    'system7': { name:'CARGADOR LARGO', desc:'+14 de munición por cargador.', bonus:{ maxAmmo:14 } }
  }
};

function buildTree(charId) {
  const nodes = [];
  const links = [];
  nodes.push({ id:'class', x:66, y:268, size:'class', icon:'◎', name:'CLASE', desc:'Núcleo de la interferencia. Siempre activo.', cost:0, max:1, bonus:{}, lane:'class' });
  for (const lane of LANES) {
    for (let i = 0; i < XS.length; i++) {
      const id = lane.id + i;
      const base = BASE[lane.id][i];
      const over = (FLAVOR[charId] || {})[id] || {};
      nodes.push({
        id, x: XS[i], y: lane.y + JY[i], size: KEY_SLOTS.includes(i) ? 'key' : 'small',
        icon: over.icon || base.icon,
        name: over.name || base.name, desc: over.desc || base.desc,
        cost: over.cost || base.cost, max: over.max || base.max,
        bonus: over.bonus || base.bonus, lane: lane.id
      });
    }
    links.push({ from:'class', to: lane.id + '0' });
    for (let i = 1; i < XS.length; i++) links.push({ from: lane.id + (i - 1), to: lane.id + i });
  }
  // Conexiones cruzadas: algunos nodos exigen dos predecesores.
  const cross = [['power2','body1'], ['body2','system1'], ['power4','body4'], ['system4','body5'], ['power6','body6'], ['body6','system6'], ['power5','body5']];
  cross.forEach(([a, b]) => links.push({ from:a, to:b, cross:true }));
  return { nodes, links };
}

const DEFAULT_BONUS = {
  damage:1, maxHp:0, speed:1, fireRate:1, maxAmmo:0, damageTaken:1, headshot:0,
  chargeMult:1, dashRecovery:1, shield:0, regen:0, maxJumps:1, companions:0,
  chips:0, chipMult:1, creditGain:1, rerolls:0, lifeOnKill:0, overdrive:0,
  pierce:0, frenzyDuration:0, jump:0, grenade:0
};

// El códice guarda lo que el jugador ha VISTO: hostiles, jefes, habilidades,
// armas y cuerpo a cuerpo. Los logros son acumulativos y locales.
function blank() {
  return {
    credits: 0, chars: {}, best: {}, totals: { runs: 0, kills: 0 },
    codex: { enemies: {}, bosses: {}, abilities: {}, weapons: {}, melee: {}, utility: {}, synergies: {} },
    achievements: {},
    telemetry: { damageDealt: 0, damageTaken: 0, shots: 0, hits: 0, headshots: 0, time: 0, deaths: 0, rounds: 0 },
    daily: { day: '', best: 0, played: 0 }
  };
}
let data = blank();

export function loadMeta() {
  try {
    const raw = localStorage.getItem(KEY);
    data = raw ? { ...blank(), ...JSON.parse(raw) } : blank();
    data.chars = data.chars || {}; data.best = data.best || {}; data.totals = data.totals || { runs: 0, kills: 0 };
    data.codex = { ...blank().codex, ...(data.codex || {}) };
    for (const k of Object.keys(blank().codex)) data.codex[k] = data.codex[k] || {};
    data.achievements = data.achievements || {};
    data.telemetry = { ...blank().telemetry, ...(data.telemetry || {}) };
    data.daily = { ...blank().daily, ...(data.daily || {}) };
  } catch (e) { data = blank(); }
  return data;
}
export function saveMeta() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { } }
export function getMeta() { return data; }
export function getCredits() { return data.credits; }
export function addCredits(amount) { data.credits += Math.max(0, Math.round(amount)); saveMeta(); return data.credits; }
export function nodeLevels(charId) { return data.chars[charId] || (data.chars[charId] = {}); }
export function nodeLevel(charId, nodeId) { return nodeLevels(charId)[nodeId] || 0; }
export function findNode(charId, nodeId) { return buildTree(charId).nodes.find(n => n.id === nodeId); }

export function nodeState(charId, nodeId) {
  const tree = buildTree(charId);
  const node = tree.nodes.find(n => n.id === nodeId);
  if (!node) return 'locked';
  if (node.id === 'class') return 'owned';
  const level = nodeLevel(charId, nodeId);
  if (level >= node.max) return 'maxed';
  const parents = tree.links.filter(l => l.to === nodeId).map(l => l.from);
  const open = parents.some(p => p === 'class' || nodeLevel(charId, p) > 0);
  if (!open) return 'locked';
  return data.credits >= node.cost ? 'ready' : 'poor';
}
export function canBuy(charId, nodeId) { return nodeState(charId, nodeId) === 'ready'; }
export function buyNode(charId, nodeId) {
  if (!canBuy(charId, nodeId)) return false;
  const node = findNode(charId, nodeId);
  data.credits -= node.cost;
  nodeLevels(charId)[nodeId] = (nodeLevels(charId)[nodeId] || 0) + 1;
  saveMeta();
  return true;
}
export function respec(charId) {
  const levels = nodeLevels(charId); let refund = 0;
  for (const node of buildTree(charId).nodes) {
    const l = levels[node.id] || 0; if (!l) continue;
    refund += Math.floor(node.cost * l * 0.8); delete levels[node.id];
  }
  data.credits += refund; saveMeta(); return refund;
}
export function getBonuses(charId) {
  const out = { ...DEFAULT_BONUS };
  const levels = nodeLevels(charId);
  for (const node of buildTree(charId).nodes) {
    const l = levels[node.id] || 0; if (!l) continue;
    for (const key in node.bonus) out[key] += node.bonus[key] * l;
  }
  out.damageTaken = Math.max(.35, out.damageTaken);
  out.fireRate = Math.max(.4, out.fireRate);
  out.dashRecovery = Math.max(.35, out.dashRecovery);
  return out;
}
export function creditReward(wave, score, kills, chips) {
  const base = wave * 3 + score / 1200 + kills / 8 + chips / 25;
  return Math.max(1, Math.floor(base));
}
export function recordRun(charId, score, wave, kills) {
  data.totals.runs += 1; data.totals.kills += kills;
  const b = data.best[charId] || { score: 0, wave: 0 };
  data.best[charId] = { score: Math.max(b.score, Math.round(score)), wave: Math.max(b.wave, wave) };
  saveMeta();
}
export function bestOf(charId) { return data.best[charId] || { score: 0, wave: 0 }; }
export function ownedCount(charId) { const l = nodeLevels(charId); return Object.values(l).filter(v => v > 0).length; }

// ---------------------------------------------------------------- códice
// markSeen escribe una entrada del códice. Devuelve true si es la PRIMERA vez
// que se ve (para poder anunciar "NUEVO REGISTRO" en el HUD).
export function markSeen(group, id, extra) {
  if (!id) return false;
  const bag = data.codex[group] || (data.codex[group] = {});
  if (bag[id]) {
    // El contador de avistamientos no escribe en disco: evita un guardado por
    // cada hostile que aparece. Solo las bajas nuevas actualizan y guardan.
    if (extra && extra.kills) { bag[id].kills = (bag[id].kills || 0) + extra.kills; saveMeta(); }
    return false;
  }
  bag[id] = { first: Date.now(), seen: 1, kills: (extra && extra.kills) || 0, wave: (extra && extra.wave) || 0 };
  saveMeta();
  return true;
}
export function seen(group, id) { return !!(data.codex[group] || {})[id]; }
export function getCodex() { return data.codex; }
export function codexCount() {
  const c = data.codex; let n = 0, total = 0;
  for (const g of ['enemies', 'bosses', 'abilities', 'weapons', 'melee', 'utility', 'synergies']) {
    n += Object.keys(c[g] || {}).length;
  }
  return { unlocked: n };
}
export function codexProgress(groups) {
  const c = data.codex;
  return groups.map(g => ({ group: g, count: Object.keys(c[g] || {}).length }));
}
export function resetCodex() { data.codex = blank().codex; saveMeta(); }

// ---------------------------------------------------------------- logros
export function hasAchievement(id) { return !!data.achievements[id]; }
export function grantAchievement(id) {
  if (data.achievements[id]) return false;
  data.achievements[id] = Date.now(); saveMeta(); return true;
}
export function getAchievements() { return data.achievements; }
export function achievementCount() { return Object.keys(data.achievements).length; }

// ---------------------------------------------------------------- telemetría
// Panel de balance: métricas locales para afinar el juego sin servidores.
export function addTelemetry(patch) {
  const t = data.telemetry;
  for (const k in patch) t[k] = (t[k] || 0) + patch[k];
  saveMeta();
}
export function getTelemetry() { return data.telemetry; }
export function telemetrySummary() {
  const t = data.telemetry;
  const acc = t.shots > 0 ? (t.hits / t.shots) * 100 : 0;
  const hs = t.hits > 0 ? (t.headshots / t.hits) * 100 : 0;
  const mins = t.time / 60;
  return {
    precision: +acc.toFixed(1),
    headshotRate: +hs.toFixed(1),
    dpm: mins > 0 ? Math.round(t.damageDealt / mins) : 0,
    takenPerMin: mins > 0 ? +(t.damageTaken / mins).toFixed(1) : 0,
    runs: t.runs || data.totals.runs,
    deaths: t.deaths,
    rounds: t.rounds,
    shots: t.shots, hits: t.hits, headshots: t.headshots
  };
}
export function resetTelemetry() { data.telemetry = blank().telemetry; saveMeta(); }

// ---------------------------------------------------------------- semilla diaria
// Una semilla por día: todos los jugadores locales comparten el mismo mapa y
// orden de botín. La clasificación es local (guardada en el disco).
export function dailyKey(date = new Date()) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}
export function dailySeed(date = new Date()) {
  const k = dailyKey(date);
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 2147483646 || 1;
}
export function dailyInfo() {
  const k = dailyKey();
  if (data.daily.day !== k) { data.daily = { day: k, best: 0, played: 0 }; saveMeta(); }
  return { ...data.daily, seed: dailySeed() };
}
export function submitDaily(score) {
  const d = dailyInfo();
  d.played += 1;
  if (score > d.best) d.best = Math.round(score);
  data.daily = { day: d.day, best: d.best, played: d.played };
  saveMeta();
  return data.daily;
}

// ---------------------------------------------------------------- clasificación local
const LB_KEY = 'nr-leaderboard-v1';
export function getLeaderboard() {
  try { return JSON.parse(localStorage.getItem(LB_KEY) || '[]'); } catch (e) { return []; }
}
export function submitScore(entry) {
  const list = getLeaderboard();
  list.push({ ...entry, at: Date.now() });
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 10);
  try { localStorage.setItem(LB_KEY, JSON.stringify(top)); } catch (e) { }
  return top;
}
export function clearLeaderboard() { try { localStorage.removeItem(LB_KEY); } catch (e) { } }

// ---------------------------------------------------------------- grafo
export function renderGraph(charId, host, onChange) {
  const tree = buildTree(charId);
  host.innerHTML = '';
  const canvas = document.createElement('div');
  canvas.className = 'tree-canvas';
  const inner = document.createElement('div');
  inner.className = 'tree-inner';
  inner.style.width = CANVAS_W + 'px';
  inner.style.height = CANVAS_H + 'px';

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'tree-links');
  svg.setAttribute('viewBox', `0 0 ${CANVAS_W} ${CANVAS_H}`);
  svg.setAttribute('width', CANVAS_W);
  svg.setAttribute('height', CANVAS_H);

  // retícula de fondo + bandas de carril + etiquetas de carril
  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `<pattern id="nrGrid" width="52" height="52" patternUnits="userSpaceOnUse">
      <path d="M52 0H0V52" fill="none" stroke="#ffffff" stroke-opacity=".045" stroke-width="1"/>
    </pattern>
    <radialGradient id="nrCore" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffd34d" stop-opacity=".22"/>
      <stop offset="100%" stop-color="#ffd34d" stop-opacity="0"/>
    </radialGradient>`;
  svg.appendChild(defs);
  const gridRect = document.createElementNS(NS, 'rect');
  gridRect.setAttribute('width', CANVAS_W); gridRect.setAttribute('height', CANVAS_H);
  gridRect.setAttribute('fill', 'url(#nrGrid)');
  svg.appendChild(gridRect);
  const coreGlow = document.createElementNS(NS, 'rect');
  coreGlow.setAttribute('width', CANVAS_W); coreGlow.setAttribute('height', CANVAS_H);
  coreGlow.setAttribute('fill', 'url(#nrCore)');
  coreGlow.setAttribute('opacity', '.5');
  svg.appendChild(coreGlow);
  for (const lane of LANES) {
    const band = document.createElementNS(NS, 'rect');
    band.setAttribute('x', 108); band.setAttribute('y', lane.y - 54);
    band.setAttribute('width', CANVAS_W - 124); band.setAttribute('height', 108);
    band.setAttribute('rx', 8);
    band.setAttribute('fill', lane.color); band.setAttribute('opacity', '.04');
    band.setAttribute('stroke', lane.color); band.setAttribute('stroke-opacity', '.14');
    svg.appendChild(band);
    const lab = document.createElementNS(NS, 'text');
    lab.setAttribute('x', 116); lab.setAttribute('y', lane.y - 60);
    lab.setAttribute('fill', lane.color); lab.setAttribute('opacity', '.9');
    lab.setAttribute('font-family', 'Consolas, monospace');
    lab.setAttribute('font-size', '14'); lab.setAttribute('letter-spacing', '5');
    lab.textContent = lane.label;
    svg.appendChild(lab);
    const lab2 = document.createElementNS(NS, 'text');
    lab2.setAttribute('x', 116); lab2.setAttribute('y', lane.y + 64);
    lab2.setAttribute('fill', '#6b777a'); lab2.setAttribute('opacity', '.75');
    lab2.setAttribute('font-family', 'Consolas, monospace');
    lab2.setAttribute('font-size', '10'); lab2.setAttribute('letter-spacing', '3');
    lab2.textContent = 'CARRIL ' + (LANES.indexOf(lane) + 1);
    svg.appendChild(lab2);
  }

  const byId = {};
  tree.nodes.forEach(n => byId[n.id] = n);
  const linkEls = [];
  tree.links.forEach(link => {
    const a = byId[link.from], b = byId[link.to];
    if (!a || !b) return;
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    if (link.cross) line.setAttribute('class', 'cross');
    svg.appendChild(line);
    linkEls.push({ el: line, link });
  });
  inner.appendChild(svg);

  const nodeEls = [];
  tree.nodes.forEach(node => {
    const el = document.createElement('button');
    el.className = 'gnode ' + node.size;
    el.dataset.node = node.id;
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';
    el.innerHTML = `<span class="glyph">${node.icon}</span><span class="gname">${node.name}</span><span class="glevel"></span>`;
    el.title = node.name;
    inner.appendChild(el);
    nodeEls.push({ el, node });
  });

  canvas.appendChild(inner);

  const tooltip = document.createElement('div');
  tooltip.className = 'node-tip';
  canvas.appendChild(tooltip);

  host.appendChild(canvas);

  const stateOf = (id) => nodeState(charId, id);
  function refresh() {
    nodeEls.forEach(({ el, node }) => {
      const st = stateOf(node.id);
      el.classList.remove('owned', 'ready', 'locked', 'poor', 'maxed');
      el.classList.add(st);
      const lvl = nodeLevel(charId, node.id);
      el.querySelector('.glevel').textContent = node.size === 'class' ? 'CLASE' : `${lvl}/${node.max}`;
      if (node.size === 'class') el.querySelector('.glevel').textContent = '';
    });
    linkEls.forEach(({ el, link }) => {
      const st = stateOf(link.to);
      el.setAttribute('class', st === 'owned' || st === 'maxed' ? 'on' : (st === 'ready' || st === 'poor' ? 'open' : 'off'));
    });
  }

  nodeEls.forEach(({ el, node }) => {
    el.addEventListener('mouseenter', () => {
      const lvl = nodeLevel(charId, node.id);
      tooltip.innerHTML = `<b>${node.name}</b><span>${node.desc}</span><i>${node.size === 'class' ? 'NÚCLEO DE CLASE' : `NIVEL ${lvl}/${node.max} · COSTE ${node.cost} PUNTOS`}</i>`;
      tooltip.classList.add('show');
    });
    el.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 16) + 'px';
      tooltip.style.top = (e.clientY - rect.top + 12) + 'px';
    });
    el.addEventListener('mouseleave', () => tooltip.classList.remove('show'));
    el.addEventListener('click', () => {
      if (buyNode(charId, node.id)) { refresh(); onChange?.(); }
    });
  });

  // pan / zoom
  let scale = .82, panX = 10, panY = 10, dragging = false, lastX = 0, lastY = 0, userMoved = false;
  function applyTransform() {
    inner.style.transform = `translate(${panX}px,${panY}px) scale(${scale})`;
  }
  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const s = Math.min(w / CANVAS_W, h / CANVAS_H) * .98;
    scale = Math.min(1.15, Math.max(.28, s));
    panX = (w - CANVAS_W * scale) / 2;
    panY = (h - CANVAS_H * scale) / 2;
    applyTransform();
  }
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    userMoved = true;
    scale = Math.min(1.6, Math.max(.28, scale - e.deltaY * .0012));
    applyTransform();
  }, { passive: false });
  canvas.addEventListener('pointerdown', e => {
    if (e.target.closest('.gnode')) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.classList.add('grabbing');
  });
  addEventListener('pointermove', e => {
    if (!dragging) return;
    userMoved = true;
    panX += e.clientX - lastX; panY += e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
    applyTransform();
  });
  addEventListener('pointerup', () => { dragging = false; canvas.classList.remove('grabbing'); });

  function setSearch(term) {
    const q = (term || '').trim().toLowerCase();
    nodeEls.forEach(({ el, node }) => {
      const match = !q || node.name.toLowerCase().includes(q) || node.desc.toLowerCase().includes(q);
      el.classList.toggle('dimmed', !!q && !match);
      el.classList.toggle('matched', !!q && match);
    });
  }
  function setNames(on) { canvas.classList.toggle('show-names', !!on); }

  refresh(); fit();
  requestAnimationFrame(fit);
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => { if (!userMoved) fit(); });
    ro.observe(canvas);
  }
  return {
    refresh,
    setSearch,
    setNames,
    fit: () => { userMoved = false; fit(); },
    auto: () => { if (!userMoved) fit(); }
  };
}
export { KEY as META_KEY };
