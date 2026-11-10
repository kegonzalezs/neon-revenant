// Visor de escenarios: carga preview.html, cambia de mundo y guarda capturas.
// Uso:  npx electron scripts/levelshot.cjs [world1,world2,...]
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('use-angle', 'd3d11');

const OUT = path.join(__dirname, '..', 'shots');
const WORLDS = ['rooftop', 'hive', 'docks', 'spire', 'refinery', 'scrapyard',
  'cathedral', 'undercity', 'terminus', 'greenhouse', 'foundry', 'nullspace'];

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({
    width: 1920, height: 1080, show: true, backgroundColor: '#000000',
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  const errors = [];
  win.webContents.on('console-message', (e) => {
    const msg = typeof e === 'object' && e.message ? e.message : String(e);
    if (/error|Error|fail/i.test(msg)) errors.push(msg);
    console.log('[console]', msg);
  });
  await win.loadFile(path.join(__dirname, '..', 'preview.html'));
  await new Promise(r => setTimeout(r, 1800));

  const arg = process.argv.slice(2).find(a => !a.startsWith('-'));
  const list = arg ? arg.split(',') : WORLDS;
  const only = process.argv.includes('--first') ? list.slice(0, 1) : list;

  for (const w of only) {
    const ok = await win.webContents.executeJavaScript(`window.__setWorld(${JSON.stringify(w)})`);
    // El primer capturePage puede devolver el frame anterior: se fuerza un
    // render, se espera a que se pinte y se descarta una captura de calentamiento.
    await new Promise(r => setTimeout(r, 500));
    await win.webContents.executeJavaScript('window.__render && window.__render()');
    await new Promise(r => setTimeout(r, 900));
    await win.webContents.capturePage();
    await new Promise(r => setTimeout(r, 260));
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, w + '.png'), img.toPNG());
    console.log('SHOT', w, ok);
  }
  if (errors.length) console.log('ERRORS:', JSON.stringify(errors.slice(0, 8)));
  app.quit();
});
