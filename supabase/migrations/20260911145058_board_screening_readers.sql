-- Board and Owner members may serve as blind screening reviewers. Panel is the
-- only identity-steward role kept out, because Panel approves decisions and
-- must not have scored the packet it later rules on.
create or replace function rush.is_eligible_screening_reviewer(target_cycle_id text, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id is not null
    and exists (
      select 1
      from rush.profiles p
      where p.id = target_user_id
        and p.active
    )
    and exists (
      select 1
      from rush.memberships m
      where m.user_id = target_user_id
        and m.cycle_id = target_cycle_id
        and m.role in ('RECRUITMENT_COMMITTEE', 'BOARD', 'OWNER')
        and m.active
    )
    and not exists (
      select 1
      from rush.memberships m
      where m.user_id = target_user_id
        and m.cycle_id = target_cycle_id
        and m.role = 'PANEL'
        and m.active
    );
$$;

revoke all on function rush.is_eligible_screening_reviewer(text, uuid) from public, anon, authenticated;
grant execute on function rush.is_eligible_screening_reviewer(text, uuid) to service_role;

-- Eligibility no longer implies enrolment: Board and Owner members are eligible
-- by role, but only a reviewer on the cycle's published batch actually screens.
create or replace function rush.is_enrolled_screening_reviewer(target_cycle_id text, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from rush.screening_reviewers sr
    join rush.screening_batches b on b.id = sr.batch_id
    where b.cycle_id = target_cycle_id
      and b.status = 'PUBLISHED'
      and sr.reviewer_id = target_user_id
      and sr.active
  );
$$;

revoke all on function rush.is_enrolled_screening_reviewer(text, uuid) from public, anon, authenticated;
grant execute on function rush.is_enrolled_screening_reviewer(text, uuid) to service_role;

-- A screening reviewer can still gain Board or Owner in the same cycle; only
-- Panel stays incompatible with having reviewed.
create or replace function rush.grant_membership(target_user_id uuid, target_cycle_id text, target_role rush.member_role)
returns text language plpgsql security definer set search_path='' as $$
declare result_id text;
begin
  if rush.actor_id()=target_user_id then raise exception 'self grant forbidden' using errcode='42501'; end if;
  if not rush.has_cycle_role(target_cycle_id,array['OWNER']::rush.member_role[]) then raise exception 'owner required' using errcode='42501'; end if;
  if not exists(select 1 from rush.profiles where id=target_user_id and active) then raise exception 'user missing' using errcode='P0002'; end if;
  if target_role = 'PANEL' and exists(
    select 1 from rush.screening_reviewers sr join rush.screening_batches b on b.id=sr.batch_id
    where sr.reviewer_id=target_user_id and b.cycle_id=target_cycle_id
  ) then raise exception 'screening reviewer cannot receive a privileged role in the same cycle' using errcode='42501'; end if;
  insert into rush.memberships(user_id,cycle_id,role,active,revoked_at) values(target_user_id,target_cycle_id,target_role,true,null)
  on conflict(user_id,cycle_id,role) do update set active=true,revoked_at=null returning id into result_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
  values(rush.actor_id(),target_cycle_id,'MEMBERSHIP_GRANTED','Profile',target_user_id::text,jsonb_build_object('role',target_role));
  return result_id;
end $$;
revoke all on function rush.grant_membership(uuid,text,rush.member_role) from public,anon;
grant execute on function rush.grant_membership(uuid,text,rush.member_role) to authenticated,service_role;

create or replace function rush.set_membership_role(
  target_user_id uuid,
  target_cycle_id text,
  target_role rush.member_role
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id text;
  previous_roles text[];
begin
  if rush.actor_id() = target_user_id then
    raise exception 'self role change forbidden' using errcode = '42501';
  end if;

  if not rush.has_cycle_role(target_cycle_id, array['OWNER']::rush.member_role[]) then
    raise exception 'owner required' using errcode = '42501';
  end if;

  if not exists(select 1 from rush.profiles where id = target_user_id and active) then
    raise exception 'user missing' using errcode = 'P0002';
  end if;

  perform id
  from rush.memberships
  where cycle_id = target_cycle_id
  order by id
  for update;

  select array_agg(role::text order by role::text)
  into previous_roles
  from rush.memberships
  where user_id = target_user_id
    and cycle_id = target_cycle_id
    and active;

  if previous_roles is null then
    raise exception 'membership missing' using errcode = 'P0002';
  end if;

  if target_role = 'PANEL' and exists(
    select 1
    from rush.screening_reviewers sr
    join rush.screening_batches b on b.id = sr.batch_id
    where sr.reviewer_id = target_user_id
      and b.cycle_id = target_cycle_id
  ) then
    raise exception 'screening reviewer cannot receive a privileged role in the same cycle' using errcode = '42501';
  end if;

  if 'OWNER' = any(previous_roles)
    and target_role <> 'OWNER'
    and not exists(
      select 1
      from rush.memberships
      where cycle_id = target_cycle_id
        and role = 'OWNER'
        and active
        and user_id <> target_user_id
    )
  then
    raise exception 'cycle must retain an owner' using errcode = '55000';
  end if;

  update rush.memberships
  set active = false,
      revoked_at = now()
  where user_id = target_user_id
    and cycle_id = target_cycle_id
    and active
    and role <> target_role;

  insert into rush.memberships(user_id, cycle_id, role, active, revoked_at)
  values(target_user_id, target_cycle_id, target_role, true, null)
  on conflict(user_id, cycle_id, role)
  do update set active = true, revoked_at = null
  returning id into result_id;

  insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id, metadata)
  values(
    rush.actor_id(),
    target_cycle_id,
    'MEMBERSHIP_ROLE_CHANGED',
    'Profile',
    target_user_id::text,
    jsonb_build_object('from', previous_roles, 'to', target_role)
  );

  return result_id;
end;
$$;

revoke all on function rush.set_membership_role(uuid, text, rush.member_role) from public, anon;
grant execute on function rush.set_membership_role(uuid, text, rush.member_role) to authenticated, service_role;

-- Frozen results now carry the application, applicant cohort, reviewer and
-- per-criterion ratings so Board can rank applicants. Callers outside Board
-- and Owner still see only the code, cohort, recommendation and scores.
create or replace function rush.screening_admin_overview(target_cycle_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not rush.has_cycle_capability(target_cycle_id, 'SCREENING_ADMINISTRATION') then null
    else coalesce((
      select jsonb_build_object(
        'batchId', b.id,
        'status', b.status,
        'reviewsPerApplication', b.reviews_per_application,
        'reviewers', (select coalesce(jsonb_agg(jsonb_build_object('id', sr.reviewer_id, 'name', p.display_name, 'capacity', sr.capacity) order by p.display_name), '[]'::jsonb) from rush.screening_reviewers sr join rush.profiles p on p.id = sr.reviewer_id where sr.batch_id = b.id and sr.active),
        'packets', case when rush.is_active_screening_reviewer(target_cycle_id) then '[]'::jsonb else (select coalesce(jsonb_agg((jsonb_build_object('id', sp.id, 'code', sp.candidate_code, 'status', sp.redaction_status, 'applicantName', pn.name, 'content', sp.content) - case when b.status = 'FROZEN' and not rush.has_cycle_role(target_cycle_id, array['BOARD', 'OWNER']::rush.member_role[]) then array['applicantName', 'content'] else array[]::text[] end) order by sp.candidate_code), '[]'::jsonb) from rush.screening_packets sp join rush.applications a on a.id = sp.application_id join rush.pnms pn on pn.id = a.pnm_id where sp.batch_id = b.id) end,
        'assigned', (select count(*) from rush.screening_assignments sa join rush.screening_packets sp on sp.id = sa.packet_id where sp.batch_id = b.id and sa.status <> 'RECUSED'),
        'submitted', (select count(*) from rush.screening_assignments sa join rush.screening_packets sp on sp.id = sa.packet_id where sp.batch_id = b.id and sa.status in ('SUBMITTED', 'LOCKED')),
        'results', case when b.status = 'FROZEN' and not rush.is_active_screening_reviewer(target_cycle_id) then (
          select coalesce(jsonb_agg((jsonb_build_object(
            'code', sp.candidate_code,
            'applicationId', sp.application_id,
            'applicantName', pn.name,
            'classYear', pn.class_year,
            'major', pn.major,
            'reviewerId', sr.reviewer_id,
            'reviewerName', rp.display_name,
            'recommendation', sr.recommendation,
            'score', sr.score,
            'evidence', sr.evidence,
            'submittedAt', sr.submitted_at,
            'ratings', (
              select coalesce(jsonb_agg((jsonb_build_object('key', rc.key, 'name', rc.name, 'weight', rc.weight, 'score', rt.score, 'note', rt.note) - case when rush.has_cycle_role(target_cycle_id, array['BOARD', 'OWNER']::rush.member_role[]) then array[]::text[] else array['note'] end) order by rc.position), '[]'::jsonb)
              from rush.screening_ratings rt
              join rush.rubric_criteria rc on rc.id = rt.criterion_id
              where rt.review_id = sr.id
            )
          ) - case when rush.has_cycle_role(target_cycle_id, array['BOARD', 'OWNER']::rush.member_role[]) then array[]::text[] else array['applicantName', 'evidence', 'reviewerId', 'reviewerName'] end) order by sp.candidate_code, sr.submitted_at), '[]'::jsonb)
          from rush.screening_reviews sr
          join rush.screening_assignments sa on sa.id = sr.assignment_id
          join rush.screening_packets sp on sp.id = sa.packet_id
          join rush.applications a on a.id = sp.application_id
          join rush.pnms pn on pn.id = a.pnm_id
          join rush.profiles rp on rp.id = sr.reviewer_id
          where sp.batch_id = b.id
        ) else '[]'::jsonb end
      )
      from rush.screening_batches b
      where b.cycle_id = target_cycle_id
    ), 'null'::jsonb)
  end;
$$;

revoke all on function rush.screening_admin_overview(text) from public, anon;
grant execute on function rush.screening_admin_overview(text) to authenticated, service_role;

-- Interview-round assignment must block enrolled screening reviewers, not
-- everyone who is merely eligible to be one.
create or replace function rush.assign_evaluator(target_cycle_id text,target_round_id text,target_application_id text,target_evaluator_id uuid) returns text language plpgsql security definer set search_path='' as $$ declare result_id text; existing_status rush.assignment_status; begin if not rush.has_cycle_capability(target_cycle_id,'APPLICANT_OPERATIONS') then raise exception 'forbidden' using errcode='42501'; end if; if not exists(select 1 from rush.rush_cycles where id=target_cycle_id and status='IN_PROCESS') then raise exception 'cycle not in process' using errcode='55000'; end if; if not exists(select 1 from rush.rounds where id=target_round_id and cycle_id=target_cycle_id and status in ('DRAFT','PUBLISHED')) then raise exception 'round unavailable' using errcode='55000'; end if; if not exists(select 1 from rush.applications where id=target_application_id and cycle_id=target_cycle_id) then raise exception 'application missing' using errcode='P0002'; end if; if not exists(select 1 from rush.memberships where user_id=target_evaluator_id and cycle_id=target_cycle_id and active) then raise exception 'evaluator inactive' using errcode='42501'; end if; if exists(select 1 from rush.conflict_declarations where application_id=target_application_id and declarer_id=target_evaluator_id) then raise exception 'evaluator conflict' using errcode='42501'; end if; if rush.is_enrolled_screening_reviewer(target_cycle_id,target_evaluator_id) then raise exception 'screening reviewer cannot be assigned as an evaluator in the same cycle' using errcode='42501'; end if; select status into existing_status from rush.evaluation_assignments where round_id=target_round_id and application_id=target_application_id and evaluator_id=target_evaluator_id for update; if existing_status is not null and existing_status<>'ASSIGNED' then raise exception 'assignment locked' using errcode='55000'; end if; insert into rush.evaluation_assignments(round_id,application_id,evaluator_id) values(target_round_id,target_application_id,target_evaluator_id) on conflict(round_id,application_id,evaluator_id) do update set updated_at=now() returning id into result_id; insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(rush.actor_id(),target_cycle_id,'EVALUATOR_ASSIGNED','EvaluationAssignment',result_id); return result_id; end $$;
revoke all on function rush.assign_evaluator(text,text,text,uuid) from public,anon;
grant execute on function rush.assign_evaluator(text,text,text,uuid) to authenticated,service_role;

create or replace function rush.reassign_evaluator(target_assignment_id text, replacement_evaluator_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare assignment_row rush.evaluation_assignments%rowtype; target_cycle text;
begin
  select * into assignment_row from rush.evaluation_assignments where id = target_assignment_id for update;
  if assignment_row.id is null then raise exception 'assignment missing' using errcode = 'P0002'; end if;
  select cycle_id into target_cycle from rush.rounds where id = assignment_row.round_id;
  if not rush.has_cycle_capability(target_cycle, 'APPLICANT_OPERATIONS') then raise exception 'forbidden' using errcode = '42501'; end if;
  if assignment_row.evaluator_id = replacement_evaluator_id then return target_assignment_id; end if;
  if assignment_row.status <> 'ASSIGNED' or exists(select 1 from rush.evaluations where assignment_id = target_assignment_id)
  then raise exception 'assignment has evidence' using errcode = '55000'; end if;
  if not exists(select 1 from rush.memberships where cycle_id = target_cycle and user_id = replacement_evaluator_id and active)
    or exists(select 1 from rush.conflict_declarations where application_id = assignment_row.application_id and declarer_id = replacement_evaluator_id)
  then raise exception 'replacement evaluator ineligible' using errcode = '42501'; end if;
  if rush.is_enrolled_screening_reviewer(target_cycle, replacement_evaluator_id)
  then raise exception 'replacement evaluator ineligible' using errcode = '42501'; end if;
  update rush.evaluation_assignments set evaluator_id = replacement_evaluator_id, updated_at = now() where id = target_assignment_id;
  insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id, metadata)
  values(rush.actor_id(), target_cycle, 'EVALUATOR_REASSIGNED', 'EvaluationAssignment', target_assignment_id,
    jsonb_build_object('fromEvaluatorId', assignment_row.evaluator_id, 'toEvaluatorId', replacement_evaluator_id));
  return target_assignment_id;
end $$;
revoke all on function rush.reassign_evaluator(text,uuid) from public, anon;
grant execute on function rush.reassign_evaluator(text,uuid) to authenticated, service_role;

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
      and not rush.is_enrolled_screening_reviewer(target_cycle, m.user_id)
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

revoke all on function rush.declare_conflict(text,text) from public, anon;
grant execute on function rush.declare_conflict(text,text) to authenticated, service_role;

-- Error strings now reflect that Board and Owner members are eligible reviewers.
create or replace function rush.create_screening_batch(target_cycle_id text, reviewer_ids uuid[])
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  v_round_id text;
  v_rubric_id text;
  v_batch_id text;
  reviewer uuid;
  distinct_reviewer_count integer;
begin
  if actor is null or not rush.has_cycle_capability(target_cycle_id, 'SCREENING_ADMINISTRATION') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from rush.rush_cycles
    where id = target_cycle_id and status in ('OPEN', 'IN_PROCESS')
  ) then
    raise exception 'cycle unavailable' using errcode = '55000';
  end if;

  select count(distinct candidate)
  into distinct_reviewer_count
  from unnest(coalesce(reviewer_ids, array[]::uuid[])) as candidates(candidate);
  if distinct_reviewer_count < 3 or distinct_reviewer_count <> coalesce(array_length(reviewer_ids, 1), 0) then
    raise exception 'at least three distinct eligible reviewers are required' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(reviewer_ids) as candidates(candidate)
    where not rush.is_eligible_screening_reviewer(target_cycle_id, candidate)
  ) then
    raise exception 'reviewers must be active Recruitment Committee, Board, or Owner members; Panel members are excluded' using errcode = '42501';
  end if;

  insert into rush.rounds(cycle_id, kind, name, status, weight)
  values (target_cycle_id, 'APPLICATION_SCREEN', 'Blind application screening', 'PUBLISHED', 0)
  on conflict(cycle_id, kind) do update set name = excluded.name
  returning id into v_round_id;

  select id into v_rubric_id
  from rush.rubrics
  where round_id = v_round_id
  order by version desc
  limit 1;
  if v_rubric_id is null then
    insert into rush.rubrics(round_id, version)
    values (v_round_id, 1)
    returning id into v_rubric_id;
    insert into rush.rubric_criteria(rubric_id, key, name, description, weight, required, position)
    values
      (v_rubric_id, 'motivation', 'MECG motivation', 'Explains why MECG specifically and connects that interest to concrete work.', 20, true, 0),
      (v_rubric_id, 'problem_structuring', 'Problem structuring', 'Separates a messy problem into workable parts and states relevant constraints.', 25, true, 1),
      (v_rubric_id, 'ownership', 'Evidence and ownership', 'Describes personal actions and the resulting change without relying on prestige signals.', 20, true, 2),
      (v_rubric_id, 'reflection', 'Reflection and judgment', 'Acknowledges uncertainty, tradeoffs, mistakes, or lessons.', 20, true, 3),
      (v_rubric_id, 'communication', 'Clear communication', 'Communicates directly and understandably without rewarding ornamental writing.', 15, true, 4);
  end if;

  insert into rush.screening_batches(cycle_id, rubric_id, reviews_per_application, created_by)
  values (target_cycle_id, v_rubric_id, 3, actor)
  returning id into v_batch_id;
  foreach reviewer in array reviewer_ids loop
    insert into rush.screening_reviewers(batch_id, reviewer_id)
    values (v_batch_id, reviewer);
  end loop;

  insert into rush.screening_packets(batch_id, application_id, candidate_code, content, content_hash)
  select
    v_batch_id,
    a.id,
    'Applicant ' || upper(substr(encode(extensions.digest(a.id || v_batch_id, 'sha256'), 'hex'), 1, 6)),
    jsonb_build_object(
      'responses',
      coalesce((
        select jsonb_agg(jsonb_build_object('question', r.question_text, 'answer', r.response_text) order by r.created_at)
        from rush.application_responses r
        where r.application_id = a.id
      ), '[]'::jsonb)
    ),
    encode(extensions.digest(coalesce((
      select string_agg(r.question_text || E'\n' || r.response_text, E'\n' order by r.created_at)
      from rush.application_responses r
      where r.application_id = a.id
    ), ''), 'sha256'), 'hex')
  from rush.applications a
  where a.cycle_id = target_cycle_id
    and a.status not in ('DRAFT', 'WITHDRAWN');
  if not found then
    raise exception 'no submitted applications are available' using errcode = '55000';
  end if;

  insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id, metadata)
  values (
    actor,
    target_cycle_id,
    'SCREENING_BATCH_CREATED',
    'ScreeningBatch',
    v_batch_id,
    jsonb_build_object('reviewerCount', distinct_reviewer_count, 'reviewsPerApplication', 3)
  );
  return v_batch_id;
end;
$$;

revoke all on function rush.create_screening_batch(text, uuid[]) from public, anon;
grant execute on function rush.create_screening_batch(text, uuid[]) to authenticated, service_role;
