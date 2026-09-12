-- Stage hashes: the member vote moves applicants between pipeline stages.
--
-- Until now Hash was one vote, held at DECISION_LOCK, whose result became a
-- decision row. The pipeline has since split into Speed Dating, Group Case and
-- Interview stages, and the chapter wants to vote at each cut, not only the
-- last one. A stage hash is the same secret ballot with a different ballot
-- (only applicants at that stage) and a different consequence (a status
-- change, not a decision). The final hash is untouched: it still needs
-- DECISION_LOCK and still writes a LOCKED, hash_derived decision.
--
-- Three design points:
--
--   1. The rules live in one place. Which statuses sit on a ballot, where a
--      YES sends them and who may vote are the whole difference between the
--      stages, so rush.hash_stage_rule owns them and every function reads from
--      it. The application stage excludes MEMBER: it is a paper screen the
--      board and recruitment committee run before anyone has met the
--      applicant, and members voting on strangers from a resume is what the
--      blind screening exists to avoid.
--
--   2. A vote carries its stage. The old unique key was (application, voter),
--      which would have let a Speed Dating vote overwrite an Application vote
--      for the same person, and would have made a stage tally count votes cast
--      at an earlier stage. Existing rows are FINAL votes, which is the only
--      kind that could exist before this migration.
--
--   3. Only one hash is open per cycle. rush.rush_cycles.hash_stage names it,
--      and null means none, except at DECISION_LOCK where the final hash is
--      implied as before. Opening a stage while another is open is refused
--      rather than silently switched, because members mid-vote would otherwise
--      have their next save land on a different ballot.

alter table rush.rush_cycles
  add column if not exists hash_stage text null
  check (hash_stage in ('APPLICATION', 'SPEED_DATING', 'GROUP_CASE'));

alter table rush.hash_votes
  add column if not exists stage text not null default 'FINAL'
  check (stage in ('APPLICATION', 'SPEED_DATING', 'GROUP_CASE', 'FINAL'));

alter table rush.hash_votes drop constraint if exists hash_votes_application_id_voter_id_key;
alter table rush.hash_votes
  add constraint hash_votes_application_voter_stage_key unique (application_id, voter_id, stage);

create or replace function rush.hash_stage_rule(stage text)
returns table (
  ballot_statuses rush.application_status[],
  pass_status rush.application_status,
  voter_roles rush.member_role[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.ballot_statuses, r.pass_status, r.voter_roles
  from (values
    ('APPLICATION',
      array['SUBMITTED', 'ELIGIBLE']::rush.application_status[],
      'INVITED'::rush.application_status,
      array['BOARD', 'RECRUITMENT_COMMITTEE', 'OWNER']::rush.member_role[]),
    ('SPEED_DATING',
      array['INVITED']::rush.application_status[],
      'GROUP_CASE'::rush.application_status,
      array['MEMBER', 'BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE']::rush.member_role[]),
    ('GROUP_CASE',
      array['GROUP_CASE']::rush.application_status[],
      'IN_PROCESS'::rush.application_status,
      array['MEMBER', 'BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE']::rush.member_role[]),
    ('FINAL',
      array['SUBMITTED', 'NEEDS_INFO', 'ELIGIBLE', 'INVITED', 'GROUP_CASE', 'IN_PROCESS',
            'FINAL_REVIEW', 'OFFERED', 'WAITLISTED', 'REJECTED']::rush.application_status[],
      null::rush.application_status,
      array['MEMBER', 'BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE']::rush.member_role[])
  ) as r(stage_name, ballot_statuses, pass_status, voter_roles)
  where r.stage_name = stage;
$$;

create or replace function rush.current_hash_stage(target_cycle_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  -- Decision lock wins over a stage the board forgot to close: the final vote
  -- must not be shadowed by a stale Group Case ballot.
  select case when c.status = 'DECISION_LOCK' then 'FINAL' else c.hash_stage end
  from rush.rush_cycles c
  where c.id = target_cycle_id;
$$;

create or replace function rush.open_hash_stage(target_cycle_id text, stage text, quorum int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  cycle_row rush.rush_cycles%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not rush.has_cycle_role(target_cycle_id, array['BOARD', 'OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into cycle_row from rush.rush_cycles where id = target_cycle_id for update;
  if cycle_row.id is null then raise exception 'cycle missing' using errcode = 'P0002'; end if;
  if cycle_row.status not in ('OPEN', 'IN_PROCESS') then
    raise exception 'cycle is not in process' using errcode = '55000';
  end if;
  if stage is null or stage not in ('APPLICATION', 'SPEED_DATING', 'GROUP_CASE') then
    raise exception 'invalid hash stage' using errcode = '22023';
  end if;
  if cycle_row.hash_stage is not null then
    raise exception 'a hash is already open' using errcode = '55000';
  end if;
  if quorum is null or quorum not between 1 and 500 then
    raise exception 'invalid quorum' using errcode = '22023';
  end if;

  update rush.rush_cycles c
  set hash_stage = stage, hash_quorum = quorum, updated_at = now()
  where c.id = cycle_row.id;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, cycle_row.id, 'HASH_STAGE_OPENED', 'Cycle', cycle_row.id,
          jsonb_build_object('stage', stage, 'quorum', quorum));
end;
$$;

-- Votes are kept: they carry their stage, so a tally of a closed stage is still
-- readable by reopening nothing, and a reopened stage picks them back up.
create or replace function rush.close_hash_stage(target_cycle_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  cycle_row rush.rush_cycles%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not rush.has_cycle_role(target_cycle_id, array['BOARD', 'OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into cycle_row from rush.rush_cycles where id = target_cycle_id for update;
  if cycle_row.id is null then raise exception 'cycle missing' using errcode = 'P0002'; end if;
  if cycle_row.hash_stage is null then return; end if;

  update rush.rush_cycles c set hash_stage = null, updated_at = now() where c.id = cycle_row.id;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, cycle_row.id, 'HASH_STAGE_CLOSED', 'Cycle', cycle_row.id,
          jsonb_build_object('stage', cycle_row.hash_stage));
end;
$$;

create or replace function rush.cast_hash_vote(target_application_id text, vote_value text, vote_note text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  app_row rush.applications%rowtype;
  open_stage text;
  rule record;
  clean_note text := coalesce(vote_note, '');
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into app_row from rush.applications where id = target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode = 'P0002'; end if;
  open_stage := rush.current_hash_stage(app_row.cycle_id);
  if open_stage is null then
    raise exception 'voting is not open' using errcode = '55000';
  end if;
  select * into rule from rush.hash_stage_rule(open_stage);
  if not rush.has_cycle_role(app_row.cycle_id, rule.voter_roles) then
    raise exception 'membership required' using errcode = '42501';
  end if;
  if exists (
    select 1 from rush.conflict_declarations cd
    where cd.application_id = app_row.id and cd.declarer_id = actor
  ) then
    raise exception 'conflict declared for this applicant' using errcode = '42501';
  end if;
  if not (app_row.status = any(rule.ballot_statuses)) then
    raise exception 'application is not votable' using errcode = '55000';
  end if;
  -- The page tells members they can change their vote "until the board applies
  -- the result", so stop accepting changes at exactly that point. Only the
  -- final hash writes a decision; a stage result changes the status, which
  -- takes the applicant off the ballot by itself.
  if open_stage = 'FINAL' and exists (
    select 1 from rush.decisions d
    where d.application_id = app_row.id
      and d.status in ('PENDING', 'APPROVED', 'LOCKED', 'RELEASED')
  ) then
    raise exception 'the result is already recorded' using errcode = '55000';
  end if;
  if vote_value is null or vote_value not in ('YES', 'NO', 'UNSURE') then
    raise exception 'invalid vote' using errcode = '22023';
  end if;
  if char_length(clean_note) > 1000 then
    raise exception 'note too long' using errcode = '22023';
  end if;

  insert into rush.hash_votes (cycle_id, application_id, voter_id, stage, vote, note)
  values (app_row.cycle_id, app_row.id, actor, open_stage, vote_value, clean_note)
  on conflict (application_id, voter_id, stage)
  do update set vote = excluded.vote, note = excluded.note, updated_at = now();

  -- No actor, and no application. Recording "Jane voted on applicant A at
  -- 8:04pm" alongside a board-readable tally hands the board the ballot: when A
  -- has one vote, the count IS Jane's vote, and the dossier page renders exactly
  -- these rows next to a name. Turnout is still countable from rush.hash_votes,
  -- which is the only thing the audit trail needed this row for.
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (null, app_row.cycle_id, 'HASH_VOTE_CAST', 'Cycle', app_row.cycle_id, '{}'::jsonb);
  return true;
end;
$$;

create or replace function rush.hash_ballot(target_cycle_id text)
returns table (id text, name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  open_stage text;
  rule record;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  -- No open vote is an empty list, not an error: the board's decision page
  -- reads this on every load, including the weeks when nothing is open.
  open_stage := rush.current_hash_stage(target_cycle_id);
  if open_stage is null then return; end if;
  select * into rule from rush.hash_stage_rule(open_stage);
  if not rush.has_cycle_role(target_cycle_id, rule.voter_roles) then
    raise exception 'membership required' using errcode = '42501';
  end if;

  return query
  select a.id, p.name
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where a.cycle_id = target_cycle_id
    and a.status = any(rule.ballot_statuses)
    -- Decided and withdrawn applicants were never on the final ballot and stay
    -- off it; a stage ballot never contains these statuses so the filter costs
    -- nothing, and it holds even if a future enum value widens the FINAL list.
    and a.status not in ('DRAFT', 'WITHDRAWN', 'REJECTED', 'OFFERED', 'WAITLISTED')
    and not exists (
      select 1 from rush.conflict_declarations cd
      where cd.application_id = a.id and cd.declarer_id = actor
    )
    -- Every row here must be one cast_hash_vote would accept, so an applicant
    -- whose result is already recorded drops off the ballot rather than
    -- handing the member an error when they press save.
    and not exists (
      select 1 from rush.decisions d
      where d.application_id = a.id
        and d.status in ('PENDING', 'APPROVED', 'LOCKED', 'RELEASED')
    )
  order by p.name;
end;
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
      when count(*) filter (where v.vote = 'YES') > count(*) filter (where v.vote = 'NO') then 'OFFER'
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

create or replace function rush.hash_notes(target_cycle_id text)
returns table (application_id text, note text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  open_stage text;
begin
  if rush.actor_id() is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not rush.has_cycle_role(
    target_cycle_id,
    array['BOARD', 'PANEL', 'OWNER']::rush.member_role[]
  ) then
    raise exception 'board role required' using errcode = '42501';
  end if;
  -- No open vote is an empty list, not an error: the board's decision page
  -- reads this on every load, including the weeks when nothing is open.
  open_stage := rush.current_hash_stage(target_cycle_id);
  if open_stage is null then return; end if;

  -- No voter_id, and no created_at: an ordered-by-time list of notes could be
  -- lined up against the audit log's HASH_VOTE_CAST timestamps to re-attribute
  -- them. Ordering by a hash of the row id breaks that correlation.
  return query
  select v.application_id, v.note
  from rush.hash_votes v
  where v.cycle_id = target_cycle_id
    and v.stage = open_stage
    and char_length(trim(v.note)) > 0
  order by v.application_id, extensions.digest(v.id, 'sha256');
end;
$$;

-- Unchanged from 20260902260000 except that the aggregate now counts only FINAL
-- votes, so a stage vote cast weeks earlier cannot leak into the final tally.
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

  computed_outcome := case when yes_votes > no_votes then 'OFFER' else 'REJECT' end;
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

-- A stage result is a status change, nothing more: no decision row, no
-- notification. The outcome is recomputed here and never taken from the
-- caller, for the same reason as apply_hash_result. A tie rejects, as it does
-- at the final hash. The second audit row is the one set_application_status
-- writes, so the dossier timeline shows the move the same way it shows a
-- manual one.
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

  next_status := case when yes_votes > no_votes then rule.pass_status else 'REJECTED'::rush.application_status end;
  update rush.applications a set status = next_status where a.id = app_row.id;

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

-- Applies every applicant on the open stage ballot that has reached quorum.
-- Applicants the actor has a conflict on are skipped, not failed, so one
-- roommate does not block the rest of the night; someone else applies theirs.
create or replace function rush.apply_stage_hash_results(target_cycle_id text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  cycle_row rush.rush_cycles%rowtype;
  open_stage text;
  rule record;
  target_id text;
  applied int := 0;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not rush.has_cycle_role(target_cycle_id, array['BOARD', 'OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into cycle_row from rush.rush_cycles where id = target_cycle_id;
  if cycle_row.id is null then raise exception 'cycle missing' using errcode = 'P0002'; end if;
  open_stage := rush.current_hash_stage(cycle_row.id);
  if open_stage is null or open_stage = 'FINAL' then
    raise exception 'no stage vote is open' using errcode = '55000';
  end if;
  select * into rule from rush.hash_stage_rule(open_stage);

  for target_id in
    select a.id
    from rush.applications a
    where a.cycle_id = cycle_row.id
      and a.status = any(rule.ballot_statuses)
      and not exists (
        select 1 from rush.conflict_declarations cd
        where cd.application_id = a.id and cd.declarer_id = actor
      )
      and (
        select count(*) from rush.hash_votes v
        where v.application_id = a.id and v.stage = open_stage
      ) >= cycle_row.hash_quorum
    order by a.id
  loop
    perform rush.apply_stage_hash_result(target_id);
    applied := applied + 1;
  end loop;
  return applied;
end;
$$;

revoke all on function
  rush.hash_stage_rule(text),
  rush.current_hash_stage(text),
  rush.open_hash_stage(text, text, int),
  rush.close_hash_stage(text),
  rush.cast_hash_vote(text, text, text),
  rush.hash_ballot(text),
  rush.hash_tally(text),
  rush.hash_notes(text),
  rush.apply_hash_result(text),
  rush.apply_stage_hash_result(text),
  rush.apply_stage_hash_results(text)
from public, anon;
grant execute on function
  rush.hash_stage_rule(text),
  rush.current_hash_stage(text),
  rush.open_hash_stage(text, text, int),
  rush.close_hash_stage(text),
  rush.cast_hash_vote(text, text, text),
  rush.hash_ballot(text),
  rush.hash_tally(text),
  rush.hash_notes(text),
  rush.apply_hash_result(text),
  rush.apply_stage_hash_result(text),
  rush.apply_stage_hash_results(text)
to authenticated, service_role;
