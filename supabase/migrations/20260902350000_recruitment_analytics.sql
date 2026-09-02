-- Post-cycle analytics are advisory aggregates for Board and Owner only.
-- No applicant/evaluator identifiers or raw evidence leave this function.

create or replace function rush.recruitment_analytics(target_cycle_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_status rush.cycle_status;
  minimum_cohort constant integer := 5;
  funnel jsonb;
  round_completion jsonb;
  workload jsonb;
  criteria jsonb;
  evaluator_signals jsonb;
begin
  if not rush.has_cycle_role(target_cycle_id, array['BOARD','OWNER']::rush.member_role[]) then
    raise exception 'board or owner role required' using errcode = '42501';
  end if;

  select status into target_status from rush.rush_cycles where id = target_cycle_id;
  if target_status is null then
    raise exception 'cycle missing' using errcode = 'P0002';
  end if;
  if target_status not in ('CLOSED','ARCHIVED') then
    return jsonb_build_object('available', false, 'minimumCohort', minimum_cohort);
  end if;

  with reviewed_applications as (
    select distinct ea.application_id
    from rush.evaluation_assignments ea
    join rush.rounds r on r.id = ea.round_id
    join rush.evaluations e on e.assignment_id = ea.id and e.status = 'LOCKED'
    where r.cycle_id = target_cycle_id
    union
    select distinct sp.application_id
    from rush.screening_batches sb
    join rush.screening_packets sp on sp.batch_id = sb.id
    join rush.screening_assignments sa on sa.packet_id = sp.id
    join rush.screening_reviews sr on sr.assignment_id = sa.id
    where sb.cycle_id = target_cycle_id
  ), stages(position, key, label, count) as (
    values
      (1, 'started', 'Started', (select count(*) from rush.applications where cycle_id = target_cycle_id)),
      (2, 'submitted', 'Submitted', (select count(*) from rush.applications where cycle_id = target_cycle_id and submitted_at is not null)),
      (3, 'reviewed', 'Reviewed', (select count(*) from reviewed_applications)),
      (4, 'decided', 'Decision released', (select count(distinct application_id) from rush.decisions where cycle_id = target_cycle_id and status = 'RELEASED')),
      (5, 'offered', 'Offered', (select count(distinct application_id) from rush.decisions where cycle_id = target_cycle_id and status = 'RELEASED' and outcome = 'OFFER')),
      (6, 'accepted', 'Accepted', (select count(*) from rush.applications where cycle_id = target_cycle_id and offer_response = 'ACCEPTED'))
  )
  select coalesce(jsonb_agg(jsonb_build_object('key', key, 'label', label, 'count', count) order by position), '[]'::jsonb)
  into funnel from stages;

  with assignment_records as (
    select r.id as round_id, ea.application_id, ea.evaluator_id,
      exists (select 1 from rush.evaluations e where e.assignment_id = ea.id and e.status = 'LOCKED') as completed
    from rush.rounds r
    join rush.evaluation_assignments ea on ea.round_id = r.id
    where r.cycle_id = target_cycle_id
    union all
    select r.id, sp.application_id, sa.reviewer_id,
      exists (select 1 from rush.screening_reviews sr where sr.assignment_id = sa.id) as completed
    from rush.screening_batches sb
    join rush.rubrics rubric on rubric.id = sb.rubric_id
    join rush.rounds r on r.id = rubric.round_id
    join rush.screening_packets sp on sp.batch_id = sb.id
    join rush.screening_assignments sa on sa.packet_id = sp.id
    where sb.cycle_id = target_cycle_id
  ), per_round as (
    select r.id, r.name, r.created_at,
      count(ar.evaluator_id)::integer as assigned,
      count(ar.evaluator_id) filter (where ar.completed)::integer as completed,
      count(distinct ar.application_id)::integer as applicant_count
    from rush.rounds r
    left join assignment_records ar on ar.round_id = r.id
    where r.cycle_id = target_cycle_id
    group by r.id, r.name, r.created_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'roundName', name,
    'assigned', assigned,
    'completed', completed,
    'applicantCount', applicant_count,
    'completionRate', case when assigned = 0 then null else round((completed::numeric / assigned) * 100, 1) end
  ) order by created_at), '[]'::jsonb)
  into round_completion from per_round;

  with assignment_records as (
    select ea.evaluator_id, ea.id as assignment_id,
      exists (select 1 from rush.evaluations e where e.assignment_id = ea.id and e.status = 'LOCKED') as completed
    from rush.evaluation_assignments ea
    join rush.rounds r on r.id = ea.round_id
    where r.cycle_id = target_cycle_id
    union all
    select sa.reviewer_id, sa.id,
      exists (select 1 from rush.screening_reviews sr where sr.assignment_id = sa.id) as completed
    from rush.screening_batches sb
    join rush.screening_packets sp on sp.batch_id = sb.id
    join rush.screening_assignments sa on sa.packet_id = sp.id
    where sb.cycle_id = target_cycle_id
  ), per_evaluator as (
    select evaluator_id, count(*)::integer as assigned,
      count(*) filter (where completed)::integer as completed
    from assignment_records
    group by evaluator_id
  ), workload_summary as (
    select count(*)::integer as evaluator_count,
      percentile_cont(0.5) within group (order by assigned)::numeric as median_assignments
    from per_evaluator
  ), buckets as (
    select case when assigned <= 4 then 1 when assigned <= 9 then 2 when assigned <= 14 then 3 else 4 end as position,
      case when assigned <= 4 then '1–4' when assigned <= 9 then '5–9' when assigned <= 14 then '10–14' else '15+' end as label,
      count(*)::integer as evaluator_count
    from per_evaluator
    group by 1, 2
  )
  select case when evaluator_count < minimum_cohort then
    jsonb_build_object('suppressed', true, 'evaluatorCount', evaluator_count, 'minimumCohort', minimum_cohort)
  else jsonb_build_object(
    'suppressed', false,
    'evaluatorCount', evaluator_count,
    'medianAssignments', round(median_assignments, 1),
    'buckets', (select coalesce(jsonb_agg(jsonb_build_object('label', label, 'evaluatorCount', evaluator_count) order by position), '[]'::jsonb) from buckets)
  ) end
  into workload from workload_summary;

  with rating_rows as (
    select r.id as round_id, r.name as round_name, rc.key as criterion_key, rc.name as criterion_name, cr.score::numeric as score
    from rush.criterion_ratings cr
    join rush.evaluations e on e.id = cr.evaluation_id and e.status = 'LOCKED'
    join rush.evaluation_assignments ea on ea.id = e.assignment_id
    join rush.rounds r on r.id = ea.round_id
    join rush.rubric_criteria rc on rc.id = cr.criterion_id
    where r.cycle_id = target_cycle_id and cr.score is not null
    union all
    select r.id, r.name, rc.key, rc.name, srating.score::numeric
    from rush.screening_ratings srating
    join rush.screening_reviews sreview on sreview.id = srating.review_id
    join rush.screening_assignments sa on sa.id = sreview.assignment_id
    join rush.screening_packets sp on sp.id = sa.packet_id
    join rush.screening_batches sb on sb.id = sp.batch_id
    join rush.rubrics rubric on rubric.id = sb.rubric_id
    join rush.rounds r on r.id = rubric.round_id
    join rush.rubric_criteria rc on rc.id = srating.criterion_id
    where sb.cycle_id = target_cycle_id
  ), aggregates as (
    select round_id, round_name, criterion_key, criterion_name,
      count(*)::integer as rating_count,
      avg(score) as average_score,
      stddev_samp(score) as score_spread
    from rating_rows
    group by round_id, round_name, criterion_key, criterion_name
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'roundName', round_name,
    'criterionName', criterion_name,
    'ratingCount', rating_count,
    'suppressed', rating_count < minimum_cohort,
    'average', case when rating_count < minimum_cohort then null else round(average_score, 2) end,
    'spread', case when rating_count < minimum_cohort then null else round(score_spread, 2) end
  ) order by round_name, criterion_name), '[]'::jsonb)
  into criteria from aggregates;

  with composite_rows as (
    select e.id, e.evaluator_id, coalesce(e.submitted_at, e.updated_at) as submitted_at,
      sum(cr.score::numeric * rc.weight) / nullif(sum(rc.weight) filter (where cr.score is not null), 0) as composite
    from rush.evaluations e
    join rush.evaluation_assignments ea on ea.id = e.assignment_id
    join rush.rounds r on r.id = ea.round_id
    join rush.criterion_ratings cr on cr.evaluation_id = e.id
    join rush.rubric_criteria rc on rc.id = cr.criterion_id
    where r.cycle_id = target_cycle_id and e.status = 'LOCKED' and cr.score is not null
    group by e.id, e.evaluator_id, e.submitted_at, e.updated_at
    union all
    select sreview.id, sreview.reviewer_id, sreview.submitted_at,
      sum(srating.score::numeric * rc.weight) / nullif(sum(rc.weight), 0) as composite
    from rush.screening_reviews sreview
    join rush.screening_assignments sa on sa.id = sreview.assignment_id
    join rush.screening_packets sp on sp.id = sa.packet_id
    join rush.screening_batches sb on sb.id = sp.batch_id
    join rush.screening_ratings srating on srating.review_id = sreview.id
    join rush.rubric_criteria rc on rc.id = srating.criterion_id
    where sb.cycle_id = target_cycle_id
    group by sreview.id, sreview.reviewer_id, sreview.submitted_at
  ), sequenced as (
    select *,
      row_number() over (partition by evaluator_id order by submitted_at, id) as position,
      count(*) over (partition by evaluator_id) as total
    from composite_rows
    where composite is not null
  ), per_evaluator as (
    select evaluator_id,
      stddev_samp(composite) as consistency_spread,
      abs(avg(composite) filter (where position > total / 2) - avg(composite) filter (where position <= total / 2)) as absolute_drift
    from sequenced
    where total >= 6
    group by evaluator_id
  ), signal_summary as (
    select count(*)::integer as evaluator_count,
      percentile_cont(0.5) within group (order by consistency_spread)::numeric as median_consistency,
      percentile_cont(0.5) within group (order by absolute_drift)::numeric as median_absolute_drift,
      count(*) filter (where consistency_spread >= 0.8)::integer as high_variance_count,
      count(*) filter (where absolute_drift >= 0.5)::integer as high_drift_count
    from per_evaluator
  )
  select case when evaluator_count < minimum_cohort then
    jsonb_build_object('suppressed', true, 'evaluatorCount', evaluator_count, 'minimumCohort', minimum_cohort)
  else jsonb_build_object(
    'suppressed', false,
    'evaluatorCount', evaluator_count,
    'medianConsistency', round(median_consistency, 2),
    'medianAbsoluteDrift', round(median_absolute_drift, 2),
    'highVarianceCount', high_variance_count,
    'highDriftCount', high_drift_count
  ) end
  into evaluator_signals from signal_summary;

  return jsonb_build_object(
    'available', true,
    'minimumCohort', minimum_cohort,
    'funnel', funnel,
    'rounds', round_completion,
    'workload', workload,
    'criteria', criteria,
    'evaluatorSignals', evaluator_signals,
    'advisoryOnly', true
  );
end;
$$;

revoke all on function rush.recruitment_analytics(text) from public, anon, authenticated;
grant execute on function rush.recruitment_analytics(text) to authenticated, service_role;

-- Clerk subjects are not UUIDs. Every Rush function created after the identity
-- cutover must resolve the stable profile through rush.actor_id().
do $$
declare retained integer;
begin
  select count(*) into retained
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'rush'
    and pg_get_functiondef(p.oid) like '%auth.uid()%';
  if retained <> 0 then
    raise exception '% Rush functions still call auth.uid()', retained;
  end if;
end;
$$;
