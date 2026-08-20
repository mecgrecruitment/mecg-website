-- Apply intake read RPCs: authenticated may call; anon may not; base tables
-- stay closed to applicants under RLS. Run against a seeded local stack.

\set ON_ERROR_STOP on

begin;

select set_config(
  'test.applicant_uid',
  (select id::text from auth.users where email = 'applicant.test@umich.edu' limit 1),
  false
);

do $$
begin
  if current_setting('test.applicant_uid', true) is null
     or current_setting('test.applicant_uid', true) = '' then
    raise exception 'FAIL: seed missing applicant.test@umich.edu';
  end if;
end $$;

-- ── anon cannot execute ──────────────────────────────────────────────────────
set local role anon;

do $$
declare
  v_id uuid;
begin
  begin
    select public.get_open_apply_cycle() into v_id;
    raise exception 'FAIL: anon executed get_open_apply_cycle';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like '%permission denied%' or sqlerrm like '%unauthenticated%' then
        null;
      else
        raise;
      end if;
  end;

  begin
    perform * from public.list_apply_questions(gen_random_uuid());
    raise exception 'FAIL: anon executed list_apply_questions';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like '%permission denied%' or sqlerrm like '%unauthenticated%' then
        null;
      else
        raise;
      end if;
  end;

  raise notice 'PASS: anon denied apply-intake read RPCs';
end $$;

reset role;

-- ── authenticated applicant: RPCs work; base tables still denied ─────────────
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.applicant_uid'),
    'role', 'authenticated'
  )::text,
  true
);

do $$
declare
  v_cycle_id uuid;
  v_n int;
  v_direct int;
begin
  -- Privileges exist; RLS must still hide base rows from applicants.
  select count(*) into v_direct from public.recruitment_cycles;
  assert v_direct = 0,
    format('FAIL: applicant saw %s recruitment_cycles base rows', v_direct);

  select count(*) into v_direct from public.application_questions;
  assert v_direct = 0,
    format('FAIL: applicant saw %s application_questions base rows', v_direct);

  v_cycle_id := public.get_open_apply_cycle();
  assert v_cycle_id is not null, 'FAIL: get_open_apply_cycle returned null (seed window closed?)';

  select count(*) into v_n from public.list_apply_questions(v_cycle_id);
  assert v_n > 0, 'FAIL: list_apply_questions returned no rows for open cycle';

  select count(*) into v_n from public.list_apply_questions(gen_random_uuid());
  assert v_n = 0, 'FAIL: list_apply_questions leaked rows for a foreign cycle id';

  assert has_function_privilege(
    'authenticated',
    'public.get_open_apply_cycle()',
    'EXECUTE'
  ), 'FAIL: authenticated missing EXECUTE on get_open_apply_cycle';
  assert has_function_privilege(
    'authenticated',
    'public.list_apply_questions(uuid)',
    'EXECUTE'
  ), 'FAIL: authenticated missing EXECUTE on list_apply_questions';
  assert not has_function_privilege(
    'anon',
    'public.get_open_apply_cycle()',
    'EXECUTE'
  ), 'FAIL: anon still has EXECUTE on get_open_apply_cycle';

  raise notice 'PASS: applicant RPCs work; base tables stay closed';
end $$;

reset role;

rollback;

\echo 'NARROW APPLY INTAKE READS: ALL CHECKS PASSED'
