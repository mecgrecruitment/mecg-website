-- One round trip for the member Hash poll.
--
-- Every member phone on the Hash page polls /api/member/hash/live every three
-- seconds. The route used to make six PostgREST requests per poll (actor_id,
-- profile, memberships, the presenting row, hash_ballot, hash_applicant_notes),
-- and PostgREST's per-request cost, not the database, capped throughput: a
-- local load test of 1000 polling laptops saturated PostgREST at ~35 polls/s
-- with the database under 40% busy. This function answers a poll in one call.
--
-- The gate is the route's old one: an active profile, and an active membership
-- with workspace access in the selected cycle (or the newest such cycle when
-- none is selected). A Recruitment Committee seat loses workspace access once
-- its cycle is CLOSED or ARCHIVED, as in src/lib/authorization.ts. Visibility
-- is still hash_ballot's and hash_applicant_notes', called as before.

create or replace function rush.member_hash_live(target_cycle_id text, target_application_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  cycle_row rush.rush_cycles%rowtype;
  presenting jsonb;
  shown text;
  notes jsonb := '[]'::jsonb;
begin
  if actor is null or not exists (select 1 from rush.profiles p where p.id = actor and p.active) then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  select c.* into cycle_row
  from rush.memberships m
  join rush.rush_cycles c on c.id = m.cycle_id
  where m.user_id = actor
    and m.active
    and (target_cycle_id is null or m.cycle_id = target_cycle_id)
    and m.role in ('MEMBER', 'BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE')
    and not (m.role = 'RECRUITMENT_COMMITTEE' and c.status in ('CLOSED', 'ARCHIVED'))
  order by c.created_at desc
  limit 1;
  if cycle_row.id is null then raise exception 'forbidden' using errcode = '42501'; end if;

  -- The ballot is the visibility boundary for both the presenter and a
  -- requested applicant; it is computed once and read twice.
  with ballot as (select * from rush.hash_ballot(cycle_row.id))
  select
    (select to_jsonb(b) from ballot b where b.id = cycle_row.hash_presenting_application_id),
    (select b.id from ballot b where b.id = coalesce(nullif(target_application_id, ''), cycle_row.hash_presenting_application_id))
  into presenting, shown;

  if shown is not null then
    select coalesce(jsonb_agg(jsonb_build_object('source', n.source, 'note', n.note) order by n.position), '[]'::jsonb)
    into notes
    from rush.hash_applicant_notes(shown) with ordinality as n(source, note, position);
  end if;

  return jsonb_build_object(
    'cycleId', cycle_row.id,
    'presenting', presenting,
    'applicationId', shown,
    'notes', notes
  );
end;
$$;

revoke all on function rush.member_hash_live(text, text) from public, anon;
grant execute on function rush.member_hash_live(text, text) to authenticated, service_role;
