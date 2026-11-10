// Diagnóstico: comprueba si WebGL está disponible en este entorno y captura
// el primer error de carga de index.html.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('use-angle', 'd3d11');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 800, height: 600, show: false, webPreferences: { contextIsolation: true } });
  win.webContents.on('console-message', (e) => {
    const msg = typeof e === 'object' && e.message ? e.message : String(e);
    console.log('[console]', msg);
  });
  win.webContents.on('render-process-gone', (_e, d) => console.log('[gone]', d.reason));
  await win.loadURL('data:text/html,<canvas id=c></canvas>');
  const gl = await win.webContents.executeJavaScript(`(()=>{
    const c=document.getElementById('c');
    const g=c.getContext('webgl2')||c.getContext('webgl');
    if(!g) return {ok:false};
    const d=g.getExtension('WEBGL_debug_renderer_info');
    return {ok:true, renderer:d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)};
  })()`);
  console.log('GLCHECK:', JSON.stringify(gl));
  app.quit();
});
