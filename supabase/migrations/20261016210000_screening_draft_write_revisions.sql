-- One current revision and exact-replay receipt per private screening draft.
alter table rush.screening_review_drafts
  add column revision uuid not null default gen_random_uuid(),
  add column mutation_id uuid,
  add column mutation_payload jsonb,
  add column confirmed_result jsonb;

create function rush.assert_screening_draft_access(target_assignment_id text, lock_assignment boolean)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=rush.actor_id(); a rush.screening_assignments%rowtype; context record;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if lock_assignment then
    select * into a from rush.screening_assignments where id=target_assignment_id for update;
  else
    select * into a from rush.screening_assignments where id=target_assignment_id;
  end if;
  if a.id is null or a.reviewer_id<>actor then raise exception 'assignment not found' using errcode='P0002'; end if;
  select b.cycle_id,p.application_id,p.batch_id into context
    from rush.screening_packets p join rush.screening_batches b on b.id=p.batch_id where p.id=a.packet_id;
  if not rush.is_eligible_screening_reviewer(context.cycle_id,actor)
    or not exists(select 1 from rush.screening_reviewers sr where sr.batch_id=context.batch_id and sr.reviewer_id=actor and sr.active)
    then raise exception 'reviewer access revoked' using errcode='42501'; end if;
  if exists(select 1 from rush.conflict_declarations c where c.application_id=context.application_id and c.declarer_id=actor)
    then raise exception 'conflict declared' using errcode='42501'; end if;
  if lock_assignment then
    perform 1 from rush.applications app where app.id=context.application_id and app.cycle_id=context.cycle_id and app.status not in ('DRAFT','WITHDRAWN') for share of app;
    if not found then raise exception 'applicant is not eligible for screening' using errcode='22023'; end if;
  elsif not exists(select 1 from rush.applications app where app.id=context.application_id and app.cycle_id=context.cycle_id and app.status not in ('DRAFT','WITHDRAWN')) then
    raise exception 'applicant is not eligible for screening' using errcode='22023';
  end if;
  if a.status='RECUSED' or (lock_assignment and (a.status<>'ASSIGNED' or exists(select 1 from rush.screening_reviews r where r.assignment_id=a.id)))
    then raise exception 'assignment closed' using errcode='55000'; end if;
end $$;

create function rush.assert_screening_draft_writable(target_assignment_id text)
returns void language plpgsql security definer set search_path='' as $$
declare context record;
begin
  -- Caller already holds the assignment lock; take current lifecycle/deadline
  -- after waiting, rather than a request-start timestamp.
  select b.status,r.closes_at into context from rush.screening_assignments a
    join rush.screening_packets p on p.id=a.packet_id join rush.screening_batches b on b.id=p.batch_id
    join rush.rubrics rubric on rubric.id=b.rubric_id join rush.rounds r on r.id=rubric.round_id
    where a.id=target_assignment_id for share of b,r;
  if context.status<>'PUBLISHED' or (context.closes_at is not null and context.closes_at<clock_timestamp()) then
    raise exception 'assignment closed' using errcode='55000';
  end if;
end $$;

create function rush.screening_draft_snapshot(target_assignment_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('assignmentId',target_assignment_id,'revision',d.revision,
    'draft',case when d.rubric_id=b.rubric_id and a.status='ASSIGNED' then
      jsonb_build_object('ratings',d.ratings,'evidence',d.evidence,'recommendation',d.recommendation,'updatedAt',d.updated_at) else null end)
  from rush.screening_assignments a join rush.screening_packets p on p.id=a.packet_id
  join rush.screening_batches b on b.id=p.batch_id
  left join rush.screening_review_drafts d on d.assignment_id=a.id and d.reviewer_id=rush.actor_id()
  where a.id=target_assignment_id and a.reviewer_id=rush.actor_id();
$$;

create function rush.get_screening_review_draft_v2(target_assignment_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform rush.assert_screening_draft_access(target_assignment_id,false);
  return rush.screening_draft_snapshot(target_assignment_id);
end $$;

create function rush.save_screening_review_draft_v2(target_assignment_id text,draft_ratings jsonb,
  draft_evidence text,draft_recommendation text,expected_revision uuid,mutation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d rush.screening_review_drafts%rowtype; snapshot jsonb; result jsonb; next_revision uuid;
  fingerprint jsonb:=jsonb_build_object('ratings',draft_ratings,'evidence',draft_evidence,'recommendation',draft_recommendation,'expectedRevision',expected_revision);
begin
  if mutation_id is null then raise exception 'mutation id required' using errcode='22023'; end if;
  perform rush.assert_screening_draft_access(target_assignment_id,true);
  select * into d from rush.screening_review_drafts where assignment_id=target_assignment_id;
  snapshot:=rush.screening_draft_snapshot(target_assignment_id);
  if d.mutation_id=save_screening_review_draft_v2.mutation_id then
    if d.mutation_payload is distinct from fingerprint then raise exception 'mutation id reused with different payload' using errcode='22023'; end if;
    -- Exact receipt confirmation is read-only even after batch/deadline closure.
    -- A changed rubric or changed content cannot confirm an obsolete receipt.
    if snapshot=jsonb_build_object('assignmentId',target_assignment_id,'revision',d.revision,'draft',d.confirmed_result->'draft') then return d.confirmed_result; end if;
    return jsonb_build_object('kind','conflict','snapshot',snapshot);
  end if;
  perform rush.assert_screening_draft_writable(target_assignment_id);
  if d.revision is distinct from expected_revision then return jsonb_build_object('kind','conflict','snapshot',snapshot); end if;
  perform rush.save_screening_review_draft(target_assignment_id,draft_ratings,draft_evidence,draft_recommendation);
  next_revision:=gen_random_uuid();
  update rush.screening_review_drafts set revision=next_revision where assignment_id=target_assignment_id;
  snapshot:=rush.screening_draft_snapshot(target_assignment_id);
  result:=jsonb_build_object('kind','saved','assignmentId',target_assignment_id,'revision',next_revision,'mutationId',mutation_id,'draft',snapshot->'draft');
  update rush.screening_review_drafts set mutation_id=save_screening_review_draft_v2.mutation_id,mutation_payload=fingerprint,confirmed_result=result where assignment_id=target_assignment_id;
  return result;
end $$;

create function rush.submit_screening_review_v2(target_assignment_id text,ratings jsonb,
  review_evidence text,review_recommendation text,expected_draft_revision uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_revision uuid; weighted numeric; review_id text;
begin
  perform rush.assert_screening_draft_access(target_assignment_id,true);
  perform rush.assert_screening_draft_writable(target_assignment_id);
  select revision into current_revision from rush.screening_review_drafts where assignment_id=target_assignment_id;
  if current_revision is distinct from expected_draft_revision then
    return jsonb_build_object('kind','conflict','snapshot',rush.screening_draft_snapshot(target_assignment_id));
  end if;
  weighted:=rush.submit_screening_review(target_assignment_id,ratings,review_evidence,review_recommendation);
  select id into strict review_id from rush.screening_reviews where assignment_id=target_assignment_id and reviewer_id=rush.actor_id();
  return jsonb_build_object('kind','submitted','assignmentId',target_assignment_id,'reviewId',review_id,'score',weighted);
end $$;

create function rush.recuse_screening_assignment_v2(target_assignment_id text,recusal_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  -- The canonical writer locks the same assignment, requires a replacement,
  -- and atomically records the reason, new assignment, cleanup and audit.
  perform rush.recuse_screening_assignment(target_assignment_id,recusal_reason);
  return jsonb_build_object('kind','recused','assignmentId',target_assignment_id);
end $$;

revoke all on function rush.assert_screening_draft_access(text,boolean),rush.assert_screening_draft_writable(text),rush.screening_draft_snapshot(text) from public,anon,authenticated;
revoke all on function rush.get_screening_review_draft_v2(text),rush.save_screening_review_draft_v2(text,jsonb,text,text,uuid,uuid),rush.submit_screening_review_v2(text,jsonb,text,text,uuid),rush.recuse_screening_assignment_v2(text,text) from public,anon;
grant execute on function rush.get_screening_review_draft_v2(text),rush.save_screening_review_draft_v2(text,jsonb,text,text,uuid,uuid),rush.submit_screening_review_v2(text,jsonb,text,text,uuid),rush.recuse_screening_assignment_v2(text,text) to authenticated,service_role;
revoke execute on function rush.get_screening_review_draft(text),rush.save_screening_review_draft(text,jsonb,text,text),rush.submit_screening_review(text,jsonb,text,text),rush.recuse_screening_assignment(text,text) from authenticated;
