-- Speed Dating runs as two sessions in one night and every applicant meets a
-- different partner in each. A pair therefore belongs to a session, an
-- applicant may sit in one pair per session, and the same two applicants may
-- never be paired twice. Labels embed the session so (round_id, label) stays
-- unique.
alter table rush.speed_dating_pairs
  add column session smallint not null default 1 check (session between 1 and 4);
alter table rush.speed_dating_pair_members
  add column session smallint not null default 1;
alter table rush.speed_dating_pair_members
  drop constraint if exists speed_dating_pair_members_round_id_application_id_key;
alter table rush.speed_dating_pair_members
  add constraint speed_dating_pair_members_round_id_session_application_id_key
  unique (round_id, session, application_id);

-- Same atomic replace as before; each submitted pair now carries a session
-- (missing means 1) and the uniqueness rules are per session plus a ban on
-- repeating a partnership across sessions.
create or replace function rush.replace_speed_dating_pairs(
  target_round_id text,
  submitted_pairs jsonb,
  publish_pairs boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
  pair_input jsonb;
  pair_id text;
  pair_number integer := 0;
  pair_session smallint;
  session_numbers integer[] := '{}';
  session_count integer;
  application_id text;
begin
  if actor is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select * into round_row from rush.rounds where id = target_round_id for update;
  if round_row.id is null then
    raise exception 'round missing' using errcode = 'P0002';
  end if;
  if round_row.kind <> 'SPEED_DATING' then
    raise exception 'round must be Speed Dating' using errcode = '22023';
  end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['BOARD','OWNER']::rush.member_role[]) then
    raise exception 'board role required' using errcode = '42501';
  end if;
  if round_row.status not in ('DRAFT', 'PUBLISHED') then
    raise exception 'pairs lock when the round opens' using errcode = '55000';
  end if;
  if jsonb_typeof(submitted_pairs) <> 'array'
     or jsonb_array_length(submitted_pairs) < 1
     or jsonb_array_length(submitted_pairs) > 200 then
    raise exception 'provide between 1 and 200 pairs' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(submitted_pairs) p
    where p ? 'session' and (
      jsonb_typeof(p->'session') <> 'number'
      or (p->>'session')::numeric <> floor((p->>'session')::numeric)
      or (p->>'session')::numeric not between 1 and 4
    )
  ) then
    raise exception 'every pair needs a session between 1 and 4' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(submitted_pairs) p
    where jsonb_typeof(p->'applicationIds') <> 'array'
       or jsonb_array_length(p->'applicationIds') <> 2
       or (select count(distinct value) from jsonb_array_elements_text(p->'applicationIds')) <> 2
       or exists (
         select 1 from jsonb_array_elements_text(p->'applicationIds') item(value)
         where nullif(trim(value), '') is null
       )
  ) then
    raise exception 'every pair needs two distinct application ids' using errcode = '22023';
  end if;
  if (
    select count(*) from (
      select coalesce((p->>'session')::numeric::integer, 1) session_number, item.value
      from jsonb_array_elements(submitted_pairs) p,
           jsonb_array_elements_text(p->'applicationIds') item(value)
    ) all_members
  ) <> (
    select count(*) from (
      select distinct coalesce((p->>'session')::numeric::integer, 1) session_number, item.value
      from jsonb_array_elements(submitted_pairs) p,
           jsonb_array_elements_text(p->'applicationIds') item(value)
    ) distinct_members
  ) then
    raise exception 'an applicant can appear in only one pair per session' using errcode = '22023';
  end if;
  if (
    select count(*) from jsonb_array_elements(submitted_pairs)
  ) <> (
    select count(distinct sorted.key) from (
      select (select string_agg(value, '|' order by value) from jsonb_array_elements_text(p->'applicationIds')) key
      from jsonb_array_elements(submitted_pairs) p
    ) sorted
  ) then
    raise exception 'the same two applicants cannot be paired twice' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(submitted_pairs) p,
         jsonb_array_elements_text(p->'applicationIds') item(application_id)
    where not exists (
      select 1
      from rush.round_participations participation
      join rush.applications application on application.id = participation.application_id
      where participation.round_id = target_round_id
        and participation.application_id = item.application_id
        and application.cycle_id = round_row.cycle_id
    )
  ) then
    raise exception 'every applicant must be advanced into this round' using errcode = '22023';
  end if;
  -- Mirrors the builder: publishing needs sessions 1 and 2, each fully paired.
  if publish_pairs and (
    select count(distinct coalesce((p->>'session')::numeric::integer, 1)) from jsonb_array_elements(submitted_pairs) p
  ) < 2 then
    raise exception 'publish needs pairs for both sessions' using errcode = '22023';
  end if;
  if publish_pairs and exists (
    select 1
    from (
      select coalesce((p->>'session')::numeric::integer, 1) session_number, count(*) pair_count
      from jsonb_array_elements(submitted_pairs) p
      group by 1
    ) per_session
    where (select count(*) from rush.round_participations where round_id = target_round_id) <> per_session.pair_count * 2
  ) then
    raise exception 'every advanced applicant must be included in every session before publishing pairs' using errcode = '22023';
  end if;
  if exists (
    select 1 from rush.speed_dating_pair_claims claim
    join rush.speed_dating_pairs pair on pair.id = claim.pair_id
    where pair.round_id = target_round_id
  ) then
    raise exception 'claimed pairs cannot be replaced' using errcode = '55000';
  end if;

  delete from rush.speed_dating_pairs where round_id = target_round_id;
  for pair_input in select value from jsonb_array_elements(submitted_pairs)
  loop
    pair_session := coalesce((pair_input->>'session')::numeric::integer, 1);
    session_numbers := array_append(session_numbers, pair_session::integer);
    pair_number := (select count(*) from unnest(session_numbers) s where s = pair_session);
    insert into rush.speed_dating_pairs (round_id, session, label, status, created_by, published_at)
    values (
      target_round_id,
      pair_session,
      'Session ' || pair_session || ' · Pair ' || lpad(pair_number::text, 2, '0'),
      case when publish_pairs then 'PUBLISHED' else 'DRAFT' end,
      actor,
      case when publish_pairs then now() else null end
    ) returning id into pair_id;

    insert into rush.speed_dating_pair_members (pair_id, round_id, session, application_id, position)
    select pair_id, target_round_id, pair_session, item.value, item.ordinality::smallint
    from jsonb_array_elements_text(pair_input->'applicationIds') with ordinality item(value, ordinality);
  end loop;
  pair_number := coalesce(array_length(session_numbers, 1), 0);
  session_count := (select count(distinct s) from unnest(session_numbers) s);

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (
    actor,
    round_row.cycle_id,
    case when publish_pairs then 'SPEED_DATING_PAIRS_PUBLISHED' else 'SPEED_DATING_PAIRS_SAVED' end,
    'Round',
    target_round_id,
    jsonb_build_object('pairCount', pair_number, 'sessionCount', session_count)
  );
  return jsonb_build_object('roundId', target_round_id, 'pairCount', pair_number, 'published', publish_pairs);
end;
$$;
revoke all on function rush.replace_speed_dating_pairs(text, jsonb, boolean) from public, anon;
grant execute on function rush.replace_speed_dating_pairs(text, jsonb, boolean) to authenticated, service_role;

-- The member queue carries the session so the grading page can group by it.
-- Claimed-but-unsubmitted pairs still sort first.
create or replace function rush.my_speed_dating_pairs(target_round_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
  active_rubric_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if round_row.kind <> 'SPEED_DATING'
     or not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
     or rush.is_active_screening_reviewer(round_row.cycle_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select rubric.id into active_rubric_id
  from rush.rubrics rubric
  where rubric.round_id = target_round_id
  order by rubric.version desc
  limit 1;

  return jsonb_build_object(
    'roundId', round_row.id,
    'roundName', round_row.name,
    'roundStatus', round_row.status::text,
    'calibrated', active_rubric_id is not null and exists (
      select 1 from rush.round_calibration_acknowledgements acknowledgement
      where acknowledgement.round_id = target_round_id
        and acknowledgement.rubric_id = active_rubric_id
        and acknowledgement.evaluator_id = actor
    ),
    'criterion', (
      select jsonb_build_object(
        'id', criterion.id,
        'name', criterion.name,
        'description', criterion.description
      )
      from rush.rubric_criteria criterion
      where criterion.rubric_id = active_rubric_id
      order by criterion.position
      limit 1
    ),
    'rubricReady', active_rubric_id is not null and (
      select count(*) = 1
        and max(criterion.weight) = 100
        and bool_and(criterion.required)
      from rush.rubric_criteria criterion
      where criterion.rubric_id = active_rubric_id
    ),
    'pairs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pair.id,
        'label', pair.label,
        'session', pair.session,
        'claimed', claim.pair_id is not null,
        'submittedAt', claim.submitted_at,
        'members', members.items
      ) order by
        case when claim.submitted_at is null and claim.pair_id is not null then 0 else 1 end,
        pair.session,
        pair.label
      )
      from rush.speed_dating_pairs pair
      left join rush.speed_dating_pair_claims claim
        on claim.pair_id = pair.id and claim.evaluator_id = actor
      cross join lateral (
        select jsonb_agg(jsonb_build_object(
          'applicationId', member.application_id,
          'name', pnm.name,
          'position', member.position,
          'assignmentId', assignment.id,
          'assignmentStatus', assignment.status::text
        ) order by member.position) as items
        from rush.speed_dating_pair_members member
        join rush.applications application on application.id = member.application_id
        join rush.pnms pnm on pnm.id = application.pnm_id
        left join rush.evaluation_assignments assignment
          on assignment.round_id = member.round_id
         and assignment.application_id = member.application_id
         and assignment.evaluator_id = actor
        where member.pair_id = pair.id
      ) members
      where pair.round_id = target_round_id
        and pair.status = 'PUBLISHED'
        and not exists (
          select 1
          from rush.speed_dating_pair_members member
          join rush.conflict_declarations conflict
            on conflict.application_id = member.application_id and conflict.declarer_id = actor
          where member.pair_id = pair.id
        )
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function rush.my_speed_dating_pairs(text) from public, anon;
grant execute on function rush.my_speed_dating_pairs(text) to authenticated, service_role;

-- Board setup carries the session on pairs and reports. Same function otherwise.
create or replace function rush.speed_dating_pair_setup(target_round_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if round_row.kind <> 'SPEED_DATING'
     or not rush.has_cycle_role(round_row.cycle_id, array['BOARD','OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'roundId', target_round_id,
    'roundStatus', round_row.status::text,
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('applicationId', application.id, 'name', pnm.name) order by pnm.name, application.id)
      from rush.round_participations participation
      join rush.applications application on application.id = participation.application_id
      join rush.pnms pnm on pnm.id = application.pnm_id
      where participation.round_id = target_round_id
    ), '[]'::jsonb),
    'pairs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pair.id,
        'label', pair.label,
        'session', pair.session,
        'status', pair.status,
        'applicationIds', members.application_ids,
        'claimEvaluatorIds', coalesce((select jsonb_agg(claim.evaluator_id) from rush.speed_dating_pair_claims claim where claim.pair_id = pair.id), '[]'::jsonb)
      ) order by pair.session, pair.label)
      from rush.speed_dating_pairs pair
      cross join lateral (
        select jsonb_agg(member.application_id order by member.position) application_ids
        from rush.speed_dating_pair_members member
        where member.pair_id = pair.id
      ) members
      where pair.round_id = target_round_id
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pairId', pair.id,
        'pairLabel', pair.label,
        'session', pair.session,
        'evaluatorName', profile.display_name,
        'reportedAt', report.created_at
      ) order by report.created_at, pair.label)
      from rush.speed_dating_pair_reports report
      join rush.speed_dating_pairs pair on pair.id = report.pair_id
      join rush.profiles profile on profile.id = report.evaluator_id
      where pair.round_id = target_round_id and report.status = 'OPEN'
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function rush.speed_dating_pair_setup(text) from public, anon;
grant execute on function rush.speed_dating_pair_setup(text) to authenticated, service_role;
