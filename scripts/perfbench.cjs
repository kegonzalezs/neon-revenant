// Banco de pruebas de rendimiento.
// Carga un index.html concreto (el original o la copia), monta la MISMA escena
// de combate y mide tiempos de frame reales. No modifica nada del proyecto que
// carga: solo lo abre y lo ejecuta.
//
//   electron scripts/perfbench.cjs --target=<ruta al proyecto> [--enemies=60]
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('use-angle', 'd3d11');
app.commandLine.appendSwitch('force-high-performance-gpu');

const argOf = (name, fallback) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};
// La ruta puede tener espacios: se acepta por variable de entorno para no pelear
// con el entrecomillado de cmd.
const target = process.env.BENCH_TARGET || argOf('target', __dirname);
const enemyCount = Number(argOf('enemies', '60'));
const winW = Number(process.env.BENCH_W || argOf('w', '1440'));
const winH = Number(process.env.BENCH_H || argOf('h', '900'));

let win = null;

async function main() {
  win = new BrowserWindow({
    width: winW, height: winH, show: true, backgroundColor: '#06080b',
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false,
      preload: path.join(target, 'preload.cjs')
    }
  });
  await win.loadFile(path.join(target, 'index.html'));
  win.show(); win.focus();   // una ventana oculta limita rAF a 1 fps
  const run = (code) => win.webContents.executeJavaScript(code);

  // 1) menú -> hub -> despliegue
  await new Promise(r => setTimeout(r, 3200));
  await run("document.getElementById('start-btn').click()");
  await new Promise(r => setTimeout(r, 900));
  await run("window.__NR_SMOKE=true;document.querySelector('[data-character=kira]').click();document.querySelector('[data-level=docks]').click();document.querySelector('[data-tab=sector]').click()");
  await new Promise(r => setTimeout(r, 500));
  await run("document.getElementById('hub-deploy').click()");
  await new Promise(r => setTimeout(r, 3400));

  // 2) misma carga exacta en ambos proyectos
  const setup = await run(`(async()=>{
    const m = await import('./src/game.js');
    m.testClearEnemies();
    await new Promise(r=>setTimeout(r,150));
    for (let i=0;i<${enemyCount};i++) m.testSpawn(i%6===0?'tank':i%5===0?'flyer':i%4===0?'ranged':'chaser');
    ['orbit','tesla','frost','aura','mines','beam','regen','chrono','dashwave','deathexplode'].forEach(id=>m.testAbility(id));
    // Disparo continuo: genera trazadoras, impactos y partículas sin parar, que es
    // justo la carga donde el sistema de FX antiguo se hundía.
    dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true}));
    await new Promise(r=>setTimeout(r,1200));
    return { enemies: m.getState().enemies, abilities: Object.keys(m.getState().abilities).length };
  })()`);

  // 3) medición: 4 s de frames reales
  const bench = await run(`(async()=>{
    const samples = [];
    let last = performance.now();
    let frames = 0;
    await new Promise(resolve => {
      const tick = () => {
        const now = performance.now();
        samples.push(now - last); last = now; frames++;
        if (now - start < 4000) requestAnimationFrame(tick); else resolve();
      };
      const start = performance.now();
      requestAnimationFrame(tick);
    });
    samples.shift();
    samples.sort((a,b)=>a-b);
    const sum = samples.reduce((a,b)=>a+b,0);
    const p = (q) => samples[Math.min(samples.length-1, Math.floor(samples.length*q))];
    return {
      frames,
      avgMs: +(sum/samples.length).toFixed(2),
      fps: +(1000/(sum/samples.length)).toFixed(1),
      p50: +p(.5).toFixed(2), p95: +p(.95).toFixed(2), worst: +samples[samples.length-1].toFixed(2),
      enemies: ${enemyCount}, w: innerWidth, h: innerHeight
    };
  })()`);

  let extra = null;
  try {
    extra = await run(`(async()=>{ const m = await import('./src/game.js'); return m.getPerf ? m.getPerf() : null; })()`);
  } catch (e) { extra = null; }

  console.log('BENCH ' + JSON.stringify({ target: path.basename(target), setup, bench, perf: extra }));
  app.quit();
}

app.whenReady().then(() => {
  main().catch(err => {
    console.log('BENCH_FAIL ' + err.message);
    app.quit();
  });
});
app.on('window-all-closed', () => app.quit());
