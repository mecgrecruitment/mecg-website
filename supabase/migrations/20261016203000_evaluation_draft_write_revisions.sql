-- Revision metadata lives with the private draft, so submission's existing
-- atomic cleanup trigger removes content and replay state together.
alter table rush.evaluation_drafts
  add column revision uuid not null default gen_random_uuid(),
  add column mutation_id uuid,
  add column mutation_payload jsonb,
  add column confirmed_result jsonb;

create function rush.evaluation_draft_snapshot(target_assignment_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('assignmentId',target_assignment_id,
    'revision',(select revision from rush.evaluation_drafts where assignment_id=target_assignment_id and evaluator_id=rush.actor_id()),
    'draft',rush.get_evaluation_draft(target_assignment_id));
$$;
revoke all on function rush.evaluation_draft_snapshot(text) from public,anon,authenticated;

-- Shared current-access boundary. Read-only recovery remains possible after a
-- round closes; a submitted assignment returns no draft through the snapshot.
create function rush.assert_evaluation_draft_access(target_assignment_id text,for_write boolean)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=rush.actor_id(); assignment_row rush.evaluation_assignments%rowtype; round_row rush.rounds%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if for_write then
    -- submit_evaluation holds this same row lock through its cleanup trigger.
    select * into assignment_row from rush.evaluation_assignments where id=target_assignment_id for update;
  else
    select * into assignment_row from rush.evaluation_assignments where id=target_assignment_id;
  end if;
  if assignment_row.id is null or assignment_row.evaluator_id<>actor then raise exception 'assignment not found' using errcode='P0002'; end if;
  if for_write then
    select * into round_row from rush.rounds where id=assignment_row.round_id for share;
  else
    select * into round_row from rush.rounds where id=assignment_row.round_id;
  end if;
  if not rush.has_cycle_role(round_row.cycle_id,array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[]) then raise exception 'role revoked' using errcode='42501'; end if;
  if exists(select 1 from rush.conflict_declarations where application_id=assignment_row.application_id and declarer_id=actor) then raise exception 'conflict declared' using errcode='42501'; end if;
  if for_write then
    perform 1 from rush.applications a where a.id=assignment_row.application_id and a.cycle_id=round_row.cycle_id and a.status not in ('DRAFT','WITHDRAWN') for share of a;
    if not found then raise exception 'applicant is not eligible for evaluation' using errcode='22023'; end if;
  elsif not exists(select 1 from rush.applications a where a.id=assignment_row.application_id and a.cycle_id=round_row.cycle_id and a.status not in ('DRAFT','WITHDRAWN')) then
    raise exception 'applicant is not eligible for evaluation' using errcode='22023';
  end if;
  if for_write and (assignment_row.status not in ('ASSIGNED','IN_PROGRESS') or round_row.status<>'ACTIVE'
    or (round_row.closes_at is not null and round_row.closes_at<clock_timestamp())
    or exists(select 1 from rush.evaluations e where e.assignment_id=target_assignment_id and e.status in ('SUBMITTED','LOCKED')))
    then raise exception 'assignment closed' using errcode='55000'; end if;
end $$;
revoke all on function rush.assert_evaluation_draft_access(text,boolean) from public,anon,authenticated;

create function rush.get_evaluation_draft_v2(target_assignment_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform rush.assert_evaluation_draft_access(target_assignment_id,false);
  return rush.evaluation_draft_snapshot(target_assignment_id);
end $$;
revoke all on function rush.get_evaluation_draft_v2(text) from public,anon;
grant execute on function rush.get_evaluation_draft_v2(text) to authenticated,service_role;

create function rush.save_evaluation_draft_v2(target_assignment_id text,submitted_ratings jsonb,
  submitted_evidence text,expected_revision uuid,mutation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare draft_row rush.evaluation_drafts%rowtype; snapshot jsonb; result jsonb; next_revision uuid;
  fingerprint jsonb:=jsonb_build_object('ratings',submitted_ratings,'evidence',submitted_evidence,'expectedRevision',expected_revision);
begin
  if mutation_id is null then raise exception 'mutation id required' using errcode='22023'; end if;
  if submitted_ratings is null then raise exception 'invalid draft' using errcode='22023'; end if;
  perform rush.assert_evaluation_draft_access(target_assignment_id,true);
  select * into draft_row from rush.evaluation_drafts where assignment_id=target_assignment_id;
  snapshot:=rush.evaluation_draft_snapshot(target_assignment_id);
  if draft_row.mutation_id=save_evaluation_draft_v2.mutation_id then
    if draft_row.mutation_payload<>fingerprint then raise exception 'mutation id reused with different payload' using errcode='22023'; end if;
    if snapshot=jsonb_build_object('assignmentId',target_assignment_id,'revision',draft_row.revision,'draft',draft_row.confirmed_result->'draft') then return draft_row.confirmed_result; end if;
    return jsonb_build_object('kind','conflict','snapshot',snapshot);
  end if;
  if draft_row.revision is distinct from expected_revision then return jsonb_build_object('kind','conflict','snapshot',snapshot); end if;
  perform rush.save_evaluation_draft(target_assignment_id,submitted_ratings,submitted_evidence);
  next_revision:=gen_random_uuid();
  update rush.evaluation_drafts set revision=next_revision where assignment_id=target_assignment_id;
  snapshot:=rush.evaluation_draft_snapshot(target_assignment_id);
  result:=jsonb_build_object('kind','saved','assignmentId',target_assignment_id,'revision',next_revision,
    'mutationId',mutation_id,'draft',snapshot->'draft');
  update rush.evaluation_drafts set mutation_id=save_evaluation_draft_v2.mutation_id,mutation_payload=fingerprint,confirmed_result=result where assignment_id=target_assignment_id;
  return result;
end $$;
revoke all on function rush.save_evaluation_draft_v2(text,jsonb,text,uuid,uuid) from public,anon;
grant execute on function rush.save_evaluation_draft_v2(text,jsonb,text,uuid,uuid) to authenticated,service_role;
-- Browser consumers must migrate together; trusted service-role APIs retain
-- their legacy execute grants. No unconditional browser read/write/delete path.
revoke execute on function rush.get_evaluation_draft(text),rush.save_evaluation_draft(text,jsonb,text),rush.discard_evaluation_draft(text) from authenticated;

-- Final submission uses the same revision precondition while holding the shared
-- assignment lock. A second device cannot finalize an obsolete reviewed draft.
create function rush.submit_evaluation_v2(target_assignment_id text,submitted_ratings jsonb,
  submitted_evidence text,expected_draft_revision uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_revision uuid; submitted record;
begin
  perform rush.assert_evaluation_draft_access(target_assignment_id,true);
  select revision into current_revision from rush.evaluation_drafts where assignment_id=target_assignment_id;
  if current_revision is distinct from expected_draft_revision then
    return jsonb_build_object('kind','conflict','snapshot',rush.evaluation_draft_snapshot(target_assignment_id));
  end if;
  select * into submitted from rush.submit_evaluation(target_assignment_id,submitted_ratings,submitted_evidence);
  return jsonb_build_object('kind','submitted','assignmentId',target_assignment_id,'evaluationId',submitted.evaluation_id,'score',submitted.score);
end $$;
revoke all on function rush.submit_evaluation_v2(text,jsonb,text,uuid) from public,anon;
grant execute on function rush.submit_evaluation_v2(text,jsonb,text,uuid) to authenticated,service_role;
revoke execute on function rush.submit_evaluation(text,jsonb,text) from authenticated;
