-- One private source for readiness counts and guarded operator diagnostics.
-- This deliberately preserves the existing two-evaluator release policy.
create or replace function rush.decision_evidence_rounds(target_application_id text)
returns table (round_id text, round_name text, kind text, status text,
  valid_locked_evaluations integer, missing_required_criteria text[])
language sql stable security definer set search_path = '' as $$
  select r.id, r.name, r.kind::text, r.status::text,
    count(distinct evidence.evaluator_id) filter (where evidence.valid)::integer,
    coalesce(array_agg(distinct evidence.missing_name order by evidence.missing_name)
      filter (where evidence.missing_name is not null), '{}'::text[])
  from rush.applications a
  join rush.rounds r on r.cycle_id = a.cycle_id and r.weight > 0
  left join lateral (
    select ea.evaluator_id, quality.valid, missing.name missing_name
    from rush.evaluation_assignments ea
    join lateral (
      select evaluation.* from rush.evaluations evaluation
      where evaluation.assignment_id = ea.id and evaluation.voided_at is null
      order by evaluation.version desc limit 1
    ) e on true
    join rush.rubrics rubric on rubric.id = e.rubric_id and rubric.round_id = r.id
      and rubric.id = (select active.id from rush.rubrics active where active.round_id = r.id order by active.version desc limit 1)
    cross join lateral rush.evaluation_observation_quality(e.id) quality
    left join lateral unnest(quality.missing_required) missing(name) on true
    where ea.round_id = r.id and ea.application_id = a.id and e.status = 'LOCKED'
      and not exists (select 1 from rush.conflict_declarations conflict
        where conflict.application_id = a.id and conflict.declarer_id = ea.evaluator_id)
  ) evidence on true
  where a.id = target_application_id
  group by r.id, r.name, r.kind, r.status;
$$;
revoke all on function rush.decision_evidence_rounds(text) from public, anon, authenticated;

create or replace function rush.is_decision_ready(target_application_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from rush.applications a join rush.rounds r on r.cycle_id = a.cycle_id and r.weight > 0
    where a.id = target_application_id and a.status not in ('DRAFT', 'WITHDRAWN')
  ) and not exists (
    select 1 from rush.decision_evidence_rounds(target_application_id) r
    where r.status not in ('FROZEN', 'FINALIZED') or r.valid_locked_evaluations < 2
  );
$$;

create or replace function rush.decision_evidence_diagnostics(target_application_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare application_row rush.applications%rowtype; round_items jsonb; blockers jsonb := '[]'::jsonb;
begin
  if rush.actor_id() is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into application_row from rush.applications where id = target_application_id;
  if application_row.id is null or not rush.has_cycle_role(application_row.cycle_id, array['PANEL','OWNER']::rush.member_role[])
    then raise exception 'application unavailable' using errcode = '42501'; end if;
  if exists (select 1 from rush.conflict_declarations conflict where conflict.application_id = target_application_id
    and conflict.declarer_id = rush.actor_id()) then raise exception 'conflict declared' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'roundId', r.round_id, 'roundName', r.round_name, 'kind', r.kind, 'status', r.status,
    'validLockedEvaluations', r.valid_locked_evaluations, 'requiredEvaluations', 2,
    'missingRequiredCriteria', to_jsonb(r.missing_required_criteria),
    'blockers', (case when r.status not in ('FROZEN','FINALIZED') then '["ROUND_NOT_CLOSED"]'::jsonb else '[]'::jsonb end)
      || (case when r.valid_locked_evaluations < 2 then '["VALID_LOCKED_EVALUATIONS_MISSING"]'::jsonb else '[]'::jsonb end)
  ) order by r.round_name, r.round_id), '[]'::jsonb) into round_items
  from rush.decision_evidence_rounds(target_application_id) r;
  if jsonb_array_length(round_items) = 0 then blockers := blockers || '["NO_REQUIRED_ROUNDS"]'::jsonb; end if;
  if application_row.status in ('DRAFT','WITHDRAWN') then blockers := blockers || '["APPLICATION_INELIGIBLE"]'::jsonb; end if;
  return jsonb_build_object('applicationId', application_row.id, 'applicationStatus', application_row.status,
    'ready', rush.is_decision_ready(target_application_id), 'blockers', blockers, 'rounds', round_items);
end $$;
revoke all on function rush.decision_evidence_diagnostics(text) from public, anon;
grant execute on function rush.decision_evidence_diagnostics(text) to authenticated, service_role;
