create function rush.submit_evaluation(target_assignment_id text, submitted_ratings jsonb, submitted_evidence text default null)
returns table (evaluation_id text, score numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  assignment_row rush.evaluation_assignments%rowtype;
  round_row rush.rounds%rowtype;
  v_rubric_id text;
  expected_count integer;
  received_count integer;
  total_weight numeric;
  observed_weight numeric;
  weighted_score numeric;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if jsonb_typeof(submitted_ratings) <> 'array' then raise exception 'ratings must be an array' using errcode = '22023'; end if;
  select * into assignment_row from rush.evaluation_assignments where id = target_assignment_id for update;
  if assignment_row.id is null or assignment_row.evaluator_id <> actor then raise exception 'assignment not found' using errcode = 'P0002'; end if;
  select * into round_row from rush.rounds where id = assignment_row.round_id for update;
  if assignment_row.status <> 'ASSIGNED' or round_row.status <> 'ACTIVE' or (round_row.closes_at is not null and round_row.closes_at < now()) then
    raise exception 'assignment closed' using errcode = '55000';
  end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[]) then
    raise exception 'role revoked' using errcode = '42501';
  end if;
  if exists (select 1 from rush.conflict_declarations where application_id = assignment_row.application_id and declarer_id = actor) then
    raise exception 'conflict declared' using errcode = '42501';
  end if;
  if exists (select 1 from rush.evaluations where assignment_id = target_assignment_id and status in ('SUBMITTED','LOCKED')) then
    raise exception 'already submitted' using errcode = '23505';
  end if;
  select id into v_rubric_id from rush.rubrics where round_id = round_row.id order by version desc limit 1;
  if v_rubric_id is null then raise exception 'rubric missing' using errcode = '55000'; end if;

  with input as (
    select x->>'criterionId' criterion_id, nullif(x->>'score','')::integer score_value, trim(coalesce(x->>'note','')) note
    from jsonb_array_elements(submitted_ratings) x
  )
  select count(*), count(distinct criterion_id) into received_count, expected_count from input;
  select count(*) into expected_count from rush.rubric_criteria where rubric_id = v_rubric_id;
  if received_count <> expected_count or exists (
    select 1 from jsonb_array_elements(submitted_ratings) x
    where not exists (select 1 from rush.rubric_criteria c where c.rubric_id = v_rubric_id and c.id = x->>'criterionId')
  ) or (select count(distinct x->>'criterionId') from jsonb_array_elements(submitted_ratings) x) <> expected_count then
    raise exception 'every criterion must appear exactly once' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(submitted_ratings) x where x ? 'score' and x->'score' <> 'null'::jsonb and ((x->>'score') !~ '^[1-5]$')) then
    raise exception 'scores must be 1 through 5 or null' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(submitted_ratings) x where (x->>'score') in ('1','2','5') and trim(coalesce(x->>'note','')) = '') then
    raise exception 'extreme scores require notes' using errcode = '22023';
  end if;
  with input as (select x->>'criterionId' criterion_id, nullif(x->>'score','')::integer score_value from jsonb_array_elements(submitted_ratings) x)
  select sum(c.weight), sum(c.weight) filter (where i.score_value is not null),
    100 * sum(c.weight * ((i.score_value - 1)::numeric / 4)) filter (where i.score_value is not null)
      / nullif(sum(c.weight) filter (where i.score_value is not null), 0)
  into total_weight, observed_weight, weighted_score
  from rush.rubric_criteria c join input i on i.criterion_id = c.id where c.rubric_id = v_rubric_id;
  if observed_weight / total_weight < 0.75 or exists (
    select 1 from rush.rubric_criteria c join jsonb_array_elements(submitted_ratings) x on x->>'criterionId' = c.id
    where c.rubric_id = v_rubric_id and c.required and x->'score' = 'null'::jsonb
  ) then raise exception 'required criteria or observation coverage missing' using errcode = '22023'; end if;

  insert into rush.evaluations (assignment_id, evaluator_id, rubric_id, status, evidence, submitted_at)
  values (target_assignment_id, actor, v_rubric_id, 'SUBMITTED', left(nullif(trim(submitted_evidence),''), 4000), now())
  returning id into evaluation_id;
  insert into rush.criterion_ratings (evaluation_id, criterion_id, score, note)
  select evaluation_id, x->>'criterionId', nullif(x->>'score','')::integer, left(nullif(trim(x->>'note'),''), 2000)
  from jsonb_array_elements(submitted_ratings) x;
  update rush.evaluation_assignments set status = 'SUBMITTED' where id = target_assignment_id;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (actor, round_row.cycle_id, 'EVALUATION_SUBMITTED', 'Evaluation', evaluation_id);
  score := weighted_score;
  return next;
end;
$$;
create function rush.declare_conflict(target_application_id text, conflict_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target_cycle text; released_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if char_length(trim(conflict_reason)) not between 1 and 1000 then raise exception 'invalid reason' using errcode = '22023'; end if;
  select cycle_id into target_cycle from rush.applications where id = target_application_id;
  if target_cycle is null or not rush.has_cycle_role(target_cycle, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into rush.conflict_declarations (application_id, declarer_id, reason) values (target_application_id, actor, trim(conflict_reason))
  on conflict (application_id, declarer_id) do update set reason = excluded.reason;
  update rush.evaluations e set status = 'VOID', voided_at = now() from rush.evaluation_assignments a
  where e.assignment_id = a.id and a.application_id = target_application_id and e.evaluator_id = actor and e.status in ('DRAFT','SUBMITTED','LOCKED');
  update rush.evaluation_assignments set status = 'RECUSED' where application_id = target_application_id and evaluator_id = actor;
  delete from rush.decision_approvals da using rush.decisions d where da.decision_id = d.id and da.approver_id = actor and d.application_id = target_application_id and d.status in ('PENDING','APPROVED','LOCKED');
  update rush.decisions set status = 'PENDING', locked_at = null where application_id = target_application_id and status in ('APPROVED','LOCKED');
  if found then update rush.applications set status = 'FINAL_REVIEW' where id = target_application_id; end if;
  select id into released_id from rush.decisions where application_id = target_application_id and status = 'RELEASED' order by released_at desc limit 1;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, target_cycle, case when released_id is null then 'CONFLICT_DECLARED' else 'CONFLICT_DECLARED_AFTER_RELEASE' end, 'Application', target_application_id, case when released_id is null then '{}'::jsonb else jsonb_build_object('decisionId', released_id, 'requiresReview', true) end);
end; $$;
create function rush.member_applicants(target_cycle_id text)
returns table (id text, name text) language sql stable security definer set search_path = '' as $$
  select a.id, p.name from rush.applications a join rush.pnms p on p.id = a.pnm_id
  where a.cycle_id = target_cycle_id and rush.has_cycle_role(target_cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
  order by p.name;
$$;
revoke all on function rush.submit_evaluation(text,jsonb,text) from public, anon;
revoke all on function rush.declare_conflict(text,text) from public, anon;
revoke all on function rush.member_applicants(text) from public, anon;
grant execute on function rush.submit_evaluation(text,jsonb,text), rush.declare_conflict(text,text), rush.member_applicants(text) to authenticated, service_role;
