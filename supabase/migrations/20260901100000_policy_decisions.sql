-- Three policy questions the plan left open, decided and enforced here rather
-- than left as convention somebody has to remember.

-- 1. RESUME REPLACEMENT
--
-- Decision: an applicant may replace their resume while the application window
-- is still open, and may not once blind screening has begun on their file.
--
-- The fairness line is review, not submission. Everyone gets the same chance to
-- fix a wrong file before the deadline; nobody gets to swap the document a
-- reviewer is already reading. A screening packet existing for the application
-- is the precise moment review begins, so that is the gate.
--
-- Reproduced from 20260831120000_resume_document_lifecycle with exactly two
-- changes: the status list widens from (DRAFT, NEEDS_INFO) to include
-- SUBMITTED, and the packet check is added. Everything else, including both
-- rate limits and the returned key names, is byte-for-byte the original. The
-- 20-per-cycle replacement cap matters more here, not less: post-submission
-- replacement is exactly when someone could churn uploads.
create or replace function rush.begin_resume_upload(
  upload_filename text,
  upload_size integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_cycle_id text;
  target_application_id text;
  document_id text := gen_random_uuid()::text;
  object_name text;
  safe_filename text := regexp_replace(trim(upload_filename), '[[:cntrl:]/\\]', '_', 'g');
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if upload_size is null or upload_size not between 1 and 10485760 then
    raise exception 'invalid file size' using errcode = '22023';
  end if;
  if char_length(safe_filename) not between 1 and 255 or safe_filename !~* '\.pdf$' then
    raise exception 'invalid filename' using errcode = '22023';
  end if;

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

  select a.id into target_application_id
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = actor
    and a.cycle_id = target_cycle_id
    and a.status in ('DRAFT', 'NEEDS_INFO', 'SUBMITTED')
  for update of a;
  if target_application_id is null then
    raise exception 'save the application before uploading' using errcode = '55000';
  end if;

  if exists (
    select 1 from rush.screening_packets sp
    where sp.application_id = target_application_id
  ) then
    raise exception 'review has already started on this application' using errcode = '55000';
  end if;

  if (
    select count(*) from rush.application_documents d
    where d.owner_user_id = actor
      and d.created_at >= now() - interval '1 hour'
  ) >= 10 then
    raise exception 'upload limit reached' using errcode = '55000';
  end if;

  if (
    select count(*) from rush.application_documents d
    where d.owner_user_id = actor and d.cycle_id = target_cycle_id
  ) >= 20 then
    raise exception 'replacement limit reached' using errcode = '55000';
  end if;

  object_name := actor::text || '/' || target_cycle_id || '/' || document_id || '.pdf';
  insert into rush.application_documents (
    id, application_id, owner_user_id, cycle_id, object_path, original_filename, declared_size
  ) values (
    document_id, target_application_id, actor, target_cycle_id, object_name, safe_filename, upload_size
  );
  return jsonb_build_object('documentId', document_id, 'path', object_name);
end;
$$;

revoke all on function rush.begin_resume_upload(text, integer) from public, anon;
grant execute on function rush.begin_resume_upload(text, integer) to authenticated, service_role;

-- Points a submitted application at the caller's newest READY resume.
-- submit_application does this at intake; after submission nothing did, so a
-- replacement uploaded fine and was then invisible to the board.
create or replace function rush.attach_ready_resume()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_cycle_id text;
  app_row rush.applications%rowtype;
  ready_path text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  select id into target_cycle_id from rush.rush_cycles
  where status = 'OPEN' and (opens_at is null or opens_at <= now()) and (closes_at is null or closes_at >= now())
  order by created_at desc limit 1;
  if target_cycle_id is null then raise exception 'applications are not open' using errcode = '55000'; end if;

  select a.* into app_row from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = actor and a.cycle_id = target_cycle_id
  for update of a;
  if app_row.id is null then raise exception 'application missing' using errcode = 'P0002'; end if;
  if app_row.status not in ('DRAFT', 'NEEDS_INFO', 'SUBMITTED') then
    raise exception 'application can no longer be edited' using errcode = '55000';
  end if;
  if exists (select 1 from rush.screening_packets sp where sp.application_id = app_row.id) then
    raise exception 'review has already started on this application' using errcode = '55000';
  end if;

  select d.object_path into ready_path
  from rush.application_documents d
  where d.owner_user_id = actor and d.cycle_id = target_cycle_id and d.kind = 'RESUME' and d.status = 'READY'
  order by d.ready_at desc nulls last
  limit 1;
  if ready_path is null then raise exception 'no resume is ready' using errcode = 'P0002'; end if;

  update rush.applications a set resume_storage_path = ready_path, updated_at = now() where a.id = app_row.id;
  update rush.application_documents d set status = 'ATTACHED'
  where d.object_path = ready_path and d.status = 'READY';

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (actor, target_cycle_id, 'RESUME_REPLACED', 'Application', app_row.id);
  return ready_path;
end;
$$;

revoke all on function rush.attach_ready_resume() from public, anon;
grant execute on function rush.attach_ready_resume() to authenticated, service_role;

-- 2. RETENTION
--
-- Decision: applicant personal data is anonymised two years after the cycle it
-- belongs to is archived. Rows survive, identities do not.
--
-- Deleting the rows outright would take the audit trail with them, and the
-- whole point of that trail is being able to reconstruct a decision that
-- affected someone. Anonymising keeps the decision reconstructable while
-- removing the person from it. Counts and outcomes stay; names, contacts and
-- free text go.
--
-- Two years covers a reapplicant's realistic return window (a student who
-- applies as a first-year and again as a junior) without keeping a rejected
-- applicant's essays for the rest of their twenties.
create or replace function rush.anonymize_archived_applicants()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  anonymized integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  -- Only people whose every application sits in a cycle archived more than two
  -- years ago. Anyone with a live application anywhere is left alone.
  create temporary table stale_pnms on commit drop as
  select p.id
  from rush.pnms p
  where p.normalized_contact not like 'redacted-%'
    and exists (select 1 from rush.applications a where a.pnm_id = p.id)
    and not exists (
      select 1 from rush.applications a
      join rush.rush_cycles c on c.id = a.cycle_id
      where a.pnm_id = p.id
        and (c.status <> 'ARCHIVED' or c.updated_at > now() - interval '2 years')
    );

  delete from rush.application_responses r
  using rush.applications a
  where r.application_id = a.id and a.pnm_id in (select id from stale_pnms);

  update rush.applications a set draft_payload = null
  where a.pnm_id in (select id from stale_pnms) and a.draft_payload is not null;

  update rush.pnms p set
    name = 'Redacted applicant',
    contact = 'redacted-' || p.id || '@example.invalid',
    normalized_contact = 'redacted-' || p.id || '@example.invalid',
    preferred_name = null,
    phone = null,
    linkedin_url = null,
    uniqname = null,
    accessibility_notes = null,
    auth_user_id = null,
    updated_at = now()
  where p.id in (select id from stale_pnms);

  get diagnostics anonymized = row_count;
  if anonymized > 0 then
    insert into rush.audit_events (action, resource, resource_id, metadata)
    values ('APPLICANTS_ANONYMIZED', 'Retention', 'pnms', jsonb_build_object('count', anonymized));
  end if;
  return anonymized;
end;
$$;

revoke all on function rush.anonymize_archived_applicants() from public, anon, authenticated;
grant execute on function rush.anonymize_archived_applicants() to service_role;

-- Monthly. Nothing here is time critical and the window is measured in years.
select cron.unschedule('anonymize-archived-applicants')
where exists (select 1 from cron.job where jobname = 'anonymize-archived-applicants');

select cron.schedule(
  'anonymize-archived-applicants',
  '31 4 1 * *',
  $job$select rush.anonymize_archived_applicants();$job$
);

-- 3. PRIOR-CYCLE HISTORY
--
-- Decision: the board may see that someone applied before, and how far they
-- got, at the dossier stage. Blind screening reviewers may not, and neither
-- may evaluators scoring a round.
--
-- Reapplying should not be a penalty, and "they applied last year too" is
-- exactly the kind of context that turns into bias when it reaches somebody
-- holding a rubric. The dossier is already the board-only surface, so this
-- gates on the same operations capability and returns nothing to anyone else.
create or replace function rush.applicant_prior_cycles(target_application_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'cycleName', c.name,
      'status', prior.status,
      'submittedAt', prior.submitted_at
    ) order by prior.created_at desc)
    from rush.applications current_app
    join rush.applications prior on prior.pnm_id = current_app.pnm_id and prior.id <> current_app.id
    join rush.rush_cycles c on c.id = prior.cycle_id
    where current_app.id = target_application_id
      and rush.has_cycle_capability(current_app.cycle_id, 'APPLICANT_OPERATIONS')
  ), '[]'::jsonb);
$$;

revoke all on function rush.applicant_prior_cycles(text) from public, anon;
grant execute on function rush.applicant_prior_cycles(text) to authenticated, service_role;
