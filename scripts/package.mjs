// Builds deliverables/: the site zip (drag & drop to Netlify), the SQL, and the docs.
// Pure Node (no `zip` binary needed).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { deflateRawSync, crc32 } from 'node:zlib';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'deliverables');

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function zip(files, base) {
  const local = [];
  const central = [];
  let offset = 0;
  const dosTime = () => {
    const d = new Date();
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  };
  const { time, date } = dosTime();
  for (const f of files) {
    const name = Buffer.from(path.relative(base, f).split(path.sep).join('/'), 'utf8');
    const data = readFileSync(f);
    const crc = crc32(data) >>> 0;
    const deflated = deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(0x0800, 6); // UTF-8 names
    h.writeUInt16LE(useDeflate ? 8 : 0, 8);
    h.writeUInt16LE(time, 10);
    h.writeUInt16LE(date, 12);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(body.length, 18);
    h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(name.length, 26);
    h.writeUInt16LE(0, 28);
    local.push(h, name, body);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(useDeflate ? 8 : 0, 10);
    c.writeUInt16LE(time, 12);
    c.writeUInt16LE(date, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(body.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += h.length + name.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, end]);
}

if (!existsSync(path.join(dist, 'index.html'))) throw new Error('run the build first');
// config.js must ship empty: the owner fills it after uploading
const cfg = readFileSync(path.join(dist, 'config.js'), 'utf8');
if (!/SUPABASE_URL: ''/.test(cfg) || !/SUPABASE_KEY: ''/.test(cfg)) throw new Error('dist/config.js is not empty');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const files = walk(dist).sort();
writeFileSync(path.join(out, 'the-quest-site.zip'), zip(files, dist));
copyFileSync(path.join(root, 'supabase', 'supabase-quest-setup.sql'), path.join(out, 'supabase-quest-setup.sql'));
for (const f of ['README-he.txt', 'SECURITY.md', 'DECISIONS.md', 'REPORT.md']) {
  const src = existsSync(path.join(root, 'deploy', f)) ? path.join(root, 'deploy', f) : path.join(root, f);
  if (existsSync(src)) copyFileSync(src, path.join(out, f));
  else console.warn('missing', f);
}
const size = statSync(path.join(out, 'the-quest-site.zip')).size;
console.log(`deliverables ready: ${files.length} files, zip ${(size / 1024 / 1024).toFixed(1)} MB`);
