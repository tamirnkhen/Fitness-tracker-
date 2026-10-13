// Runs the SQL test-suite against a throwaway *real* Postgres cluster
// (initdb + postgres on a unix socket), in addition to PGlite.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function findBin() {
  const base = '/usr/lib/postgresql';
  if (!existsSync(base)) return null;
  const v = readdirSync(base).sort().reverse()[0];
  return v ? path.join(base, v, 'bin') : null;
}

const bin = process.env.PG_BIN || findBin();
if (!bin || !existsSync(path.join(bin, 'postgres'))) {
  console.log('No local Postgres binaries found; skipping real-Postgres SQL tests.');
  process.exit(0);
}

const dir = mkdtempSync(path.join(tmpdir(), 'quest-pg-'));
const data = path.join(dir, 'data');
const asUser = process.getuid && process.getuid() === 0 ? ['runuser', '-u', 'postgres', '--'] : [];
if (asUser.length) execFileSync('chown', ['-R', 'postgres', dir]);
const run = (cmd, args) => (asUser.length ? execFileSync(asUser[0], [...asUser.slice(1), cmd, ...args]) : execFileSync(cmd, args));

run(path.join(bin, 'initdb'), ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-sync', '-E', 'UTF8', '--locale=C.UTF-8']);
const port = 55432;
const pg = spawn(asUser.length ? asUser[0] : path.join(bin, 'postgres'),
  [...(asUser.length ? [...asUser.slice(1), path.join(bin, 'postgres')] : []), '-D', data, '-k', dir, '-p', String(port), '-c', 'listen_addresses=', '-c', 'fsync=off'],
  { stdio: 'inherit' });

let code = 1;
try {
  for (let i = 0; i < 50; i++) {
    try {
      execFileSync(path.join(bin, 'pg_isready'), ['-h', dir, '-p', String(port)], { stdio: 'ignore' });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  const url = `postgresql://postgres@/postgres?host=${encodeURIComponent(dir)}&port=${port}`;
  const r = spawn('npx', ['vitest', 'run', 'tests/sql'], { stdio: 'inherit', env: { ...process.env, PG_URL: url } });
  code = await new Promise((res) => r.on('exit', res));
} finally {
  pg.kill('SIGINT');
  await new Promise((r) => setTimeout(r, 800));
  rmSync(dir, { recursive: true, force: true });
}
process.exit(code ?? 1);
