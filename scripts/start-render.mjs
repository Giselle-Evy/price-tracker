

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const children = new Map();
let shuttingDown = false;
let shutdownExitCode = 0;
let forceExitTimer;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    if (exitCode !== 0) {
      shutdownExitCode = exitCode;
      process.exitCode = exitCode;
    }
    return;
  }

  shuttingDown = true;
  shutdownExitCode = exitCode;
  process.exitCode = exitCode;

  console.log('\nCerrando API y Worker...');

  const activeChildren = [...children.entries()].filter(
    ([, child]) => child.exitCode === null && child.signalCode === null
  );

  if (activeChildren.length === 0) {
    process.exit(shutdownExitCode);
  }

  forceExitTimer = setTimeout(() => {
    console.error('Tiempo agotado al cerrar los procesos.');
    process.exit(shutdownExitCode || 1);
  }, 10000);

  for (const [name, child] of activeChildren) {
    console.log(`Deteniendo ${name}...`);

    try {
      child.kill('SIGTERM');
    } catch (error) {
      console.error(`No se pudo detener ${name}:`, error);
      shutdownExitCode = 1;
      process.exitCode = 1;
    }
  }

  // Si todos los procesos ya terminaron, se puede cerrar el lanzador.
  checkChildrenStopped();
}

function checkChildrenStopped() {
  if (!shuttingDown) return;

  const stillRunning = [...children.values()].some(
    (child) => child.exitCode === null && child.signalCode === null
  );

  if (!stillRunning) {
    if (forceExitTimer) clearTimeout(forceExitTimer);
    process.exit(shutdownExitCode);
  }
}

function startProcess(name, args) {
  if (shuttingDown) return null;

  console.log(`\nIniciando ${name}...`);

  const child = spawn(process.execPath, args, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
  });

  children.set(name, child);

  child.on('error', (error) => {
    console.error(`No se pudo iniciar ${name}:`, error);
    shutdown(1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      checkChildrenStopped();
      return;
    }

    console.error(
      `${name} terminó inesperadamente. Código: ${code}, señal: ${signal}`
    );

    shutdown(code === 0 ? 1 : (code ?? 1));
  });

  return child;
}

async function runMigrations() {
  console.log('Ejecutando migraciones de Prisma...');

  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

  const child = spawn(
    command,
    [
      '--filter',
      '@price-tracker/api',
      'exec',
      'prisma',
      'migrate',
      'deploy',
    ],
    {
      cwd: rootDir,
      env: process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    }
  );

  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (exitCode) => resolve(exitCode ?? 1));
  });

  if (shuttingDown) {
    throw new Error('El servicio se está cerrando.');
  }

  if (code !== 0) {
    throw new Error(`Las migraciones fallaron. Código: ${code}`);
  }

  console.log('Migraciones completadas correctamente.');
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  await runMigrations();

  if (shuttingDown) return;

  startProcess('API', ['apps/api/dist/index.js']);
  startProcess('Worker', ['apps/worker/dist/index.js']);
}

main().catch((error) => {
  console.error('Error al iniciar Price Tracker:', error);
  shutdown(1);
});
