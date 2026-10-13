// E2E server: serves dist/ with the headers from dist/_headers, and a
// PostgREST-compatible /rest/v1/rpc/<fn> backed by Postgres (PGlite) with
// the real supabase-quest-setup.sql. Same origin as the site, so the
// production CSP (connect-src 'self' https://*.supabase.co) applies as is.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createDb } from '../support/rpc-db.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../../dist');
const port = Number(process.env.PORT || 4173);
const db = await createDb();

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.tflite': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.ics': 'text/calendar',
};

function parseHeaders() {
  const f = path.join(dist, '_headers');
  if (!existsSync(f)) return [];
  const rules = [];
  let cur = null;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    if (!line.startsWith(' ')) {
      cur = { pattern: line.trim(), headers: {} };
      rules.push(cur);
    } else if (cur) {
      const i = line.indexOf(':');
      cur.headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return rules;
}
const rules = parseHeaders();
const match = (pattern, p) => (pattern.endsWith('*') ? p.startsWith(pattern.slice(0, -1)) : p === pattern);

const config = process.env.E2E_EMPTY_CONFIG
  ? null
  : `window.QUEST_CONFIG = { SUPABASE_URL: 'http://localhost:${port}', SUPABASE_KEY: 'sb_publishable_e2e_test_key', CONTACT: '' };\n`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  for (const r of rules) if (match(r.pattern, url.pathname)) for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const fn = url.pathname.slice('/rest/v1/rpc/'.length);
    if (req.method !== 'POST' || !req.headers.apikey) {
      res.writeHead(401).end('{}');
      return;
    }
    let body = '';
    for await (const c of req) body += c;
    try {
      const args = body ? JSON.parse(body) : {};
      if (!/^q_[a-z_]+$/.test(fn) || fn.startsWith('q__')) throw Object.assign(new Error('not found'), { status: 404 });
      // like a gateway: forward the client IP only if one is given (per-IP limits are covered by the SQL tests)
      const xff = req.headers['x-forwarded-for'];
      const out = await db.rpc(fn, args, { headers: xff ? { 'x-forwarded-for': String(xff) } : {} });
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(e.status || 400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: String(e.message) }));
    }
    return;
  }
  if (url.pathname === '/__test/sql' && process.env.E2E_SQL === '1') {
    let body = '';
    for await (const c of req) body += c;
    const { sql, params } = JSON.parse(body);
    const r = await db.query(sql, params ?? []);
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(r.rows));
    return;
  }
  if (url.pathname === '/config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    res.end(config ?? readFileSync(path.join(dist, 'config.js')));
    return;
  }
  let p = path.join(dist, decodeURIComponent(url.pathname));
  if (!p.startsWith(dist)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(p) || statSync(p).isDirectory()) p = path.join(dist, 'index.html');
  const type = TYPES[path.extname(p)] ?? 'application/octet-stream';
  let body = readFileSync(p);
  // Netlify compresses text assets; do the same so performance numbers are realistic
  if (/text|javascript|json|svg|wasm/.test(type) && /gzip/.test(String(req.headers['accept-encoding']))) {
    body = gzipSync(body);
    res.setHeader('Content-Encoding', 'gzip');
  }
  res.writeHead(200, { 'Content-Type': type });
  res.end(body);
});
server.listen(port, () => console.log(`e2e server on http://localhost:${port}`));
