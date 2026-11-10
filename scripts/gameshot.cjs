// Capturas del juego real (no del visor): carga index.html, elige sector en el
// hub, despliega y fotografía la partida. Sirve para comprobar que el escenario
// voxel se ve bien con la cámara de juego, el HUD y los enemigos encima.
// Uso:  npx electron scripts/gameshot.cjs [nivel1,nivel2,...]
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('use-angle', 'd3d11');

const OUT = path.join(__dirname, '..', 'shots', 'game');
const WORLDS = ['rooftop', 'hive', 'docks', 'spire', 'refinery', 'scrapyard',
  'cathedral', 'undercity', 'terminus', 'greenhouse', 'foundry', 'nullspace'];
const wait = (ms) => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({
    width: 1600, height: 900, show: true, backgroundColor: '#000000',
    webPreferences: { contextIsolation: false, nodeIntegration: false, sandbox: false }
  });
  const errors = [];
  win.webContents.on('console-message', (e) => {
    const msg = typeof e === 'object' && e.message ? e.message : String(e);
    if (/error|Error|fail|Cannot|undefined is not/i.test(msg)) errors.push(msg);
  });
  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await wait(2600);

  const arg = process.argv.slice(2).find(a => !a.startsWith('-'));
  const list = arg ? arg.split(',') : WORLDS;
  const only = process.argv.includes('--first') ? list.slice(0, 1) : list;

  await win.webContents.executeJavaScript("window.__NR_SMOKE=true;document.getElementById('start-btn').click()");
  await wait(900);

  for (const id of only) {
    const res = await win.webContents.executeJavaScript(`(async()=>{
      const card = document.querySelector('[data-level="${id}"]');
      if (!card) return 'NO_CARD';
      card.click();
      await new Promise(r=>setTimeout(r,120));
      const dep = document.getElementById('hub-deploy');
      dep.click();
      return 'OK';
    })()`);
    await wait(3400);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, id + '.png'), img.toPNG());
    // Datos de interés: altura real del jugador y número de plataformas.
    const info = await win.webContents.executeJavaScript(`(async()=>{
      const m = await import('./src/game.js');
      const s = m.getState();
      const p = m.getPerf ? m.getPerf() : null;
      return { py:+s.py.toFixed(2), level:s.level, mode:s.mode, enemies:s.enemies,
               fps:p&&p.fps||null, calls:p&&p.calls||null };
    })()`).catch(e => ({ err: e.message }));
    console.log('GAME', id, res, JSON.stringify(info));
    // Volver al hub para el siguiente.
    await win.webContents.executeJavaScript(`(async()=>{
      const m = await import('./src/game.js');
      if (m.openHub) m.openHub();
    })()`).catch(() => {});
    await wait(700);
  }
  if (errors.length) console.log('ERRORS:', JSON.stringify(errors.slice(0, 10)));
  app.quit();
});
