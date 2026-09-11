-- Two things go wrong in practice once a batch exists that nothing today
-- can fix: an admin needs to start over (wrong readers, bad packets, a
-- rubric change) and unique (cycle_id) on screening_batches blocks a second
-- batch; or a reader drops out mid-cycle and their ASSIGNED packets sit
-- unread with no way to hand them on. Both get an admin RPC here.
--
-- A batch can be reset while it is DRAFT, or while it is PUBLISHED but no
-- review has been submitted yet. Once a review exists the batch is evidence
-- and stays. Reset deletes the batch (packets, assignments, reviewers and
-- distribution runs cascade) and puts the round and rubric back to the
-- state create_screening_batch expects, so the admin can create a new one.
create or replace function rush.reset_screening_batch(target_batch_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  target_cycle text;
  batch_status text;
  n_packets integer;
  n_assignments integer;
begin
  select b.cycle_id, b.status into target_cycle, batch_status
  from rush.screening_batches b
  where b.id = target_batch_id
  for update;
  if actor is null or target_cycle is null or not rush.has_cycle_capability(target_cycle, 'SCREENING_ADMINISTRATION') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if batch_status <> 'DRAFT' and (
    batch_status <> 'PUBLISHED'
    or exists (
      select 1
      from rush.screening_reviews r
      join rush.screening_assignments a on a.id = r.assignment_id
      join rush.screening_packets p on p.id = a.packet_id
      where p.batch_id = target_batch_id
    )
  ) then
    raise exception 'reviews already submitted; the batch cannot be reset' using errcode = '55000';
  end if;

  select count(*) into n_packets from rush.screening_packets where batch_id = target_batch_id;
  select count(*) into n_assignments
  from rush.screening_assignments a
  join rush.screening_packets p on p.id = a.packet_id
  where p.batch_id = target_batch_id;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, target_cycle, 'SCREENING_BATCH_RESET', 'ScreeningBatch', target_batch_id,
    jsonb_build_object('status', batch_status, 'packets', n_packets, 'assignments', n_assignments));

  delete from rush.screening_batches where id = target_batch_id;

  update rush.rounds set status = 'PUBLISHED', updated_at = now()
  where cycle_id = target_cycle and kind = 'APPLICATION_SCREEN';
  update rush.rubrics set frozen_at = null
  where round_id in (select id from rush.rounds where cycle_id = target_cycle and kind = 'APPLICATION_SCREEN');
end;
$$;

revoke all on function rush.reset_screening_batch(text) from public, anon;
grant execute on function rush.reset_screening_batch(text) to authenticated, service_role;

-- Hands every ASSIGNED packet of one reader in a PUBLISHED batch to another
-- eligible reader and deactivates the original. Replacement picking matches
-- recuse_screening_assignment: active in this batch, still eligible, no
-- conflict on the application, not already on the packet, under capacity,
-- least loaded first with ties broken at random. If any packet has nobody
-- left to take it the whole call rolls back, the same as a recusal would.
-- Submitted reviews by the departing reader are left alone.
create or replace function rush.reassign_screening_reader(target_batch_id text, target_reviewer_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  target_cycle text;
  a record;
  replacement uuid;
  n_reassigned integer := 0;
begin
  select b.cycle_id into target_cycle
  from rush.screening_batches b
  where b.id = target_batch_id and b.status = 'PUBLISHED'
  for update;
  if actor is null or target_cycle is null or not rush.has_cycle_capability(target_cycle, 'SCREENING_ADMINISTRATION') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for a in
    select sa.id, sa.packet_id, p.application_id
    from rush.screening_assignments sa
    join rush.screening_packets p on p.id = sa.packet_id
    where p.batch_id = target_batch_id and sa.reviewer_id = target_reviewer_id and sa.status = 'ASSIGNED'
    order by p.candidate_code
  loop
    update rush.screening_assignments set status = 'RECUSED', updated_at = now() where id = a.id;
    select sr.reviewer_id into replacement
    from rush.screening_reviewers sr
    where sr.batch_id = target_batch_id and sr.active and sr.reviewer_id <> target_reviewer_id
      and rush.is_eligible_screening_reviewer(target_cycle, sr.reviewer_id)
      and not exists (select 1 from rush.screening_assignments x where x.packet_id = a.packet_id and x.reviewer_id = sr.reviewer_id)
      and not exists (select 1 from rush.conflict_declarations c where c.application_id = a.application_id and c.declarer_id = sr.reviewer_id)
      and (select count(*) from rush.screening_assignments x join rush.screening_packets p2 on p2.id = x.packet_id where p2.batch_id = target_batch_id and x.reviewer_id = sr.reviewer_id and x.status <> 'RECUSED') < sr.capacity
    order by (select count(*) from rush.screening_assignments x join rush.screening_packets p2 on p2.id = x.packet_id where p2.batch_id = target_batch_id and x.reviewer_id = sr.reviewer_id and x.status <> 'RECUSED'), random()
    limit 1;
    if replacement is null then
      raise exception 'no eligible replacement reader for packet %', a.packet_id using errcode = '55000';
    end if;
    insert into rush.screening_assignments (packet_id, reviewer_id) values (a.packet_id, replacement);
    n_reassigned := n_reassigned + 1;
  end loop;

  update rush.screening_reviewers set active = false
  where batch_id = target_batch_id and reviewer_id = target_reviewer_id;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, target_cycle, 'SCREENING_READER_REASSIGNED', 'ScreeningBatch', target_batch_id,
    jsonb_build_object('reviewerId', target_reviewer_id, 'reassigned', n_reassigned));

  return n_reassigned;
end;
$$;

revoke all on function rush.reassign_screening_reader(text, uuid) from public, anon;
grant execute on function rush.reassign_screening_reader(text, uuid) to authenticated, service_role;

-- The leak check used strpos, so a three-letter name or uniqname refused
-- every packet whose prose happened to contain those letters inside another
-- word ("sam" in "the same"). Match on word boundaries instead, and name the
-- value that matched so the admin knows what to redact. Nothing else changes.
create or replace function rush.approve_screening_packet(target_packet_id text, approved boolean) returns void language plpgsql security definer set search_path='' as $$ declare actor uuid:=rush.actor_id(); target_cycle text; leak_field text; leak_value text; begin select b.cycle_id into target_cycle from rush.screening_packets p join rush.screening_batches b on b.id=p.batch_id where p.id=target_packet_id and b.status='DRAFT'; if target_cycle is null or not rush.has_cycle_capability(target_cycle,'SCREENING_ADMINISTRATION') then raise exception 'forbidden' using errcode='42501'; end if; if approved then select case when char_length(trim(pn.name))>=3 and p.content::text ~* ('(^|[^[:alnum:]])'||regexp_replace(trim(pn.name),'([\\^$.|?*+()\[\]{}])','\\\1','g')||'([^[:alnum:]]|$)') then 'name' when pn.uniqname is not null and char_length(trim(pn.uniqname))>=3 and p.content::text ~* ('(^|[^[:alnum:]])'||regexp_replace(trim(pn.uniqname),'([\\^$.|?*+()\[\]{}])','\\\1','g')||'([^[:alnum:]]|$)') then 'uniqname' when char_length(split_part(trim(pn.contact),'@',1))>=3 and p.content::text ~* ('(^|[^[:alnum:]])'||regexp_replace(split_part(trim(pn.contact),'@',1),'([\\^$.|?*+()\[\]{}])','\\\1','g')||'([^[:alnum:]]|$)') then 'contact' end, case when char_length(trim(pn.name))>=3 and p.content::text ~* ('(^|[^[:alnum:]])'||regexp_replace(trim(pn.name),'([\\^$.|?*+()\[\]{}])','\\\1','g')||'([^[:alnum:]]|$)') then trim(pn.name) when pn.uniqname is not null and char_length(trim(pn.uniqname))>=3 and p.content::text ~* ('(^|[^[:alnum:]])'||regexp_replace(trim(pn.uniqname),'([\\^$.|?*+()\[\]{}])','\\\1','g')||'([^[:alnum:]]|$)') then trim(pn.uniqname) when char_length(split_part(trim(pn.contact),'@',1))>=3 and p.content::text ~* ('(^|[^[:alnum:]])'||regexp_replace(split_part(trim(pn.contact),'@',1),'([\\^$.|?*+()\[\]{}])','\\\1','g')||'([^[:alnum:]]|$)') then split_part(trim(pn.contact),'@',1) end into leak_field, leak_value from rush.screening_packets p join rush.applications a on a.id=p.application_id join rush.pnms pn on pn.id=a.pnm_id where p.id=target_packet_id; if leak_field is not null then raise exception 'packet content still contains the applicant''s own % ("%"); redact it before approving', leak_field, leak_value using errcode='55000'; end if; end if; update rush.screening_packets set redaction_status=case when approved then 'APPROVED' else 'REJECTED' end,approved_by=actor,approved_at=now() where id=target_packet_id; insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(actor,target_cycle,case when approved then 'SCREENING_PACKET_APPROVED' else 'SCREENING_PACKET_REJECTED' end,'ScreeningPacket',target_packet_id); end $$;

-- Packets stay hidden from anyone reading in this batch, active or not,
-- so a Board member who is also a reader cannot see applicant names while
-- the batch is open. Non-Board results also drop applicationId, which was
-- enough to look a code up in the roster.
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
        'reviewers', (select coalesce(jsonb_agg(jsonb_build_object('id', sr.reviewer_id, 'name', p.display_name, 'capacity', sr.capacity, 'assigned', (select count(*) from rush.screening_assignments sa join rush.screening_packets sp on sp.id = sa.packet_id where sp.batch_id = b.id and sa.reviewer_id = sr.reviewer_id and sa.status <> 'RECUSED'), 'submitted', (select count(*) from rush.screening_assignments sa join rush.screening_packets sp on sp.id = sa.packet_id where sp.batch_id = b.id and sa.reviewer_id = sr.reviewer_id and sa.status in ('SUBMITTED', 'LOCKED'))) order by p.display_name), '[]'::jsonb) from rush.screening_reviewers sr join rush.profiles p on p.id = sr.reviewer_id where sr.batch_id = b.id and sr.active),
        'packets', case when exists (select 1 from rush.screening_reviewers sr where sr.batch_id = b.id and sr.reviewer_id = rush.actor_id() and sr.active) or rush.is_active_screening_reviewer(target_cycle_id) then '[]'::jsonb else (select coalesce(jsonb_agg((jsonb_build_object('id', sp.id, 'code', sp.candidate_code, 'status', sp.redaction_status, 'applicantName', pn.name, 'content', sp.content, 'assignments', (select coalesce(jsonb_agg(jsonb_build_object('reviewerId', sa.reviewer_id, 'reviewerName', rp.display_name, 'status', sa.status) order by rp.display_name), '[]'::jsonb) from rush.screening_assignments sa join rush.profiles rp on rp.id = sa.reviewer_id where sa.packet_id = sp.id)) - case when b.status = 'FROZEN' and not rush.has_cycle_role(target_cycle_id, array['BOARD', 'OWNER']::rush.member_role[]) then array['applicantName', 'content', 'assignments'] else array[]::text[] end) order by sp.candidate_code), '[]'::jsonb) from rush.screening_packets sp join rush.applications a on a.id = sp.application_id join rush.pnms pn on pn.id = a.pnm_id where sp.batch_id = b.id) end,
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
          ) - case when rush.has_cycle_role(target_cycle_id, array['BOARD', 'OWNER']::rush.member_role[]) then array[]::text[] else array['applicationId', 'applicantName', 'evidence', 'reviewerId', 'reviewerName'] end) order by sp.candidate_code, sr.submitted_at), '[]'::jsonb)
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
