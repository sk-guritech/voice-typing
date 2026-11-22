const { spawn } = require('node:child_process');
const path = require('node:path');
const electron = require('electron');

const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [path.resolve(__dirname, '..'), ...process.argv.slice(2)], {
  env: environment,
  stdio: 'inherit',
});
child.on('error', error => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', code => { process.exitCode = code ?? 1; });
