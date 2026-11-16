// NEON//REVENANT — ÉLITES EXCLUSIVOS POR BIOMA (Fase 2)
// ---------------------------------------------------------------------------
// Un élite por mundo. No son tipos nuevos de IA: se enganchan a un hostil
// normal mediante `e.eliteKind`, así heredan colisiones, daño, afijos, botín y
// código de oleada sin duplicar nada. Cada uno usa sprites de
// assets/vfx/particles y sonidos de assets/audio (Kenney), nunca inventados.
//
// `api` lo inyecta game.js para no acoplar este módulo al estado global:
//   { THREE, emit, sfx, hurt, slowPlayer, hazard, explode, damageEnemy,
//     createEnemy, announce, spawnBurst, player, enemies, state, rnd, faction }

export const ELITE_DEFS = {
  chaman_bosque: {
    name: 'Chamán del Bosque', world: 'world1_nature', period: 6,
    sprite: 'magic_03.png', color: 0x8ce87a, sound: 'scifi/forceField_000.ogg'
  },
  lanzador_escarcha: {
    name: 'Lanzador de Escarcha', world: 'world2_snow', period: 3.2,
    sprite: 'magic_03.png', color: 0xa9e6ff, sound: 'scifi/laserSmall_000.ogg'
  },
  juguete_kamikaze: {
    name: 'Juguete Kamikaze', world: 'world3_shop', period: 1.0,
    sprite: 'circle_05.png', color: 0xff5a4a, sound: 'scifi/explosionCrunch_000.ogg'
  },
  zombi_toxico: {
    name: 'Zombi Tóxico', world: 'world4_suburban', period: 0,
    sprite: 'smoke_07.png', color: 0x8dff4a, sound: 'scifi/slime_000.ogg'
  },
  dron_escudero: {
    name: 'Dron Escudero', world: 'world5_station', period: .35,
    sprite: 'circle_05.png', color: 0x5fb8ff, sound: 'scifi/forceField_000.ogg'
  },
  parasito_divisible: {
    name: 'Parásito Divisible', world: 'world6_space', period: 0,
    sprite: 'smoke_07.png', color: 0xc07dff, sound: 'scifi/slime_000.ogg'
  },
  nigromante_real: {
    name: 'Nigromante Real', world: 'world7_hexagon', period: 7,
    sprite: 'circle_05.png', color: 0xb56bff, sound: 'rpg/bookFlip1.ogg'
  }
};

const diag = { ticks: 0, abilities: 0, byId: {}, deaths: 0, summons: 0, splits: 0 };
function bump(id) { diag.abilities++; diag.byId[id] = (diag.byId[id] || 0) + 1; }
export function eliteDiagnostics() { return { ...diag, byId: { ...diag.byId } }; }
export function resetEliteDiagnostics() {
  diag.ticks = 0; diag.abilities = 0; diag.byId = {};
  diag.deaths = 0; diag.summons = 0; diag.splits = 0;
}

const at = (api, e, h = 1.2) => e.group.position.clone().add(new api.THREE.Vector3(0, h, 0));
const distTo = (e, api) => e.group.position.distanceTo(api.player.position);

function nearby(api, e, radius) {
  const out = [];
  for (const o of api.enemies) {
    if (o.dead || o.spawn > 0 || o === e || o.type === 'boss') continue;
    if (o.group.position.distanceTo(e.group.position) <= radius) out.push(o);
  }
  return out;
}

/** Llamado una vez por frame desde updateEnemies(). */
export function tickWorldElite(e, dt, api) {
  if (!e || e.dead || !e.eliteKind) return;
  diag.ticks++;
  const def = ELITE_DEFS[e.eliteKind];
  if (!def) return;
  const id = e.eliteKind;

  // --- Kamikaze: telegrafía 1 s con círculo rojo y parpadeo, luego explota -
  if (id === 'juguete_kamikaze') {
    if (e.kamiT === undefined) e.kamiT = -1;
    if (e.kamiT < 0) {
      if (distTo(e, api) < 4.2) {
        e.kamiT = 1.0;
        api.emit('circle_05.png', e.group.position.clone().setY(.08),
          { count: 3, color: 0xff5a4a, size: 2.6, life: 1.0, speed: .1, spread: 0 });
        api.sfx('scifi/forceField_000.ogg', { volume: .4 });
        bump(id);
      }
    } else {
      e.kamiT -= dt;
      e.blinkT = (e.blinkT || 0) - dt;
      if (e.blinkT <= 0) { e.blinkT = .12; e.creature?.hit(); }
      if (e.kamiT <= 0) {
        const pos = e.group.position.clone();
        api.explode(pos.clone().add(new api.THREE.Vector3(0, 1, 0)), 4.4,
          42 * (e.dmgMult || 1), 0xff7a4a);
        api.emit('smoke_07.png', pos.clone().setY(1),
          { count: 14, color: 0xff8a5a, size: 1.1, life: .7, speed: 5, spread: 5 });
        api.sfx(def.sound, { volume: .6, pitch: .8 });
        api.damageEnemy(e, 99999, false);   // se autodestruye: killEnemy -> onDeath
      }
    }
    return;
  }

  // --- Dron Escudero: aura continua de reducción de daño -------------------
  if (id === 'dron_escudero') {
    e.eliteT = (e.eliteT ?? def.period) - dt;
    if (e.eliteT <= 0) {
      e.eliteT = def.period;
      const allies = nearby(api, e, 8.5);
      for (const o of allies) o.shieldGuard = .55;   // se resetea cada frame en game.js
      api.emit('circle_05.png', e.group.position.clone().setY(.12),
        { count: 2, color: def.color, size: 5.2, life: .5, speed: .05, spread: 0 });
      if (!e.auraSfx || e.auraSfx <= 0) { api.sfx(def.sound, { volume: .22 }); e.auraSfx = 3.5; }
      bump(id);
    }
    e.auraSfx = Math.max(0, (e.auraSfx || 0) - dt);
    return;
  }

  if (!def.period) return;   // zombi tóxico y parásito solo actúan al morir
  e.eliteT = (e.eliteT ?? def.period * (.5 + api.rnd() * .5)) - dt;
  if (e.eliteT > 0) return;
  e.eliteT = def.period;

  if (id === 'chaman_bosque') {
    // Cura 14% y acelera 25% durante 3 s a los aliados cercanos.
    let healed = 0;
    for (const o of nearby(api, e, 12)) {
      if (o.hp < o.maxHp) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * .14); healed++; }
      o.baseSpeed = o.baseSpeed || o.speed;
      o.speed = o.baseSpeed * 1.25;
      o.boostT = 3;
    }
    api.emit(def.sprite, at(api, e, 1.6),
      { count: 18, color: def.color, size: .7, life: .8, speed: 3.4, spread: 3 });
    api.sfx(def.sound, { volume: .38 });
    bump(id);
    if (healed) api.announce('CHAMÁN // ' + healed + ' ALIADOS REGENERADOS');
  } else if (id === 'lanzador_escarcha') {
    // Proyectil azul claro que ralentiza al jugador 2 s.
    if (distTo(e, api) > 27) return;
    const from = at(api, e, 1.4);
    const dir = api.player.position.clone().sub(from).normalize();
    api.emit(def.sprite, from, { count: 16, color: def.color, size: .55,
      life: .55, speed: 13, spread: .5, dir, gravity: -1 });
    api.slowPlayer(2, .55);
    api.sfx(def.sound, { volume: .4 });
    api.hurt(5 * (e.dmgMult || 1), 'escarcha');
    bump(id);
  } else if (id === 'nigromante_real') {
    // Invoca 2 esqueletos cada 7 s con círculo púrpura.
    api.emit(def.sprite, e.group.position.clone().setY(.1),
      { count: 4, color: def.color, size: 2.4, life: .9, speed: .2, spread: .2 });
    for (let i = 0; i < 2; i++) {
      const a = api.rnd() * Math.PI * 2, r = 3 + api.rnd() * 2;
      const spawned = api.createEnemy('chaser',
        e.group.position.x + Math.cos(a) * r,
        e.group.position.z + Math.sin(a) * r, false, api.faction);
      if (spawned) { diag.summons++; spawned.eliteSummoned = true; }
    }
    api.sfx(def.sound, { volume: .4 });
    bump(id);
    api.announce('NIGROMANTE // INVOCA ESQUELETOS');
  }
}

/** Llamado desde killEnemy(), antes de retirar el grupo de la escena. */
export function onWorldEliteDeath(e, api) {
  if (!e || !e.eliteKind) return;
  diag.deaths++;
  const def = ELITE_DEFS[e.eliteKind];
  if (!def) return;
  const pos = e.group.position.clone();

  if (e.eliteKind === 'zombi_toxico') {
    // Charco ácido verde 4 s.
    api.hazard(pos.clone(), 'acid', { radius: 3.4, life: 4, dmg: 9 * (e.dmgMult || 1), color: 0x8dff4a });
    api.emit(def.sprite, pos.clone().setY(.5),
      { count: 22, color: def.color, size: 1.3, life: 1.2, speed: 2.2, spread: 3, gravity: -1 });
    api.sfx(def.sound, { volume: .5 });
    bump(e.eliteKind);
  } else if (e.eliteKind === 'parasito_divisible') {
    // Se divide en 2 mini-alienígenas rápidos.
    api.emit(def.sprite, pos.clone().setY(1),
      { count: 16, color: def.color, size: .9, life: .7, speed: 4, spread: 4 });
    for (let i = 0; i < 2; i++) {
      const a = api.rnd() * Math.PI * 2;
      const mini = api.createEnemy('swarmling',
        pos.x + Math.cos(a) * 1.8, pos.z + Math.sin(a) * 1.8, false, api.faction);
      if (mini) {
        mini.baseSpeed = mini.speed;
        mini.speed *= 1.3;
        mini.hp = mini.maxHp = Math.max(24, mini.maxHp * .55);
        mini.eliteKind = null;
        diag.splits++;
      }
    }
    api.sfx(def.sound, { volume: .5 });
    bump(e.eliteKind);
  } else if (e.eliteKind === 'juguete_kamikaze') {
    api.emit(def.sprite, pos.clone().setY(.1),
      { count: 8, color: def.color, size: 1.8, life: .45, speed: 1, spread: 1 });
  }
}

export function eliteIds() { return Object.keys(ELITE_DEFS); }
