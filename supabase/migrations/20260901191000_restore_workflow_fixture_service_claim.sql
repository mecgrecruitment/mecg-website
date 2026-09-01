-- The release verifier impersonates the applicant while retaining the
-- service-role authorization required by the write-capable fixture helper.
-- Restore the authenticated applicant claim immediately after that call so
-- the remainder of the workflow continues to exercise applicant RLS.
do $migration$
declare
  function_definition text;
  fixture_call text := 'application_id := rush.submit_application_self_test(''Workflow Applicant''::text,(''workflow-''||applicant_id||''@example.invalid'')::text);';
  guarded_fixture_call text := E'perform set_config(''request.jwt.claims'',jsonb_build_object(''sub'',applicant_id,''role'',''service_role'')::text,true);\n  application_id := rush.submit_application_self_test(''Workflow Applicant''::text,(''workflow-''||applicant_id||''@example.invalid'')::text);\n  perform set_config(''request.jwt.claims'',jsonb_build_object(''sub'',applicant_id,''role'',''authenticated'')::text,true);';
begin
  select pg_get_functiondef('rush.verify_full_workflow(uuid,uuid,uuid)'::regprocedure)
  into function_definition;

  if position(fixture_call in function_definition) = 0 then
    raise exception 'could not restore workflow self-test service claim';
  end if;

  execute replace(function_definition, fixture_call, guarded_fixture_call);
end;
$migration$;
