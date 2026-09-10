-- Applicant submission reliability has three database-owned pieces:
--
--   * failed resume replacements age out of the cycle quota instead of
--     permanently stranding an applicant;
--   * a submission and its confirmation-email obligation commit together;
--   * draft reads carry an authoritative server timestamp for recovery, and a
--     narrow status RPC resolves a response lost after commit.

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
  actor uuid := rush.actor_id();
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

  -- Every attempt, including a rejected one, occupies the short abuse window.
  if (
    select count(*) from rush.application_documents d
    where d.owner_user_id = actor
      and d.created_at >= now() - interval '1 hour'
  ) >= 10 then
    raise exception 'upload limit reached' using errcode = '55000';
  end if;

  -- Live documents continue to count for the cycle. Failed, deleted, and
  -- superseded attempts count for one day, then stop consuming the applicant's
  -- replacement allowance. This preserves a rolling abuse bound without
  -- turning ordinary upload failures into a permanent cycle lockout.
  if (
    select count(*) from rush.application_documents d
    where d.owner_user_id = actor
      and d.cycle_id = target_cycle_id
      and (
        d.status in ('READY', 'ATTACHED')
        or d.created_at >= now() - interval '24 hours'
      )
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

-- Application receipts use the same leased, retryable outbox as decision and
-- event mail. application_id is already mandatory on every row, so a receipt
-- is identified by having no secondary source column.
alter table rush.notification_outbox drop constraint notification_outbox_template_key_check;
alter table rush.notification_outbox add constraint notification_outbox_template_key_check
  check (template_key in (
    'APPLICATION_RECEIVED', 'DECISION_RELEASED', 'EVENT_CANCELLED',
    'SPEED_DATING_INVITATION', 'EVALUATION_ASSIGNED'
  ));
alter table rush.notification_outbox drop constraint notification_outbox_one_source_check;
alter table rush.notification_outbox add constraint notification_outbox_one_source_check
  check (
    (template_key = 'APPLICATION_RECEIVED'
      and num_nonnulls(decision_id, event_id, round_participation_id, evaluation_assignment_id) = 0)
    or
    (template_key <> 'APPLICATION_RECEIVED'
      and num_nonnulls(decision_id, event_id, round_participation_id, evaluation_assignment_id) = 1)
  );
create unique index notification_outbox_application_receipt_key
  on rush.notification_outbox(application_id, template_key, template_version)
  where template_key = 'APPLICATION_RECEIVED';

create or replace function rush.enqueue_application_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'SUBMITTED'
    and (tg_op = 'INSERT' or old.status is distinct from 'SUBMITTED')
  then
    insert into rush.notification_outbox(
      cycle_id, application_id, recipient, template_key, template_version, idempotency_key
    )
    select new.cycle_id, new.id, p.contact, 'APPLICATION_RECEIVED', 1,
      'application-received:' || new.id
    from rush.pnms p
    where p.id = new.pnm_id
    on conflict (idempotency_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function rush.enqueue_application_receipt() from public, anon, authenticated;
drop trigger if exists applications_enqueue_receipt on rush.applications;
create trigger applications_enqueue_receipt
after insert or update on rush.applications
for each row execute function rush.enqueue_application_receipt();

create or replace function rush.claim_notification(target_notification_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  item rush.notification_outbox%rowtype;
  result jsonb;
begin
  select * into item from rush.notification_outbox where id = target_notification_id for update;
  if item.id is null then raise exception 'notification missing' using errcode = 'P0002'; end if;
  if not (
    auth.role() = 'service_role'
    or (actor is not null and rush.has_cycle_role(item.cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[]))
  ) then raise exception 'forbidden' using errcode = '42501'; end if;
  if item.status = 'SENT' then return null; end if;
  if item.status = 'FAILED' or item.attempt_count >= item.max_attempts then
    raise exception 'notification attempts exhausted' using errcode = '55000';
  end if;
  if item.next_attempt_at > now() then return null; end if;

  update rush.notification_outbox
  set status = 'PROCESSING',
      attempt_count = attempt_count + 1,
      last_attempt_at = now(),
      next_attempt_at = now() + interval '10 minutes'
  where id = item.id
  returning * into item;

  if item.template_key = 'APPLICATION_RECEIVED' then
    select jsonb_build_object(
      'id', item.id, 'recipient', item.recipient, 'templateKey', item.template_key,
      'templateVersion', item.template_version, 'attemptCount', item.attempt_count,
      'idempotencyKey', item.idempotency_key, 'applicantName', p.name
    ) into result
    from rush.applications a
    join rush.pnms p on p.id = a.pnm_id
    where a.id = item.application_id;
  elsif item.template_key = 'DECISION_RELEASED' then
    select jsonb_build_object(
      'id', item.id, 'recipient', item.recipient, 'templateKey', item.template_key,
      'templateVersion', item.template_version, 'attemptCount', item.attempt_count,
      'idempotencyKey', item.idempotency_key, 'decisionOutcome', d.outcome::text,
      'applicantName', p.name
    ) into result
    from rush.decisions d
    join rush.applications a on a.id = d.application_id
    join rush.pnms p on p.id = a.pnm_id
    where d.id = item.decision_id and a.id = item.application_id;
  elsif item.template_key = 'EVENT_CANCELLED' then
    select jsonb_build_object(
      'id', item.id, 'recipient', item.recipient, 'templateKey', item.template_key,
      'templateVersion', item.template_version, 'attemptCount', item.attempt_count,
      'idempotencyKey', item.idempotency_key, 'eventName', e.name,
      'eventStartsAt', e.starts_at, 'eventLocation', e.location, 'applicantName', p.name
    ) into result
    from rush.events e
    join rush.applications a on a.id = item.application_id
    join rush.pnms p on p.id = a.pnm_id
    where e.id = item.event_id;
  elsif item.template_key = 'SPEED_DATING_INVITATION' then
    select jsonb_build_object(
      'id', item.id, 'recipient', item.recipient, 'templateKey', item.template_key,
      'templateVersion', item.template_version, 'attemptCount', item.attempt_count,
      'idempotencyKey', item.idempotency_key, 'applicantName', p.name,
      'roundName', r.name, 'roundOpensAt', r.opens_at, 'roundClosesAt', r.closes_at
    ) into result
    from rush.round_participations rp
    join rush.rounds r on r.id = rp.round_id
    join rush.applications a on a.id = rp.application_id
    join rush.pnms p on p.id = a.pnm_id
    where rp.id = item.round_participation_id and a.id = item.application_id;
  elsif item.template_key = 'EVALUATION_ASSIGNED' then
    select jsonb_build_object(
      'id', item.id, 'recipient', item.recipient, 'templateKey', item.template_key,
      'templateVersion', item.template_version, 'attemptCount', item.attempt_count,
      'idempotencyKey', item.idempotency_key, 'applicantName', pnm.name,
      'evaluatorName', evaluator.display_name, 'roundName', r.name,
      'roundOpensAt', r.opens_at, 'roundClosesAt', r.closes_at,
      'assignmentId', ea.id
    ) into result
    from rush.evaluation_assignments ea
    join rush.rounds r on r.id = ea.round_id
    join rush.applications a on a.id = ea.application_id
    join rush.pnms pnm on pnm.id = a.pnm_id
    join rush.profiles evaluator on evaluator.id = ea.evaluator_id
    where ea.id = item.evaluation_assignment_id and a.id = item.application_id;
  end if;
  if result is null then raise exception 'notification source missing' using errcode = 'P0002'; end if;
  return result;
end;
$$;

-- savedAt comes from the row timestamp maintained by the applications trigger;
-- it is never stored inside the caller-supplied payload.
create or replace function rush.application_draft()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  current_cycle_id text;
  result jsonb;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select c.id into current_cycle_id
  from rush.rush_cycles c
  where c.status = 'OPEN'
    and (c.opens_at is null or c.opens_at <= now())
    and (c.closes_at is null or c.closes_at >= now())
  order by c.created_at desc
  limit 1;
  if current_cycle_id is null or not rush.application_portal_allows(actor) then return null; end if;

  select coalesce(a.draft_payload, jsonb_build_object(
    'name', p.name,
    'preferredName', coalesce(p.preferred_name, ''),
    'phone', coalesce(p.phone, ''),
    'classYear', coalesce(p.class_year::text, ''),
    'major', coalesce(p.major, ''),
    'college', coalesce(p.college::text, ''),
    'uniqname', coalesce(p.uniqname, ''),
    'gradTerm', coalesce(p.grad_term, ''),
    'accessibilityNotes', coalesce(p.accessibility_notes, ''),
    'linkedinUrl', coalesce(p.linkedin_url, ''),
    'answers', coalesce((
      select jsonb_object_agg(r.question_key, r.response_text)
      from rush.application_responses r
      join rush.application_questions q
        on q.cycle_id = a.cycle_id and q.key = r.question_key
      where r.application_id = a.id
    ), '{}'::jsonb),
    'resumeStoragePath', coalesce(a.resume_storage_path, ''),
    'currentStep', 'details'
  )) || jsonb_build_object(
    'savedAt', a.updated_at,
    'serverNow', now(),
    'resumeStoragePath', coalesce((
      select d.object_path
      from rush.application_documents d
      where d.owner_user_id = actor
        and d.cycle_id = current_cycle_id
        and d.kind = 'RESUME'
        and d.status = 'READY'
      order by d.ready_at desc nulls last, d.created_at desc
      limit 1
    ), a.resume_storage_path, a.draft_payload->>'resumeStoragePath', '')
  ) into result
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = actor
    and a.cycle_id = current_cycle_id
    and a.status in ('DRAFT', 'NEEDS_INFO');
  return result;
end;
$$;

create or replace function rush.intake_schema()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  cycle_row rush.rush_cycles%rowtype;
  draft jsonb;
  needs_info boolean;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  select * into cycle_row from rush.rush_cycles
  where status = 'OPEN' and (opens_at is null or opens_at <= now()) and (closes_at is null or closes_at >= now())
  order by created_at desc limit 1;

  if cycle_row.id is null or not rush.application_portal_allows(actor) then
    return jsonb_build_object('open', false, 'cycleId', null, 'cycleName', null, 'questions', '[]'::jsonb, 'draft', null, 'needsInfo', false);
  end if;

  select coalesce(a.draft_payload, jsonb_build_object(
    'name', p.name,
    'preferredName', coalesce(p.preferred_name, ''),
    'phone', coalesce(p.phone, ''),
    'classYear', coalesce(p.class_year::text, ''),
    'major', coalesce(p.major, ''),
    'college', coalesce(p.college::text, ''),
    'uniqname', coalesce(p.uniqname, ''),
    'gradTerm', coalesce(p.grad_term, ''),
    'accessibilityNotes', coalesce(p.accessibility_notes, ''),
    'linkedinUrl', coalesce(p.linkedin_url, ''),
    'answers', coalesce((
      select jsonb_object_agg(r.question_key, r.response_text)
      from rush.application_responses r
      join rush.application_questions q
        on q.cycle_id = a.cycle_id and q.key = r.question_key
      where r.application_id = a.id
    ), '{}'::jsonb),
    'resumeStoragePath', coalesce(a.resume_storage_path, ''),
    'currentStep', 'details'
  )) || jsonb_build_object(
    'savedAt', a.updated_at,
    'serverNow', now(),
    'resumeStoragePath', coalesce((
      select d.object_path
      from rush.application_documents d
      where d.owner_user_id = actor
        and d.cycle_id = cycle_row.id
        and d.kind = 'RESUME'
        and d.status = 'READY'
      order by d.ready_at desc nulls last, d.created_at desc
      limit 1
    ), a.resume_storage_path, a.draft_payload->>'resumeStoragePath', '')
  ), (a.status = 'NEEDS_INFO')
  into draft, needs_info
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = actor and a.cycle_id = cycle_row.id and a.status in ('DRAFT', 'NEEDS_INFO');

  return jsonb_build_object(
    'open', true,
    'cycleId', cycle_row.id,
    'cycleName', cycle_row.name,
    'draft', draft,
    'needsInfo', coalesce(needs_info, false),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', q.key,
        'prompt', q.prompt,
        'inputType', q.input_type,
        'required', q.required,
        'sortOrder', q.sort_order,
        'options', q.options,
        'maxWords', q.word_limit
      ) order by q.sort_order)
      from rush.application_questions q where q.cycle_id = cycle_row.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Reconcile an ambiguous POST without exposing applicant identity or answers.
-- Selecting the newest non-archived cycle also works just after its application
-- window closes, which is the boundary where a lost response is most harmful.
create or replace function rush.my_application_submission_status()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  application_row rush.applications%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select a.* into application_row
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  join rush.rush_cycles c on c.id = a.cycle_id
  where p.auth_user_id = actor and c.status <> 'ARCHIVED'
  order by c.created_at desc
  limit 1;
  if application_row.id is null then return null; end if;

  return jsonb_build_object(
    'applicationId', application_row.id,
    'status', application_row.status::text,
    'submitted', application_row.submitted_at is not null
      and application_row.status not in ('DRAFT', 'NEEDS_INFO')
  );
end;
$$;
revoke all on function rush.my_application_submission_status() from public, anon;
grant execute on function rush.my_application_submission_status() to authenticated, service_role;
