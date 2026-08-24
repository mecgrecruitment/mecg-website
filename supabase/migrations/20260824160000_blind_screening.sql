create table rush.screening_batches (
  id text primary key default gen_random_uuid()::text,
  cycle_id text not null references rush.rush_cycles(id) on delete cascade,
  rubric_id text not null references rush.rubrics(id),
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','FROZEN')),
  reviews_per_application integer not null default 3 check (reviews_per_application = 3),
  seed_commitment text,
  created_by uuid not null references rush.profiles(id),
  published_at timestamptz,
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (cycle_id)
);

create table rush.screening_reviewers (
  batch_id text not null references rush.screening_batches(id) on delete cascade,
  reviewer_id uuid not null references rush.profiles(id),
  capacity integer not null default 100 check (capacity between 1 and 1000),
  active boolean not null default true,
  primary key (batch_id, reviewer_id)
);

create table rush.screening_packets (
  id text primary key default gen_random_uuid()::text,
  batch_id text not null references rush.screening_batches(id) on delete cascade,
  application_id text not null references rush.applications(id) on delete cascade,
  candidate_code text not null,
  content jsonb not null,
  content_hash text not null,
  redaction_status text not null default 'PENDING' check (redaction_status in ('PENDING','APPROVED','REJECTED')),
  approved_by uuid references rush.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (batch_id, application_id),
  unique (batch_id, candidate_code)
);

create table rush.screening_assignments (
  id text primary key default gen_random_uuid()::text,
  packet_id text not null references rush.screening_packets(id) on delete cascade,
  reviewer_id uuid not null references rush.profiles(id),
  status text not null default 'ASSIGNED' check (status in ('ASSIGNED','SUBMITTED','RECUSED','LOCKED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (packet_id, reviewer_id)
);

create table rush.screening_reviews (
  id text primary key default gen_random_uuid()::text,
  assignment_id text not null unique references rush.screening_assignments(id) on delete cascade,
  reviewer_id uuid not null references rush.profiles(id),
  recommendation text not null check (recommendation in ('ADVANCE','HOLD','DECLINE')),
  evidence text not null check (char_length(trim(evidence)) between 20 and 6000),
  score numeric not null check (score between 0 and 100),
  submitted_at timestamptz not null default now()
);

create table rush.screening_ratings (
  review_id text not null references rush.screening_reviews(id) on delete cascade,
  criterion_id text not null references rush.rubric_criteria(id),
  score integer not null check (score between 1 and 5),
  note text check (note is null or char_length(note) <= 2000),
  primary key (review_id, criterion_id)
);

create table rush.screening_distribution_runs (
  id text primary key default gen_random_uuid()::text,
  batch_id text not null references rush.screening_batches(id) on delete cascade,
  seed_commitment text not null,
  assignment_count integer not null,
  summary jsonb not null,
  created_by uuid not null references rush.profiles(id),
  created_at timestamptz not null default now()
);

create index screening_assignments_reviewer_status_idx on rush.screening_assignments(reviewer_id,status);
create index screening_packets_batch_status_idx on rush.screening_packets(batch_id,redaction_status);

alter table rush.screening_batches enable row level security; alter table rush.screening_batches force row level security;
alter table rush.screening_reviewers enable row level security; alter table rush.screening_reviewers force row level security;
alter table rush.screening_packets enable row level security; alter table rush.screening_packets force row level security;
alter table rush.screening_assignments enable row level security; alter table rush.screening_assignments force row level security;
alter table rush.screening_reviews enable row level security; alter table rush.screening_reviews force row level security;
alter table rush.screening_ratings enable row level security; alter table rush.screening_ratings force row level security;
alter table rush.screening_distribution_runs enable row level security; alter table rush.screening_distribution_runs force row level security;

grant all on rush.screening_batches, rush.screening_reviewers, rush.screening_packets, rush.screening_assignments,
  rush.screening_reviews, rush.screening_ratings, rush.screening_distribution_runs to service_role;

create or replace function rush.create_screening_batch(target_cycle_id text, reviewer_ids uuid[])
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); v_round_id text; v_rubric_id text; v_batch_id text; v_reviewer_id uuid;
begin
  if actor is null or not rush.has_cycle_role(target_cycle_id,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from rush.rush_cycles where id=target_cycle_id and status in ('OPEN','IN_PROCESS')) then raise exception 'cycle unavailable' using errcode='55000'; end if;
  if coalesce(array_length(reviewer_ids,1),0) < 3 then raise exception 'at least three reviewers are required' using errcode='22023'; end if;
  insert into rush.rounds(cycle_id,kind,name,status,weight)
  values(target_cycle_id,'APPLICATION_SCREEN','Blind application screening','PUBLISHED',0)
  on conflict(cycle_id,kind) do update set name=excluded.name
  returning id into v_round_id;
  select id into v_rubric_id from rush.rubrics where round_id=v_round_id order by version desc limit 1;
  if v_rubric_id is null then
    insert into rush.rubrics(round_id,version) values(v_round_id,1) returning id into v_rubric_id;
    insert into rush.rubric_criteria(rubric_id,key,name,description,weight,required,position) values
      (v_rubric_id,'motivation','MECG motivation','Explains why MECG specifically and connects that interest to concrete work.',20,true,0),
      (v_rubric_id,'problem_structuring','Problem structuring','Separates a messy problem into workable parts and states relevant constraints.',25,true,1),
      (v_rubric_id,'ownership','Evidence and ownership','Describes personal actions and the resulting change without relying on prestige signals.',20,true,2),
      (v_rubric_id,'reflection','Reflection and judgment','Acknowledges uncertainty, tradeoffs, mistakes, or lessons.',20,true,3),
      (v_rubric_id,'communication','Clear communication','Communicates directly and understandably without rewarding ornamental writing.',15,true,4);
  end if;
  insert into rush.screening_batches(cycle_id,rubric_id,created_by) values(target_cycle_id,v_rubric_id,actor) returning id into v_batch_id;
  foreach v_reviewer_id in array reviewer_ids loop
    if not exists(select 1 from rush.memberships m where m.user_id=v_reviewer_id and m.cycle_id=target_cycle_id and m.role='MEMBER' and m.active)
      or exists(select 1 from rush.memberships m where m.user_id=v_reviewer_id and m.cycle_id=target_cycle_id and m.role in ('BOARD','PANEL','OWNER') and m.active)
    then raise exception 'reviewers must be non-privileged active members' using errcode='42501'; end if;
    insert into rush.screening_reviewers(batch_id,reviewer_id) values(v_batch_id,v_reviewer_id);
  end loop;
  insert into rush.screening_packets(batch_id,application_id,candidate_code,content,content_hash)
  select v_batch_id,a.id,'Applicant '||upper(substr(encode(extensions.digest(a.id||v_batch_id,'sha256'),'hex'),1,6)),
    jsonb_build_object('responses',coalesce((select jsonb_agg(jsonb_build_object('question',r.question_text,'answer',r.response_text) order by r.created_at) from rush.application_responses r where r.application_id=a.id),'[]'::jsonb)),
    encode(extensions.digest(coalesce((select string_agg(r.question_text||E'\n'||r.response_text,E'\n' order by r.created_at) from rush.application_responses r where r.application_id=a.id),''),'sha256'),'hex')
  from rush.applications a where a.cycle_id=target_cycle_id and a.status not in ('DRAFT','WITHDRAWN');
  if not found then raise exception 'no submitted applications are available' using errcode='55000'; end if;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(actor,target_cycle_id,'SCREENING_BATCH_CREATED','ScreeningBatch',v_batch_id);
  return v_batch_id;
end $$;

create or replace function rush.screening_admin_overview(target_cycle_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when not rush.has_cycle_role(target_cycle_id,array['BOARD','OWNER']::rush.member_role[]) then null else coalesce((
    select jsonb_build_object(
      'batchId',b.id,'status',b.status,'reviewsPerApplication',b.reviews_per_application,
      'reviewers',(select coalesce(jsonb_agg(jsonb_build_object('id',sr.reviewer_id,'name',p.display_name,'capacity',sr.capacity) order by p.display_name),'[]'::jsonb) from rush.screening_reviewers sr join rush.profiles p on p.id=sr.reviewer_id where sr.batch_id=b.id and sr.active),
      'packets',(select coalesce(jsonb_agg(jsonb_build_object('id',sp.id,'code',sp.candidate_code,'status',sp.redaction_status,'applicantName',pn.name,'content',sp.content) order by sp.candidate_code),'[]'::jsonb) from rush.screening_packets sp join rush.applications a on a.id=sp.application_id join rush.pnms pn on pn.id=a.pnm_id where sp.batch_id=b.id),
      'assigned',(select count(*) from rush.screening_assignments sa join rush.screening_packets sp on sp.id=sa.packet_id where sp.batch_id=b.id and sa.status<>'RECUSED'),
      'submitted',(select count(*) from rush.screening_assignments sa join rush.screening_packets sp on sp.id=sa.packet_id where sp.batch_id=b.id and sa.status in ('SUBMITTED','LOCKED')),
      'results',case when b.status='FROZEN' then (select coalesce(jsonb_agg(jsonb_build_object('code',sp.candidate_code,'applicantName',pn.name,'recommendation',sr.recommendation,'score',sr.score,'evidence',sr.evidence) order by sp.candidate_code,sr.submitted_at),'[]'::jsonb) from rush.screening_reviews sr join rush.screening_assignments sa on sa.id=sr.assignment_id join rush.screening_packets sp on sp.id=sa.packet_id join rush.applications a on a.id=sp.application_id join rush.pnms pn on pn.id=a.pnm_id where sp.batch_id=b.id) else '[]'::jsonb end
    ) from rush.screening_batches b where b.cycle_id=target_cycle_id
  ),'null'::jsonb) end;
$$;

create or replace function rush.approve_screening_packet(target_packet_id text, approved boolean)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target_cycle text;
begin
  select b.cycle_id into target_cycle from rush.screening_packets p join rush.screening_batches b on b.id=p.batch_id where p.id=target_packet_id and b.status='DRAFT';
  if target_cycle is null or not rush.has_cycle_role(target_cycle,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  update rush.screening_packets set redaction_status=case when approved then 'APPROVED' else 'REJECTED' end,approved_by=actor,approved_at=now() where id=target_packet_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(actor,target_cycle,case when approved then 'SCREENING_PACKET_APPROVED' else 'SCREENING_PACKET_REJECTED' end,'ScreeningPacket',target_packet_id);
end $$;

create or replace function rush.update_screening_packet_content(target_packet_id text, revised_content jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target_cycle text;
begin
  select b.cycle_id into target_cycle from rush.screening_packets p join rush.screening_batches b on b.id=p.batch_id where p.id=target_packet_id and b.status='DRAFT';
  if target_cycle is null or not rush.has_cycle_role(target_cycle,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  if jsonb_typeof(revised_content)<>'object' or jsonb_typeof(revised_content->'responses')<>'array' or octet_length(revised_content::text)>50000 then raise exception 'invalid packet content' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(revised_content->'responses') x where jsonb_typeof(x)<>'object' or char_length(coalesce(x->>'question',''))>2000 or char_length(coalesce(x->>'answer',''))>8000) then raise exception 'invalid response content' using errcode='22023'; end if;
  update rush.screening_packets set content=revised_content,content_hash=encode(extensions.digest(revised_content::text,'sha256'),'hex'),redaction_status='PENDING',approved_by=null,approved_at=null where id=target_packet_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(actor,target_cycle,'SCREENING_PACKET_REDACTED','ScreeningPacket',target_packet_id);
end $$;

create or replace function rush.screening_assignment_inputs(target_batch_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare target_cycle text;
begin
  select cycle_id into target_cycle from rush.screening_batches where id=target_batch_id and status='DRAFT';
  if target_cycle is null or not rush.has_cycle_role(target_cycle,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  return jsonb_build_object(
    'packets',(select coalesce(jsonb_agg(jsonb_build_object('packetId',p.id,'eligibleReviewerIds',(
      select coalesce(jsonb_agg(sr.reviewer_id),'[]'::jsonb) from rush.screening_reviewers sr
      where sr.batch_id=target_batch_id and sr.active and not exists(select 1 from rush.conflict_declarations c where c.application_id=p.application_id and c.declarer_id=sr.reviewer_id)
    ))),'[]'::jsonb) from rush.screening_packets p where p.batch_id=target_batch_id and p.redaction_status='APPROVED'),
    'reviewers',(select coalesce(jsonb_agg(jsonb_build_object('reviewerId',reviewer_id,'capacity',capacity)),'[]'::jsonb) from rush.screening_reviewers where batch_id=target_batch_id and active)
  );
end $$;

create or replace function rush.commit_screening_assignments(target_batch_id text, proposal jsonb, commitment text, summary jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target_cycle text; required_count integer; inserted_count integer;
begin
  select cycle_id,reviews_per_application into target_cycle,required_count from rush.screening_batches where id=target_batch_id and status='DRAFT' for update;
  if target_cycle is null or not rush.has_cycle_role(target_cycle,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  if jsonb_typeof(proposal)<>'array' or char_length(commitment)<>64 then raise exception 'invalid proposal' using errcode='22023'; end if;
  if exists(select 1 from rush.screening_packets where batch_id=target_batch_id and redaction_status<>'APPROVED') then raise exception 'every packet requires approval' using errcode='55000'; end if;
  if exists(
    select 1 from jsonb_array_elements(proposal) x
    where not exists(select 1 from rush.screening_packets p where p.id=x->>'packetId' and p.batch_id=target_batch_id and p.redaction_status='APPROVED')
       or not exists(select 1 from rush.screening_reviewers r where r.batch_id=target_batch_id and r.reviewer_id=(x->>'reviewerId')::uuid and r.active)
       or exists(select 1 from rush.screening_packets p join rush.conflict_declarations c on c.application_id=p.application_id where p.id=x->>'packetId' and c.declarer_id=(x->>'reviewerId')::uuid)
  ) then raise exception 'proposal contains an ineligible assignment' using errcode='42501'; end if;
  if exists(select 1 from rush.screening_packets p where p.batch_id=target_batch_id and (select count(*) from jsonb_array_elements(proposal) x where x->>'packetId'=p.id)<>required_count)
    or exists(select 1 from jsonb_array_elements(proposal) x group by x->>'packetId',x->>'reviewerId' having count(*)>1)
  then raise exception 'every packet needs three distinct reviewers' using errcode='22023'; end if;
  if exists(select 1 from rush.screening_reviewers r where r.batch_id=target_batch_id and (select count(*) from jsonb_array_elements(proposal) x where x->>'reviewerId'=r.reviewer_id::text)>r.capacity)
  then raise exception 'reviewer capacity exceeded' using errcode='22023'; end if;
  insert into rush.screening_assignments(packet_id,reviewer_id)
  select x->>'packetId',(x->>'reviewerId')::uuid from jsonb_array_elements(proposal) x;
  get diagnostics inserted_count=row_count;
  update rush.screening_batches set status='PUBLISHED',seed_commitment=commitment,published_at=now() where id=target_batch_id;
  update rush.rounds set status='ACTIVE' where id=(select r.round_id from rush.rubrics r join rush.screening_batches b on b.rubric_id=r.id where b.id=target_batch_id);
  update rush.rubrics set frozen_at=now() where id=(select rubric_id from rush.screening_batches where id=target_batch_id);
  insert into rush.screening_distribution_runs(batch_id,seed_commitment,assignment_count,summary,created_by) values(target_batch_id,commitment,inserted_count,summary,actor);
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(actor,target_cycle,'SCREENING_DISTRIBUTED','ScreeningBatch',target_batch_id,jsonb_build_object('assignments',inserted_count));
  return inserted_count;
end $$;

create or replace function rush.my_screening_queue(target_cycle_id text)
returns table(assignment_id text,candidate_code text,assignment_status text) language sql stable security definer set search_path='' as $$
  select a.id,p.candidate_code,a.status from rush.screening_assignments a join rush.screening_packets p on p.id=a.packet_id join rush.screening_batches b on b.id=p.batch_id
  where b.cycle_id=target_cycle_id and b.status='PUBLISHED' and a.reviewer_id=auth.uid() order by p.candidate_code;
$$;

create or replace function rush.screening_assignment_detail(target_assignment_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  select jsonb_build_object('assignmentId',a.id,'candidateCode',p.candidate_code,'status',a.status,'content',p.content,'criteria',(
    select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'weight',c.weight,'required',c.required) order by c.position) from rush.rubric_criteria c where c.rubric_id=b.rubric_id
  )) into result from rush.screening_assignments a join rush.screening_packets p on p.id=a.packet_id join rush.screening_batches b on b.id=p.batch_id
  where a.id=target_assignment_id and a.reviewer_id=auth.uid() and b.status='PUBLISHED' and a.status='ASSIGNED';
  if result is null then raise exception 'assignment not found' using errcode='P0002'; end if;
  return result;
end $$;

create or replace function rush.submit_screening_review(target_assignment_id text, ratings jsonb, review_evidence text, review_recommendation text)
returns numeric language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); v_rubric_id text; v_review_id text; expected integer; weighted numeric; target_cycle text;
begin
  select b.rubric_id,b.cycle_id into v_rubric_id,target_cycle from rush.screening_assignments a join rush.screening_packets p on p.id=a.packet_id join rush.screening_batches b on b.id=p.batch_id
  where a.id=target_assignment_id and a.reviewer_id=actor and a.status='ASSIGNED' and b.status='PUBLISHED' for update of a;
  if v_rubric_id is null then raise exception 'assignment not found' using errcode='P0002'; end if;
  if review_recommendation not in ('ADVANCE','HOLD','DECLINE') or char_length(trim(review_evidence)) not between 20 and 6000 or jsonb_typeof(ratings)<>'array' then raise exception 'invalid review' using errcode='22023'; end if;
  select count(*) into expected from rush.rubric_criteria where rubric_id=v_rubric_id;
  if (select count(*) from jsonb_array_elements(ratings))<>expected or (select count(distinct x->>'criterionId') from jsonb_array_elements(ratings)x)<>expected
    or exists(select 1 from jsonb_array_elements(ratings)x where (x->>'score')!~'^[1-5]$' or not exists(select 1 from rush.rubric_criteria c where c.id=x->>'criterionId' and c.rubric_id=v_rubric_id))
  then raise exception 'every criterion needs one score' using errcode='22023'; end if;
  select 100*sum(c.weight*(((x->>'score')::numeric-1)/4))/sum(c.weight) into weighted from jsonb_array_elements(ratings)x join rush.rubric_criteria c on c.id=x->>'criterionId';
  insert into rush.screening_reviews(assignment_id,reviewer_id,recommendation,evidence,score) values(target_assignment_id,actor,review_recommendation,trim(review_evidence),weighted) returning id into v_review_id;
  insert into rush.screening_ratings(review_id,criterion_id,score,note) select v_review_id,x->>'criterionId',(x->>'score')::integer,left(nullif(trim(x->>'note'),''),2000) from jsonb_array_elements(ratings)x;
  update rush.screening_assignments set status='SUBMITTED',updated_at=now() where id=target_assignment_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(actor,target_cycle,'SCREENING_REVIEW_SUBMITTED','ScreeningReview',v_review_id);
  return weighted;
end $$;

create or replace function rush.recuse_screening_assignment(target_assignment_id text, recusal_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); packet text; application text; batch text; target_cycle text; replacement uuid;
begin
  if char_length(trim(recusal_reason)) not between 5 and 1000 then raise exception 'reason required' using errcode='22023'; end if;
  select a.packet_id,p.application_id,p.batch_id,b.cycle_id into packet,application,batch,target_cycle from rush.screening_assignments a join rush.screening_packets p on p.id=a.packet_id join rush.screening_batches b on b.id=p.batch_id
  where a.id=target_assignment_id and a.reviewer_id=actor and a.status='ASSIGNED' and b.status='PUBLISHED' for update of a;
  if packet is null then raise exception 'assignment not found' using errcode='P0002'; end if;
  insert into rush.conflict_declarations(application_id,declarer_id,reason) values(application,actor,trim(recusal_reason)) on conflict(application_id,declarer_id) do update set reason=excluded.reason;
  update rush.screening_assignments set status='RECUSED',updated_at=now() where id=target_assignment_id;
  select sr.reviewer_id into replacement from rush.screening_reviewers sr where sr.batch_id=batch and sr.active
    and not exists(select 1 from rush.screening_assignments x where x.packet_id=packet and x.reviewer_id=sr.reviewer_id)
    and not exists(select 1 from rush.conflict_declarations c where c.application_id=application and c.declarer_id=sr.reviewer_id)
    and (select count(*) from rush.screening_assignments x join rush.screening_packets p2 on p2.id=x.packet_id where p2.batch_id=batch and x.reviewer_id=sr.reviewer_id and x.status<>'RECUSED')<sr.capacity
  order by (select count(*) from rush.screening_assignments x join rush.screening_packets p2 on p2.id=x.packet_id where p2.batch_id=batch and x.reviewer_id=sr.reviewer_id and x.status<>'RECUSED'),random() limit 1;
  if replacement is not null then insert into rush.screening_assignments(packet_id,reviewer_id) values(packet,replacement); end if;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(actor,target_cycle,'SCREENING_RECUSED','ScreeningAssignment',target_assignment_id,jsonb_build_object('replacementCreated',replacement is not null));
end $$;

create or replace function rush.freeze_screening_batch(target_batch_id text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target_cycle text;
begin
  select cycle_id into target_cycle from rush.screening_batches where id=target_batch_id and status='PUBLISHED' for update;
  if target_cycle is null or not rush.has_cycle_role(target_cycle,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  if exists(select 1 from rush.screening_assignments a join rush.screening_packets p on p.id=a.packet_id where p.batch_id=target_batch_id and a.status not in ('SUBMITTED','RECUSED'))
    or exists(select 1 from rush.screening_packets p where p.batch_id=target_batch_id and (select count(*) from rush.screening_assignments a where a.packet_id=p.id and a.status='SUBMITTED')<>3)
  then raise exception 'three submitted reviews are required for every packet' using errcode='55000'; end if;
  update rush.screening_assignments set status='LOCKED',updated_at=now() where packet_id in(select id from rush.screening_packets where batch_id=target_batch_id) and status='SUBMITTED';
  update rush.screening_batches set status='FROZEN',frozen_at=now() where id=target_batch_id;
  update rush.rounds set status='FROZEN' where id=(select r.round_id from rush.rubrics r join rush.screening_batches b on b.rubric_id=r.id where b.id=target_batch_id);
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(actor,target_cycle,'SCREENING_FROZEN','ScreeningBatch',target_batch_id);
end $$;

create or replace function rush.is_active_screening_reviewer(target_cycle_id text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from rush.screening_reviewers sr join rush.screening_batches b on b.id=sr.batch_id where b.cycle_id=target_cycle_id and b.status='PUBLISHED' and sr.reviewer_id=auth.uid() and sr.active);
$$;

create or replace function rush.member_applicants(target_cycle_id text)
returns table(id text,name text) language sql stable security definer set search_path='' as $$
  select a.id,p.name from rush.applications a join rush.pnms p on p.id=a.pnm_id
  where a.cycle_id=target_cycle_id
    and rush.has_cycle_role(target_cycle_id,array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
    and not rush.is_active_screening_reviewer(target_cycle_id)
  order by p.name;
$$;

revoke all on function rush.create_screening_batch(text,uuid[]),rush.screening_admin_overview(text),rush.approve_screening_packet(text,boolean),rush.update_screening_packet_content(text,jsonb),
  rush.screening_assignment_inputs(text),rush.commit_screening_assignments(text,jsonb,text,jsonb),rush.my_screening_queue(text),
  rush.screening_assignment_detail(text),rush.submit_screening_review(text,jsonb,text,text),rush.recuse_screening_assignment(text,text),
  rush.freeze_screening_batch(text),rush.is_active_screening_reviewer(text) from public,anon;
grant execute on function rush.create_screening_batch(text,uuid[]),rush.screening_admin_overview(text),rush.approve_screening_packet(text,boolean),rush.update_screening_packet_content(text,jsonb),
  rush.screening_assignment_inputs(text),rush.commit_screening_assignments(text,jsonb,text,jsonb),rush.my_screening_queue(text),
  rush.screening_assignment_detail(text),rush.submit_screening_review(text,jsonb,text,text),rush.recuse_screening_assignment(text,text),
  rush.freeze_screening_batch(text),rush.is_active_screening_reviewer(text) to authenticated,service_role;
