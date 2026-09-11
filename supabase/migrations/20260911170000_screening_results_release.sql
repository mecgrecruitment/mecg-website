-- Closing the review used to publish the ranking to every Board member at
-- once, with a name-stripped copy for the Recruitment Committee. Hash needs
-- everyone in the room looking at the same table at the same moment, so the
-- ranking now stays with Owners until one of them releases it. Release hands
-- Board and the Recruitment Committee the full ranking: names, readers,
-- evidence and rating notes.
alter table rush.screening_batches add column released_at timestamptz;

create or replace function rush.release_screening_results(target_batch_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  target_cycle text;
  batch_status text;
  already_released_at timestamptz;
begin
  select b.cycle_id, b.status, b.released_at into target_cycle, batch_status, already_released_at
  from rush.screening_batches b
  where b.id = target_batch_id
  for update;
  if actor is null or target_cycle is null or not rush.has_cycle_role(target_cycle, array['OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if batch_status <> 'FROZEN' then
    raise exception 'close the review before releasing scores' using errcode = '55000';
  end if;
  if already_released_at is not null then
    return;
  end if;
  update rush.screening_batches set released_at = now() where id = target_batch_id;
  insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id)
  values (actor, target_cycle, 'SCREENING_RESULTS_RELEASED', 'ScreeningBatch', target_batch_id);
end;
$$;
revoke all on function rush.release_screening_results(text) from public, anon;
grant execute on function rush.release_screening_results(text) to authenticated, service_role;

-- Results now carry releasedAt and are withheld from everyone but Owners until
-- it is set. After release nothing is stripped: Board and the Committee see
-- the same table Owners saw. Packet identity keeps its pre-release rule and
-- opens up on release for the same reason.
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
        'releasedAt', b.released_at,
        'reviewsPerApplication', b.reviews_per_application,
        'reviewers', (select coalesce(jsonb_agg(jsonb_build_object('id', sr.reviewer_id, 'name', p.display_name, 'capacity', sr.capacity, 'assigned', (select count(*) from rush.screening_assignments sa join rush.screening_packets sp on sp.id = sa.packet_id where sp.batch_id = b.id and sa.reviewer_id = sr.reviewer_id and sa.status <> 'RECUSED'), 'submitted', (select count(*) from rush.screening_assignments sa join rush.screening_packets sp on sp.id = sa.packet_id where sp.batch_id = b.id and sa.reviewer_id = sr.reviewer_id and sa.status in ('SUBMITTED', 'LOCKED'))) order by p.display_name), '[]'::jsonb) from rush.screening_reviewers sr join rush.profiles p on p.id = sr.reviewer_id where sr.batch_id = b.id and sr.active),
        'packets', case when exists (select 1 from rush.screening_reviewers sr where sr.batch_id = b.id and sr.reviewer_id = rush.actor_id() and sr.active) or rush.is_active_screening_reviewer(target_cycle_id) then '[]'::jsonb else (select coalesce(jsonb_agg((jsonb_build_object('id', sp.id, 'code', sp.candidate_code, 'status', sp.redaction_status, 'applicantName', pn.name, 'content', sp.content, 'assignments', (select coalesce(jsonb_agg(jsonb_build_object('reviewerId', sa.reviewer_id, 'reviewerName', rp.display_name, 'status', sa.status) order by rp.display_name), '[]'::jsonb) from rush.screening_assignments sa join rush.profiles rp on rp.id = sa.reviewer_id where sa.packet_id = sp.id)) - case when b.status = 'FROZEN' and b.released_at is null and not rush.has_cycle_role(target_cycle_id, array['BOARD', 'OWNER']::rush.member_role[]) then array['applicantName', 'content', 'assignments'] else array[]::text[] end) order by sp.candidate_code), '[]'::jsonb) from rush.screening_packets sp join rush.applications a on a.id = sp.application_id join rush.pnms pn on pn.id = a.pnm_id where sp.batch_id = b.id) end,
        'assigned', (select count(*) from rush.screening_assignments sa join rush.screening_packets sp on sp.id = sa.packet_id where sp.batch_id = b.id and sa.status <> 'RECUSED'),
        'submitted', (select count(*) from rush.screening_assignments sa join rush.screening_packets sp on sp.id = sa.packet_id where sp.batch_id = b.id and sa.status in ('SUBMITTED', 'LOCKED')),
        'results', case when b.status = 'FROZEN' and (b.released_at is not null or rush.has_cycle_role(target_cycle_id, array['OWNER']::rush.member_role[])) then (
          select coalesce(jsonb_agg(jsonb_build_object(
            'code', sp.candidate_code,
            'applicationId', sp.application_id,
            'applicantName', pn.name,
            'classYear', pn.class_year,
            'major', pn.major,
            'events', (select coalesce(jsonb_agg(ev.name order by ev.starts_at), '[]'::jsonb) from rush.checkins ck join rush.events ev on ev.id = ck.event_id where ck.pnm_id = pn.id and ev.cycle_id = target_cycle_id),
            'reviewerId', sr.reviewer_id,
            'reviewerName', rp.display_name,
            'recommendation', sr.recommendation,
            'score', sr.score,
            'evidence', sr.evidence,
            'submittedAt', sr.submitted_at,
            'ratings', (
              select coalesce(jsonb_agg(jsonb_build_object('key', rc.key, 'name', rc.name, 'weight', rc.weight, 'score', rt.score, 'note', rt.note) order by rc.position), '[]'::jsonb)
              from rush.screening_ratings rt
              join rush.rubric_criteria rc on rc.id = rt.criterion_id
              where rt.review_id = sr.id
            )
          ) order by sp.candidate_code, sr.submitted_at), '[]'::jsonb)
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
