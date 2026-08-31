-- Keep the production workflow rehearsal aligned with the validated applicant
-- contract while still exercising the verified-resume trigger.
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
