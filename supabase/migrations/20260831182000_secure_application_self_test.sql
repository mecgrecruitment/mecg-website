-- Restrict the write-capable workflow fixture to service-role verification.
create or replace function rush.submit_application_self_test(applicant_name text, applicant_contact text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  cycle_id text;
  resume_path text;
  result jsonb;
  application_id text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if actor is null or applicant_contact <> ('workflow-' || actor::text || '@example.invalid') then
    raise exception 'workflow self-test only' using errcode = '42501';
  end if;
  select id into cycle_id from rush.rush_cycles
  where status = 'OPEN' and (opens_at is null or opens_at <= now()) and (closes_at is null or closes_at >= now())
  order by created_at desc limit 1;
  if cycle_id is null then raise exception 'applications are not open' using errcode = '55000'; end if;

  application_id := rush.save_application_draft(jsonb_build_object(
    'name', applicant_name,
    'classYear', 'JUNIOR',
    'major', 'Self Test',
    'uniqname', 'w' || substr(replace(actor::text, '-', ''), 1, 15),
    'college', 'Other',
    'answers', '{}'::jsonb
  ));
  resume_path := actor::text || '/' || cycle_id || '/resume.pdf';
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('resumes', resume_path, actor::text, jsonb_build_object('mimetype', 'application/pdf', 'size', 1));
  insert into rush.application_documents (
    application_id, owner_user_id, cycle_id, object_path, original_filename, declared_size,
    verified_size, page_count, sha256, status, ready_at
  ) values (
    application_id, actor, cycle_id, resume_path, 'workflow-resume.pdf', 1,
    1, 1, repeat('0', 64), 'READY', now()
  );

  result := rush.submit_application(
    applicant_name,
    applicant_contact,
    null,
    null,
    'JUNIOR',
    'Self Test',
    null,
    resume_path,
    '{}'::jsonb,
    true,
    'w' || substr(replace(actor::text, '-', ''), 1, 15),
    'Other',
    null,
    null
  );
  return result ->> 'applicationId';
end;
$$;
revoke all on function rush.submit_application_self_test(text,text) from public, anon, authenticated;
grant execute on function rush.submit_application_self_test(text,text) to service_role;
-- The workflow fixture impersonates the applicant before calling this helper.
-- Keep the applicant identity, but retain the caller's service-role claim for the guarded call.
do $migration$
declare
  function_definition text;
  fixture_call text := 'application_id := rush.submit_application_self_test(''Workflow Applicant''::text,(''workflow-''||applicant_id||''@example.invalid'')::text);';
  guarded_fixture_call text := E'perform set_config(''request.jwt.claims'',jsonb_build_object(''sub'',applicant_id,''role'',''service_role'')::text,true);\n  application_id := rush.submit_application_self_test(''Workflow Applicant''::text,(''workflow-''||applicant_id||''@example.invalid'')::text);\n  perform set_config(''request.jwt.claims'',jsonb_build_object(''sub'',applicant_id,''role'',''authenticated'')::text,true);';
begin
  select pg_get_functiondef('rush.verify_full_workflow(uuid,uuid,uuid)'::regprocedure)
  into function_definition;

  if position(fixture_call in function_definition) = 0 then
    raise exception 'could not secure workflow self-test application call';
  end if;

  execute replace(function_definition, fixture_call, guarded_fixture_call);
end;
$migration$;
