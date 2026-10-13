import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error JS helper
import { createDb, SQL_PATH } from '../support/rpc-db.mjs';

type Db = Awaited<ReturnType<typeof createDb>>;
let db: Db;
let n = 0;
const phone = () => `05${String(20000000 + ++n * 7919).padStart(8, '0')}`;
const COL: Record<string, string> = {
  q_config: 'v',
  q_users: 'created_at',
  q_auth: 'fails',
  q_sessions: 'created_at',
  q_parties: 'created_at',
  q_members: 'joined_at',
  q_rate: 'n',
};
const TABLES = ['q_config', 'q_users', 'q_auth', 'q_sessions', 'q_parties', 'q_members', 'q_rate'];

async function register(over: Record<string, unknown> = {}) {
  const p = (over.p_phone as string) ?? phone();
  const r = await db.rpc('q_register', { p_phone: p, p_pin: '4826', p_name: 'גיבור', p_consent_ver: 1, ...over });
  return { ...r, phone: p };
}

beforeAll(async () => {
  db = await createDb();
}, 60000);
afterAll(async () => db?.close());

describe('install', () => {
  it('is idempotent and keeps the admin key', async () => {
    const k1 = (await db.query(`select v from q_config where k='admin_key'`)).rows[0].v;
    expect(k1).toMatch(/^[0-9a-f]{36}$/);
    await db.exec(`create or replace function public.q_old_login(p text) returns text language sql as $$ select p $$;`);
    await db.exec(readFileSync(SQL_PATH, 'utf8'));
    await db.exec(readFileSync(SQL_PATH, 'utf8'));
    const k2 = (await db.query(`select v from q_config where k='admin_key'`)).rows[0].v;
    expect(k2).toBe(k1);
    const old = await db.query(`select 1 from pg_proc where proname='q_old_login'`);
    expect(old.rows.length).toBe(0);
  });

  it('keeps existing user data on re-install', async () => {
    const r = await register();
    await db.exec(readFileSync(SQL_PATH, 'utf8'));
    const l = await db.rpc('q_load', { p_token: r.token });
    expect(l.ok).toBe(true);
  });

  it('has RLS enabled and no policies on every table', async () => {
    for (const t of TABLES) {
      const r = await db.query(`select relrowsecurity from pg_class where relname=$1`, [t]);
      expect(r.rows[0].relrowsecurity, t).toBe(true);
    }
    const pol = await db.query(`select count(*)::int c from pg_policies where tablename like 'q\\_%'`);
    expect(pol.rows[0].c).toBe(0);
  });

  it('every q_ function is security definer with a fixed search_path', async () => {
    const r = await db.query(`
      select p.proname, p.prosecdef, p.proconfig, p.provolatile from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname like 'q\\_%' and p.proname not like 'q\\_\\_%'`);
    expect(r.rows.length).toBeGreaterThanOrEqual(15);
    for (const row of r.rows) {
      expect(row.prosecdef, row.proname).toBe(true);
      expect(String(row.proconfig), row.proname).toContain('search_path=public, extensions, pg_temp');
    }
  });
});

describe('anon has no direct access', () => {
  for (const t of TABLES) {
    it(`cannot read or write ${t}`, async () => {
      for (const role of ['anon', 'authenticated']) {
        await expect(db.asRole(role, `select * from ${t} limit 1`)).rejects.toThrow(/permission denied/);
        await expect(db.asRole(role, `delete from ${t}`)).rejects.toThrow(/permission denied/);
        await expect(db.asRole(role, `update ${t} set ${COL[t]} = default`)).rejects.toThrow(/permission denied/);
      }
    });
  }
  it('cannot insert into users', async () => {
    await expect(db.asRole('anon', `insert into q_users(phone,pin_hash,name) values ('1','x','y')`)).rejects.toThrow(/permission denied/);
  });
  it('cannot call internal helpers', async () => {
    for (const sql of [
      `select q__uid('x')`,
      `select q__new_session(gen_random_uuid())`,
      `select q__cfg('admin_key')`,
      `select q__hit('a',1,1)`,
      `select q__payload(gen_random_uuid())`,
    ]) {
      await expect(db.asRole('anon', sql), sql).rejects.toThrow(/permission denied/);
    }
  });
});

describe('register', () => {
  it('validates input', async () => {
    expect((await register({ p_phone: '123' })).err).toBe('bad_phone');
    expect((await register({ p_pin: '12a4' })).err).toBe('bad_pin');
    expect((await register({ p_pin: '12345' })).err).toBe('bad_pin');
    expect((await register({ p_pin: '1111' })).err).toBe('weak_pin');
    expect((await register({ p_pin: '1234' })).err).toBe('weak_pin');
    expect((await register({ p_name: '   ' })).err).toBe('bad_name');
    expect((await register({ p_name: 'x'.repeat(30) })).err).toBe('bad_name');
  });
  it('requires consent of the current terms version', async () => {
    expect((await register({ p_consent_ver: null })).err).toBe('consent_required');
    expect((await register({ p_consent_ver: 0 })).err).toBe('consent_required');
  });
  it('stores consent version + time, bcrypt hash, normalised phone', async () => {
    const r = await register({ p_phone: '+972-54-1234567' });
    expect(r.ok).toBe(true);
    expect(r.token).toMatch(/^[0-9a-f]{64}$/);
    const u = (await db.query(`select * from q_users where phone='972541234567'`)).rows[0];
    expect(u.consent_ver).toBe(1);
    expect(u.consent_at).toBeTruthy();
    expect(u.pin_hash).toMatch(/^\$2a\$08\$/);
    expect(u.pin_hash).not.toContain('4826');
  });
  it('stores only the token hash', async () => {
    const r = await register();
    const s = await db.query(`select token_hash from q_sessions`);
    expect(s.rows.some((x: { token_hash: string }) => x.token_hash === r.token)).toBe(false);
  });
  it('rejects a duplicate phone (05x and 972 forms)', async () => {
    const p = phone();
    expect((await register({ p_phone: p })).ok).toBe(true);
    expect((await register({ p_phone: '972' + p.slice(1) })).err).toBe('phone_taken');
  });
  it('strips markup from the name', async () => {
    const r = await register({ p_name: '<img onerror=x>' });
    expect(r.ok).toBe(true);
    expect(r.user.name).not.toMatch(/[<>]/);
  });
  it('rate limits by IP when the gateway passes one', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' };
    const out: string[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await db.rpc('q_register', { p_phone: phone(), p_pin: '4826', p_name: 'a', p_consent_ver: 1 }, { headers });
      out.push(r.ok ? 'ok' : r.err);
    }
    expect(out.slice(0, 10).every((x) => x === 'ok')).toBe(true);
    expect(out.slice(10)).toEqual(['rate', 'rate']);
  });
});

describe('login + lockout', () => {
  it('logs in and returns state and a fresh token', async () => {
    const r = await register();
    const l = await db.rpc('q_login', { p_phone: r.phone, p_pin: '4826' });
    expect(l.ok).toBe(true);
    expect(l.token).not.toBe(r.token);
    expect(l.state).toEqual({});
    expect(JSON.stringify(l)).not.toContain(r.phone.slice(1));
  });
  it('same error for unknown phone and wrong code', async () => {
    const r = await register();
    const a = await db.rpc('q_login', { p_phone: r.phone, p_pin: '9999' });
    const b = await db.rpc('q_login', { p_phone: phone(), p_pin: '9999' });
    expect(a).toEqual({ ok: false, err: 'bad_credentials', left: 4 });
    expect(b).toEqual({ ok: false, err: 'bad_credentials', left: 4 });
  });
  it('locks for 15 minutes after 5 failures, even with the right code', async () => {
    const r = await register();
    let last;
    for (let i = 0; i < 5; i++) last = await db.rpc('q_login', { p_phone: r.phone, p_pin: '0001' });
    expect(last.err).toBe('locked');
    expect(last.retry_in).toBe(900);
    const ok = await db.rpc('q_login', { p_phone: r.phone, p_pin: '4826' });
    expect(ok.err).toBe('locked');
    expect(ok.retry_in).toBeGreaterThan(890);
  });
  it('escalates the lock and caps it at 24h', async () => {
    const r = await register();
    const ph = '972' + r.phone.slice(1);
    const secs: number[] = [];
    for (let round = 0; round < 9; round++) {
      await db.query(`update q_auth set locked_until = null where phone=$1`, [ph]);
      await db.query(`delete from q_rate where bucket like 'login:%'`);
      let last;
      for (let i = 0; i < 5; i++) last = await db.rpc('q_login', { p_phone: r.phone, p_pin: '0001' });
      secs.push(last.retry_in);
    }
    expect(secs.slice(0, 5)).toEqual([900, 1800, 3600, 7200, 14400]);
    expect(secs[secs.length - 1]).toBe(86400);
  });
  it('locks unknown phones too (no existence oracle)', async () => {
    const p = phone();
    let last;
    for (let i = 0; i < 5; i++) last = await db.rpc('q_login', { p_phone: p, p_pin: '0001' });
    expect(last.err).toBe('locked');
  });
  it('rate limits by phone', async () => {
    const r = await register();
    await db.query(`delete from q_rate`);
    const out = [];
    for (let i = 0; i < 12; i++) {
      const l = await db.rpc('q_login', { p_phone: r.phone, p_pin: '4826' });
      out.push(l.ok ? 'ok' : l.err);
    }
    expect(out.slice(0, 10).every((x) => x === 'ok')).toBe(true);
    expect(out[11]).toBe('rate');
  });
});

describe('sessions', () => {
  it('rejects a bad / expired / logged-out token', async () => {
    const r = await register();
    expect((await db.rpc('q_load', { p_token: 'nope' })).err).toBe('auth');
    expect((await db.rpc('q_load', { p_token: 'f'.repeat(64) })).err).toBe('auth');
    expect((await db.rpc('q_load', { p_token: r.token })).ok).toBe(true);
    await db.rpc('q_logout', { p_token: r.token });
    expect((await db.rpc('q_load', { p_token: r.token })).err).toBe('auth');

    const r2 = await register();
    await db.query(`update q_sessions set expires_at = now() - interval '1 second'`);
    expect((await db.rpc('q_load', { p_token: r2.token })).err).toBe('auth');
  });
  it('change pin keeps this device and signs out the others', async () => {
    const r = await register();
    const other = await db.rpc('q_login', { p_phone: r.phone, p_pin: '4826' });
    expect((await db.rpc('q_change_pin', { p_token: r.token, p_old: '0000', p_new: '7391' })).err).toBe('bad_credentials');
    expect((await db.rpc('q_change_pin', { p_token: r.token, p_old: '4826', p_new: '2222' })).err).toBe('weak_pin');
    expect((await db.rpc('q_change_pin', { p_token: r.token, p_old: '4826', p_new: '7391' })).ok).toBe(true);
    expect((await db.rpc('q_load', { p_token: r.token })).ok).toBe(true);
    expect((await db.rpc('q_load', { p_token: other.token })).err).toBe('auth');
    expect((await db.rpc('q_login', { p_phone: r.phone, p_pin: '7391' })).ok).toBe(true);
  });
});

const pub = (o: Record<string, unknown> = {}) => ({ name: 'גיבור', level: 3, xp: 420, streak: 2, title: 'חניך', thumb: null, ...o });

describe('save', () => {
  it('uses optimistic concurrency on saved_at', async () => {
    const r = await register();
    const s1 = await db.rpc('q_save', { p_token: r.token, p_base: 0, p_state: { a: 1 }, p_pub: pub() });
    expect(s1.ok).toBe(true);
    expect(s1.saved_at).toBeGreaterThan(0);
    const stale = await db.rpc('q_save', { p_token: r.token, p_base: 0, p_state: { a: 0 }, p_pub: pub() });
    expect(stale.err).toBe('conflict');
    expect(stale.state).toEqual({ a: 1 });
    expect(stale.saved_at).toBe(s1.saved_at);
    const s2 = await db.rpc('q_save', { p_token: r.token, p_base: s1.saved_at, p_state: { a: 2 }, p_pub: pub() });
    expect(s2.ok).toBe(true);
    expect(s2.saved_at).toBeGreaterThan(s1.saved_at);
  });
  it('enforces size caps', async () => {
    const r = await register();
    const big = { x: 'a'.repeat(270000) };
    expect((await db.rpc('q_save', { p_token: r.token, p_base: 0, p_state: big, p_pub: pub() })).err).toBe('too_big');
    const img = 'data:image/png;base64,' + 'A'.repeat(720000);
    expect((await db.rpc('q_save', { p_token: r.token, p_base: 0, p_state: {}, p_pub: pub(), p_imgs: { cut: img }, p_img_v: 1 })).err).toBe(
      'bad_imgs',
    );
  });
  it('validates images', async () => {
    const r = await register();
    for (const cut of [
      'javascript:alert(1)',
      'data:image/svg+xml;base64,AAAA',
      'data:text/html;base64,AAAA',
      'data:image/png;base64,AA"><script>',
    ]) {
      expect((await db.rpc('q_save', { p_token: r.token, p_base: 0, p_state: {}, p_pub: pub(), p_imgs: { cut }, p_img_v: 1 })).err).toBe(
        'bad_imgs',
      );
    }
    expect(
      (
        await db.rpc('q_save', {
          p_token: r.token,
          p_base: 0,
          p_state: {},
          p_pub: pub(),
          p_imgs: { original: 'data:image/png;base64,AAAA' },
          p_img_v: 1,
        })
      ).err,
    ).toBe('bad_imgs');
    const ok = await db.rpc('q_save', {
      p_token: r.token,
      p_base: 0,
      p_state: {},
      p_pub: pub(),
      p_imgs: { cut: 'data:image/png;base64,AAAA', thumb: 'data:image/jpeg;base64,AAAA', frame: { v: 2 } },
      p_img_v: 1,
    });
    expect(ok.ok).toBe(true);
    // a save without p_img_v keeps the images
    const ok2 = await db.rpc('q_save', { p_token: r.token, p_base: ok.saved_at, p_state: { b: 1 }, p_pub: pub() });
    expect(ok2.ok).toBe(true);
    const l = await db.rpc('q_load', { p_token: r.token });
    expect(l.imgs.cut).toBe('data:image/png;base64,AAAA');
    expect(l.img_v).toBe(1);
  });
  it('validates the public card', async () => {
    const r = await register();
    const bad = [
      pub({ level: 'x' }),
      pub({ level: 0 }),
      pub({ level: 5000 }),
      pub({ xp: -1 }),
      pub({ streak: '1' }),
      pub({ name: 5 }),
      pub({ title: 't'.repeat(41) }),
      pub({ thumb: 'javascript:alert(1)' }),
      pub({ thumb: 'data:image/svg+xml;base64,AAAA' }),
      pub({ thumb: 'data:image/png;base64,' + 'A'.repeat(33000) }),
    ];
    for (const p of bad) {
      expect((await db.rpc('q_save', { p_token: r.token, p_base: 0, p_state: {}, p_pub: p })).err, JSON.stringify(p).slice(0, 80)).toBe(
        'bad_pub',
      );
    }
    const ok = await db.rpc('q_save', {
      p_token: r.token,
      p_base: 0,
      p_state: {},
      p_pub: pub({ name: '<b>x</b>', extra: 'dropped', phone: '0501234567' }),
    });
    expect(ok.ok).toBe(true);
    const row = (await db.query(`select pub from q_users where id = (select user_id from q_sessions limit 1 offset 0)`)).rows;
    expect(row).toBeTruthy();
  });
  it('blocks saves until the user accepts new terms', async () => {
    const r = await register();
    await db.query(`update q_config set v='2' where k='terms_ver'`);
    try {
      expect((await db.rpc('q_save', { p_token: r.token, p_base: 0, p_state: {}, p_pub: pub() })).err).toBe('consent_required');
      expect((await db.rpc('q_load', { p_token: r.token })).terms_ver).toBe(2);
      expect((await db.rpc('q_consent', { p_token: r.token, p_ver: 1 })).err).toBe('consent_required');
      expect((await db.rpc('q_consent', { p_token: r.token, p_ver: 2 })).ok).toBe(true);
      expect((await db.rpc('q_save', { p_token: r.token, p_base: 0, p_state: {}, p_pub: pub() })).ok).toBe(true);
      expect((await register({ p_consent_ver: 1 })).err).toBe('consent_required');
    } finally {
      await db.query(`update q_config set v='1' where k='terms_ver'`);
    }
  });
});

describe('parties', () => {
  it('create / join / leaderboard without private data', async () => {
    const a = await register({ p_name: 'אלף' });
    const b = await register({ p_name: 'בית' });
    await db.rpc('q_save', { p_token: a.token, p_base: 0, p_state: { secret: 'תשובה פרטית' }, p_pub: pub({ name: 'אלף', xp: 100 }) });
    const c = await db.rpc('q_party_create', { p_token: a.token, p_name: 'החבורה' });
    expect(c.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect((await db.rpc('q_party_join', { p_token: b.token, p_code: 'ZZZZZ2' })).err).toBe('no_party');
    expect((await db.rpc('q_party', { p_token: b.token, p_code: c.code })).err).toBe('not_member');
    const j = await db.rpc('q_party_join', { p_token: b.token, p_code: c.code.toLowerCase() });
    expect(j.ok).toBe(true);
    expect(j.parties[0].count).toBe(2);
    const p = await db.rpc('q_party', { p_token: b.token, p_code: c.code });
    expect(p.members.length).toBe(2);
    expect(p.members[0].name).toBe('אלף');
    for (const m of p.members) {
      expect(Object.keys(m).sort()).toEqual(['active', 'level', 'me', 'name', 'streak', 'thumb', 'title', 'xp']);
    }
    const raw = JSON.stringify(p);
    expect(raw).not.toContain(a.phone.slice(1));
    expect(raw).not.toContain(b.phone.slice(1));
    expect(raw).not.toContain('תשובה פרטית');
    expect(p.members.find((m: { me: boolean }) => m.me).name).toBe('בית');
  });
  it('leave removes presence immediately; empty party is deleted', async () => {
    const a = await register();
    const b = await register();
    const c = await db.rpc('q_party_create', { p_token: a.token, p_name: '' });
    await db.rpc('q_party_join', { p_token: b.token, p_code: c.code });
    await db.rpc('q_party_leave', { p_token: b.token, p_code: c.code });
    expect((await db.rpc('q_party', { p_token: a.token, p_code: c.code })).members.length).toBe(1);
    await db.rpc('q_party_leave', { p_token: a.token, p_code: c.code });
    expect((await db.query(`select 1 from q_parties where code=$1`, [c.code])).rows.length).toBe(0);
  });
  it('caps a party at 50 members', async () => {
    const owner = await register();
    const c = await db.rpc('q_party_create', { p_token: owner.token, p_name: 'big' });
    await db.query(`delete from q_rate`);
    for (let i = 0; i < 49; i++) {
      const u = await register();
      expect((await db.rpc('q_party_join', { p_token: u.token, p_code: c.code })).ok).toBe(true);
      if (i % 8 === 0) await db.query(`delete from q_rate`);
    }
    const late = await register();
    expect((await db.rpc('q_party_join', { p_token: late.token, p_code: c.code })).err).toBe('party_full');
  }, 60000);
});

describe('delete account', () => {
  it('needs the code, removes everything, and party mates stop seeing you', async () => {
    const a = await register();
    const b = await register();
    const c = await db.rpc('q_party_create', { p_token: a.token, p_name: '' });
    await db.rpc('q_party_join', { p_token: b.token, p_code: c.code });
    expect((await db.rpc('q_delete', { p_token: b.token, p_pin: '0000' })).err).toBe('bad_credentials');
    expect((await db.rpc('q_delete', { p_token: b.token, p_pin: '4826' })).ok).toBe(true);
    const ph = '972' + b.phone.slice(1);
    expect((await db.query(`select 1 from q_users where phone=$1`, [ph])).rows.length).toBe(0);
    expect((await db.rpc('q_load', { p_token: b.token })).err).toBe('auth');
    expect((await db.rpc('q_party', { p_token: a.token, p_code: c.code })).members.length).toBe(1);
    expect((await db.rpc('q_login', { p_phone: b.phone, p_pin: '4826' })).err).toBe('bad_credentials');
  });
});

describe('admin + config', () => {
  it('denies a wrong key and returns progress only for the right one', async () => {
    expect((await db.rpc('q_admin', { p_key: 'x' })).err).toBe('denied');
    expect((await db.rpc('q_admin', { p_key: 'a'.repeat(36) })).err).toBe('denied');
    const key = (await db.query(`select v from q_config where k='admin_key'`)).rows[0].v;
    const r = await register();
    await db.rpc('q_save', { p_token: r.token, p_base: 0, p_state: { secret: 'פרטי' }, p_pub: pub() });
    const a = await db.rpc('q_admin', { p_key: key });
    expect(a.ok).toBe(true);
    expect(a.counts.users).toBeGreaterThan(0);
    const raw = JSON.stringify(a);
    expect(raw).not.toContain('פרטי');
    expect(raw).not.toContain(r.phone.slice(1));
    expect(a.players[0].phone).toMatch(/^97250|^9725\d•••\d\d$/);
    expect(Object.keys(a.players[0]).sort()).toEqual(['created_at', 'last_seen', 'level', 'name', 'parties', 'phone', 'streak', 'xp']);
  });
  it('broadcast + min version via admin_set and config_get', async () => {
    const key = (await db.query(`select v from q_config where k='admin_key'`)).rows[0].v;
    const before = await db.rpc('q_config_get', {});
    expect(before).toMatchObject({ ok: true, terms_ver: 1 });
    expect((await db.rpc('q_admin_set', { p_key: key, p_k: 'admin_key', p_v: 'x' })).err).toBe('bad_key');
    expect((await db.rpc('q_admin_set', { p_key: key, p_k: 'min_version', p_v: 'abc' })).err).toBe('bad_value');
    expect((await db.rpc('q_admin_set', { p_key: key, p_k: 'broadcast', p_v: 'שלום לכולם' })).ok).toBe(true);
    expect((await db.rpc('q_admin_set', { p_key: key, p_k: 'min_version', p_v: '2.0.0' })).ok).toBe(true);
    const after = await db.rpc('q_config_get', {});
    expect(after.broadcast).toBe('שלום לכולם');
    expect(after.min_version).toBe('2.0.0');
    expect(after.broadcast_id).not.toBe(before.broadcast_id);
    expect(JSON.stringify(after)).not.toContain(key);
    await db.rpc('q_admin_set', { p_key: key, p_k: 'broadcast', p_v: '' });
    await db.rpc('q_admin_set', { p_key: key, p_k: 'min_version', p_v: '0' });
  });
});
