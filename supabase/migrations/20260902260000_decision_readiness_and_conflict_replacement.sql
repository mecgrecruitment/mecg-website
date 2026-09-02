-- One evidence gate for every decision path, plus conflict replacement during
-- an active evaluated round. These rules live in the database so a UI or API
-- path cannot accidentally provide a softer route to an outcome.

create or replace function rush.is_decision_ready(target_application_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from rush.applications a
    join rush.rounds r on r.cycle_id = a.cycle_id and r.weight > 0
    where a.id = target_application_id
  ) and not exists (
    select 1
    from rush.applications a
    join rush.rounds r on r.cycle_id = a.cycle_id and r.weight > 0
    where a.id = target_application_id
      and (
        r.status not in ('FROZEN', 'FINALIZED')
        or (
          select count(distinct ea.id)
          from rush.evaluation_assignments ea
          join rush.evaluations e on e.assignment_id = ea.id
          where ea.round_id = r.id
            and ea.application_id = a.id
            and e.status = 'LOCKED'
        ) < 2
      )
  );
$$;

create or replace function rush.assert_decision_ready(target_application_id text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from rush.applications where id = target_application_id) then
    raise exception 'application missing' using errcode = 'P0002';
  end if;
  if not rush.is_decision_ready(target_application_id) then
    raise exception 'complete and freeze two evaluations in every weighted round before deciding' using errcode = '55000';
  end if;
end;
$$;

create or replace function rush.create_decision(
  target_cycle_id text,
  target_application_id text,
  target_outcome rush.decision_outcome,
  decision_reason text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare result_id text;
begin
  if not rush.has_cycle_role(target_cycle_id, array['PANEL','OWNER']::rush.member_role[]) then
    raise exception 'panel role required' using errcode = '42501';
  end if;
  if char_length(trim(decision_reason)) not between 1 and 4000 then
    raise exception 'reason required' using errcode = '22023';
  end if;
  if not exists (select 1 from rush.applications where id = target_application_id and cycle_id = target_cycle_id) then
    raise exception 'application missing' using errcode = 'P0002';
  end if;
  if exists (select 1 from rush.applications where id = target_application_id and status = 'WITHDRAWN') then
    raise exception 'application withdrawn' using errcode = '55000';
  end if;
  if exists (select 1 from rush.conflict_declarations where application_id = target_application_id and declarer_id = rush.actor_id()) then
    raise exception 'conflict declared' using errcode = '42501';
  end if;
  if not exists (select 1 from rush.rush_cycles where id = target_cycle_id and status = 'DECISION_LOCK') then
    raise exception 'cycle not in decision lock' using errcode = '55000';
  end if;
  perform rush.assert_decision_ready(target_application_id);

  insert into rush.decisions (cycle_id, application_id, outcome, reason, created_by_id)
  values (target_cycle_id, target_application_id, target_outcome, trim(decision_reason), rush.actor_id())
  returning id into result_id;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (rush.actor_id(), target_cycle_id, 'DECISION_CREATED', 'Decision', result_id);
  return result_id;
end;
$$;

create or replace function rush.approve_decision(target_decision_id text)
returns table (locked boolean, approvals bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare d rush.decisions%rowtype;
begin
  select * into d from rush.decisions where id = target_decision_id for update;
  if d.id is null then raise exception 'decision missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(d.cycle_id, array['PANEL','OWNER']::rush.member_role[]) then raise exception 'panel role required' using errcode = '42501'; end if;
  if exists (select 1 from rush.conflict_declarations where application_id = d.application_id and declarer_id = rush.actor_id()) then raise exception 'conflict declared' using errcode = '42501'; end if;
  if d.status not in ('PENDING','APPROVED') then raise exception 'decision closed' using errcode = '55000'; end if;
  if not exists (select 1 from rush.rush_cycles where id = d.cycle_id and status = 'DECISION_LOCK') then raise exception 'cycle closed' using errcode = '55000'; end if;
  perform rush.assert_decision_ready(d.application_id);

  insert into rush.decision_approvals (decision_id, approver_id) values (d.id, rush.actor_id()) on conflict do nothing;
  select count(*) into approvals
  from rush.decision_approvals da
  join rush.profiles p on p.id = da.approver_id and p.active
  where da.decision_id = d.id
    and exists (select 1 from rush.memberships m where m.user_id = da.approver_id and m.cycle_id = d.cycle_id and m.active and m.role in ('PANEL','OWNER'))
    and not exists (select 1 from rush.conflict_declarations c where c.application_id = d.application_id and c.declarer_id = da.approver_id);
  locked := approvals >= 2;
  update rush.decisions
  set status = case when locked then 'LOCKED'::rush.decision_status else 'APPROVED'::rush.decision_status end,
      locked_at = case when locked then now() else null end
  where id = d.id;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (rush.actor_id(), d.cycle_id, case when locked then 'DECISION_LOCKED' else 'DECISION_APPROVED' end,
          'Decision', d.id, jsonb_build_object('validApprovals', approvals));
  return next;
end;
$$;

create or replace function rush.apply_hash_result(target_application_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  app_row rush.applications%rowtype;
  cycle_row rush.rush_cycles%rowtype;
  yes_votes int;
  no_votes int;
  unsure_votes int;
  total_cast int;
  computed_outcome rush.decision_outcome;
  existing_id text;
  result_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into app_row from rush.applications where id = target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(app_row.cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into cycle_row from rush.rush_cycles where id = app_row.cycle_id;
  if cycle_row.status <> 'DECISION_LOCK' then raise exception 'voting is not open' using errcode = '55000'; end if;
  if app_row.status in ('DRAFT','WITHDRAWN') then raise exception 'application is not votable' using errcode = '55000'; end if;
  if exists (select 1 from rush.conflict_declarations where application_id = app_row.id and declarer_id = actor) then raise exception 'conflict declared for this applicant' using errcode = '42501'; end if;
  perform rush.assert_decision_ready(app_row.id);

  select count(*) filter (where vote = 'YES')::int,
         count(*) filter (where vote = 'NO')::int,
         count(*) filter (where vote = 'UNSURE')::int,
         count(*)::int
  into yes_votes, no_votes, unsure_votes, total_cast
  from rush.hash_votes where application_id = app_row.id;
  if total_cast < cycle_row.hash_quorum then raise exception 'not enough votes yet' using errcode = '55000'; end if;

  select id into existing_id from rush.decisions
  where application_id = app_row.id and status in ('PENDING','APPROVED','LOCKED','RELEASED');
  if existing_id is not null then return existing_id; end if;

  computed_outcome := case when yes_votes > no_votes then 'OFFER' else 'REJECT' end;
  insert into rush.decisions (cycle_id, application_id, outcome, status, reason, created_by_id, locked_at, hash_derived)
  values (app_row.cycle_id, app_row.id, computed_outcome, 'LOCKED',
          format('Member vote: %s yes, %s no, %s unsure', yes_votes, no_votes, unsure_votes), actor, now(), true)
  returning id into result_id;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, app_row.cycle_id, 'HASH_RESULT_APPLIED', 'Decision', result_id,
          jsonb_build_object('applicationId', app_row.id, 'yesCount', yes_votes, 'noCount', no_votes,
                            'unsureCount', unsure_votes, 'totalVotes', total_cast,
                            'quorum', cycle_row.hash_quorum, 'outcome', computed_outcome));
  return result_id;
end;
$$;

create or replace function rush.release_decision(target_decision_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare d rush.decisions%rowtype; valid_approvals bigint;
begin
  select * into d from rush.decisions where id = target_decision_id for update;
  if d.id is null then raise exception 'decision missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(d.cycle_id, array['PANEL','OWNER']::rush.member_role[]) then raise exception 'panel role required' using errcode = '42501'; end if;
  if exists (select 1 from rush.conflict_declarations where application_id = d.application_id and declarer_id = rush.actor_id()) then raise exception 'conflict declared' using errcode = '42501'; end if;
  perform rush.assert_decision_ready(d.application_id);
  select count(*) into valid_approvals
  from rush.decision_approvals da
  join rush.profiles p on p.id = da.approver_id and p.active
  where da.decision_id = d.id
    and exists (select 1 from rush.memberships m where m.user_id = da.approver_id and m.cycle_id = d.cycle_id and m.active and m.role in ('PANEL','OWNER'))
    and not exists (select 1 from rush.conflict_declarations c where c.application_id = d.application_id and c.declarer_id = da.approver_id);
  if d.status <> 'LOCKED' or (valid_approvals < 2 and not d.hash_derived) then raise exception 'decision not locked' using errcode = '55000'; end if;

  perform 1 from rush.applications where id = d.application_id for update;
  update rush.applications
  set status = case d.outcome when 'OFFER' then 'OFFERED'::rush.application_status
                              when 'WAITLIST' then 'WAITLISTED'::rush.application_status
                              when 'REJECT' then 'REJECTED'::rush.application_status
                              else 'FINAL_REVIEW'::rush.application_status end
  where id = d.application_id;
  update rush.decisions set status = 'RELEASED', released_at = now() where id = d.id and status = 'LOCKED';
  insert into rush.notification_outbox (cycle_id, application_id, decision_id, recipient, template_key, template_version, idempotency_key)
  select d.cycle_id, d.application_id, d.id, p.contact, 'DECISION_RELEASED', 1, 'decision-release:' || d.id
  from rush.applications a join rush.pnms p on p.id = a.pnm_id where a.id = d.application_id
  on conflict (decision_id, template_key, template_version) do nothing;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (rush.actor_id(), d.cycle_id, 'DECISION_RELEASED', 'Decision', d.id);
end;
$$;

create or replace function rush.declare_conflict(target_application_id text, conflict_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  target_cycle text;
  released_id text;
  recused rush.evaluation_assignments%rowtype;
  replacement uuid;
  replacement_assignment_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if char_length(trim(conflict_reason)) not between 1 and 1000 then raise exception 'invalid reason' using errcode = '22023'; end if;
  select cycle_id into target_cycle from rush.applications where id = target_application_id for update;
  if target_cycle is null or not rush.has_cycle_role(target_cycle, array['MEMBER','BOARD','PANEL','OWNER','RECRUITMENT_COMMITTEE']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into rush.conflict_declarations (application_id, declarer_id, reason)
  values (target_application_id, actor, trim(conflict_reason))
  on conflict (application_id, declarer_id) do update set reason = excluded.reason;

  update rush.evaluations e set status = 'VOID', voided_at = now()
  from rush.evaluation_assignments a
  where e.assignment_id = a.id and a.application_id = target_application_id
    and e.evaluator_id = actor and e.status in ('DRAFT','SUBMITTED','LOCKED');

  for recused in
    update rush.evaluation_assignments
    set status = 'RECUSED', updated_at = now()
    where application_id = target_application_id and evaluator_id = actor and status <> 'RECUSED'
    returning *
  loop
    replacement := null;
    replacement_assignment_id := null;
    select m.user_id into replacement
    from rush.memberships m
    join rush.profiles p on p.id = m.user_id and p.active
    where m.cycle_id = target_cycle and m.active
      and m.role in ('MEMBER','BOARD','PANEL','OWNER')
      and m.user_id <> actor
      and not exists (select 1 from rush.conflict_declarations c where c.application_id = target_application_id and c.declarer_id = m.user_id)
      and not exists (select 1 from rush.evaluation_assignments ea where ea.round_id = recused.round_id and ea.application_id = target_application_id and ea.evaluator_id = m.user_id)
      and not (rush.is_eligible_screening_reviewer(target_cycle, m.user_id)
        and exists (select 1 from rush.screening_batches b where b.cycle_id = target_cycle and b.status = 'PUBLISHED'))
    order by (
      select count(*) from rush.evaluation_assignments load
      join rush.rounds lr on lr.id = load.round_id
      where load.evaluator_id = m.user_id and lr.cycle_id = target_cycle and load.status in ('ASSIGNED','IN_PROGRESS')
    ), m.user_id
    limit 1;

    if replacement is not null then
      insert into rush.evaluation_assignments (round_id, application_id, evaluator_id)
      values (recused.round_id, target_application_id, replacement)
      returning id into replacement_assignment_id;
      insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
      values (actor, target_cycle, 'EVALUATOR_REPLACED_AFTER_CONFLICT', 'EvaluationAssignment', replacement_assignment_id,
              jsonb_build_object('recusedAssignmentId', recused.id, 'replacementEvaluatorId', replacement));
    else
      insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
      values (actor, target_cycle, 'EVALUATOR_REPLACEMENT_REQUIRED', 'EvaluationAssignment', recused.id,
              jsonb_build_object('applicationId', target_application_id, 'roundId', recused.round_id));
    end if;
  end loop;

  delete from rush.decision_approvals da using rush.decisions d
  where da.decision_id = d.id and da.approver_id = actor and d.application_id = target_application_id
    and d.status in ('PENDING','APPROVED','LOCKED');
  update rush.decisions set status = 'PENDING', locked_at = null
  where application_id = target_application_id and status in ('APPROVED','LOCKED');
  if found then update rush.applications set status = 'FINAL_REVIEW' where id = target_application_id; end if;
  select id into released_id from rush.decisions
  where application_id = target_application_id and status = 'RELEASED' order by released_at desc limit 1;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, target_cycle,
          case when released_id is null then 'CONFLICT_DECLARED' else 'CONFLICT_DECLARED_AFTER_RELEASE' end,
          'Application', target_application_id,
          case when released_id is null then '{}'::jsonb else jsonb_build_object('decisionId', released_id, 'requiresReview', true) end);
end;
$$;

revoke all on function rush.is_decision_ready(text), rush.assert_decision_ready(text) from public, anon, authenticated;
grant execute on function rush.is_decision_ready(text), rush.assert_decision_ready(text) to service_role;
revoke all on function rush.create_decision(text,text,rush.decision_outcome,text), rush.approve_decision(text),
  rush.apply_hash_result(text), rush.release_decision(text), rush.declare_conflict(text,text) from public, anon;
grant execute on function rush.create_decision(text,text,rush.decision_outcome,text), rush.approve_decision(text),
  rush.apply_hash_result(text), rush.release_decision(text), rush.declare_conflict(text,text) to authenticated, service_role;
