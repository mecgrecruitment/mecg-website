-- Applicant headshots. The committee needs a face next to a name at speed
-- dating and in the dossier; today the roster shows initials in a circle.
--
-- This is deliberately additive and sits alongside the resume path rather than
-- inside it. Applications are open, so nothing here alters submit_application,
-- the application_documents lifecycle, or any resume RPC or policy. A headshot
-- is a ~40KB WebP that the browser has already square-cropped and re-encoded;
-- it needs none of the PDF machinery (page counts, encryption probes, 10MB
-- chunked signed uploads), and reusing that machinery would mean editing the
-- live intake to get it.

alter table rush.applications add column headshot_storage_path text;

-- Same path shape as resumes ({actor}/{cycle}/{uuid}) so one glance says who
-- owns an object, but .webp: the browser always re-encodes before upload.
alter table rush.applications add constraint applications_headshot_storage_path_check
  check (
    headshot_storage_path is null
    or headshot_storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]+/[0-9a-f-]{36}\.webp$'
  );

-- Private, and deliberately without storage.objects policies: writes happen
-- only through the /api/apply/headshot route on the service-role client, and
-- reads are short-lived signed URLs minted server-side behind
-- authorize_headshot_access. No browser-reachable role needs list or select
-- here. (The dead member-photos bucket keys its policies to functions that the
-- public-schema drop removed; do not copy that pattern.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('candidate-photos', 'candidate-photos', false, 1048576, array['image/webp'])
on conflict (id) do nothing;

-- Mints the object path. The caller never proposes one: same rule the resume
-- flow follows, for the same reason.
create or replace function rush.begin_headshot_upload()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  target_cycle_id text;
  target_application rush.applications%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  select id into target_cycle_id
  from rush.rush_cycles
  where status = 'OPEN'
    and (opens_at is null or opens_at <= now())
    and (closes_at is null or closes_at >= now())
  order by created_at desc
  limit 1;
  if target_cycle_id is null then
    raise exception 'applications are not open' using errcode = '55000';
  end if;

  select a.* into target_application
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = actor
    and a.cycle_id = target_cycle_id
    and a.status in ('DRAFT', 'NEEDS_INFO', 'SUBMITTED')
  for update of a;
  if target_application.id is null then
    raise exception 'save the application before uploading' using errcode = '55000';
  end if;

  -- A first headshot stays available after review starts: the applicant is
  -- being asked for a photo they were never asked for, and refusing it would
  -- leave exactly the people already in the pipeline faceless. Swapping one
  -- out after a packet exists is a different act, and follows the resume rule.
  if target_application.headshot_storage_path is not null
    and exists (
      select 1 from rush.screening_packets sp
      where sp.application_id = target_application.id
    )
  then
    raise exception 'review has already started on this application' using errcode = '55000';
  end if;

  if (
    select count(*) from rush.audit_events e
    where e.actor_id = actor
      and e.action = 'HEADSHOT_ATTACHED'
      and e.created_at >= now() - interval '1 hour'
  ) >= 10 then
    raise exception 'upload limit reached' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'path',
    actor::text || '/' || target_cycle_id || '/' || gen_random_uuid()::text || '.webp'
  );
end;
$$;
revoke all on function rush.begin_headshot_upload() from public, anon;
grant execute on function rush.begin_headshot_upload() to authenticated, service_role;

-- Records the uploaded object against the caller's own application and returns
-- the path it replaced, so the route can delete the superseded object.
create or replace function rush.attach_headshot(target_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  target_application rush.applications%rowtype;
  previous_path text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  -- The path is server-minted, but this runs on a separate request: re-check
  -- that it is this actor's before writing it to their row.
  if target_path is null or target_path !~ ('^' || actor::text || '/') then
    raise exception 'invalid headshot path' using errcode = '22023';
  end if;

  select a.* into target_application
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = actor
    and a.status in ('DRAFT', 'NEEDS_INFO', 'SUBMITTED')
  order by a.created_at desc
  limit 1
  for update of a;
  if target_application.id is null then
    raise exception 'save the application before uploading' using errcode = '55000';
  end if;

  -- The bytes must already be in Storage. submit_application applies the same
  -- check to resumes: a path column that points at nothing reads as "on file".
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'candidate-photos' and name = target_path
  ) then
    raise exception 'headshot upload not found' using errcode = 'P0002';
  end if;

  previous_path := target_application.headshot_storage_path;
  update rush.applications
     set headshot_storage_path = target_path,
         updated_at = now()
   where id = target_application.id;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (actor, target_application.cycle_id, 'HEADSHOT_ATTACHED', 'Application', target_application.id);

  return jsonb_build_object('previousPath', previous_path);
end;
$$;
revoke all on function rush.attach_headshot(text) from public, anon;
grant execute on function rush.attach_headshot(text) to authenticated, service_role;

-- The applicant's own view: "photo on file" without exposing the object path.
create or replace function rush.my_headshot()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from rush.applications a
    join rush.pnms p on p.id = a.pnm_id
    where p.auth_user_id = rush.actor_id()
      and a.headshot_storage_path is not null
  );
$$;
revoke all on function rush.my_headshot() from public, anon;
grant execute on function rush.my_headshot() to authenticated, service_role;

-- Reader authorization, mirroring authorize_resume_access exactly: the same
-- CANDIDATE_ACCESS capability and the same conflict recusal. A face is
-- candidate material, so blind screening and panel-only Hash review must not
-- reach it either.
--
-- One deliberate difference: no audit event. authorize_resume_access records
-- RESUME_VIEWED because opening a resume is a discrete act. The roster renders
-- a thumbnail per applicant on every page load, so the equivalent here would
-- write dozens of rows per visit and bury the events that matter. Attachment
-- is audited (HEADSHOT_ATTACHED above); reads are not.
create or replace function rush.authorize_headshot_access(target_application_id text)
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
    raise exception 'headshot not found' using errcode = 'P0002';
  end if;
  if not rush.has_cycle_capability(target_application.cycle_id, 'CANDIDATE_ACCESS') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if rush.actor_has_application_conflict(target_application.id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target_application.headshot_storage_path is null then
    raise exception 'headshot not found' using errcode = 'P0002';
  end if;

  return target_application.headshot_storage_path;
end;
$$;
revoke all on function rush.authorize_headshot_access(text) from public, anon;
grant execute on function rush.authorize_headshot_access(text) to authenticated, service_role;
