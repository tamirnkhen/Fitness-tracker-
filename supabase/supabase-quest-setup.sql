-- =====================================================================
-- The Quest — Supabase / Postgres setup (v2)
--
-- Idempotent: safe to run on an empty project and to re-run on an
-- existing one. Paste the whole file into Supabase → SQL Editor → Run.
--
-- Security model (do not weaken):
--   * RLS is ON for every table, with NO policies, and all table
--     privileges are revoked from anon / authenticated / public.
--   * The browser can only call the public q_* functions below. They are
--     SECURITY DEFINER with a fixed search_path.
--   * The 4-digit code is stored only as a bcrypt hash.
--   * Login hands out a random session token; only its SHA-256 is stored.
--   * Escalating lockout per phone (15 min → 24 h), also for phones that
--     do not exist (so lockout does not reveal who is registered).
--   * Rate limits per phone / user / IP (when the gateway passes it).
--   * Optimistic concurrency on saves (saved_at), size caps, and server
--     validation of the public card (pub).
--
-- Admin key: generated randomly on first run. Read it with
--   select v from q_config where k = 'admin_key';
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Drop every existing q_* function so stale overloads from older
-- versions can never stay callable. They are all recreated below.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'q\_%'
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists q_config (
  k text primary key,
  v text not null default ''
);

create table if not exists q_users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  pin_hash text not null,
  name text not null,
  created_at timestamptz not null default now()
);
alter table q_users add column if not exists state jsonb not null default '{}'::jsonb;
alter table q_users add column if not exists imgs jsonb;
alter table q_users add column if not exists img_v integer not null default 0;
alter table q_users add column if not exists pub jsonb not null default '{}'::jsonb;
alter table q_users add column if not exists saved_at bigint not null default 0;
alter table q_users add column if not exists consent_ver integer not null default 0;
alter table q_users add column if not exists consent_at timestamptz;
alter table q_users add column if not exists last_seen timestamptz not null default now();

create table if not exists q_auth (
  phone text primary key,
  fails integer not null default 0,
  lock_level integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists q_sessions (
  token_hash text primary key,
  user_id uuid not null references q_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists q_sessions_user on q_sessions(user_id);
create index if not exists q_sessions_exp on q_sessions(expires_at);

create table if not exists q_parties (
  code text primary key,
  name text not null default '',
  owner uuid references q_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists q_members (
  code text not null references q_parties(code) on delete cascade,
  user_id uuid not null references q_users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (code, user_id)
);
create index if not exists q_members_user on q_members(user_id);

create table if not exists q_rate (
  bucket text not null,
  win bigint not null,
  n integer not null default 0,
  primary key (bucket, win)
);
alter table q_rate add column if not exists at timestamptz not null default now();

-- ---------------------------------------------------------------------
-- Lock everything down: RLS on, no policies, no direct privileges.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['q_config','q_users','q_auth','q_sessions','q_parties','q_members','q_rate'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table %I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on table %I from authenticated', t);
    end if;
  end loop;
end $$;

-- Drop any policies an older version may have created.
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename like 'q\_%' loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Config defaults (never overwrite existing values)
-- ---------------------------------------------------------------------
insert into q_config(k, v) values
  ('admin_key', encode(extensions.gen_random_bytes(18), 'hex')),
  ('terms_ver', '1'),
  ('min_version', '0'),
  ('broadcast', ''),
  ('broadcast_id', ''),
  ('dummy_hash', extensions.crypt('0000', extensions.gen_salt('bf', 8)))
on conflict (k) do nothing;

-- =====================================================================
-- Internal helpers (not callable by the browser)
-- =====================================================================

create or replace function q__cfg(p_k text) returns text
language sql stable security definer set search_path = public, extensions, pg_temp
as $$ select v from q_config where k = p_k $$;

-- Client IP as forwarded by the Supabase gateway, if any.
create or replace function q__ip() returns text
language plpgsql stable security definer set search_path = public, extensions, pg_temp
as $$
declare h json; ip text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;
  if h is null then return null; end if;
  ip := coalesce(h->>'cf-connecting-ip', split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1));
  ip := nullif(trim(ip), '');
  return left(ip, 64);
end $$;

-- Fixed-window rate limiter. Returns true if the call is allowed.
create or replace function q__hit(p_bucket text, p_max integer, p_window integer) returns boolean
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
declare w bigint := floor(extract(epoch from clock_timestamp()) / p_window)::bigint; c integer;
begin
  insert into q_rate(bucket, win, n) values (p_bucket, w, 1)
  on conflict (bucket, win) do update set n = q_rate.n + 1
  returning n into c;
  if random() < 0.02 then
    delete from q_rate where at < now() - interval '2 days';
  end if;
  return c <= p_max;
end $$;

create or replace function q__err(p_code text, p_extra jsonb default '{}'::jsonb) returns jsonb
language sql immutable as $$ select jsonb_build_object('ok', false, 'err', p_code) || p_extra $$;

-- 05XXXXXXXX / +9725XXXXXXXX / 9725XXXXXXXX → 9725XXXXXXXX (Israeli mobile).
create or replace function q__phone(p text) returns text
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if d like '00972%' then d := substr(d, 3); end if;
  if d like '0%' then d := '972' || substr(d, 2); end if;
  if d ~ '^9725[0-9]{8}$' then return d; end if;
  return null;
end $$;

create or replace function q__weak_pin(p text) returns boolean
language sql immutable as $$
  select p ~ '^([0-9])\1{3}$'
      or p in ('1234','4321','0123','3210','1212','2121','2580','0852','1122','6969','1010','2000','1984','2468','1357')
$$;

create or replace function q__clean_name(p text) returns text
language plpgsql immutable as $$
declare s text := btrim(regexp_replace(coalesce(p, ''), '[[:cntrl:]<>]', '', 'g'));
begin
  s := regexp_replace(s, '\s+', ' ', 'g');
  if char_length(s) < 1 or char_length(s) > 24 then return null; end if;
  return s;
end $$;

create or replace function q__sha(p text) returns text
language sql immutable security definer set search_path = public, extensions, pg_temp
as $$ select encode(extensions.digest(convert_to(p, 'UTF8'), 'sha256'), 'hex') $$;

create or replace function q__new_session(p_user uuid) returns text
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
declare tok text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into q_sessions(token_hash, user_id, expires_at)
  values (q__sha(tok), p_user, now() + interval '180 days');
  -- keep at most 10 sessions per user
  delete from q_sessions where token_hash in (
    select token_hash from q_sessions where user_id = p_user
    order by last_used desc offset 10);
  return tok;
end $$;

-- Resolve a session token to a user id (null if invalid/expired).
create or replace function q__uid(p_token text) returns uuid
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
declare s q_sessions;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into s from q_sessions where token_hash = q__sha(p_token);
  if not found then return null; end if;
  if s.expires_at < now() then
    delete from q_sessions where token_hash = s.token_hash;
    return null;
  end if;
  if s.last_used < now() - interval '1 hour' then
    update q_sessions set last_used = now(), expires_at = now() + interval '180 days'
    where token_hash = s.token_hash;
    update q_users set last_seen = now() where id = s.user_id;
  end if;
  return s.user_id;
end $$;

-- Register a failed code attempt; returns the q__err payload.
create or replace function q__fail(p_phone text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
declare a q_auth; secs integer;
begin
  insert into q_auth(phone, fails) values (p_phone, 1)
  on conflict (phone) do update set fails = q_auth.fails + 1, updated_at = now()
  returning * into a;
  if a.fails >= 5 then
    secs := least(900 * (2 ^ least(a.lock_level, 7))::integer, 86400);
    update q_auth set fails = 0, lock_level = lock_level + 1,
      locked_until = now() + make_interval(secs => secs), updated_at = now()
    where phone = p_phone;
    return q__err('locked', jsonb_build_object('retry_in', secs));
  end if;
  return q__err('bad_credentials', jsonb_build_object('left', 5 - a.fails));
end $$;

-- Returns seconds left on a lock, or 0.
create or replace function q__locked(p_phone text) returns integer
language sql stable security definer set search_path = public, extensions, pg_temp
as $$
  select coalesce((select greatest(0, ceil(extract(epoch from (locked_until - now()))))::integer
                   from q_auth where phone = p_phone and locked_until > now()), 0)
$$;

-- Validates and normalises the public card shown to party members.
-- Returns null when invalid.
create or replace function q__clean_pub(p jsonb, p_fallback_name text) returns jsonb
language plpgsql immutable as $$
declare
  out jsonb := '{}'::jsonb; nm text; tt text; th text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return null; end if;
  if octet_length(p::text) > 40000 then return null; end if;
  if p ? 'level' and (jsonb_typeof(p->'level') <> 'number' or (p->>'level')::numeric not between 1 and 1000) then return null; end if;
  if p ? 'xp' and (jsonb_typeof(p->'xp') <> 'number' or (p->>'xp')::numeric not between 0 and 1000000000) then return null; end if;
  if p ? 'streak' and (jsonb_typeof(p->'streak') <> 'number' or (p->>'streak')::numeric not between 0 and 100000) then return null; end if;
  if p ? 'name' and jsonb_typeof(p->'name') <> 'string' then return null; end if;
  if p ? 'title' and jsonb_typeof(p->'title') not in ('string','null') then return null; end if;
  if p ? 'thumb' and jsonb_typeof(p->'thumb') not in ('string','null') then return null; end if;

  nm := coalesce(q__clean_name(p->>'name'), p_fallback_name);
  tt := btrim(regexp_replace(coalesce(p->>'title', ''), '[[:cntrl:]<>]', '', 'g'));
  if char_length(tt) > 40 then return null; end if;
  th := p->>'thumb';
  if th is not null and (octet_length(th) > 32768
      or th !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$') then
    return null;
  end if;
  out := jsonb_build_object(
    'name', nm,
    'level', coalesce(floor((p->>'level')::numeric)::integer, 1),
    'xp', coalesce(floor((p->>'xp')::numeric)::bigint, 0),
    'streak', coalesce(floor((p->>'streak')::numeric)::integer, 0),
    'title', tt,
    'thumb', th);
  return out;
end $$;

create or replace function q__valid_imgs(p jsonb) returns boolean
language plpgsql immutable as $$
begin
  if p is null or jsonb_typeof(p) = 'null' then return true; end if;
  if jsonb_typeof(p) <> 'object' then return false; end if;
  if octet_length(p::text) > 716800 then return false; end if;
  if exists (select 1 from jsonb_object_keys(p) k where k not in ('cut','thumb','frame','legacy','style')) then return false; end if;
  if p ? 'cut' and (jsonb_typeof(p->'cut') <> 'string'
      or (p->>'cut') !~ '^data:image/(png|webp|jpeg);base64,[A-Za-z0-9+/]+=*$') then return false; end if;
  if p ? 'legacy' and (jsonb_typeof(p->'legacy') <> 'string'
      or (p->>'legacy') !~ '^data:image/(png|webp|jpeg);base64,[A-Za-z0-9+/]+=*$') then return false; end if;
  if p ? 'thumb' and (jsonb_typeof(p->'thumb') <> 'string'
      or (p->>'thumb') !~ '^data:image/(png|webp|jpeg);base64,[A-Za-z0-9+/]+=*$') then return false; end if;
  if p ? 'frame' and jsonb_typeof(p->'frame') <> 'object' then return false; end if;
  return true;
end $$;

create or replace function q__parties(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', p.code, 'name', p.name,
           'count', (select count(*) from q_members m2 where m2.code = p.code))
         order by m.joined_at), '[]'::jsonb)
  from q_members m join q_parties p on p.code = m.code
  where m.user_id = p_uid
$$;

create or replace function q__payload(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp
as $$
  select jsonb_build_object(
    'ok', true,
    'user', jsonb_build_object('name', u.name),
    'state', u.state,
    'imgs', u.imgs,
    'img_v', u.img_v,
    'saved_at', u.saved_at,
    'consent_ver', u.consent_ver,
    'terms_ver', coalesce(q__cfg('terms_ver'), '1')::integer,
    'parties', q__parties(u.id))
  from q_users u where u.id = p_uid
$$;

-- =====================================================================
-- Public API (callable with the publishable / anon key)
-- =====================================================================

create or replace function q_config_get() returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp
as $$
  select jsonb_build_object(
    'ok', true,
    'terms_ver', coalesce(q__cfg('terms_ver'), '1')::integer,
    'min_version', coalesce(q__cfg('min_version'), '0'),
    'broadcast', coalesce(q__cfg('broadcast'), ''),
    'broadcast_id', coalesce(q__cfg('broadcast_id'), ''))
$$;

create or replace function q_register(p_phone text, p_pin text, p_name text, p_consent_ver integer)
returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
declare ph text := q__phone(p_phone); nm text := q__clean_name(p_name); ip text := q__ip(); uid uuid;
begin
  if ip is not null and not q__hit('reg:ip:' || ip || ':h', 10, 3600) then return q__err('rate'); end if;
  if not q__hit('reg:all', 120, 60) then return q__err('rate'); end if;
  if ph is null then return q__err('bad_phone'); end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then return q__err('bad_pin'); end if;
  if q__weak_pin(p_pin) then return q__err('weak_pin'); end if;
  if nm is null then return q__err('bad_name'); end if;
  if p_consent_ver is null or p_consent_ver < coalesce(q__cfg('terms_ver'), '1')::integer then
    return q__err('consent_required');
  end if;
  if not q__hit('reg:ph:' || ph || ':h', 5, 3600) then return q__err('rate'); end if;
  if exists (select 1 from q_users where phone = ph) then return q__err('phone_taken'); end if;

  insert into q_users(phone, pin_hash, name, consent_ver, consent_at, pub)
  values (ph, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), nm, p_consent_ver, now(),
          jsonb_build_object('name', nm, 'level', 1, 'xp', 0, 'streak', 0, 'title', '', 'thumb', null))
  returning id into uid;
  return q__payload(uid) || jsonb_build_object('token', q__new_session(uid));
end $$;

create or replace function q_login(p_phone text, p_pin text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
declare ph text := q__phone(p_phone); ip text := q__ip(); u q_users; lk integer; ok boolean;
begin
  if ip is not null and not q__hit('login:ip:' || ip, 30, 60) then return q__err('rate'); end if;
  if ph is null or p_pin is null or p_pin !~ '^[0-9]{4}$' then return q__err('bad_credentials'); end if;
  if not q__hit('login:ph:' || ph, 10, 60) then return q__err('rate'); end if;
  lk := q__locked(ph);
  if lk > 0 then return q__err('locked', jsonb_build_object('retry_in', lk)); end if;

  select * into u from q_users where phone = ph;
  -- Always run bcrypt so timing does not reveal whether the phone exists.
  ok := extensions.crypt(p_pin, coalesce(u.pin_hash, q__cfg('dummy_hash'))) = coalesce(u.pin_hash, '!');
  if not ok or u.id is null then return q__fail(ph); end if;

  delete from q_auth where phone = ph;
  delete from q_sessions where expires_at < now();
  update q_users set last_seen = now() where id = u.id;
  return q__payload(u.id) || jsonb_build_object('token', q__new_session(u.id));
end $$;

create or replace function q_logout(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
begin
  if p_token is not null and p_token ~ '^[0-9a-f]{64}$' then
    delete from q_sessions where token_hash = q__sha(p_token);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function q_load(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
declare uid uuid := q__uid(p_token);
begin
  if uid is null then return q__err('auth'); end if;
  if not q__hit('load:' || uid, 60, 60) then return q__err('rate'); end if;
  update q_users set last_seen = now() where id = uid;
  return q__payload(uid);
end $$;

create or replace function q_save(p_token text, p_base bigint, p_state jsonb, p_pub jsonb,
                                  p_imgs jsonb default null, p_img_v integer default null)
returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
declare uid uuid := q__uid(p_token); u q_users; pb jsonb; nowms bigint; nv bigint;
begin
  if uid is null then return q__err('auth'); end if;
  if not q__hit('save:' || uid, 40, 60) then return q__err('rate'); end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then return q__err('bad_state'); end if;
  if octet_length(p_state::text) > 262144 then return q__err('too_big'); end if;
  if p_img_v is not null and not q__valid_imgs(p_imgs) then return q__err('bad_imgs'); end if;

  select * into u from q_users where id = uid for update;
  if u.consent_ver < coalesce(q__cfg('terms_ver'), '1')::integer then return q__err('consent_required'); end if;
  if coalesce(p_base, -1) <> u.saved_at then
    return q__err('conflict', jsonb_build_object(
      'state', u.state, 'saved_at', u.saved_at, 'img_v', u.img_v,
      'imgs', case when p_img_v is distinct from u.img_v then u.imgs else null end));
  end if;
  pb := q__clean_pub(coalesce(p_pub, u.pub), u.name);
  if pb is null then return q__err('bad_pub'); end if;

  nowms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  nv := greatest(nowms, u.saved_at + 1);
  update q_users set
    state = p_state,
    pub = pb,
    saved_at = nv,
    last_seen = now(),
    imgs = case when p_img_v is not null then nullif(p_imgs, 'null'::jsonb) else imgs end,
    img_v = case when p_img_v is not null then p_img_v else img_v end
  where id = uid;
  return jsonb_build_object('ok', true, 'saved_at', nv);
end $$;

create or replace function q_consent(p_token text, p_ver integer) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
declare uid uuid := q__uid(p_token);
begin
  if uid is null then return q__err('auth'); end if;
  if p_ver is null or p_ver < coalesce(q__cfg('terms_ver'), '1')::integer then return q__err('consent_required'); end if;
  update q_users set consent_ver = p_ver, consent_at = now() where id = uid;
  return jsonb_build_object('ok', true, 'consent_ver', p_ver);
end $$;

create or replace function q_change_pin(p_token text, p_old text, p_new text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
declare uid uuid := q__uid(p_token); u q_users; lk integer;
begin
  if uid is null then return q__err('auth'); end if;
  select * into u from q_users where id = uid;
  lk := q__locked(u.phone);
  if lk > 0 then return q__err('locked', jsonb_build_object('retry_in', lk)); end if;
  if p_old is null or extensions.crypt(p_old, u.pin_hash) <> u.pin_hash then return q__fail(u.phone); end if;
  if p_new is null or p_new !~ '^[0-9]{4}$' then return q__err('bad_pin'); end if;
  if q__weak_pin(p_new) then return q__err('weak_pin'); end if;
  update q_users set pin_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 8)) where id = uid;
  delete from q_auth where phone = u.phone;
  -- sign out every other device
  delete from q_sessions where user_id = uid and token_hash <> q__sha(p_token);
  return jsonb_build_object('ok', true);
end $$;

create or replace function q_delete(p_token text, p_pin text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
declare uid uuid := q__uid(p_token); u q_users; lk integer;
begin
  if uid is null then return q__err('auth'); end if;
  select * into u from q_users where id = uid;
  lk := q__locked(u.phone);
  if lk > 0 then return q__err('locked', jsonb_build_object('retry_in', lk)); end if;
  if p_pin is null or extensions.crypt(p_pin, u.pin_hash) <> u.pin_hash then return q__fail(u.phone); end if;
  delete from q_users where id = uid;           -- cascades sessions + memberships
  delete from q_auth where phone = u.phone;
  delete from q_parties p where not exists (select 1 from q_members m where m.code = p.code);
  return jsonb_build_object('ok', true);
end $$;

create or replace function q_party_create(p_token text, p_name text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
declare uid uuid := q__uid(p_token); c text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        b bytea; i integer; tries integer := 0; nm text;
begin
  if uid is null then return q__err('auth'); end if;
  if not q__hit('pcreate:' || uid || ':h', 10, 3600) then return q__err('rate'); end if;
  if (select count(*) from q_members where user_id = uid) >= 5 then return q__err('too_many_parties'); end if;
  nm := coalesce(q__clean_name(p_name), '');
  loop
    b := extensions.gen_random_bytes(6);
    c := '';
    for i in 0..5 loop
      c := c || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from q_parties where code = c);
    tries := tries + 1;
    if tries > 10 then return q__err('server'); end if;
  end loop;
  insert into q_parties(code, name, owner) values (c, nm, uid);
  insert into q_members(code, user_id) values (c, uid);
  return jsonb_build_object('ok', true, 'code', c, 'parties', q__parties(uid));
end $$;

create or replace function q_party_join(p_token text, p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
declare uid uuid := q__uid(p_token); c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if uid is null then return q__err('auth'); end if;
  if not q__hit('pjoin:' || uid || ':h', 30, 3600) then return q__err('rate'); end if;
  if c !~ '^[A-HJ-NP-Z2-9]{6}$' or not exists (select 1 from q_parties where code = c) then
    return q__err('no_party');
  end if;
  if exists (select 1 from q_members where code = c and user_id = uid) then
    return jsonb_build_object('ok', true, 'code', c, 'parties', q__parties(uid));
  end if;
  if (select count(*) from q_members where user_id = uid) >= 5 then return q__err('too_many_parties'); end if;
  perform 1 from q_parties where code = c for update;
  if (select count(*) from q_members where code = c) >= 50 then return q__err('party_full'); end if;
  insert into q_members(code, user_id) values (c, uid) on conflict do nothing;
  return jsonb_build_object('ok', true, 'code', c, 'parties', q__parties(uid));
end $$;

create or replace function q_party_leave(p_token text, p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
declare uid uuid := q__uid(p_token); c text := upper(coalesce(p_code, ''));
begin
  if uid is null then return q__err('auth'); end if;
  delete from q_members where code = c and user_id = uid;
  delete from q_parties p where p.code = c and not exists (select 1 from q_members m where m.code = c);
  return jsonb_build_object('ok', true, 'parties', q__parties(uid));
end $$;

-- Leaderboard: only the public card. Never phone, code, state or answers.
create or replace function q_party(p_token text, p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
declare uid uuid := q__uid(p_token); c text := upper(coalesce(p_code, '')); res jsonb;
begin
  if uid is null then return q__err('auth'); end if;
  if not q__hit('party:' || uid, 30, 60) then return q__err('rate'); end if;
  if not exists (select 1 from q_members where code = c and user_id = uid) then return q__err('not_member'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', coalesce(u.pub->>'name', u.name),
           'level', coalesce((u.pub->>'level')::integer, 1),
           'xp', coalesce((u.pub->>'xp')::bigint, 0),
           'streak', coalesce((u.pub->>'streak')::integer, 0),
           'title', coalesce(u.pub->>'title', ''),
           'thumb', u.pub->>'thumb',
           'me', u.id = uid,
           'active', u.last_seen > now() - interval '2 days')
         order by coalesce((u.pub->>'xp')::bigint, 0) desc, m.joined_at), '[]'::jsonb)
    into res
  from q_members m join q_users u on u.id = m.user_id
  where m.code = c;
  return jsonb_build_object('ok', true, 'code', c,
    'name', (select name from q_parties where code = c), 'members', res);
end $$;

-- Admin: progress only. Phone partially masked. No state, answers or images.
create or replace function q_admin(p_key text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
declare res jsonb; cnt jsonb;
begin
  if not q__hit('admin', 20, 60) then return q__err('rate'); end if;
  if p_key is null or length(p_key) < 16 or p_key <> q__cfg('admin_key') then
    perform pg_sleep(0.3);
    return q__err('denied');
  end if;
  select jsonb_build_object(
    'users', (select count(*) from q_users),
    'active_1d', (select count(*) from q_users where last_seen > now() - interval '1 day'),
    'active_7d', (select count(*) from q_users where last_seen > now() - interval '7 days'),
    'parties', (select count(*) from q_parties),
    'with_character', (select count(*) from q_users where imgs is not null))
  into cnt;
  select coalesce(jsonb_agg(x order by (x->>'xp')::bigint desc), '[]'::jsonb) into res from (
    select jsonb_build_object(
      'name', coalesce(u.pub->>'name', u.name),
      'phone', left(u.phone, 5) || '•••' || right(u.phone, 2),
      'level', coalesce((u.pub->>'level')::integer, 1),
      'xp', coalesce((u.pub->>'xp')::bigint, 0),
      'streak', coalesce((u.pub->>'streak')::integer, 0),
      'last_seen', u.last_seen,
      'created_at', u.created_at,
      'parties', (select count(*) from q_members m where m.user_id = u.id)) as x
    from q_users u order by u.last_seen desc limit 1000) s;
  return jsonb_build_object('ok', true, 'counts', cnt, 'players', res,
    'config', jsonb_build_object('terms_ver', q__cfg('terms_ver'), 'min_version', q__cfg('min_version'),
                                 'broadcast', q__cfg('broadcast')));
end $$;

create or replace function q_admin_set(p_key text, p_k text, p_v text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
as $$
begin
  if not q__hit('admin', 20, 60) then return q__err('rate'); end if;
  if p_key is null or length(p_key) < 16 or p_key <> q__cfg('admin_key') then
    perform pg_sleep(0.3);
    return q__err('denied');
  end if;
  if p_k not in ('broadcast', 'min_version', 'terms_ver') then return q__err('bad_key'); end if;
  if p_k = 'terms_ver' and coalesce(p_v, '') !~ '^[0-9]{1,4}$' then return q__err('bad_value'); end if;
  if p_k = 'min_version' and coalesce(p_v, '') !~ '^[0-9]+(\.[0-9]+){0,2}$' then return q__err('bad_value'); end if;
  if char_length(coalesce(p_v, '')) > 500 then return q__err('bad_value'); end if;
  update q_config set v = coalesce(p_v, '') where k = p_k;
  if p_k = 'broadcast' then
    update q_config set v = encode(extensions.gen_random_bytes(6), 'hex') where k = 'broadcast_id';
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- Function privileges: only the public API is callable from the browser.
-- ---------------------------------------------------------------------
do $$
declare r record; pub text[] := array[
  'q_config_get','q_register','q_login','q_logout','q_load','q_save','q_consent',
  'q_change_pin','q_delete','q_party_create','q_party_join','q_party_leave','q_party',
  'q_admin','q_admin_set'];
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'q\_%'
  loop
    execute 'revoke all on function ' || r.sig || ' from public';
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute 'revoke all on function ' || r.sig || ' from anon';
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || r.sig || ' from authenticated';
    end if;
    if r.proname = any(pub) then
      if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'grant execute on function ' || r.sig || ' to anon';
      end if;
      if exists (select 1 from pg_roles where rolname = 'authenticated') then
        execute 'grant execute on function ' || r.sig || ' to authenticated';
      end if;
    end if;
  end loop;
end $$;

-- Ask PostgREST to pick up the new functions right away.
notify pgrst, 'reload schema';
