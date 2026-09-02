-- Keep resume visibility aligned with the Board portal. Hash panel membership
-- alone does not grant candidate-material access because Hash review is blind.

create or replace function rush.board_can_view_resume(target_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from rush.applications a
    where a.resume_storage_path = target_path
      and rush.has_cycle_capability(a.cycle_id, 'CANDIDATE_ACCESS')
      and not rush.actor_has_application_conflict(a.id)
  );
$$;

revoke all on function rush.board_can_view_resume(text) from public, anon;
grant execute on function rush.board_can_view_resume(text) to authenticated, service_role;

create or replace function rush.authorize_resume_access(target_application_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  target_application rush.applications%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  select * into target_application
  from rush.applications
  where id = target_application_id;

  if target_application.id is null then
    raise exception 'resume not found' using errcode = 'P0002';
  end if;
  if not rush.has_cycle_capability(target_application.cycle_id, 'CANDIDATE_ACCESS') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if rush.actor_has_application_conflict(target_application.id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target_application.resume_storage_path is null then
    raise exception 'resume not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1
    from rush.application_documents d
    where d.object_path = target_application.resume_storage_path
      and d.application_id = target_application.id
      and d.status = 'ATTACHED'
  ) then
    raise exception 'resume not found' using errcode = 'P0002';
  end if;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (actor, target_application.cycle_id, 'RESUME_VIEWED', 'Application', target_application.id);
  return target_application.resume_storage_path;
end;
$$;

revoke all on function rush.authorize_resume_access(text) from public, anon;
grant execute on function rush.authorize_resume_access(text) to authenticated, service_role;

drop policy if exists application_documents_internal_read on rush.application_documents;
create policy application_documents_internal_read on rush.application_documents
for select to authenticated
using (
  status = 'ATTACHED'
  and rush.has_cycle_capability(cycle_id, 'CANDIDATE_ACCESS')
  and not rush.actor_has_application_conflict(application_id)
);

drop policy if exists storage_resumes_internal_select on storage.objects;
create policy storage_resumes_internal_select on storage.objects
for select to authenticated
using (
  bucket_id = 'resumes'
  and exists (
    select 1
    from rush.application_documents d
    where d.object_path = name
      and d.status = 'ATTACHED'
      and rush.has_cycle_capability(d.cycle_id, 'CANDIDATE_ACCESS')
      and not rush.actor_has_application_conflict(d.application_id)
  )
);

-- A browser can retry the attach request after losing the response. Return the
-- existing attachment when no newer READY document exists, and do not emit a
-- duplicate replacement audit event.
create or replace function rush.attach_ready_resume()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  target_cycle_id text;
  app_row rush.applications%rowtype;
  ready_path text;
  attached_path text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  select id into target_cycle_id
  from rush.rush_cycles
  where status = 'OPEN'
    and (opens_at is null or opens_at <= now())
    and (closes_at is null or closes_at >= now())
  order by created_at desc
  limit 1;
  if target_cycle_id is null then raise exception 'applications are not open' using errcode = '55000'; end if;

  select a.* into app_row
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = actor and a.cycle_id = target_cycle_id
  for update of a;
  if app_row.id is null then raise exception 'application missing' using errcode = 'P0002'; end if;
  if app_row.status not in ('DRAFT', 'NEEDS_INFO', 'SUBMITTED') then
    raise exception 'application can no longer be edited' using errcode = '55000';
  end if;
  if exists (
    select 1 from rush.screening_packets sp where sp.application_id = app_row.id
  ) then
    raise exception 'review has already started on this application' using errcode = '55000';
  end if;

  select d.object_path into ready_path
  from rush.application_documents d
  where d.owner_user_id = actor
    and d.cycle_id = target_cycle_id
    and d.kind = 'RESUME'
    and d.status = 'READY'
  order by d.ready_at desc nulls last
  limit 1;

  if ready_path is null then
    select d.object_path into attached_path
    from rush.application_documents d
    where d.owner_user_id = actor
      and d.cycle_id = target_cycle_id
      and d.kind = 'RESUME'
      and d.status = 'ATTACHED'
      and d.object_path = app_row.resume_storage_path;
    if attached_path is not null then return attached_path; end if;
    raise exception 'no resume is ready' using errcode = 'P0002';
  end if;

  update rush.applications
  set resume_storage_path = ready_path, updated_at = now()
  where id = app_row.id;

  update rush.application_documents
  set status = 'ATTACHED', application_id = app_row.id
  where object_path = ready_path and status = 'READY';

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (actor, target_cycle_id, 'RESUME_REPLACED', 'Application', app_row.id);
  return ready_path;
end;
$$;

revoke all on function rush.attach_ready_resume() from public, anon;
grant execute on function rush.attach_ready_resume() to authenticated, service_role;
