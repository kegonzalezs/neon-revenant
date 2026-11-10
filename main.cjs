const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

// Keep window compositing in software for compatibility, but render WebGL on the real GPU.
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('use-angle', 'd3d11');
app.commandLine.appendSwitch('force-high-performance-gpu');

let mainWindow;

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
    if (event.message?.startsWith('GPU_RENDERER:') || event.message?.startsWith('RUNTIME_')) console.log(event.message);
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
      const image = await mainWindow.webContents.capturePage();
      require('node:fs').writeFileSync(path.join(__dirname, 'gameplay-smoke.png'), image.toPNG());

      // salto y cambio de arma (con el combate ya en marcha)
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
        dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF'}));
        await new Promise(r=>setTimeout(r,200));
        const swap1 = document.getElementById('weapon-name').textContent.slice(0,22);
        dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF'}));
        await new Promise(r=>setTimeout(r,200));
        const swap2 = document.getElementById('weapon-name').textContent.slice(0,22);
        return {mode:before.mode, jumpFrom:before.py, jumpUp:air.py, jumpVy:air.vy, jumpsAfter:air.jumps,
                landedPy:landed.py, landedJumps:landed.jumps, weapons:m.getState().weapons, swap1, swap2};
      })()`);
      console.log('MOVE_TEST:', JSON.stringify(moveTest));

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
        // operadores nuevos: cada uno construye su cuerpo
        const ops = await import('./src/operators.js');
        const THREE = await import('three');
        out.operators = {};
        for (const id of ['vanta','kira','rook','nyx','pyre','aegis','glitch','seraph','ronin','cipher']) {
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

      // ranuras de carga: cuerpo a cuerpo, utilidad, gato y objetivos de ronda
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
      console.log('SMOKE_TEST_OK: hub, árbol, dificultad, combate, botín, tragaperras, sinergias, efectos, ranuras y códice');
      app.quit();
    });
  }
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // --- Pasarela visual de hostiles (solo desarrollo) -----------------------
  // Coloca un ejemplar de cada tipo delante del jugador y guarda una captura por
  // facción. Sirve para revisar siluetas sin tener que jugar hasta la ronda 20.
  if (process.argv.includes('--showcase')) {
    const fs = require('node:fs');
    const shot = async (name, rect) => {
      await new Promise(r => setTimeout(r, 900));
      const img = await mainWindow.webContents.capturePage(rect);
      fs.writeFileSync(path.join(__dirname, name + '.png'), img.toPNG());
      console.log('SHOT ' + name);
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
        // Operador de cerca, con los tres modelos de arma.
        for (const [op, wp] of [['vanta', 'smg'], ['kira', 'needle'], ['rook', 'cannon']]) {
          await mainWindow.webContents.executeJavaScript(`(async()=>{
            const m=await import('./src/game.js');
            document.querySelector('[data-character=${op}]').click();
            m.playerCloseup(Math.PI*0.78, 4.2);
          })()`);
          await shot('player-' + op, { x: 300, y: 120, width: 820, height: 640 });
        }
        console.log('SHOWCASE_OK');
      } catch (e) { console.log('SHOWCASE_FAIL ' + e.message); }
      app.quit();
    });
  }
  mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.on('app:quit', () => app.quit());
ipcMain.on('app:fullscreen', () => {
  if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
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
