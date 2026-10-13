// Shared test support: a Postgres that behaves like Supabase for our purposes
// (anon / authenticated / service_role roles, pgcrypto in `extensions`,
// Supabase-style default privileges that grant everything to anon), plus a
// PostgREST-like `rpc()` that calls a function *as anon* with named args.
//
// Backends: PGlite (default, in-process) or a real Postgres via `pg`
// when PG_URL is set.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SQL_PATH = path.resolve(here, '../../supabase/supabase-quest-setup.sql');

const SUPABASE_SHIM = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists extensions;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
-- Supabase grants everything on new objects in public to the API roles.
-- Our SQL must revoke it; the tests prove that it does.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

async function pgliteAdapter() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.waitReady;
  let chain = Promise.resolve();
  // PGlite is single-connection: serialise transactions.
  const serial = (fn) => {
    const p = chain.then(fn, fn);
    chain = p.catch(() => {});
    return p;
  };
  return {
    kind: 'pglite',
    exec: (sql) => serial(() => db.exec(sql)),
    query: (sql, params) => serial(() => db.query(sql, params)),
    tx: (fn) => serial(() => db.transaction(async (t) => fn({ query: (s, p) => t.query(s, p), exec: (s) => t.exec(s) }))),
    close: () => db.close(),
  };
}

async function pgAdapter(url) {
  const pg = (await import('pg')).default;
  const pool = new pg.Pool({ connectionString: url, max: 4 });
  return {
    kind: 'pg',
    exec: (sql) => pool.query(sql),
    query: (sql, params) => pool.query(sql, params),
    tx: async (fn) => {
      const c = await pool.connect();
      try {
        await c.query('begin');
        const r = await fn({ query: (s, p) => c.query(s, p), exec: (s) => c.query(s) });
        await c.query('commit');
        return r;
      } catch (e) {
        await c.query('rollback').catch(() => {});
        throw e;
      } finally {
        c.release();
      }
    },
    close: () => pool.end(),
  };
}

export async function createDb({ url = process.env.PG_URL, install = true } = {}) {
  const db = url ? await pgAdapter(url) : await pgliteAdapter();
  if (url) {
    // fresh public schema on a real server
    await db.exec(`drop schema if exists public cascade; create schema public; drop schema if exists extensions cascade;`);
  }
  await db.exec(SUPABASE_SHIM);
  if (install) await db.exec(readFileSync(SQL_PATH, 'utf8'));
  const sigCache = new Map();

  async function signature(fn) {
    if (sigCache.has(fn)) return sigCache.get(fn);
    const r = await db.query(
      `select p.proargnames as names, array(select format_type(t, null) from unnest(p.proargtypes) t) as types
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname=$1`,
      [fn],
    );
    if (!r.rows.length) throw new Error(`no such function ${fn}`);
    const row = r.rows[0];
    const names = Array.isArray(row.names) ? row.names : parseArr(row.names);
    const types = Array.isArray(row.types) ? row.types : parseArr(row.types);
    const sig = names.map((n, i) => ({ name: n, type: types[i] }));
    sigCache.set(fn, sig);
    return sig;
  }

  /** Call a public function the way PostgREST would: as `role`, named args. */
  async function rpc(fn, args = {}, { role = 'anon', headers = {} } = {}) {
    if (!/^[a-z_][a-z0-9_]*$/.test(fn)) throw new Error('bad fn');
    const sig = await signature(fn);
    const known = new Set(sig.map((s) => s.name));
    for (const k of Object.keys(args)) if (!known.has(k)) throw new Error(`unknown arg ${k} for ${fn}`);
    const parts = [];
    const params = [];
    for (const s of sig) {
      if (!(s.name in args)) continue;
      let v = args[s.name];
      if (s.type === 'jsonb' || s.type === 'json') v = v === undefined ? null : JSON.stringify(v);
      params.push(v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));
      parts.push(`${s.name} => $${params.length}::${s.type}`);
    }
    return db.tx(async (t) => {
      await t.query(`select set_config('request.headers', $1, true)`, [JSON.stringify(headers)]);
      await t.query(`set local role ${role}`);
      const r = await t.query(`select public.${fn}(${parts.join(', ')}) as r`, params);
      const v = r.rows[0].r;
      return typeof v === 'string' ? JSON.parse(v) : v;
    });
  }

  /** Run arbitrary SQL as a role (used to prove direct table access is denied). */
  async function asRole(role, sql, params) {
    return db.tx(async (t) => {
      await t.query(`set local role ${role}`);
      return t.query(sql, params);
    });
  }

  return { ...db, rpc, asRole };
}

function parseArr(s) {
  if (s == null) return [];
  return String(s)
    .replace(/^\{|\}$/g, '')
    .split(',')
    .map((x) => x.replace(/^"|"$/g, ''));
}
