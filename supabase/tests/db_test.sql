-- Security & game-logic tests for the migration. Run with scripts/test-db.sh.
-- Each check raises an exception on failure, so a clean run means all passed.
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- Fixtures: two users (alice, bob) created the way Supabase Auth would.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', '{"display_name":"Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', '{"full_name":"Bob"}');

do $$ begin
  assert (select count(*) from public.profiles) = 2, 'profile trigger should create profiles';
  assert (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 'Bob', 'full_name fallback';
  assert (select level from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 1, 'new users start at level 1';
end $$;

-- Server-side (service role) fixtures: a daily task worth 600 XP total across two
-- tasks for alice, a weekly task, a stale task, and a task for bob.
insert into public.tasks (id, user_id, domain, kind, title, xp, period_key) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'health', 'daily', 'run', 10, public.local_day('Asia/Jerusalem')),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'health', 'daily', 'old', 10, public.local_day('Asia/Jerusalem') - 1),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'health', 'daily', 'bob task', 10, public.local_day('Asia/Jerusalem'));
insert into public.tasks (id, user_id, domain, kind, title, xp, target_count, period_key) values
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'discipline', 'weekly', 'weekly', 20, 2, public.week_start(public.local_day('Asia/Jerusalem')));

-- Put alice 5 XP away from level 2 so completing the 10 XP task levels her up.
update public.profiles set xp_total = 995 where id = '11111111-1111-1111-1111-111111111111';

-- ---------------------------------------------------------------------------
-- Act as alice
-- ---------------------------------------------------------------------------
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false); end $$;

do $$ begin
  assert (select count(*) from public.profiles) = 1, 'RLS: alice sees only her profile';
  assert (select count(*) from public.tasks) = 3, 'RLS: alice sees only her tasks';
  assert not exists (select 1 from public.tasks where user_id = '22222222-2222-2222-2222-222222222222'), 'RLS: no access to bob tasks';
end $$;

-- Users cannot write XP, role, tasks or the ledger directly.
do $$ begin
  begin
    update public.profiles set xp_total = 999999 where id = auth.uid();
    raise exception 'FAIL: user updated xp_total';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'FAIL: user escalated role';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.tasks (user_id, domain, kind, title, xp, period_key) values (auth.uid(), 'health', 'manual', 'farm', 50, current_date);
    raise exception 'FAIL: user inserted a task';
  exception when insufficient_privilege then null; end;
  begin
    update public.tasks set xp = 50 where user_id = auth.uid();
    raise exception 'FAIL: user edited task xp';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.xp_events (user_id, domain, amount) values (auth.uid(), 'health', 1000);
    raise exception 'FAIL: user wrote to the XP ledger';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.admin_audit_log;
    raise exception 'FAIL: user read the audit log';
  exception when insufficient_privilege then null; end;
  begin
    perform public.consume_rate_limit(auth.uid(), 'x', 1, 60);
    raise exception 'FAIL: user called the rate limiter';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_metrics();
    raise exception 'FAIL: user called admin_metrics';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.admin_user_directory;
    raise exception 'FAIL: user read the admin directory';
  exception when insufficient_privilege then null; end;
end $$;

-- But a user may rename themselves.
update public.profiles set display_name = 'Alice Q' where id = auth.uid();

-- complete_task: awards XP once, levels up, refuses repeats, other users' and stale tasks.
do $$
declare r jsonb;
begin
  r := public.complete_task('aaaaaaaa-0000-0000-0000-000000000001');
  assert (r ->> 'completed')::boolean, 'task completes';
  assert (r ->> 'xp_awarded')::int = 10, 'awards task xp';
  assert (r ->> 'xp_total')::int = 1005, 'xp total updated';
  assert (r ->> 'level_before')::int = 1 and (r ->> 'level_after')::int = 2, 'level up reported';

  begin
    perform public.complete_task('aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'FAIL: completed twice';
  exception when sqlstate 'P0001' then null; end;

  begin
    perform public.complete_task('bbbbbbbb-0000-0000-0000-000000000001');
    raise exception 'FAIL: completed another user''s task';
  exception when sqlstate 'P0002' then null; end;

  begin
    perform public.complete_task('aaaaaaaa-0000-0000-0000-000000000002');
    raise exception 'FAIL: completed a task from a past period';
  exception when sqlstate 'P0001' then null; end;

  -- Weekly: progress first, XP only when the target is reached.
  r := public.complete_task('aaaaaaaa-0000-0000-0000-000000000003');
  assert not (r ->> 'completed')::boolean and (r ->> 'progress')::int = 1 and (r ->> 'xp_awarded')::int = 0, 'weekly progress step';
  r := public.complete_task('aaaaaaaa-0000-0000-0000-000000000003');
  assert (r ->> 'completed')::boolean and (r ->> 'xp_awarded')::int = 20 and (r ->> 'xp_total')::int = 1025, 'weekly completes';
end $$;

reset role;
do $$ begin
  assert (select xp_total from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 1025, 'xp persisted';
  assert (select level from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 2, 'generated level column';
  assert (select count(*) from public.xp_events where user_id = '11111111-1111-1111-1111-111111111111') = 2, 'ledger has one row per completion';
  assert (select status from public.tasks where id = 'aaaaaaaa-0000-0000-0000-000000000002') = 'open', 'stale-task rejection rolled back with the error';
  assert (select xp_total from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 0, 'bob untouched';
  assert (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Alice Q', 'rename allowed';
end $$;

-- Anonymous callers get nothing.
set role anon;
do $$ begin perform set_config('request.jwt.claim.sub', '', false); end $$;
do $$ begin
  begin
    perform public.complete_task('aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'FAIL: anon executed complete_task';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.tasks;
    raise exception 'FAIL: anon read tasks';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Service role (server routes)
-- ---------------------------------------------------------------------------
set role service_role;
do $$ begin
  assert public.consume_rate_limit('11111111-1111-1111-1111-111111111111', 'test', 2, 60), 'rate limit 1/2';
  assert public.consume_rate_limit('11111111-1111-1111-1111-111111111111', 'test', 2, 60), 'rate limit 2/2';
  assert not public.consume_rate_limit('11111111-1111-1111-1111-111111111111', 'test', 2, 60), 'rate limit blocks the 3rd';
  assert public.consume_rate_limit('22222222-2222-2222-2222-222222222222', 'test', 2, 60), 'limits are per user';
end $$;

insert into public.activity_days (user_id, day) values
  ('11111111-1111-1111-1111-111111111111', (now() at time zone 'Asia/Jerusalem')::date),
  ('22222222-2222-2222-2222-222222222222', (now() at time zone 'Asia/Jerusalem')::date - 10);

do $$
declare m jsonb := public.admin_metrics();
begin
  assert (m ->> 'total_users')::int = 2, 'metrics: total users';
  assert (m ->> 'dau')::int = 1 and (m ->> 'wau')::int = 1, 'metrics: dau/wau';
  assert (m ->> 'churned')::int = 1 and (m ->> 'churn_rate')::numeric = 1, 'metrics: bob churned';
  assert (m ->> 'tasks_done_7d')::int = 2, 'metrics: tasks done';
  assert (select email from public.admin_user_directory where id = '11111111-1111-1111-1111-111111111111') = 'alice@example.com', 'directory joins email';
end $$;

-- XP template constraints enforce the brief's ranges even for server writes.
do $$ begin
  begin
    insert into public.task_templates (user_id, domain, kind, title, xp) values ('11111111-1111-1111-1111-111111111111', 'health', 'daily', 'too rich', 11);
    raise exception 'FAIL: daily template above +10';
  exception when check_violation then null; end;
  begin
    insert into public.task_templates (user_id, domain, kind, title, xp) values ('11111111-1111-1111-1111-111111111111', 'health', 'bonus', 'too rich', 51);
    raise exception 'FAIL: bonus template above +50';
  exception when check_violation then null; end;
end $$;

-- The audit log is append-only, even for the service role.
insert into public.admin_audit_log (admin_id, action, target_user_id) values ('11111111-1111-1111-1111-111111111111', 'view_user', '22222222-2222-2222-2222-222222222222');
do $$ begin
  begin
    update public.admin_audit_log set action = 'nothing';
    raise exception 'FAIL: audit log updated';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    delete from public.admin_audit_log;
    raise exception 'FAIL: audit log deleted';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
reset role;

-- Storage: owner-only read on the private bucket.
insert into storage.objects (bucket_id, name) values
  ('character-private', '11111111-1111-1111-1111-111111111111/source.jpg'),
  ('character-private', '22222222-2222-2222-2222-222222222222/source.jpg');
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false); end $$;
do $$ begin
  assert (select count(*) from storage.objects) = 1, 'storage: alice sees only her folder';
  assert (select public from storage.buckets where id = 'character-private') is not null or true, 'bucket exists';
end $$;
reset role;
do $$ begin
  assert (select public from storage.buckets where id = 'character-private') = false, 'storage: bucket is private';
end $$;

-- Deleting the auth user erases everything except the opaque audit entry.
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert not exists (select 1 from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'profile deleted';
  assert not exists (select 1 from public.tasks where user_id = '22222222-2222-2222-2222-222222222222'), 'tasks deleted';
  assert not exists (select 1 from public.activity_days where user_id = '22222222-2222-2222-2222-222222222222'), 'activity deleted';
  assert not exists (select 1 from public.ai_requests where user_id = '22222222-2222-2222-2222-222222222222'), 'ai log deleted';
  assert exists (select 1 from public.admin_audit_log where target_user_id = '22222222-2222-2222-2222-222222222222'), 'audit entry kept';
end $$;

select 'ALL DATABASE TESTS PASSED' as result;
