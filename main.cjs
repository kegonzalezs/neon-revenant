const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const os = require('node:os');

// Los modos de automatización usan un userData propio: así --smoke-test y
// compañía no chocan con el bloqueo de instancia única de una partida abierta
// (antes un segundo lanzamiento salía sin hacer nada y parecía un test OK),
// y además no tocan la partida guardada del jugador.
const AUTOMATION_FLAGS = ['--smoke-test', '--showcase', '--characters', '--nature', '--weapons', '--worlds'];
if (process.argv.some(a => AUTOMATION_FLAGS.includes(a))) {
  app.setPath('userData', path.join(os.tmpdir(), 'neon-revenant-automation'));
}

// Keep window compositing in software for compatibility, but render WebGL on the real GPU.
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('use-angle', 'd3d11');
app.commandLine.appendSwitch('force-high-performance-gpu');

let mainWindow;

// Cualquier excepción no capturada en el renderer invalida TODOS los modos de
// automatización (y también una partida normal): el proceso termina con código
// de error aunque el test siga imprimiendo sus resultados. Antes una llamada a
// una propiedad eliminada del arsenal antiguo solo se veía al pulsar TAB en una
// partida real, porque los smoke tests nunca abrían el resumen de build.
const runtimeErrors = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#06080b',
    title: 'NEON//REVENANT',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('NEON_REVENANT_READY');
    mainWindow.show();
  });
  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    console.error(`Load failed (${code}): ${description}`);
    setTimeout(() => mainWindow?.webContents.reload(), 500);
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`Renderer stopped: ${details.reason}`);
    if (mainWindow) mainWindow.webContents.reload();
  });
  mainWindow.webContents.on('console-message', (event) => {
    if (event.message?.startsWith('GPU_RENDERER:') || event.message?.startsWith('RUNTIME_') ||
        event.message?.startsWith('GLTF_') || event.message?.startsWith('GLB_') ||
        event.message?.startsWith('NATURE_') || event.message?.startsWith('COMBAT_') ||
        event.message?.startsWith('WEAPON_') || event.message?.startsWith('VFX_') ||
        event.message?.startsWith('SFX_') || event.message?.startsWith('WORLD_')) console.log(event.message);
    if (event.message?.startsWith('RUNTIME_ERROR:')) {
      runtimeErrors.push(event.message);
      process.exitCode = 1;
      console.log('RUNTIME_ASSERT_FAIL: ' + event.message);
    }
    if (event.level === 'error' || event.level >= 2) console.error(`[renderer] ${event.message}`);
  });
  if (process.argv.includes('--smoke-test')) {
    const step = async (name, code) => {
      console.log('STEP ' + name);
      try { return await mainWindow.webContents.executeJavaScript(code); }
      catch (e) { console.log('STEP_FAIL ' + name + ' :: ' + e.message); throw e; }
    };
    mainWindow.webContents.once('did-finish-load', async () => {
      await new Promise((resolve) => setTimeout(resolve, 2200));
      const menuImage = await mainWindow.webContents.capturePage();
      require('node:fs').writeFileSync(path.join(__dirname, 'menu-smoke.png'), menuImage.toPNG());
      await step("open-hub", "document.getElementById('start-btn').click()");
      await new Promise((resolve) => setTimeout(resolve, 700));
      const hubImage = await mainWindow.webContents.capturePage();
      require('node:fs').writeFileSync(path.join(__dirname, 'hub-operator-smoke.png'), hubImage.toPNG());
      // hub: operador -> sector -> pestaña de habilidades
      await step("pick-operator-sector", "window.__NR_SMOKE=true;document.querySelector('[data-character=kira]').click();document.querySelector('[data-level=docks]').click();document.querySelector('[data-tab=sector]').click()");
      await new Promise((resolve) => setTimeout(resolve, 500));
      const sectorImage = await mainWindow.webContents.capturePage();
      require('node:fs').writeFileSync(path.join(__dirname, 'hub-sector-smoke.png'), sectorImage.toPNG());
      await step("skills-tab", "document.querySelector('[data-tab=skills]').click()");
      await new Promise((resolve) => setTimeout(resolve, 600));
      const skillsImage = await mainWindow.webContents.capturePage();
      require('node:fs').writeFileSync(path.join(__dirname, 'hub-skills-smoke.png'), skillsImage.toPNG());
      const treeTest = await step('tree', `(async()=>{
        const meta = await import('./src/meta.js');
        meta.addCredits(60);
        document.querySelector('[data-tab=operator]').click();
        document.querySelector('[data-tab=skills]').click();
        await new Promise(r=>setTimeout(r,300));
        const host = document.getElementById('hub-tree');
        const nodes = document.querySelectorAll('[data-node]').length;
        const ready = document.querySelectorAll('.gnode.ready').length;
        const locked = document.querySelectorAll('.gnode.locked').length;
        if (nodes) document.querySelector('[data-node]').click();
        await new Promise(r=>setTimeout(r,200));
        return {nodes, ready, locked, hostHtml:host.innerHTML.length, treeErr:window.__NR_TREE_ERROR||null,
                owned:document.querySelectorAll('.gnode.owned,.gnode.maxed').length,
                credits:document.getElementById('skill-credits').textContent};
      })()`);
      console.log('TREE_TEST:', JSON.stringify(treeTest));
      const hubTest = await mainWindow.webContents.executeJavaScript(`(async()=>{
        document.querySelector('[data-tab=dossier]').click();
        await new Promise(r=>setTimeout(r,300));
        const diffs = document.querySelectorAll('[data-diff]').length;
        document.querySelector('[data-diff=elite]').click();
        await new Promise(r=>setTimeout(r,200));
        const elite = document.getElementById('hub-summary').textContent;
        document.querySelector('[data-diff=recruit]').click();
        await new Promise(r=>setTimeout(r,200));
        return {diffs, elite, summary:document.getElementById('hub-summary').textContent, points:document.getElementById('hub-points').textContent};
      })()`);
      console.log('HUB_TEST:', JSON.stringify(hubTest));
      await step("deploy", "document.getElementById('hub-deploy').click()");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      // Verificación del cargador GLB: clips embebidos, escala y texturas.
      console.log('GLB_TEST:', JSON.stringify(await mainWindow.webContents.executeJavaScript(
        "window.__NR_GLB_STATUS || {ok:false,error:'sin estado'}"
      )));
      // Arsenal único: cinco GLB, sprites Kenney, bancos de audio y pools.
      console.log('COMBAT_TEST:', JSON.stringify(await mainWindow.webContents.executeJavaScript(
        "(async()=>{const m=await import('./src/game.js');return m.testCombat();})()"
      )));
      console.log('PROJECTILE_TEST:', JSON.stringify(await mainWindow.webContents.executeJavaScript(
        "(async()=>{const m=await import('./src/game.js');return m.testProjectileHit();})()"
      )));
      const image = await mainWindow.webContents.capturePage();
      require('node:fs').writeFileSync(path.join(__dirname, 'gameplay-smoke.png'), image.toPNG());

      // salto y ATAQUE PRIMARIO con clic real (F y E ya no existen)
      const moveTest = await mainWindow.webContents.executeJavaScript(`(async()=>{
        const m = await import('./src/game.js');
        m.testGrantWeapon();
        const before = m.getState();
        dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}));
        await new Promise(r=>setTimeout(r,200));
        const air = m.getState();
        dispatchEvent(new KeyboardEvent('keyup',{code:'Space'}));
        await new Promise(r=>setTimeout(r,900));
        const landed = m.getState();
        // El clic debe permanecer pulsado al menos un frame: updatePlayer()
        // consulta mouseDown en el bucle de render, no en el evento.
        const click = async () => {
          dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true}));
          await new Promise(r=>setTimeout(r,90));
          dispatchEvent(new MouseEvent('mouseup',{button:0,bubbles:true}));
        };
        await click();
        await new Promise(r=>setTimeout(r,420)); // > enfriamiento melé (.36 s)
        const attack1 = m.getState();
        const weapon1 = document.getElementById('weapon-name').textContent.slice(0,22);
        await click();
        await new Promise(r=>setTimeout(r,160));
        const attack2 = m.getState();
        const weapon2 = document.getElementById('weapon-name').textContent.slice(0,22);
        return {mode:before.mode, jumpFrom:before.py, jumpUp:air.py, jumpVy:air.vy, jumpsAfter:air.jumps,
                landedPy:landed.py, landedJumps:landed.jumps, weapons:m.getState().weapons,
                weapon1, weapon2, attack:attack2.attack,
                shots1:attack1.shotCount, shots2:attack2.shotCount,
                melee1:attack1.meleeSeq, melee2:attack2.meleeSeq};
      })()`);
      console.log('MOVE_TEST:', JSON.stringify(moveTest));
      // Regresión de animación: el idle no debe derivar (temblor de cabeza/
      // brazos) y el salto debe recorrer despegue -> caída -> aterrizaje.
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log('ANIM_TEST:', JSON.stringify(await mainWindow.webContents.executeJavaScript(
        "window.__NR_GLB_DIAG || {error:'sin diagnóstico'}"
      )));

      // Resumen de build (TAB): se abre con el evento de teclado REAL, se
      // comprueba que las cuatro ranuras se renderizan sin campos eliminados y
      // se cierra de nuevo. Así se detecta cualquier referencia a catálogos
      // viejos que node --check no puede ver (p. ej. melee.special.name).
      const buildSumTest = await step('build-summary', `(async()=>{
        const key = code => dispatchEvent(new KeyboardEvent('keydown',{code,key:code,bubbles:true}));
        const panel = document.getElementById('buildsum');
        const body = document.getElementById('buildsum-body');
        key('Tab');
        await new Promise(r=>setTimeout(r,300));
        const open = panel.classList.contains('active');
        const slots = body.querySelectorAll('.bs-slot').length;
        const text = body.textContent.replace(/\\s+/g,' ').trim();
        const eSlot = (body.querySelectorAll('.bs-slot')[1]?.textContent||'').replace(/\\s+/g,' ').trim().slice(0,140);
        const bad = /undefined|NaN|\\[object Object\\]|null/.test(text);
        const min = document.getElementById('buildsum-min')?.textContent?.trim() || '';
        key('Tab');
        dispatchEvent(new KeyboardEvent('keyup',{code:'Tab',key:'Tab',bubbles:true}));
        await new Promise(r=>setTimeout(r,200));
        return {open, slots, closeOk:!panel.classList.contains('active'), bad,
                mode:(await import('./src/game.js')).getState().mode,
                htmlLen:body.innerHTML.length, eSlot, min:min.slice(0,60)};
      })()`);
      console.log('BUILD_SUMMARY_TEST:', JSON.stringify(buildSumTest));
      if (!buildSumTest.open || buildSumTest.slots < 4 || buildSumTest.bad || !buildSumTest.closeOk) {
        console.log('BUILD_SUMMARY_FAIL'); process.exitCode = 1;
      }
      // Captura del panel que antes reventaba, para revisión visual.
      await mainWindow.webContents.executeJavaScript(
        "dispatchEvent(new KeyboardEvent('keydown',{code:'Tab',key:'Tab'}))"
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
      require('node:fs').writeFileSync(path.join(__dirname, 'buildsum-smoke.png'),
        (await mainWindow.webContents.capturePage()).toPNG());
      await mainWindow.webContents.executeJavaScript(`(()=>{
        dispatchEvent(new KeyboardEvent('keydown',{code:'Tab',key:'Tab'}));
        dispatchEvent(new KeyboardEvent('keyup',{code:'Tab',key:'Tab'}));
      })()`);

      // botín con panel explicativo (antes del combate para capturarlo vivo)
      const lootTest = await mainWindow.webContents.executeJavaScript(`(async()=>{
        const m = await import('./src/game.js'); m.testDropLoot(); m.testOpenLoot();
        await new Promise(r=>setTimeout(r,600));
        const open = document.getElementById('loot').classList.contains('active');
        const name = document.getElementById('loot-name').textContent;
        const how = document.getElementById('loot-how').textContent.length;
        return {open,name,how};
      })()`);
      console.log('LOOT_TEST:', JSON.stringify(lootTest));
      const lootImage = await mainWindow.webContents.capturePage();
      require('node:fs').writeFileSync(path.join(__dirname, 'loot-smoke.png'), lootImage.toPNG());
      await mainWindow.webContents.executeJavaScript(`(async()=>{document.getElementById('loot-equip-btn').click();await new Promise(r=>setTimeout(r,400));})()`);

      // draft de mejora + tragaperras (con el jugador vivo)
      await step("upgrade-draft", "import('./src/game.js').then(m=>m.showUpgradeDraft())");
      await new Promise((resolve) => setTimeout(resolve, 700));
      const upgradeImage = await mainWindow.webContents.capturePage();
      require('node:fs').writeFileSync(path.join(__dirname, 'upgrade-smoke.png'), upgradeImage.toPNG());
      const slotTest = await mainWindow.webContents.executeJavaScript(`(async()=>{
        const m = await import('./src/game.js');
        m.testAddChips(600);
        const before = m.getState().chips;
        document.getElementById('slot-spin').click();
        await new Promise(r=>setTimeout(r,2600));
        return {before,result:document.getElementById('slot-result').textContent.slice(0,60),after:m.getState().chips};
      })()`);
      console.log('SLOT_TEST:', JSON.stringify(slotTest));
      const slotImage = await mainWindow.webContents.capturePage();
      require('node:fs').writeFileSync(path.join(__dirname, 'slot-smoke.png'), slotImage.toPNG());
      const validation = await mainWindow.webContents.executeJavaScript(`(async()=>{document.getElementById('reroll-btn').click();const rerolls=document.getElementById('reroll-count').textContent;document.querySelector('.upgrade-choice').click();await new Promise(r=>setTimeout(r,600));return {rerolls,nextWave:document.getElementById('wave').textContent,draftClosed:!document.getElementById('upgrade').classList.contains('active'),mode:(await import('./src/game.js')).getState().mode};})()`);
      console.log('UPGRADE_TEST:', JSON.stringify(validation));

      // pacto de interferencia: se ofrece, se acepta y aplica su maldición
      const pactTest = await mainWindow.webContents.executeJavaScript(`(async()=>{
        const m = await import('./src/game.js');
        m.showUpgradeDraft();
        await new Promise(r=>setTimeout(r,300));
        const btn = document.getElementById('pact-take');
        const curse = (document.querySelector('#pact-offer .pact-curse')||{}).textContent || '';
        const before = m.getBuild();
        if (btn) btn.click();
        await new Promise(r=>setTimeout(r,220));
        const after = m.getBuild();
        const offer = document.querySelector('.upgrade-choice');
        if (offer) offer.click();
        await new Promise(r=>setTimeout(r,600));
        return {offered:!!btn, curse, pacts:after.pacts,
                dmg:[before.damage, after.damage], hp:[before.maxHp, after.maxHp],
                closed:!document.getElementById('upgrade').classList.contains('active')};
      })()`);
      console.log('PACT_TEST:', JSON.stringify(pactTest));

      // combate: todos los arquetipos de enemigo y todas las habilidades automáticas
      const combatTest = await mainWindow.webContents.executeJavaScript(`(async()=>{
        const m = await import('./src/game.js');
        for (const t of ['chaser','ranged','tank','drone','flyer','stalker','support','boss']) m.testSpawn(t);
        ['orbit','tesla','frost','aura','mines','beam','regen','chrono','dashwave','deathexplode'].forEach(id=>m.testAbility(id));
        await new Promise(r=>setTimeout(r,1800));
        const s = m.getState();
        m.testClearEnemies();
        m.spawnWave();
        await new Promise(r=>setTimeout(r,900));
        return {level:s.level, enemies:s.enemies, abilities:Object.keys(s.abilities).length, chips:s.chips, modeAfter:m.getState().mode};
      })()`);
      console.log('COMBAT_TEST:', JSON.stringify(combatTest));

      // arsenal de interferencia: módulos, resonancias, afijos, evolución y director
      const arsenalTest = await mainWindow.webContents.executeJavaScript(`(async()=>{
        const m = await import('./src/game.js');
        const base = m.getBuild();
        for (let i=0;i<4;i++) m.testInstall('filo');
        const afterFilo = m.getBuild();
        for (let i=0;i<4;i++) m.testInstall('placa');
        const eliteArmored = m.testElite('blindado');
        const eliteIgn = m.testElite('igneo','tank');
        const director = m.testDirector(180);
        const evo = m.testEvolve();
        await new Promise(r=>setTimeout(r,700));
        const build = m.getBuild();
        return {base:{damage:base.damage,hp:base.maxHp},
                filo:{damage:afterFilo.damage,res:afterFilo.resonances,fam:afterFilo.families},
                coraza:{hp:build.maxHp,shield:build.maxShield,res:build.resonances},
                eliteArmored, eliteIgn, director, evo,
                final:{mods:Object.keys(build.modules).length,fam:build.families,res:build.resonances,threat:build.threat,scoreMult:build.scoreMult}};
      })()`);
      console.log('ARSENAL_TEST:', JSON.stringify(arsenalTest));
      // HUD de build: se cierran los overlays y se captura la tira de familias.
      await mainWindow.webContents.executeJavaScript(`(async()=>{
        document.querySelectorAll('.screen.active').forEach(e=>e.classList.remove('active'));
        const m = await import('./src/game.js');
        m.getState().mode='playing';
        document.getElementById('hud').classList.remove('hidden');
        await new Promise(r=>setTimeout(r,350));
      })()`);
      // rendimiento: 40 hostiles + efectos, medido sobre el último frame dibujado
      const perfTest = await mainWindow.webContents.executeJavaScript(`(async()=>{
        const m = await import('./src/game.js');
        m.testClearEnemies();
        await new Promise(r=>setTimeout(r,150));
        for (let i=0;i<40;i++) m.testSpawn(i%5===0?'tank':i%4===0?'ranged':'chaser');
        await new Promise(r=>setTimeout(r,900));
        const p = m.getPerf();
        m.testClearEnemies();
        return p;
      })()`);
      console.log('PERF_TEST:', JSON.stringify(perfTest));

      const hudTest = await mainWindow.webContents.executeJavaScript(`(()=>{
        const l = document.getElementById('loadout');
        const r = l.getBoundingClientRect();
        const chips = [...l.querySelectorAll('span')].slice(0,4).map(s=>{const b=s.getBoundingClientRect();return {t:s.textContent.trim().slice(0,18),x:Math.round(b.x),w:Math.round(b.width)};});
        return {x:Math.round(r.x),w:Math.round(r.width),h:Math.round(r.height),chips};
      })()`);
      console.log('HUD_TEST:', JSON.stringify(hudTest));
      const buildImage = await mainWindow.webContents.capturePage();
      require('node:fs').writeFileSync(path.join(__dirname, 'build-smoke.png'), buildImage.toPNG());

      // ---- MEGA-UPDATE 05.00: habilidades nuevas, evoluciones, reliquías, ----
      // ---- hostiles nuevos, facciones nuevas y operadores nuevos ------------
      const megaTest = await mainWindow.webContents.executeJavaScript(`(async()=>{
        const m = await import('./src/game.js');
        const out = {};
        // habilidades de la tercera y cuarta hornada
        out.turret = m.testTurret();
        out.meteor = m.testMeteor();
        out.ghost = m.testGhost();
        out.spiral = m.testSpiral();
        ['comet','quake'].forEach(id => m.testAbility(id));
        await new Promise(r=>setTimeout(r,900));
        out.cometQuake = !!m.getState().abilities.comet && !!m.getState().abilities.quake;
        // evolución de habilidad
        out.evolved = m.testEvolveAbility('spiral');
        // hostiles de la segunda hornada
        m.testClearEnemies();
        for (const t of ['sapper','brute','swarmling','turret','wraith']) m.testSpawn(t);
        await new Promise(r=>setTimeout(r,1400));
        out.newEnemies = m.getState().enemies;
        m.testClearEnemies();
        // reliquías: se conceden y se listan
        const rel = [];
        for (let i=0;i<3;i++){ const r = m.testGrantRelic(); if (r) rel.push(r.id); }
        out.relics = rel;
        // cada reliquía declarada tiene que tener un gancho real, no solo texto
        const ars = await import('./src/arsenal.js');
        let withHook = 0; const noHook = [];
        for (const r of ars.RELICS) {
          try { if (m.testRelicHook(r.id)) withHook++; else noHook.push(r.id); }
          catch (e) { noHook.push(r.id + '!' + e.message); }
        }
        out.relicHooks = { total: ars.RELICS.length, withHook, noHook };
        // facciones nuevas: cada una con sus tres jefes
        const bosses = await import('./src/bosses.js');
        out.factions = {};
        for (const f of ['SYNTEK','HIVE','UMBRA','HELIX','PYRE','NULL']) {
          out.factions[f] = bosses.BOSSES.filter(b=>b.faction===f).map(b=>b.id);
        }
        out.bossTotal = bosses.BOSSES.length;
        // los cinco héroes definitivos: el generador procedural de referencia
        // sigue siendo capaz de construir un cuerpo para cada id del roster
        const ops = await import('./src/operators.js');
        const THREE = await import('three');
        out.operators = {};
        for (const id of ['seraph','ronin','glitch','vanta','kira']) {
          try {
            const g = ops.buildOperator(id, 0x6ef7e7);
            let meshes = 0; g.traverse(o=>{ if (o.isMesh) meshes++; });
            out.operators[id] = meshes;
            ops.disposeOperator(g);
          } catch (e) { out.operators[id] = 'ERR:' + e.message; }
        }
        return out;
      })()`);
      console.log('MEGA_TEST:', JSON.stringify(megaTest));

      // colisiones de la utilería: el jugador y los hostiles no la atraviesan
      const propTest = await mainWindow.webContents.executeJavaScript(`(async()=>{
        const m = await import('./src/game.js');
        m.spawnWave();
        await new Promise(r=>setTimeout(r,1200));
        return m.testProps();
      })()`);
      console.log('PROP_TEST:', JSON.stringify(propTest));


      const worldTest = await mainWindow.webContents.executeJavaScript(`(async()=>{const m=await import('./src/game.js');m.testDropCompanion();await new Promise(r=>setTimeout(r,300));m.spawnWave();await new Promise(r=>setTimeout(r,500));return {map:m.getMap(),sector:document.getElementById('sector-label').textContent,loot:Object.keys(m.getLootLevels())};})()`);
      console.log('WORLD_TEST:', JSON.stringify(worldTest));
      // números de daño, sinergias, modificador y efectos de cámara
      const polishTest = await mainWindow.webContents.executeJavaScript(`(async()=>{
        const m=await import('./src/game.js');
        const s0=m.getState();
        m.testClearEnemies(); m.testSpawn('tank');
        await new Promise(r=>setTimeout(r,700));
        const dmg=m.testDamageNumbers();
        ['orbit','frost'].forEach(id=>m.testAbility(id));
        await new Promise(r=>setTimeout(r,300));
        const syn1=m.getSynergies();
        ['tesla','beam','mines','deathexplode'].forEach(id=>m.testAbility(id));
        await new Promise(r=>setTimeout(r,300));
        const syn2=m.getSynergies();
        const mod=m.testForceModifier('elite');
        dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftLeft'}));
        await new Promise(r=>setTimeout(r,120));
        const fovDash=m.getState().fov;
        dispatchEvent(new KeyboardEvent('keyup',{code:'ShiftLeft'}));
        dispatchEvent(new KeyboardEvent('keydown',{code:'KeyP'}));
        await new Promise(r=>setTimeout(r,150));
        const photo=m.getState().photo;
        dispatchEvent(new KeyboardEvent('keydown',{code:'KeyP'}));
        await new Promise(r=>setTimeout(r,400));
        return {dmg, syn1, syn2, mod, fovBase:s0.fov, fovDash, photo,
                banner:document.getElementById('modifier-banner').classList.contains('show'),
                speed:document.getElementById('fx-speed')!==null};
      })()`);
      console.log('POLISH_TEST:', JSON.stringify(polishTest));

      // ranuras de carga: ataque melé (gancho de prueba), utilidad, gato y objetivos de ronda
      const slotsTest = await mainWindow.webContents.executeJavaScript(`(async()=>{
        const m = await import('./src/game.js');
        const melee = m.testMelee();
        const utility = m.testUtility();
        const cat = m.testCat();
        await new Promise(r=>setTimeout(r,600));
        const catHp = m.getState().mode;
        const obj = m.testObjective();
        const balance = m.testBalance(15);
        return {melee, utility, cat, mode:catHp, obj,
          bossRounds: balance.filter(b=>b.boss).map(b=>b.round),
          lastHp: balance[balance.length-1].hpMul};
      })()`);
      console.log('SLOTS_TEST:', JSON.stringify(slotsTest));

      // biblioteca: el códice debe listar registros descubiertos
      const codexTest = await mainWindow.webContents.executeJavaScript(`(async()=>{
        const m = await import('./src/game.js');
        m.openHub('codex');
        await new Promise(r=>setTimeout(r,500));
        const cards = document.querySelectorAll('#hub-codex .codex-card').length;
        const locked = document.querySelectorAll('#hub-codex .codex-card.locked').length;
        const summary = document.getElementById('codex-summary').textContent;
        document.getElementById('hub-back').click();
        await new Promise(r=>setTimeout(r,300));
        return {cards, locked, summary};
      })()`);
      console.log('CODEX_TEST:', JSON.stringify(codexTest));
      console.log('RUNTIME_ASSERT:', JSON.stringify({errors: runtimeErrors.length, details: runtimeErrors.slice(0, 5)}));
      if (runtimeErrors.length) {
        console.log('SMOKE_TEST_FAIL: ' + runtimeErrors.length + ' excepción(es) sin capturar en el renderer');
        process.exitCode = 1;
      } else {
        console.log('SMOKE_TEST_OK: hub, árbol, dificultad, combate, resumen TAB, botín, tragaperras, sinergias, efectos, ranuras y códice');
      }
      app.quit();
    });
  }
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // --- Pasarela visual de hostiles (solo desarrollo) -----------------------
  // Coloca un ejemplar de cada tipo delante del jugador y guarda una captura por
  // facción. Sirve para revisar siluetas sin tener que jugar hasta la ronda 20.
  if (process.argv.includes('--showcase')) {
    const fs = require('node:fs');
    const shotNow = async (name, rect) => {
      const img = await mainWindow.webContents.capturePage(rect);
      fs.writeFileSync(path.join(__dirname, name + '.png'), img.toPNG());
      console.log('SHOT ' + name);
    };
    const shot = async (name, rect) => {
      await new Promise(r => setTimeout(r, 900));
      await shotNow(name, rect);
    };
    const CROP = { x: 240, y: 210, width: 960, height: 480 };
    mainWindow.webContents.once('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 2200));
      try {
        await mainWindow.webContents.executeJavaScript("document.getElementById('start-btn').click()");
        await new Promise(r => setTimeout(r, 700));
        await mainWindow.webContents.executeJavaScript("window.__NR_SMOKE=true;document.querySelector('[data-character=vanta]').click();document.querySelector('[data-level=docks]').click()");
        await new Promise(r => setTimeout(r, 400));
        await mainWindow.webContents.executeJavaScript("document.getElementById('hub-deploy').click()");
        await new Promise(r => setTimeout(r, 2600));
        for (const f of ['SYNTEK', 'HIVE', 'UMBRA']) {
          await mainWindow.webContents.executeJavaScript(`(async()=>{const m=await import('./src/game.js');m.showcase('${f}');})()`);
          await shot('showcase-' + f.toLowerCase(), CROP);
        }
        // Primer plano de los cinco héroes definitivos (un GLB por personaje).
        for (const op of ['seraph', 'ronin', 'glitch', 'vanta', 'kira']) {
          await mainWindow.webContents.executeJavaScript(`(async()=>{
            const m=await import('./src/game.js');
            document.querySelector('[data-character=${op}]').click();
            m.playerCloseup(Math.PI*0.78, 4.2);
          })()`);
          await shot('player-' + op, { x: 300, y: 120, width: 820, height: 640 });
        }
        // Regresión visual del salto: primer plano durante despegue, caída y
        // aterrizaje. playerCloseup() mantiene la simulación activa, así que
        // se usan los mismos clips y la misma física que en partida real.
        const JUMP_CROP = { x: 300, y: 120, width: 820, height: 640 };
        await mainWindow.webContents.executeJavaScript(`(async()=>{
          const m=await import('./src/game.js');
          document.querySelector('[data-character=vanta]').click();
          m.playerCloseup(Math.PI*0.78, 4.6);
        })()`);
        // El GLB del robot (34 MB) se parsea de forma asíncrona: si el salto se
        // dispara antes del mount, el mixer aún no existe y se pierde el clip
        // de despegue en el diagnóstico.
        for (let i = 0; i < 24; i++) {
          const ready = await mainWindow.webContents.executeJavaScript(
            "!!(window.__NR_GLB_STATUS&&window.__NR_GLB_STATUS.ok&&window.__NR_GLB_STATUS.asset.endsWith('robot_voxel_mixamo.glb'))");
          if (ready) break;
          await new Promise(r => setTimeout(r, 250));
        }
        await new Promise(r => setTimeout(r, 300));
        await mainWindow.webContents.executeJavaScript("dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}))");
        await new Promise(r => setTimeout(r, 90));
        await shotNow('jump-takeoff', JUMP_CROP);
        await new Promise(r => setTimeout(r, 300));
        await shotNow('jump-fall', JUMP_CROP);
        await mainWindow.webContents.executeJavaScript("dispatchEvent(new KeyboardEvent('keyup',{code:'Space'}))");
        await new Promise(r => setTimeout(r, 380));
        await shotNow('jump-land', JUMP_CROP);
        console.log('ANIM_SHOWCASE:', JSON.stringify(await mainWindow.webContents.executeJavaScript(
          "window.__NR_GLB_DIAG || {error:'sin diagnóstico'}"
        )));
        console.log('SHOWCASE_OK');
      } catch (e) { console.log('SHOWCASE_FAIL ' + e.message); }
      app.quit();
    });
  }

  // --- Pasarela de los 5 héroes (validación de modelos) --------------------
  // Selecciona cada personaje en partida, espera a que GLTFLoader termine y
  // guarda un primer plano + el estado del cargador. Sirve para detectar un
  // GLB corrupto, un skim con pesos mal transferidos o una fuga al cambiar.
  if (process.argv.includes('--characters')) {
    const fs = require('node:fs');
    const ASSET_OF = {
      seraph: 'arquero.glb', ronin: 'barbaro.glb', glitch: 'bruja.glb',
      vanta: 'robot_voxel_mixamo.glb', kira: 'vampiro.glb'
    };
    const CROP = { x: 300, y: 120, width: 820, height: 640 };
    mainWindow.webContents.once('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 2200));
      const report = [];
      try {
        await mainWindow.webContents.executeJavaScript("document.getElementById('start-btn').click()");
        await new Promise(r => setTimeout(r, 700));
        await mainWindow.webContents.executeJavaScript("window.__NR_SMOKE=true;document.querySelector('[data-level=docks]').click()");
        await new Promise(r => setTimeout(r, 300));
        await mainWindow.webContents.executeJavaScript("document.getElementById('hub-deploy').click()");
        await new Promise(r => setTimeout(r, 2600));
        for (const id of Object.keys(ASSET_OF)) {
          await mainWindow.webContents.executeJavaScript(`(async()=>{
            const m = await import('./src/game.js');
            document.querySelector('[data-character=${id}]').click();
            m.playerCloseup(Math.PI*0.78, 4.2);
          })()`);
          // Espera activa: el parseo de un GLB de 9-35 MB no es inmediato.
          for (let i = 0; i < 24; i++) {
            const ok = await mainWindow.webContents.executeJavaScript(
              `(()=>{const s=window.__NR_GLB_STATUS;return !!(s&&s.ok&&s.asset&&s.asset.endsWith('${ASSET_OF[id]}'));})()`);
            if (ok) break;
            await new Promise(r => setTimeout(r, 250));
          }
          await new Promise(r => setTimeout(r, 500));
          const img = await mainWindow.webContents.capturePage(CROP);
          fs.writeFileSync(path.join(__dirname, 'character-' + id + '.png'), img.toPNG());
          const status = await mainWindow.webContents.executeJavaScript(
            "window.__NR_GLB_STATUS || {ok:false,error:'sin estado'}");
          report.push({ id, asset: status.asset, ok: status.ok,
                        clips: status.clips, textures: status.textures, error: status.error });
          console.log('CHARACTER_SHOT ' + id + ' ' + JSON.stringify(status));
        }
        console.log('CHARACTER_TEST:', JSON.stringify(report));
        console.log('CHARACTER_SHOWCASE_OK');
      } catch (e) { console.log('CHARACTER_SHOWCASE_FAIL ' + e.message); }
      app.quit();
    });
  }
  // --- Pasarela del Mundo 1 (Kenney Nature Kit) -----------------------------
  // Arranca una partida en PRADERAS FELICES, espera a que el puente IPC haya
  // parseado todos los GLB y a que se reconstruya la arena, y guarda dos
  // capturas junto al recuento de instancias / draw calls / colisiones.
  if (process.argv.includes('--nature')) {
    const fs = require('node:fs');
    mainWindow.webContents.once('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 2200));
      try {
        await mainWindow.webContents.executeJavaScript("document.getElementById('start-btn').click()");
        await new Promise(r => setTimeout(r, 700));
        await mainWindow.webContents.executeJavaScript(
          "window.__NR_SMOKE=true;document.querySelector('[data-level=rooftop]').click()");
        await new Promise(r => setTimeout(r, 300));
        await mainWindow.webContents.executeJavaScript("document.getElementById('hub-deploy').click()");
        for (let i = 0; i < 40; i++) {
          const ok = await mainWindow.webContents.executeJavaScript(
            "(()=>!!(window.__NR_NATURE_READY && window.__NR_NATURE && !window.__NR_NATURE_PENDING))()");
          if (ok) break;
          await new Promise(r => setTimeout(r, 250));
        }
        await new Promise(r => setTimeout(r, 1400));
        const full = await mainWindow.webContents.capturePage();
        fs.writeFileSync(path.join(__dirname, 'world1-nature.png'), full.toPNG());
        const crop = await mainWindow.webContents.capturePage({ x: 240, y: 150, width: 960, height: 560 });
        fs.writeFileSync(path.join(__dirname, 'world1-nature-detail.png'), crop.toPNG());
        const report = await mainWindow.webContents.executeJavaScript(
          "({nature:window.__NR_NATURE||null, kit:window.__NR_NATURE_DIAG||null, ready:!!window.__NR_NATURE_READY})");
        console.log('NATURE_TEST:', JSON.stringify(report));
        // Regresión de hitboxes: expulsión del jugador, hostiles que no nacen
        // dentro de un tronco/roca y cobertura real para los proyectiles.
        const collision = await mainWindow.webContents.executeJavaScript(
          "(async()=>{const m=await import('./src/game.js');m.spawnWave();await new Promise(r=>setTimeout(r,1000));return m.testProps();})()");
        console.log('NATURE_COLLISION:', JSON.stringify(collision));
        console.log('NATURE_SHOWCASE_OK');
      } catch (e) { console.log('NATURE_SHOWCASE_FAIL ' + e.message); }
      app.quit();
    });
  }

  // --- Pasarela del arsenal único (validación visual de armas / VFX) -------
  // Espera a que los cinco GLB, los sprites y el banco de SFX estén listos,
  // selecciona cada héroe, dispara una ráfaga corta y guarda un primer plano
  // con el arma montada en la mano derecha y sus efectos en vuelo.
  if (process.argv.includes('--weapons')) {
    const fs = require('node:fs');
    const CROP = { x: 290, y: 120, width: 840, height: 640 };
    const IDS = ['seraph', 'ronin', 'glitch', 'vanta', 'kira'];
    const ASSET_OF = {
      seraph: 'arquero.glb', ronin: 'barbaro.glb', glitch: 'bruja.glb',
      vanta: 'robot_voxel_mixamo.glb', kira: 'vampiro.glb'
    };
    mainWindow.webContents.once('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 2200));
      const report = [];
      try {
        await mainWindow.webContents.executeJavaScript("document.getElementById('start-btn').click()");
        await new Promise(r => setTimeout(r, 700));
        await mainWindow.webContents.executeJavaScript("window.__NR_SMOKE=true;document.querySelector('[data-level=docks]').click()");
        await new Promise(r => setTimeout(r, 300));
        await mainWindow.webContents.executeJavaScript("document.getElementById('hub-deploy').click()");
        // Los 5 GLB (~11 MB) + 19 sprites + 124 .ogg llegan por IPC en paralelo.
        for (let i = 0; i < 60; i++) {
          const ok = await mainWindow.webContents.executeJavaScript(
            "(()=>!!(window.__NR_COMBAT_READY && window.__NR_COMBAT && window.__NR_COMBAT.weapons.ok))()");
          if (ok) break;
          await new Promise(r => setTimeout(r, 250));
        }
        for (const id of IDS) {
          await mainWindow.webContents.executeJavaScript(`(async()=>{
            const m = await import('./src/game.js');
            document.querySelector('[data-character=${id}]').click();
            m.playerCloseup(Math.PI*0.78, 4.4);
          })()`);
          for (let i = 0; i < 24; i++) {
            const ok = await mainWindow.webContents.executeJavaScript(
              `(()=>{const s=window.__NR_GLB_STATUS;return !!(s&&s.ok&&s.asset&&s.asset.endsWith('${ASSET_OF[id]}'));})()`);
            if (ok) break;
            await new Promise(r => setTimeout(r, 250));
          }
          await new Promise(r => setTimeout(r, 450));
          const idle = await mainWindow.webContents.capturePage(CROP);
          fs.writeFileSync(path.join(__dirname, 'weapon-' + id + '.png'), idle.toPNG());
          const fire = await mainWindow.webContents.executeJavaScript(
            "(async()=>{const m=await import('./src/game.js');return m.testFire(7);})()");
          await new Promise(r => setTimeout(r, 60));
          const action = await mainWindow.webContents.capturePage(CROP);
          fs.writeFileSync(path.join(__dirname, 'weapon-' + id + '-fire.png'), action.toPNG());
          const diag = await mainWindow.webContents.executeJavaScript(
            "(async()=>{const m=await import('./src/game.js');return m.testCombat();})()");
          report.push({ id, fire, weapon: diag.active, loaded: diag.weapons.loaded.length,
                        vfxPools: diag.vfx.pools, sprites: diag.vfx.sprites.length,
                        projectilePools: diag.projectiles.pools, sfxFiles: diag.sfx.files,
                        sfxPlayed: diag.sfx.played, rendered: true });
          console.log('WEAPON_SHOT ' + id + ' ' + JSON.stringify(report[report.length - 1]));
        }
        console.log('WEAPON_TEST:', JSON.stringify(report));
        console.log('WEAPON_SHOWCASE_OK');
      } catch (e) { console.log('WEAPON_SHOWCASE_FAIL ' + e.message); }
      app.quit();
    });
  }

  // --- Control de calidad: SOLO Mundos 1 y 2 -------------------------------
  // El plan de arquitectura prohíbe generar los 7 mundos de golpe. Esta
  // pasarela valida escala, confort visual (crítico en la nieve), sombras,
  // colisiones y FPS de los dos primeros antes de autorizar los mundos 3-7.
  // Guarda una vista general y una vista de juego por mundo.
  if (process.argv.includes('--worlds')) {
    const fs = require('node:fs');
    const WORLDS = [
      { id: 'world1_nature', label: 'world1-nature' },
      { id: 'world2_snow', label: 'world2-snow' },
      { id: 'world3_shop', label: 'world3-shop' },
      { id: 'world4_suburban', label: 'world4-suburban' },
      { id: 'world5_station', label: 'world5-station' },
      { id: 'world6_space', label: 'world6-space' },
      { id: 'world7_hexagon', label: 'world7-hexagon' }
    ];
    mainWindow.webContents.once('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 2200));
      const report = [];
      try {
        await mainWindow.webContents.executeJavaScript(
          "window.__NR_SMOKE=true;document.getElementById('start-btn').click()");
        await new Promise(r => setTimeout(r, 700));
        await mainWindow.webContents.executeJavaScript(
          "document.querySelector('[data-level=rooftop]').click()");
        await new Promise(r => setTimeout(r, 300));
        await mainWindow.webContents.executeJavaScript("document.getElementById('hub-deploy').click()");
        await new Promise(r => setTimeout(r, 900));
        for (const w of WORLDS) {
          await mainWindow.webContents.executeJavaScript(
            `(async()=>{const m=await import('./src/game.js');m.previewWorld('${w.id}');})()`);
          // Espera a que lleguen los GLB por IPC, se parseen y se haga flush().
          let ready = false;
          for (let i = 0; i < 60; i++) {
            ready = await mainWindow.webContents.executeJavaScript(
              `(()=>{const d=window.__NR_WORLD_DIAG;return !!(window.__NR_WORLD_READY && d && d.active==='${w.id}');})()`);
            if (ready) break;
            await new Promise(r => setTimeout(r, 250));
          }
          await new Promise(r => setTimeout(r, 900));
          // Una oleada viva mantiene la lógica de ronda ocupada: si se vaciara
          // la arena, el director abriría el borrador de mejora a los 1.3 s y
          // las capturas saldrían con la interfaz encima.
          // Modo dios de QC + oleada viva: sin esto el heroe moria con oleadas
          // gordas (W7) y las capturas salian con la pantalla de derrota.
          // W3 tiene techo a y=15: la camara estandar (34,-.44) queda POR
          // ENCIMA (y≈16) y fotografia el techo. Vista interior mas baja.
          const ov = w.id === 'world3_shop' ? '24,-.30' : '34,-.44';
          await mainWindow.webContents.executeJavaScript(
            `(async()=>{const m=await import('./src/game.js');m.testGod(true);m.spawnWave();m.setWorldView(${ov},0);})()`);
          await new Promise(r => setTimeout(r, 700));
          fs.writeFileSync(path.join(__dirname, w.label + '-overview.png'),
            (await mainWindow.webContents.capturePage()).toPNG());
          await mainWindow.webContents.executeJavaScript(
            "(async()=>{const m=await import('./src/game.js');m.testGod(true);m.setWorldView(9,-.17,0);})()");
          await new Promise(r => setTimeout(r, 500));
          fs.writeFileSync(path.join(__dirname, w.label + '-play.png'),
            (await mainWindow.webContents.capturePage()).toPNG());
          await mainWindow.webContents.executeJavaScript(
            "(async()=>{const m=await import('./src/game.js');m.testGod(false);})()");
          const fps = await mainWindow.webContents.executeJavaScript(`(async()=>{
            return await new Promise(res=>{let n=0;const t0=performance.now();
              const tick=()=>{n++;const dt=performance.now()-t0;
                if(dt<1200) requestAnimationFrame(tick);
                else res({fps:Math.round(n*1000/dt),ms:+(dt/n).toFixed(2)});};
              requestAnimationFrame(tick);});})()`);
          const diag = await mainWindow.webContents.executeJavaScript(
            "(async()=>{const m=await import('./src/game.js');return {world:m.worldDiagnostics(),perf:m.getPerf(),props:m.testProps()};})()");
          report.push({ id: w.id, ready, fps, ...diag });
          console.log('WORLD_QC ' + w.id + ' ' + JSON.stringify(report[report.length - 1]));
          // Limpia la oleada antes de saltar al siguiente mundo para que no
          // aparezcan hostiles del bioma anterior en la captura siguiente.
          await mainWindow.webContents.executeJavaScript(
            "(async()=>{const m=await import('./src/game.js');m.testClearEnemies();})()");
        }
        console.log('WORLDS_TEST: ' + JSON.stringify(report));
        console.log('WORLDS_QC_OK');
      } catch (e) {
        console.log('WORLDS_QC_FAIL ' + e.message);
        process.exitCode = 1;
      }
      app.quit();
    });
  }
  mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.on('app:quit', () => app.quit());
ipcMain.on('app:fullscreen', () => {
  if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
});

// --- Puente de assets para el cargador GLTF --------------------------------
// El renderer está aislado (contextIsolation + sandbox) y el juego se sirve
// desde file://, así que fetch()/XHR del .glb queda bloqueado por CORS/CSP.
// Leemos el binario en el proceso principal y lo entregamos como ArrayBuffer:
// una sola lectura de disco, sin peticiones de red ni rutas externas.
// Lista blanca: el renderer aislado solo puede pedir los GLB del roster.
// Se valida el nombre (no una ruta) para evitar path traversal desde el DOM.
const CHARACTER_GLB_FILES = new Set([
  'robot_voxel_mixamo.glb', 'arquero.glb', 'barbaro.glb', 'bruja.glb', 'vampiro.glb'
]);
ipcMain.handle('nr:load-character-glb', async (_event, requested) => {
  const fs = require('node:fs/promises');
  const relative = typeof requested === 'string'
    ? requested.split('/').pop().split('\\').pop() : '';
  const name = CHARACTER_GLB_FILES.has(relative) ? relative : 'robot_voxel_mixamo.glb';
  const file = path.join(__dirname, 'assets', 'characters', name);
  const buf = await fs.readFile(file);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
});

// --- Puente de assets del Kenney Nature Kit ---------------------------------
// Un solo IPC devuelve todos los GLB del escenario: el renderer los parsea con
// GLTFLoader.parseAsync() y los convierte en plantillas para InstancedMesh.
// Solo se sirven .glb del directorio controlado por el proyecto (sin rutas del
// renderer), así que no hay superficie para path traversal.
ipcMain.handle('nr:load-nature-glbs', async () => {
  const fs = require('node:fs/promises');
  const dir = path.join(__dirname, 'assets', 'environment', 'nature');
  const files = (await fs.readdir(dir)).filter(n => /^[a-zA-Z0-9_.-]+\.glb$/i.test(n));
  const out = {};
  for (const name of files) {
    const buf = await fs.readFile(path.join(dir, name));
    out[name] = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  return out;
});

// --- Puente de assets del arsenal único ------------------------------------
// Igual que los anteriores: el renderer aislado no puede leer file://. Los
// nombres se validan contra el contenido real del directorio del proyecto,
// así que el DOM nunca puede pedir una ruta externa.
const SAFE_NAME = /^[a-zA-Z0-9_.-]+$/;

// --- Puente de assets de los 7 mundos Kenney -------------------------------
// Carga perezosa: el renderer solo pide los GLB que declara el builder del
// mundo activo (67 en el Mundo 1, 50 en el Mundo 2), no los 809 importados.
// worldId se valida contra el patrón de carpetas del proyecto y cada nombre
// contra SAFE_NAME: el DOM aislado no puede escapar de assets/worlds/.
const WORLD_DIR = /^world[1-7]_[a-z0-9_]+$/;
ipcMain.handle('nr:load-world-glbs', async (_event, worldId, names) => {
  const fs = require('node:fs/promises');
  if (typeof worldId !== 'string' || !WORLD_DIR.test(worldId)) return {};
  const dir = path.join(__dirname, 'assets', 'worlds', worldId);
  let files = [];
  try { files = await fs.readdir(dir); } catch { return {}; }
  const wanted = Array.isArray(names) && names.length
    ? new Set(names.filter(n => typeof n === 'string' && SAFE_NAME.test(n))
      .map(n => n.replace(/\.glb$/i, '')))
    : null;
  const out = {};
  for (const name of files) {
    if (!SAFE_NAME.test(name) || !/\.glb$/i.test(name)) continue;
    if (wanted && !wanted.has(name.replace(/\.glb$/i, ''))) continue;
    const buf = await fs.readFile(path.join(dir, name));
    out[name] = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  // Los kits Kenney referencian UNA textura externa compartida
  // (Textures/colormap.png). Cada kit tiene SU paleta: se remapea esa clave al
  // colormap real del kit del mundo activo. nature-kit y space-kit traen las
  // texturas embebidas en el GLB (no referencian .png) y no necesitan paleta.
  const WORLD_COLORMAP = {
    world2_snow: 'colormap.png',            // platformer-kit (filtro nieve)
    world3_shop: 'colormap-minishop.png',   // mini-shop 2.1
    world4_suburban: 'colormap-city.png',   // city-kit-suburban
    world5_station: 'colormap-station.png', // space-station-kit
    world7_hexagon: 'colormap-hexagon.png'  // hexagon-kit
  };
  const texDir = path.join(__dirname, 'assets', 'worlds', '_textures');
  try {
    const map = {};
    const cmap = WORLD_COLORMAP[worldId] || 'colormap.png';
    const buf = await fs.readFile(path.join(texDir, cmap));
    map['Textures/colormap.png'] = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    out['__textures__'] = map;
  } catch { /* sin texturas compartidas: los GLB van coloreados por material */ }
  return out;
});

ipcMain.handle('nr:load-weapon-glbs', async () => {
  const fs = require('node:fs/promises');
  const dir = path.join(__dirname, 'assets', 'weapons');
  const files = (await fs.readdir(dir)).filter(n => SAFE_NAME.test(n) && n.endsWith('.glb'));
  const out = {};
  for (const name of files) {
    const buf = await fs.readFile(path.join(dir, name));
    out[name] = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  return out;
});

ipcMain.handle('nr:load-vfx-sprites', async (_event, names) => {
  const fs = require('node:fs/promises');
  const dir = path.join(__dirname, 'assets', 'vfx', 'particles');
  const wanted = Array.isArray(names) && names.length
    ? new Set(names.filter(n => SAFE_NAME.test(String(n)))) : null;
  const files = (await fs.readdir(dir)).filter(n => SAFE_NAME.test(n) && n.endsWith('.png'));
  const out = {};
  for (const name of files) {
    if (wanted && !wanted.has(name)) continue;
    const buf = await fs.readFile(path.join(dir, name));
    out[name] = 'data:image/png;base64,' + buf.toString('base64');
  }
  return out;
});

ipcMain.handle('nr:load-sfx-bank', async () => {
  const fs = require('node:fs/promises');
  const root = path.join(__dirname, 'assets', 'audio');
  const out = {};
  for (const pack of ['rpg', 'scifi']) {
    const dir = path.join(root, pack);
    let files = [];
    try { files = await fs.readdir(dir); } catch { continue; }
    for (const name of files) {
      if (!SAFE_NAME.test(name) || !name.endsWith('.ogg')) continue;
      const buf = await fs.readFile(path.join(dir, name));
      out[pack + '/' + name] = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
  }
  return out;
});

// Single-instance: a second launch just focuses the window that is already open.
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
