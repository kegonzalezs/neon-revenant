// Diagnóstico: carga index.html y captura errores de consola / módulos.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('use-angle', 'd3d11');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 800, show: false, webPreferences: { contextIsolation: true, sandbox: true } });
  win.webContents.on('console-message', (e) => {
    const msg = typeof e === 'object' && e.message ? e.message : String(e);
    console.log('[console]', msg);
  });
  win.webContents.on('render-process-gone', (_e, d) => console.log('[gone]', d.reason));
  win.webContents.on('preload-error', (_e, p, err) => console.log('[preload]', p, err.message));
  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise(r => setTimeout(r, 2500));
  const out = await win.webContents.executeJavaScript(`(async()=>{
    const boot = document.getElementById('boot');
    let modErr = null;
    try { await import('./src/game.js'); } catch (e) { modErr = String(e && e.stack || e); }
    return { boot: !!boot, bootOpacity: boot ? getComputedStyle(boot).opacity : null, modErr,
             canvas: !!document.querySelector('#game canvas'),
             hud: !!document.getElementById('hud') };
  })()`);
  console.log('PAGE_DIAG:', JSON.stringify(out));
  app.quit();
});
