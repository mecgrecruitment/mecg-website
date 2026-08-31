-- Fixes two P0 findings from the 2026-08-25 release audit:
--
-- 1. is_applicant() (rush/20260821230000_hide_unreleased_outcomes.sql) treats
--    "has a rush.pnms row" as "has an application", which routing
--    (resolveAuthDestination -> "/applicant") uses to gate access to /apply.
--    A DRAFT or NEEDS_INFO application creates that pnms row on first
--    autosave, so applicants who never finished submitting (or were asked
--    for more info) are routed to /applicant, see a false "submitted, in
--    review" status, and have no way back to /apply. Fix: only count as
--    "has an application" once status has left DRAFT/NEEDS_INFO.
--
-- 2. respond_to_offer() (rush/20260822140000_recruitment_ops.sql) writes
--    offer_response/offer_responded_at but nothing reads it back -- no
--    dashboard, export, or roster surfaces it -- and it has no idempotency
--    guard or audit trail, unlike every other mutating RPC in this schema.
--    Fix: surface offer_response through applicant_dashboard(), reject a
--    second response once one is recorded, and log an audit_events row.

create or replace function rush.is_applicant()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from rush.pnms p
    join rush.applications a on a.pnm_id = p.id
    where p.auth_user_id = auth.uid() and a.status not in ('DRAFT', 'NEEDS_INFO')
  );
$$;

-- CREATE OR REPLACE can't change a table-returning function's output
-- columns; drop first since we're adding offer_response.
drop function if exists rush.applicant_dashboard();

create function rush.applicant_dashboard()
returns table(
  application_id text,
  applicant_name text,
  cycle_name text,
  display_status text,
  released_outcome rush.decision_outcome,
  released_at timestamptz,
  has_resume boolean,
  responses jsonb,
  offer_response text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, p.name, c.name,
    case when d.id is not null then d.outcome::text when a.status in ('OFFERED','WAITLISTED','REJECTED') then 'FINAL_REVIEW' else a.status::text end,
    d.outcome, d.released_at,
    a.resume_storage_path is not null,
    coalesce((
      select jsonb_agg(jsonb_build_object('key', r.question_key, 'prompt', r.question_text, 'answer', r.response_text) order by r.created_at)
      from rush.application_responses r where r.application_id = a.id
    ), '[]'::jsonb),
    a.offer_response
  from rush.pnms p
  join rush.applications a on a.pnm_id = p.id
  join rush.rush_cycles c on c.id = a.cycle_id
  left join lateral (
    select x.id, x.outcome, x.released_at
    from rush.decisions x
    where x.application_id = a.id and x.status = 'RELEASED'
    order by x.released_at desc limit 1
  ) d on true
  where p.auth_user_id = auth.uid()
  order by a.created_at desc;
$$;
-- DROP+CREATE (needed above to change output columns) makes a new object
-- with no privileges -- re-grant explicitly, matching the original grant in
-- rush/20260822130000_application_intake.sql.
revoke all on function rush.applicant_dashboard() from public, anon;
grant execute on function rush.applicant_dashboard() to authenticated, service_role;

create or replace function rush.respond_to_offer(accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); app_row rush.applications%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select a.* into app_row from rush.applications a join rush.pnms p on p.id=a.pnm_id
  where p.auth_user_id=actor and a.status='OFFERED' order by a.submitted_at desc limit 1;
  if app_row.id is null then raise exception 'no offer' using errcode='P0002'; end if;
  if app_row.offer_response is not null then raise exception 'offer already answered' using errcode='55000'; end if;
  update rush.applications set offer_response = case when accept then 'ACCEPTED' else 'DECLINED' end, offer_responded_at=now() where id=app_row.id;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, app_row.cycle_id, 'OFFER_RESPONSE', 'Application', app_row.id,
    jsonb_build_object('response', case when accept then 'ACCEPTED' else 'DECLINED' end));
end; $$;

-- Surface the NEEDS_INFO reason to the applicant on /apply, now that
-- NEEDS_INFO applications route back there instead of dead-ending on
-- /applicant.
create or replace function rush.intake_schema()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  cycle_row rush.rush_cycles%rowtype;
  draft jsonb;
  needs_info boolean;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into cycle_row from rush.rush_cycles
  where status = 'OPEN' and (opens_at is null or opens_at <= now()) and (closes_at is null or closes_at >= now())
  order by created_at desc limit 1;
  if cycle_row.id is null then
    return jsonb_build_object('open', false, 'cycleId', null, 'cycleName', null, 'questions', '[]'::jsonb, 'draft', null, 'needsInfo', false);
  end if;

  select a.draft_payload, (a.status = 'NEEDS_INFO') into draft, needs_info
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
        'options', q.options
      ) order by q.sort_order)
      from rush.application_questions q where q.cycle_id = cycle_row.id
    ), '[]'::jsonb)
  );
end;
$$;
