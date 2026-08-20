-- Data API privilege smoke tests. RLS cannot authorize a request unless the
-- caller first has the corresponding relation privilege.

\set ON_ERROR_STOP on

do $$
declare
  missing text;
begin
  select string_agg(required.relation || ':' || required.privilege, ', ')
    into missing
    from (
      values
        ('members', 'SELECT'),
        ('candidates', 'SELECT'),
        ('rubric_versions', 'SELECT'),
        ('rubric_criteria', 'SELECT'),
        ('scores', 'SELECT'),
        ('notes', 'SELECT'),
        ('hash_sessions', 'SELECT'),
        ('membership_requests', 'SELECT')
    ) as required(relation, privilege)
   where not has_table_privilege(
     'authenticated',
     format('public.%I', required.relation),
     required.privilege
   );

  assert missing is null, 'FAIL: authenticated Data API privileges missing: ' || missing;
  assert has_table_privilege('service_role', 'public.candidates', 'INSERT'),
    'FAIL: service_role cannot insert candidates';
  assert has_function_privilege(
    'service_role',
    'public.submit_application(uuid,text,uuid,text,text,text,text,text,text,text,jsonb)',
    'EXECUTE'
  ), 'FAIL: service_role cannot execute submit_application';
  assert has_function_privilege(
    'authenticated',
    'public.get_open_apply_cycle()',
    'EXECUTE'
  ), 'FAIL: authenticated cannot execute get_open_apply_cycle';
  assert has_function_privilege(
    'authenticated',
    'public.list_apply_questions(uuid)',
    'EXECUTE'
  ), 'FAIL: authenticated cannot execute list_apply_questions';
  assert not has_function_privilege(
    'anon',
    'public.get_open_apply_cycle()',
    'EXECUTE'
  ), 'FAIL: anon must not execute get_open_apply_cycle';
  assert not has_function_privilege(
    'anon',
    'public.list_apply_questions(uuid)',
    'EXECUTE'
  ), 'FAIL: anon must not execute list_apply_questions';

  raise notice 'PASS: Data API relation and function privileges are present';
end $$;

\echo 'DATA API PRIVILEGES: ALL CHECKS PASSED'
