-- Serialize each evaluator's applicant observation, including the first save.
create table rush.group_case_write_revisions (
  round_id text not null references rush.rounds(id) on delete cascade,
  application_id text not null references rush.applications(id) on delete cascade,
  evaluator_id uuid not null references rush.profiles(id) on delete cascade,
  revision uuid not null,
  mutation_id uuid not null,
  payload jsonb not null,
  confirmed_result jsonb not null,
  primary key(round_id,application_id,evaluator_id)
);
alter table rush.group_case_write_revisions enable row level security;
revoke all on rush.group_case_write_revisions from public, anon, authenticated;

-- Same own-observation projection as the guarded roster; never callable directly.
create function rush.group_case_rating_snapshot(target_round_id text,target_application_id text,target_actor uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('applicationId',target_application_id,'revision',state.revision,
    'scores',coalesce((select jsonb_object_agg(r.criterion_id,r.score) from rush.criterion_ratings r where r.evaluation_id=e.id),'{}'::jsonb),
    'note',coalesce(e.evidence,''),'savedAt',e.updated_at,
    'quality',case when e.rubric_id=(select id from rush.rubrics where round_id=target_round_id order by version desc limit 1)
      then (select jsonb_build_object('valid',q.valid,'coverage',q.coverage,'observedCount',q.observed_count,
        'criteriaCount',q.criteria_count,'minimumObserved',q.minimum_observed,'missingRequired',to_jsonb(q.missing_required))
        from rush.evaluation_observation_quality(e.id) q) end)
  from (select 1) singleton
  left join rush.group_case_write_revisions state on state.round_id=target_round_id and state.application_id=target_application_id and state.evaluator_id=target_actor
  left join rush.evaluation_assignments assignment on assignment.round_id=target_round_id and assignment.application_id=target_application_id and assignment.evaluator_id=target_actor
  left join lateral (select * from rush.evaluations evaluation where evaluation.assignment_id=assignment.id and evaluation.voided_at is null order by evaluation.version desc limit 1) e on true;
$$;
revoke all on function rush.group_case_rating_snapshot(text,text,uuid) from public,anon,authenticated;

create function rush.group_case_roster_v2(target_round_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare roster jsonb; groups jsonb;
begin
  roster:=rush.group_case_roster(target_round_id);
  select coalesce(jsonb_agg(group_item || jsonb_build_object('applicants',(
    select coalesce(jsonb_agg(applicant || jsonb_build_object('revision',(
      select state.revision from rush.group_case_write_revisions state
      where state.round_id=target_round_id and state.application_id=applicant->>'applicationId' and state.evaluator_id=rush.actor_id()
    )) order by applicant_position),'[]'::jsonb)
    from jsonb_array_elements(group_item->'applicants') with ordinality applicants(applicant,applicant_position)
  )) order by group_position),'[]'::jsonb) into groups
  from jsonb_array_elements(roster->'groups') with ordinality grouped(group_item,group_position);
  return roster || jsonb_build_object('groups',groups);
end $$;
revoke all on function rush.group_case_roster_v2(text) from public,anon;
grant execute on function rush.group_case_roster_v2(text) to authenticated,service_role;

create function rush.rate_group_case_applicant_v2(target_round_id text,target_application_id text,
  scores jsonb,note text,expected_revision uuid,mutation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=rush.actor_id(); round_row rush.rounds%rowtype;
  state rush.group_case_write_revisions%rowtype; snapshot jsonb; result jsonb;
  fingerprint jsonb:=jsonb_build_object('scores',scores,'note',note,'expectedRevision',expected_revision);
  next_revision uuid;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if mutation_id is null then raise exception 'mutation id required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(jsonb_build_array('group-case-write',target_round_id,target_application_id,actor)::text,0));
  select * into round_row from rush.rounds where id=target_round_id for share;
  if round_row.id is null then raise exception 'round missing' using errcode='P0002'; end if;
  if round_row.kind<>'GROUP_CASE' then raise exception 'not a Group Case round' using errcode='55000'; end if;
  if not rush.has_cycle_role(round_row.cycle_id,array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
    or rush.is_active_screening_reviewer(round_row.cycle_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from rush.round_participations participation join rush.applications a on a.id=participation.application_id
    where participation.round_id=target_round_id and a.id=target_application_id and a.cycle_id=round_row.cycle_id and a.status not in ('DRAFT','WITHDRAWN') for share of a)
    then raise exception 'applicant is not in this round' using errcode='22023'; end if;
  if exists(select 1 from rush.conflict_declarations c where c.application_id=target_application_id and c.declarer_id=actor)
    then raise exception 'conflict declared' using errcode='42501'; end if;
  select * into state from rush.group_case_write_revisions s where s.round_id=target_round_id and s.application_id=target_application_id and s.evaluator_id=actor for update;
  snapshot:=rush.group_case_rating_snapshot(target_round_id,target_application_id,actor);
  if state.mutation_id=rate_group_case_applicant_v2.mutation_id then
    if state.payload<>fingerprint then raise exception 'mutation id reused with different payload' using errcode='22023'; end if;
    -- Re-read quality instead of replaying an obsolete rubric projection.
    if snapshot=(state.confirmed_result-'kind'-'mutationId') then return state.confirmed_result; end if;
    return jsonb_build_object('kind','conflict','snapshot',snapshot);
  end if;
  if round_row.status<>'ACTIVE' or (round_row.closes_at is not null and round_row.closes_at<clock_timestamp()) then raise exception 'round is not open for grading' using errcode='55000'; end if;
  if exists(select 1 from rush.evaluation_assignments a where a.round_id=target_round_id and a.application_id=target_application_id and a.evaluator_id=actor and a.status='LOCKED')
    then raise exception 'round is frozen' using errcode='55000'; end if;
  if state.revision is distinct from expected_revision then return jsonb_build_object('kind','conflict','snapshot',snapshot); end if;
  result:=rush.rate_group_case_applicant(target_round_id,target_application_id,scores,note);
  next_revision:=gen_random_uuid();
  result:=result || jsonb_build_object('kind','saved','revision',next_revision,'mutationId',mutation_id);
  insert into rush.group_case_write_revisions as current(round_id,application_id,evaluator_id,revision,mutation_id,payload,confirmed_result)
  values(target_round_id,target_application_id,actor,next_revision,mutation_id,fingerprint,result)
  on conflict(round_id,application_id,evaluator_id) do update set revision=excluded.revision,mutation_id=excluded.mutation_id,payload=excluded.payload,confirmed_result=excluded.confirmed_result;
  return result;
end $$;
revoke all on function rush.rate_group_case_applicant_v2(text,text,jsonb,text,uuid,uuid) from public,anon;
grant execute on function rush.rate_group_case_applicant_v2(text,text,jsonb,text,uuid,uuid) to authenticated,service_role;
-- All browser writes must participate in revision checking after this rollout.
revoke execute on function rush.rate_group_case_applicant(text,text,jsonb,text) from authenticated;
