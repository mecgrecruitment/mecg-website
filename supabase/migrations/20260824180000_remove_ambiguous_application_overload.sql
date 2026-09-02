do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef('rush.submit_application(text,text,text,text,text,text,text,text,jsonb,boolean)'::regprocedure)
  into function_definition;

  function_definition := replace(
    function_definition,
    'AS $function$',
    E'AS $function$\n#variable_conflict use_variable'
  );

  if function_definition not like '%#variable_conflict use_variable%' then
    raise exception 'could not set application variable resolution';
  end if;

  execute function_definition;
end;
$migration$;
alter function rush.submit_application(text,text)
  rename to submit_application_self_test;
do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef('rush.verify_full_workflow(uuid,uuid,uuid)'::regprocedure)
  into function_definition;

  function_definition := replace(function_definition, 'rush.submit_application(', 'rush.submit_application_self_test(');

  if function_definition not like '%rush.submit_application_self_test(%' then
    raise exception 'could not update workflow self-test application call';
  end if;

  execute function_definition;
end;
$migration$;
