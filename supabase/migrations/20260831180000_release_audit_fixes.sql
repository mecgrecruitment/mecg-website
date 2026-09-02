-- Release audit fixes: B2, B5, S1, S2, S12, S13, S9/S7, S26.
-- Every function below is the current definition reproduced verbatim with one
-- clause changed; see the header comment above each block for that clause.

-- B2: the evidence gate counted every round in the cycle, including the
-- weight-0 APPLICATION_SCREEN round whose evidence lives in
-- rush.screening_reviews and which has zero evaluation assignments by
-- construction, so no decision could ever be created in a screened cycle.
-- Change: add `and r.weight > 0` to the outer rush.rounds predicate.
create or replace function rush.create_decision(target_cycle_id text, target_application_id text, target_outcome rush.decision_outcome, decision_reason text)
returns text language plpgsql security definer set search_path='' as $$
declare result_id text;
begin
  if not rush.has_cycle_role(target_cycle_id,array['PANEL','OWNER']::rush.member_role[]) then raise exception 'panel role required' using errcode='42501'; end if;
  if char_length(trim(decision_reason)) not between 1 and 4000 then raise exception 'reason required' using errcode='22023'; end if;
  if not exists(select 1 from rush.applications where id=target_application_id and cycle_id=target_cycle_id) then raise exception 'application missing' using errcode='P0002'; end if;
  if exists(select 1 from rush.applications where id=target_application_id and status='WITHDRAWN') then raise exception 'application withdrawn' using errcode='55000'; end if;
  if exists(select 1 from rush.conflict_declarations where application_id=target_application_id and declarer_id=auth.uid()) then raise exception 'conflict declared' using errcode='42501'; end if;
  if not exists(select 1 from rush.rush_cycles where id=target_cycle_id and status='DECISION_LOCK') then raise exception 'cycle not in decision lock' using errcode='55000'; end if;
  if exists(select 1 from rush.rounds r where r.cycle_id=target_cycle_id and r.status not in ('FROZEN','FINALIZED')) then raise exception 'rounds remain open' using errcode='55000'; end if;
  if exists(select 1 from rush.rounds r where r.cycle_id=target_cycle_id and r.weight > 0 and (select count(*) from rush.evaluation_assignments a join rush.evaluations e on e.assignment_id=a.id where a.round_id=r.id and a.application_id=target_application_id and e.status='LOCKED') < 2) then raise exception 'insufficient evidence' using errcode='55000'; end if;
  insert into rush.decisions(cycle_id,application_id,outcome,reason,created_by_id) values(target_cycle_id,target_application_id,target_outcome,trim(decision_reason),auth.uid()) returning id into result_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),target_cycle_id,'DECISION_CREATED','Decision',result_id);
  return result_id;
end; $$;
-- B5: `x->'score' = 'null'::jsonb` yields SQL NULL rather than true when the
-- `score` key is absent entirely, so a required criterion could be submitted
-- with no score key at all and still pass. Changes: coalesce the required
-- check, and drop the `x ? 'score'` guard on the range check so a missing key
-- is treated the same as an explicit null.
create or replace function rush.submit_evaluation(target_assignment_id text, submitted_ratings jsonb, submitted_evidence text default null)
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
  if exists (select 1 from jsonb_array_elements(submitted_ratings) x where x->'score' <> 'null'::jsonb and ((x->>'score') !~ '^[1-5]$')) then
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
    where c.rubric_id = v_rubric_id and c.required and coalesce(x->'score', 'null'::jsonb) = 'null'::jsonb
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
-- S1: approval performed no content check, so an admin approving a queue
-- unread could publish a packet that still names its own applicant.
-- Change: on approval, raise 55000 naming the field whose value appears in
-- content::text. Values under 3 characters are skipped so short names and
-- uniqnames do not make every packet unapprovable.
create or replace function rush.approve_screening_packet(target_packet_id text, approved boolean) returns void language plpgsql security definer set search_path='' as $$ declare actor uuid:=auth.uid(); target_cycle text; leak_field text; begin select b.cycle_id into target_cycle from rush.screening_packets p join rush.screening_batches b on b.id=p.batch_id where p.id=target_packet_id and b.status='DRAFT'; if target_cycle is null or not rush.has_cycle_capability(target_cycle,'SCREENING_ADMINISTRATION') then raise exception 'forbidden' using errcode='42501'; end if; if approved then select case when char_length(trim(pn.name))>=3 and strpos(lower(p.content::text),lower(trim(pn.name)))>0 then 'name' when pn.uniqname is not null and char_length(trim(pn.uniqname))>=3 and strpos(lower(p.content::text),lower(trim(pn.uniqname)))>0 then 'uniqname' when char_length(split_part(trim(pn.contact),'@',1))>=3 and strpos(lower(p.content::text),lower(split_part(trim(pn.contact),'@',1)))>0 then 'contact' end into leak_field from rush.screening_packets p join rush.applications a on a.id=p.application_id join rush.pnms pn on pn.id=a.pnm_id where p.id=target_packet_id; if leak_field is not null then raise exception 'packet content still contains the applicant''s own %; redact it before approving', leak_field using errcode='55000'; end if; end if; update rush.screening_packets set redaction_status=case when approved then 'APPROVED' else 'REJECTED' end,approved_by=actor,approved_at=now() where id=target_packet_id; insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(actor,target_cycle,case when approved then 'SCREENING_PACKET_APPROVED' else 'SCREENING_PACKET_REJECTED' end,'ScreeningPacket',target_packet_id); end $$;
-- S2: recusing the last eligible reviewer silently left the packet below
-- reviews_per_application, which freeze_screening_batch then rejects forever
-- with no recovery RPC (unique (cycle_id) blocks a second batch).
-- Change: raise 55000 instead of committing an unfillable packet.
create or replace function rush.recuse_screening_assignment(target_assignment_id text, recusal_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); packet text; application text; batch text; target_cycle text; replacement uuid;
begin
  if char_length(trim(recusal_reason)) not between 5 and 1000 then raise exception 'reason required' using errcode='22023'; end if;
  select a.packet_id,p.application_id,p.batch_id,b.cycle_id into packet,application,batch,target_cycle from rush.screening_assignments a join rush.screening_packets p on p.id=a.packet_id join rush.screening_batches b on b.id=p.batch_id
  join rush.screening_reviewers sr on sr.batch_id=b.id and sr.reviewer_id=a.reviewer_id and sr.active
  where a.id=target_assignment_id and a.reviewer_id=actor and a.status='ASSIGNED' and b.status='PUBLISHED'
    and rush.is_eligible_screening_reviewer(b.cycle_id,actor) for update of a;
  if packet is null then raise exception 'assignment not found' using errcode='P0002'; end if;
  insert into rush.conflict_declarations(application_id,declarer_id,reason) values(application,actor,trim(recusal_reason)) on conflict(application_id,declarer_id) do update set reason=excluded.reason;
  update rush.screening_assignments set status='RECUSED',updated_at=now() where id=target_assignment_id;
  select sr.reviewer_id into replacement from rush.screening_reviewers sr where sr.batch_id=batch and sr.active
    and rush.is_eligible_screening_reviewer(target_cycle,sr.reviewer_id)
    and not exists(select 1 from rush.screening_assignments x where x.packet_id=packet and x.reviewer_id=sr.reviewer_id)
    and not exists(select 1 from rush.conflict_declarations c where c.application_id=application and c.declarer_id=sr.reviewer_id)
    and (select count(*) from rush.screening_assignments x join rush.screening_packets p2 on p2.id=x.packet_id where p2.batch_id=batch and x.reviewer_id=sr.reviewer_id and x.status<>'RECUSED')<sr.capacity
  order by (select count(*) from rush.screening_assignments x join rush.screening_packets p2 on p2.id=x.packet_id where p2.batch_id=batch and x.reviewer_id=sr.reviewer_id and x.status<>'RECUSED'),random() limit 1;
  if replacement is null then raise exception 'no eligible replacement reviewer exists for this packet; the recusal cannot be completed' using errcode='55000'; end if;
  insert into rush.screening_assignments(packet_id,reviewer_id) values(packet,replacement);
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(actor,target_cycle,'SCREENING_RECUSED','ScreeningAssignment',target_assignment_id,jsonb_build_object('replacementCreated',replacement is not null));
end $$;
-- S12: the only decision RPC with no recusal check, so a conflicted PANEL
-- member could rewrite the applicant-facing communication preview.
-- Change: add the conflict_declarations guard the other three decision RPCs
-- already use.
create or replace function rush.set_decision_preview(target_decision_id text, preview_text text)
returns void language plpgsql security definer set search_path='' as $$
declare d rush.decisions%rowtype;
begin
  select * into d from rush.decisions where id=target_decision_id;
  if d.id is null or not rush.has_cycle_role(d.cycle_id, array['PANEL','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  if exists(select 1 from rush.conflict_declarations where application_id=d.application_id and declarer_id=auth.uid()) then raise exception 'conflict declared' using errcode='42501'; end if;
  update rush.decisions set communication_preview = trim(preview_text) where id=target_decision_id;
end; $$;
-- S13: assigning an active screening reviewer as an evaluator created a row
-- that applications_read_internal then hides, so the reviewer saw zero
-- assignments and the round board showed the slot Open forever.
-- Change: reject the assignment when the target is an eligible screening
-- reviewer in a cycle that has a PUBLISHED screening batch.
create or replace function rush.assign_evaluator(target_cycle_id text,target_round_id text,target_application_id text,target_evaluator_id uuid) returns text language plpgsql security definer set search_path='' as $$ declare result_id text; existing_status rush.assignment_status; begin if not rush.has_cycle_capability(target_cycle_id,'APPLICANT_OPERATIONS') then raise exception 'forbidden' using errcode='42501'; end if; if not exists(select 1 from rush.rush_cycles where id=target_cycle_id and status='IN_PROCESS') then raise exception 'cycle not in process' using errcode='55000'; end if; if not exists(select 1 from rush.rounds where id=target_round_id and cycle_id=target_cycle_id and status in ('DRAFT','PUBLISHED')) then raise exception 'round unavailable' using errcode='55000'; end if; if not exists(select 1 from rush.applications where id=target_application_id and cycle_id=target_cycle_id) then raise exception 'application missing' using errcode='P0002'; end if; if not exists(select 1 from rush.memberships where user_id=target_evaluator_id and cycle_id=target_cycle_id and active) then raise exception 'evaluator inactive' using errcode='42501'; end if; if exists(select 1 from rush.conflict_declarations where application_id=target_application_id and declarer_id=target_evaluator_id) then raise exception 'evaluator conflict' using errcode='42501'; end if; if rush.is_eligible_screening_reviewer(target_cycle_id,target_evaluator_id) and exists(select 1 from rush.screening_batches b where b.cycle_id=target_cycle_id and b.status='PUBLISHED') then raise exception 'screening reviewer cannot be assigned as an evaluator in the same cycle' using errcode='42501'; end if; select status into existing_status from rush.evaluation_assignments where round_id=target_round_id and application_id=target_application_id and evaluator_id=target_evaluator_id for update; if existing_status is not null and existing_status<>'ASSIGNED' then raise exception 'assignment locked' using errcode='55000'; end if; insert into rush.evaluation_assignments(round_id,application_id,evaluator_id) values(target_round_id,target_application_id,target_evaluator_id) on conflict(round_id,application_id,evaluator_id) do update set updated_at=now() returning id into result_id; insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),target_cycle_id,'EVALUATOR_ASSIGNED','EvaluationAssignment',result_id); return result_id; end $$;
-- S9: PENDING resume documents whose bytes uploaded but were never finalized
-- accumulate in the bucket permanently.
-- SCHEDULING IS A MANUAL STEP. Nothing calls this function. It must be
-- scheduled (pg_cron, a Supabase scheduled Edge Function, or an external cron
-- hitting it with the service role) before it does anything.
create or replace function rush.prune_pending_resume_uploads()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with stale as (
    delete from rush.application_documents
    where status = 'PENDING' and created_at < now() - interval '1 hour'
    returning object_path
  )
  delete from storage.objects o using stale
  where o.bucket_id = 'resumes' and o.name = stale.object_path;
end;
$$;
revoke all on function rush.prune_pending_resume_uploads() from public, anon, authenticated;
grant execute on function rush.prune_pending_resume_uploads() to service_role;
comment on function rush.prune_pending_resume_uploads() is
  'Deletes PENDING resume documents older than 1 hour and their resumes-bucket objects. MUST BE SCHEDULED; nothing calls it.';
-- S7: prune_rate_limits() is never called from any route, script or cron, so
-- every email typed into the login or forgot-password form accumulates in
-- plaintext forever. Grants are unchanged; this only records the requirement.
-- SCHEDULING IS A MANUAL STEP.
comment on function rush.prune_rate_limits() is
  'Deletes rate_limits rows older than 1 day. MUST BE SCHEDULED; nothing calls it.';
-- S26: audit_read_board was superseded by audit_events_read_internal
-- (20260830090000) but never dropped, leaving two overlapping permissive
-- policies. rush.claim_tokens is dead (RLS on, no policy, no RPC, no
-- reference in src/ or migrations) and holds unsalted token digests nothing
-- expires.
drop policy if exists audit_read_board on rush.audit_events;
drop table if exists rush.claim_tokens;
