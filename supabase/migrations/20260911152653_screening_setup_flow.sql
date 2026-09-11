-- Approving a batch one packet at a time is slow when nothing needs
-- redacting. This approves every PENDING packet in a DRAFT batch, running the
-- existing per-packet leak check for each, and reports the ones that refused
-- so the admin can redact those by hand. Each approval writes its own audit
-- row through approve_screening_packet.
create or replace function rush.approve_screening_packets(target_batch_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  target_cycle text;
  p record;
  n_ok integer := 0;
  failures jsonb := '[]'::jsonb;
begin
  select b.cycle_id into target_cycle
  from rush.screening_batches b
  where b.id = target_batch_id and b.status = 'DRAFT';
  if actor is null or target_cycle is null or not rush.has_cycle_capability(target_cycle, 'SCREENING_ADMINISTRATION') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for p in
    select id, candidate_code
    from rush.screening_packets
    where batch_id = target_batch_id and redaction_status = 'PENDING'
    order by candidate_code
  loop
    begin
      perform rush.approve_screening_packet(p.id, true);
      n_ok := n_ok + 1;
    exception when others then
      failures := failures || jsonb_build_object('packetId', p.id, 'code', p.candidate_code, 'reason', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('approved', n_ok, 'failed', failures);
end;
$$;

revoke all on function rush.approve_screening_packets(text) from public, anon;
grant execute on function rush.approve_screening_packets(text) to authenticated, service_role;

-- The overview now reports each reviewer's assignment load and each packet's
-- reviewer list so the admin can see coverage before and after publishing.
-- Packet assignments are stripped alongside applicantName and content for
-- FROZEN batches read by non-Board callers.
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
        'packets', case when rush.is_active_screening_reviewer(target_cycle_id) then '[]'::jsonb else (select coalesce(jsonb_agg((jsonb_build_object('id', sp.id, 'code', sp.candidate_code, 'status', sp.redaction_status, 'applicantName', pn.name, 'content', sp.content, 'assignments', (select coalesce(jsonb_agg(jsonb_build_object('reviewerId', sa.reviewer_id, 'reviewerName', rp.display_name, 'status', sa.status) order by rp.display_name), '[]'::jsonb) from rush.screening_assignments sa join rush.profiles rp on rp.id = sa.reviewer_id where sa.packet_id = sp.id)) - case when b.status = 'FROZEN' and not rush.has_cycle_role(target_cycle_id, array['BOARD', 'OWNER']::rush.member_role[]) then array['applicantName', 'content', 'assignments'] else array[]::text[] end) order by sp.candidate_code), '[]'::jsonb) from rush.screening_packets sp join rush.applications a on a.id = sp.application_id join rush.pnms pn on pn.id = a.pnm_id where sp.batch_id = b.id) end,
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
