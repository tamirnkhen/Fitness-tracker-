-- The Quest — initial schema
-- Security model:
--   * Every user-owned table has RLS enabled. Users can only SELECT their own rows.
--   * Users never write XP, roles, tasks or templates directly. XP is awarded only by
--     the SECURITY DEFINER function `complete_task`, which validates ownership and the
--     task's period atomically. Everything else is written by server routes using the
--     service-role key (never exposed to the browser) after an auth check.
--   * Admin access is never granted through RLS. Admin pages run server-side, verify
--     `profiles.role = 'admin'` on every request, then read via the service role and
--     write an entry to the append-only `admin_audit_log`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  display_name            text check (char_length(display_name) <= 60),
  role                    text not null default 'user' check (role in ('user', 'admin')),
  birth_date              date,
  age_verified_at         timestamptz,
  terms_accepted_at       timestamptz,
  terms_version           text,
  photo_consent_at        timestamptz,
  onboarding_completed_at timestamptz,
  xp_total                integer not null default 0 check (xp_total >= 0),
  level                   integer generated always as ((xp_total / 1000) + 1) stored,
  timezone                text not null default 'Asia/Jerusalem',
  last_active_at          timestamptz,
  created_at              timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());

-- Column-level privileges: a signed-in user may only rename themselves.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy "profiles: update own name" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Create a profile row for every new auth user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', ''), 60)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------
create table public.goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  domain       text not null check (domain in ('health', 'direction', 'subconscious', 'discipline', 'personal')),
  custom_label text check (char_length(custom_label) <= 40),
  title        text not null check (char_length(title) between 1 and 140),
  baseline     text check (char_length(baseline) <= 280),
  target       text check (char_length(target) <= 280),
  status       text not null default 'active' check (status in ('active', 'archived')),
  created_at   timestamptz not null default now()
);
create index goals_user_idx on public.goals (user_id);

-- ---------------------------------------------------------------------------
-- task_templates — the AI-generated "quest plan" each day's tasks are drawn from
-- ---------------------------------------------------------------------------
create table public.task_templates (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  goal_id      uuid references public.goals (id) on delete cascade,
  domain       text not null check (domain in ('health', 'direction', 'subconscious', 'discipline', 'personal')),
  custom_label text,
  kind         text not null check (kind in ('daily', 'weekly', 'bonus')),
  title        text not null check (char_length(title) between 1 and 140),
  description  text check (char_length(description) <= 400),
  xp           integer not null,
  target_count integer not null default 1 check (target_count between 1 and 14),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint task_templates_xp_range check (
    (kind = 'daily'  and xp between 2 and 10) or
    (kind = 'weekly' and xp between 15 and 30) or
    (kind = 'bonus'  and xp between 10 and 50)
  )
);
create index task_templates_user_idx on public.task_templates (user_id, kind) where active;

-- ---------------------------------------------------------------------------
-- tasks — concrete task instances for a period
--   period_key: the local day (daily / bonus / manual) or the local week start (weekly)
-- ---------------------------------------------------------------------------
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  template_id  uuid references public.task_templates (id) on delete set null,
  goal_id      uuid references public.goals (id) on delete set null,
  domain       text not null check (domain in ('health', 'direction', 'subconscious', 'discipline', 'personal')),
  custom_label text,
  kind         text not null check (kind in ('daily', 'weekly', 'bonus', 'manual')),
  title        text not null check (char_length(title) between 1 and 140),
  description  text check (char_length(description) <= 400),
  xp           integer not null check (xp between 1 and 50),
  target_count integer not null default 1 check (target_count between 1 and 14),
  progress     integer not null default 0 check (progress >= 0),
  status       text not null default 'open' check (status in ('open', 'done', 'expired')),
  period_key   date not null,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (template_id, period_key)
);
create index tasks_user_period_idx on public.tasks (user_id, period_key);
create index tasks_user_status_idx on public.tasks (user_id, status);
create index tasks_completed_idx on public.tasks (completed_at) where status = 'done';

-- ---------------------------------------------------------------------------
-- xp_events — immutable XP ledger (history + per-domain breakdown)
-- ---------------------------------------------------------------------------
create table public.xp_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  task_id    uuid references public.tasks (id) on delete set null,
  domain     text not null,
  amount     integer not null,
  created_at timestamptz not null default now()
);
create index xp_events_user_idx on public.xp_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- activity_days — one row per user per active local day (DAU/WAU/churn + bonus roll)
-- ---------------------------------------------------------------------------
create table public.activity_days (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  day          date not null,
  bonus_rolled boolean not null default false,
  primary key (user_id, day)
);
create index activity_days_day_idx on public.activity_days (day);

-- ---------------------------------------------------------------------------
-- onboarding_sessions — goal-setting conversation, kept server-side
-- ---------------------------------------------------------------------------
create table public.onboarding_sessions (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  messages   jsonb not null default '[]'::jsonb,
  draft      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- characters — avatar state. Images live in the private `character-private` bucket.
-- ---------------------------------------------------------------------------
create table public.characters (
  user_id          uuid primary key references public.profiles (id) on delete cascade,
  source_path      text,
  avatar_path      text,
  status           text not null default 'none' check (status in ('none', 'uploaded', 'generating', 'ready', 'failed')),
  equipped         text[] not null default '{}',
  generation_count integer not null default 0,
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ai_requests — rate-limit ledger for AI endpoints
-- ---------------------------------------------------------------------------
create table public.ai_requests (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  bucket     text not null,
  created_at timestamptz not null default now()
);
create index ai_requests_lookup_idx on public.ai_requests (user_id, bucket, created_at desc);

-- ---------------------------------------------------------------------------
-- admin_audit_log — append-only: who viewed what, and when
-- ---------------------------------------------------------------------------
create table public.admin_audit_log (
  id             bigint generated always as identity primary key,
  admin_id       uuid not null,
  action         text not null,
  target_user_id uuid,
  details        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

create function public.prevent_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'admin_audit_log is append-only';
end;
$$;

create trigger admin_audit_log_no_update before update or delete on public.admin_audit_log
  for each row execute function public.prevent_audit_mutation();

-- ---------------------------------------------------------------------------
-- RLS for user-owned tables: read own rows only. All writes go through the
-- service role or SECURITY DEFINER functions below.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['goals', 'task_templates', 'tasks', 'xp_events', 'activity_days', 'onboarding_sessions', 'characters']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy "%s: read own" on public.%I for select to authenticated using (user_id = auth.uid())', t, t);
  end loop;
end;
$$;

-- No client access at all.
alter table public.ai_requests enable row level security;
alter table public.admin_audit_log enable row level security;
revoke all on public.ai_requests from anon, authenticated;
revoke all on public.admin_audit_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Period helpers (local day / local week starting Sunday)
-- ---------------------------------------------------------------------------
create function public.local_day(p_tz text)
returns date language sql stable as $$
  select (now() at time zone coalesce(nullif(p_tz, ''), 'Asia/Jerusalem'))::date;
$$;

create function public.week_start(p_day date)
returns date language sql immutable as $$
  select p_day - extract(dow from p_day)::int;
$$;

-- ---------------------------------------------------------------------------
-- complete_task — the ONLY way XP is awarded.
-- Called by the signed-in user (auth.uid()); validates ownership, status and
-- that the task belongs to the current period, then awards XP atomically.
-- ---------------------------------------------------------------------------
create function public.complete_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_task        public.tasks%rowtype;
  v_tz          text;
  v_today       date;
  v_xp_before   integer;
  v_xp_after    integer;
  v_done        boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_task from public.tasks
   where id = p_task_id and user_id = v_uid
   for update;

  if not found then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  if v_task.status <> 'open' then
    raise exception 'task is not open' using errcode = 'P0001';
  end if;

  select timezone, xp_total into v_tz, v_xp_before from public.profiles where id = v_uid for update;
  v_today := public.local_day(v_tz);

  if (v_task.kind = 'weekly' and v_task.period_key <> public.week_start(v_today))
     or (v_task.kind <> 'weekly' and v_task.period_key <> v_today) then
    raise exception 'task period has ended' using errcode = 'P0001';
  end if;

  v_task.progress := v_task.progress + 1;
  if v_task.progress >= v_task.target_count then
    v_done := true;
    update public.tasks
       set progress = v_task.target_count, status = 'done', completed_at = now()
     where id = v_task.id;

    insert into public.xp_events (user_id, task_id, domain, amount)
    values (v_uid, v_task.id, v_task.domain, v_task.xp);

    update public.profiles set xp_total = xp_total + v_task.xp, last_active_at = now()
     where id = v_uid
    returning xp_total into v_xp_after;
  else
    update public.tasks set progress = v_task.progress where id = v_task.id;
    update public.profiles set last_active_at = now() where id = v_uid;
    v_xp_after := v_xp_before;
  end if;

  return jsonb_build_object(
    'task_id', v_task.id,
    'completed', v_done,
    'progress', least(v_task.progress, v_task.target_count),
    'target_count', v_task.target_count,
    'xp_awarded', case when v_done then v_task.xp else 0 end,
    'xp_total', v_xp_after,
    'level_before', (v_xp_before / 1000) + 1,
    'level_after', (v_xp_after / 1000) + 1
  );
end;
$$;

revoke all on function public.complete_task(uuid) from public, anon;
grant execute on function public.complete_task(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- consume_rate_limit — atomically checks and records an AI request.
-- Service role only (called from server routes after auth).
-- ---------------------------------------------------------------------------
create function public.consume_rate_limit(p_user uuid, p_bucket text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_user::text || ':' || p_bucket));
  select count(*) into v_count from public.ai_requests
   where user_id = p_user and bucket = p_bucket
     and created_at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_max then
    return false;
  end if;
  insert into public.ai_requests (user_id, bucket) values (p_user, p_bucket);
  return true;
end;
$$;

revoke all on function public.consume_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(uuid, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Admin metrics (service role only; the app checks the admin role first)
-- ---------------------------------------------------------------------------
create function public.admin_metrics()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with d as (select (now() at time zone 'Asia/Jerusalem')::date as today),
  cur as (select distinct user_id from public.activity_days, d where day > d.today - 7),
  prev as (select distinct user_id from public.activity_days, d where day <= d.today - 7 and day > d.today - 14),
  done7 as (select count(*) as n from public.tasks where status = 'done' and completed_at > now() - interval '7 days')
  select jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'new_users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'dau', (select count(distinct user_id) from public.activity_days, d where day = d.today),
    'wau', (select count(*) from cur),
    'mau', (select count(distinct user_id) from public.activity_days, d where day > d.today - 30),
    'prev_week_active', (select count(*) from prev),
    'churned', (select count(*) from prev where user_id not in (select user_id from cur)),
    'churn_rate', case when (select count(*) from prev) = 0 then null
                  else round((select count(*) from prev where user_id not in (select user_id from cur))::numeric
                             / (select count(*) from prev), 4) end,
    'tasks_done_7d', (select n from done7),
    'avg_tasks_per_active_user_7d', case when (select count(*) from cur) = 0 then 0
                  else round((select n from done7)::numeric / (select count(*) from cur), 2) end,
    'onboarded_users', (select count(*) from public.profiles where onboarding_completed_at is not null)
  );
$$;

revoke all on function public.admin_metrics() from public, anon, authenticated;
grant execute on function public.admin_metrics() to service_role;

-- Email lives in auth.users; expose it to the service role only, for support.
create view public.admin_user_directory
with (security_invoker = true) as
  select p.id, u.email, p.display_name, p.role, p.level, p.xp_total, p.created_at,
         p.last_active_at, p.onboarding_completed_at
    from public.profiles p
    join auth.users u on u.id = p.id;

revoke all on public.admin_user_directory from public, anon, authenticated;
grant select on public.admin_user_directory to service_role;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for the source photo and generated avatar.
-- Paths are `<user_id>/<file>`. Uploads go through the server (validation +
-- re-encoding), so users only get read access to their own folder; images are
-- served through short-lived signed URLs.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('character-private', 'character-private', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;

create policy "character-private: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'character-private' and (storage.foldername(name))[1] = auth.uid()::text);
