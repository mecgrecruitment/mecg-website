-- A pass now needs 60% Yes, not a bare majority of Yes over No.
--
-- The board's rule for the room: an applicant moves forward when at least
-- three in five of everyone who voted on them said Yes. Unsure sits in the
-- denominator, so "I can't tell" counts against, the same as it would in the
-- room. One helper owns the arithmetic and the three places that decided
-- (the tally, the stage apply, the final apply) call it; the bodies below are
-- copied from 20260912120000 and 20260913150000 with only that line changed.
-- Integer math on purpose: yes * 5 >= total * 3 has no rounding to argue over.
create or replace function rush.hash_passes(yes_votes int, total_cast int)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select total_cast > 0 and yes_votes * 5 >= total_cast * 3;
$$;

create or replace function rush.hash_tally(target_cycle_id text)
returns table (
  application_id text,
  yes_count int,
  no_count int,
  unsure_count int,
  total_votes int,
  quorum int,
  outcome text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cycle_quorum int;
  open_stage text;
  rule record;
begin
  if rush.actor_id() is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  -- Board only. `grant execute ... to authenticated` means any member could
  -- call this straight from a browser console, and a live running count is
  -- exactly what a secret ballot must not expose: seeing an applicant sitting
  -- at 3 yes / 9 no tells you how to vote. Members read the quorum they need
  -- from rush.rush_cycles.hash_quorum instead, which carries no counts.
  if not rush.has_cycle_role(
    target_cycle_id,
    array['BOARD', 'PANEL', 'OWNER']::rush.member_role[]
  ) then
    raise exception 'board role required' using errcode = '42501';
  end if;
  select c.hash_quorum into cycle_quorum from rush.rush_cycles c where c.id = target_cycle_id;
  if cycle_quorum is null then raise exception 'cycle missing' using errcode = 'P0002'; end if;
  -- No open vote is an empty list, not an error: the board's decision page
  -- reads this on every load, including the weeks when nothing is open.
  open_stage := rush.current_hash_stage(target_cycle_id);
  if open_stage is null then return; end if;
  select * into rule from rush.hash_stage_rule(open_stage);

  return query
  select a.id,
    count(*) filter (where v.vote = 'YES')::int,
    count(*) filter (where v.vote = 'NO')::int,
    count(*) filter (where v.vote = 'UNSURE')::int,
    count(v.id)::int,
    cycle_quorum,
    case
      when count(v.id) < cycle_quorum then 'PENDING'
      when rush.hash_passes(count(*) filter (where v.vote = 'YES')::int, count(v.id)::int) then 'OFFER'
      else 'REJECT'
    end
  from rush.applications a
  left join rush.hash_votes v on v.application_id = a.id and v.stage = open_stage
  where a.cycle_id = target_cycle_id
    and a.status = any(rule.ballot_statuses)
  group by a.id
  order by a.id;
end;
$$;

create or replace function rush.apply_hash_result(target_application_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  app_row rush.applications%rowtype;
  cycle_row rush.rush_cycles%rowtype;
  yes_votes int;
  no_votes int;
  unsure_votes int;
  total_cast int;
  computed_outcome rush.decision_outcome;
  existing_id text;
  result_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into app_row from rush.applications where id = target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(app_row.cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into cycle_row from rush.rush_cycles where id = app_row.cycle_id;
  if cycle_row.status <> 'DECISION_LOCK' then raise exception 'voting is not open' using errcode = '55000'; end if;
  if app_row.status in ('DRAFT','WITHDRAWN') then raise exception 'application is not votable' using errcode = '55000'; end if;
  if exists (select 1 from rush.conflict_declarations where application_id = app_row.id and declarer_id = actor) then raise exception 'conflict declared for this applicant' using errcode = '42501'; end if;
  perform rush.assert_decision_ready(app_row.id);

  select count(*) filter (where vote = 'YES')::int,
         count(*) filter (where vote = 'NO')::int,
         count(*) filter (where vote = 'UNSURE')::int,
         count(*)::int
  into yes_votes, no_votes, unsure_votes, total_cast
  from rush.hash_votes v where v.application_id = app_row.id and v.stage = 'FINAL';
  if total_cast < cycle_row.hash_quorum then raise exception 'not enough votes yet' using errcode = '55000'; end if;

  select id into existing_id from rush.decisions
  where application_id = app_row.id and status in ('PENDING','APPROVED','LOCKED','RELEASED');
  if existing_id is not null then return existing_id; end if;

  computed_outcome := case when rush.hash_passes(yes_votes, total_cast) then 'OFFER' else 'REJECT' end;
  insert into rush.decisions (cycle_id, application_id, outcome, status, reason, created_by_id, locked_at, hash_derived)
  values (app_row.cycle_id, app_row.id, computed_outcome, 'LOCKED',
          format('Member vote: %s yes, %s no, %s unsure', yes_votes, no_votes, unsure_votes), actor, now(), true)
  returning id into result_id;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, app_row.cycle_id, 'HASH_RESULT_APPLIED', 'Decision', result_id,
          jsonb_build_object('applicationId', app_row.id, 'yesCount', yes_votes, 'noCount', no_votes,
                            'unsureCount', unsure_votes, 'totalVotes', total_cast,
                            'quorum', cycle_row.hash_quorum, 'outcome', computed_outcome));
  return result_id;
end;
$$;

create or replace function rush.apply_stage_hash_result(target_application_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  app_row rush.applications%rowtype;
  cycle_row rush.rush_cycles%rowtype;
  open_stage text;
  rule record;
  yes_votes int;
  no_votes int;
  unsure_votes int;
  total_cast int;
  next_status rush.application_status;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into app_row from rush.applications where id = target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(app_row.cycle_id, array['BOARD', 'OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into cycle_row from rush.rush_cycles where id = app_row.cycle_id;
  open_stage := rush.current_hash_stage(cycle_row.id);
  if open_stage is null or open_stage = 'FINAL' then
    raise exception 'no stage vote is open' using errcode = '55000';
  end if;
  select * into rule from rush.hash_stage_rule(open_stage);
  if not (app_row.status = any(rule.ballot_statuses)) then
    raise exception 'application is not on this ballot' using errcode = '55000';
  end if;
  if exists (
    select 1 from rush.conflict_declarations cd
    where cd.application_id = app_row.id and cd.declarer_id = actor
  ) then
    raise exception 'conflict declared for this applicant' using errcode = '42501';
  end if;

  select
    count(*) filter (where v.vote = 'YES')::int,
    count(*) filter (where v.vote = 'NO')::int,
    count(*) filter (where v.vote = 'UNSURE')::int,
    count(*)::int
  into yes_votes, no_votes, unsure_votes, total_cast
  from rush.hash_votes v
  where v.application_id = app_row.id and v.stage = open_stage;
  if total_cast < cycle_row.hash_quorum then
    raise exception 'not enough votes yet' using errcode = '55000';
  end if;

  next_status := case when rush.hash_passes(yes_votes, total_cast) then rule.pass_status else 'REJECTED'::rush.application_status end;
  if next_status = 'INVITED' then
    -- Speed Dating enrollment and evaluator staffing live in one place.
    perform rush.advance_to_speed_dating(app_row.cycle_id, array[app_row.id]);
  else
    update rush.applications a set status = next_status where a.id = app_row.id;
  end if;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, app_row.cycle_id, 'HASH_STAGE_RESULT_APPLIED', 'Application', app_row.id,
          jsonb_build_object(
            'stage', open_stage,
            'yesCount', yes_votes,
            'noCount', no_votes,
            'unsureCount', unsure_votes,
            'quorum', cycle_row.hash_quorum,
            'from', app_row.status,
            'to', next_status
          ));
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, app_row.cycle_id, 'APPLICATION_STATUS_CHANGED', 'Application', app_row.id,
          jsonb_build_object('from', app_row.status, 'to', next_status));
  return next_status::text;
end;
$$;

revoke all on function
  rush.hash_passes(int, int),
  rush.hash_tally(text),
  rush.apply_hash_result(text),
  rush.apply_stage_hash_result(text)
from public, anon;
grant execute on function
  rush.hash_passes(int, int),
  rush.hash_tally(text),
  rush.apply_hash_result(text),
  rush.apply_stage_hash_result(text)
to authenticated, service_role;
