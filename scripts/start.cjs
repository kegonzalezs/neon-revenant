const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const electron = require('electron');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [root, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  windowsHide: false
});
child.on('exit', (code) => process.exit(code || 0));
