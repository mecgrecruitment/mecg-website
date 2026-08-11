-- Reconcile signup behavior and move integrity-sensitive recruitment writes
-- behind validated, transactional SECURITY DEFINER functions.

-- Reassert the approval-queue behavior even when a local database recorded the
-- compatibility timestamp before the checked-in function body was corrected.
create or replace function public.fn_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allow public.invite_allowlist%rowtype;
begin
  select * into v_allow
    from public.invite_allowlist ia
   where lower(ia.email) = lower(new.email)
     and ia.consumed_at is null
     and (ia.expires_at is null or ia.expires_at > now())
   limit 1;

  if found then
    insert into public.membership_requests (user_id, email, full_name, requested_role, status)
    values (
      new.id,
      new.email,
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        initcap(replace(split_part(new.email, '@', 1), '.', ' '))
      ),
      v_allow.role,
      'pending'
    );

    update public.invite_allowlist
       set consumed_at = now()
     where id = v_allow.id;
  end if;

  return new;
end;
$$;

create or replace function public.submit_candidate_score(
  p_candidate_id uuid,
  p_stage public.candidate_stage,
  p_rubric_version_id uuid,
  p_scores jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evaluator_id uuid := public.current_member_id();
  v_role public.member_role := public.current_member_role();
  v_cycle_id uuid;
  v_expected_count integer;
  v_supplied_count integer;
  v_distinct_count integer;
begin
  if v_role not in ('board', 'recruitment_committee') then
    raise exception 'Committee access required';
  end if;
  if p_stage not in ('speed_dating', 'group_case', 'interview') then
    raise exception 'Unsupported scoring stage';
  end if;
  if p_stage = 'interview' and v_role <> 'board' then
    raise exception 'Final round scoring is board only';
  end if;
  if jsonb_typeof(p_scores) <> 'array' then
    raise exception 'Scores must be an array';
  end if;

  select c.cycle_id into v_cycle_id
    from public.candidates c
    join public.recruitment_cycles cycle
      on cycle.id = c.cycle_id and cycle.is_active
    join public.rubric_versions rv
      on rv.id = p_rubric_version_id
     and rv.cycle_id = c.cycle_id
     and rv.stage = p_stage
     and rv.is_active
   where c.id = p_candidate_id
     and c.current_stage = p_stage
     and c.deleted_at is null
   for update of c;

  if v_cycle_id is null then
    raise exception 'Candidate, stage, or active rubric is invalid';
  end if;

  if v_role <> 'board' and not exists (
    select 1
      from public.evaluator_assignments ea
     where ea.cycle_id = v_cycle_id
       and ea.stage = p_stage
       and ea.evaluator_id = v_evaluator_id
       and (ea.candidate_id is null or ea.candidate_id = p_candidate_id)
  ) then
    raise exception 'Evaluator is not assigned to this candidate';
  end if;

  if exists (
    select 1
      from public.score_submissions ss
     where ss.candidate_id = p_candidate_id
       and ss.evaluator_id = v_evaluator_id
       and ss.stage = p_stage
       and ss.rubric_version_id <> p_rubric_version_id
  ) then
    raise exception 'The submitted rubric version cannot be changed';
  end if;

  select count(*) into v_expected_count
    from public.rubric_criteria rc
   where rc.rubric_version_id = p_rubric_version_id;

  select count(*), count(distinct submitted.criterion_id)
    into v_supplied_count, v_distinct_count
    from jsonb_to_recordset(p_scores) as submitted(criterion_id uuid, value integer);

  if v_expected_count = 0
     or v_supplied_count <> v_expected_count
     or v_distinct_count <> v_expected_count then
    raise exception 'Submit exactly one score for every rubric criterion';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_scores) as submitted(criterion_id uuid, value integer)
      left join public.rubric_criteria rc
        on rc.id = submitted.criterion_id
       and rc.rubric_version_id = p_rubric_version_id
     where rc.id is null
        or submitted.value is null
        or submitted.value < rc.min_score
        or submitted.value > rc.max_score
  ) then
    raise exception 'A rubric criterion or score value is invalid';
  end if;

  insert into public.scores (
    candidate_id,
    rubric_criterion_id,
    rubric_version_id,
    evaluator_id,
    stage,
    value
  )
  select
    p_candidate_id,
    submitted.criterion_id,
    p_rubric_version_id,
    v_evaluator_id,
    p_stage,
    submitted.value
  from jsonb_to_recordset(p_scores) as submitted(criterion_id uuid, value integer)
  on conflict (candidate_id, rubric_criterion_id, evaluator_id)
  do update set
    value = excluded.value,
    rubric_version_id = excluded.rubric_version_id,
    stage = excluded.stage;

  insert into public.score_submissions (
    candidate_id,
    evaluator_id,
    stage,
    rubric_version_id
  )
  values (p_candidate_id, v_evaluator_id, p_stage, p_rubric_version_id)
  on conflict (candidate_id, evaluator_id, stage) do nothing;
end;
$$;

create or replace function public.submit_hash_vote(
  p_session_id uuid,
  p_candidate_id uuid,
  p_value public.vote_value
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter_id uuid := public.current_member_id();
begin
  if not public.is_committee_or_above() then
    raise exception 'Committee access required';
  end if;

  if not exists (
    select 1
      from public.hash_sessions hs
      join public.candidates c
        on c.id = p_candidate_id
       and c.cycle_id = hs.cycle_id
       and c.current_stage = hs.stage
       and c.status = 'active'
       and c.deleted_at is null
      join public.hash_session_participants participant
        on participant.session_id = hs.id
       and participant.member_id = v_voter_id
     where hs.id = p_session_id
       and hs.is_active
       and hs.ended_at is null
  ) then
    raise exception 'Session, candidate, or voter is not eligible';
  end if;

  insert into public.votes (session_id, candidate_id, voter_id, value)
  values (p_session_id, p_candidate_id, v_voter_id, p_value);
end;
$$;

create or replace function public.record_hash_decision(
  p_session_id uuid,
  p_candidate_id uuid,
  p_value public.decision_value,
  p_rationale text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board_id uuid := public.current_member_id();
  v_from_stage public.candidate_stage;
  v_tally jsonb;
begin
  if not public.is_board() then
    raise exception 'Board access required';
  end if;

  select c.current_stage into v_from_stage
    from public.hash_sessions hs
    join public.candidates c
      on c.id = p_candidate_id
     and c.cycle_id = hs.cycle_id
     and c.current_stage = hs.stage
     and c.status = 'active'
     and c.deleted_at is null
   where hs.id = p_session_id
     and hs.is_active
     and hs.ended_at is null
   for update of c;

  if v_from_stage is null then
    raise exception 'Session or candidate is not eligible for a decision';
  end if;

  with latest_votes as (
    select distinct on (v.voter_id) v.value
      from public.votes v
     where v.session_id = p_session_id
       and v.candidate_id = p_candidate_id
     order by v.voter_id, v.created_at desc
  )
  select jsonb_build_object(
    'advance', count(*) filter (where value = 'advance'),
    'cut', count(*) filter (where value = 'cut'),
    'discuss', count(*) filter (where value = 'discuss'),
    'total_voters', count(*)
  ) into v_tally
  from latest_votes;

  insert into public.decisions (
    session_id,
    candidate_id,
    value,
    decided_by,
    rationale,
    voter_tally
  )
  values (
    p_session_id,
    p_candidate_id,
    p_value,
    v_board_id,
    nullif(trim(p_rationale), ''),
    v_tally
  );

  update public.candidates
     set status = p_value::text::public.candidate_status,
         current_stage = 'decided'
   where id = p_candidate_id;

  insert into public.stage_transitions (
    candidate_id,
    from_stage,
    to_stage,
    actor_id,
    reason
  )
  values (
    p_candidate_id,
    v_from_stage,
    'decided',
    v_board_id,
    'Hash decision: ' || p_value::text
  );
end;
$$;

-- These tables may now be written by authenticated users only through the
-- functions above. SECURITY DEFINER bypasses RLS after validating the caller.
drop policy if exists score_submissions_insert on public.score_submissions;
drop policy if exists scores_insert on public.scores;
drop policy if exists scores_update on public.scores;
drop policy if exists votes_insert on public.votes;
drop policy if exists decisions_insert on public.decisions;

revoke execute on function public.submit_candidate_score(uuid, public.candidate_stage, uuid, jsonb) from public, anon;
revoke execute on function public.submit_hash_vote(uuid, uuid, public.vote_value) from public, anon;
revoke execute on function public.record_hash_decision(uuid, uuid, public.decision_value, text) from public, anon;

grant execute on function public.submit_candidate_score(uuid, public.candidate_stage, uuid, jsonb) to authenticated;
grant execute on function public.submit_hash_vote(uuid, uuid, public.vote_value) to authenticated;
grant execute on function public.record_hash_decision(uuid, uuid, public.decision_value, text) to authenticated;
