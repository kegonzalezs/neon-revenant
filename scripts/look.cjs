// Vista libre del visor: mundo + cámara a medida. Para depurar qué hay delante
// del jugador sin lanzar la partida entera.
// Uso: npx electron scripts/look.cjs hive 0,6,20 0,4,0 [salida]
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('use-angle', 'd3d11');

const args = process.argv.slice(2).filter(a => !a.startsWith('-'));
const world = args[0] || 'hive';
const pos = (args[1] || '0,6,20').split(',').map(Number);
const look = (args[2] || '0,4,0').split(',').map(Number);
const out = args[3] || path.join(__dirname, '..', 'shots', 'look.png');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 720, show: true, backgroundColor: '#000' });
  win.webContents.on('console-message', (e) => {
    const m = typeof e === 'object' && e.message ? e.message : String(e);
    if (/error|Error/i.test(m)) console.log('[c]', m);
  });
  await win.loadFile(path.join(__dirname, '..', 'preview.html'));
  await new Promise(r => setTimeout(r, 1600));
  await win.webContents.executeJavaScript(`window.__setWorld(${JSON.stringify(world)})`);
  await new Promise(r => setTimeout(r, 500));
  await win.webContents.executeJavaScript(`window.__setCam([${pos}],[${look}])`);
  await new Promise(r => setTimeout(r, 600));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(out, img.toPNG());
  console.log('LOOK', world, pos.join(','), '->', look.join(','), out);
  app.quit();
});
