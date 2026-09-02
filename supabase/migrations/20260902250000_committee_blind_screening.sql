-- Blind application screening is owned by the Recruitment Committee. Reviewers
-- remain ineligible when they also hold an identity-revealing Board, Panel, or
-- Owner role in the same cycle.
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
        and m.role = 'RECRUITMENT_COMMITTEE'
        and m.active
    )
    and not exists (
      select 1
      from rush.memberships m
      where m.user_id = target_user_id
        and m.cycle_id = target_cycle_id
        and m.role in ('BOARD', 'PANEL', 'OWNER')
        and m.active
    );
$$;

revoke all on function rush.is_eligible_screening_reviewer(text, uuid) from public, anon, authenticated;
grant execute on function rush.is_eligible_screening_reviewer(text, uuid) to service_role;

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
    raise exception 'at least three distinct Recruitment Committee reviewers are required' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(reviewer_ids) as candidates(candidate)
    where not rush.is_eligible_screening_reviewer(target_cycle_id, candidate)
  ) then
    raise exception 'reviewers must be active Recruitment Committee members without an identity-steward role' using errcode = '42501';
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

-- Once assignments are published, committee reviewers receive only aggregate
-- administration counts here. Their anonymous packet is exposed exclusively by
-- my_screening_queue/screening_assignment_detail.
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
        'results', case when b.status = 'FROZEN' and not rush.is_active_screening_reviewer(target_cycle_id) then (select coalesce(jsonb_agg((jsonb_build_object('code', sp.candidate_code, 'recommendation', sr.recommendation, 'score', sr.score, 'applicantName', pn.name, 'evidence', sr.evidence) - case when rush.has_cycle_role(target_cycle_id, array['BOARD', 'OWNER']::rush.member_role[]) then array[]::text[] else array['applicantName', 'evidence'] end) order by sp.candidate_code, sr.submitted_at), '[]'::jsonb) from rush.screening_reviews sr join rush.screening_assignments sa on sa.id = sr.assignment_id join rush.screening_packets sp on sp.id = sa.packet_id join rush.applications a on a.id = sp.application_id join rush.pnms pn on pn.id = a.pnm_id where sp.batch_id = b.id) else '[]'::jsonb end
      )
      from rush.screening_batches b
      where b.cycle_id = target_cycle_id
    ), 'null'::jsonb)
  end;
$$;

revoke all on function rush.create_screening_batch(text, uuid[]), rush.screening_admin_overview(text) from public, anon;
grant execute on function rush.create_screening_batch(text, uuid[]), rush.screening_admin_overview(text) to authenticated, service_role;
