-- Follow-on hardening for the member hash vote.
--
-- Everything here belongs logically to 20260902230000, but that migration is
-- already applied to production, so editing it in place would leave the repo
-- describing a database that does not exist. These are the same statements,
-- delivered as a migration that can actually run.
--
-- Four defects, all in the voting path:
--
--   1. A tally-derived decision could never be released. apply_hash_result
--      wrote a LOCKED decision with no decision_approvals rows, release_decision
--      demands two, and approve_decision refuses anything already LOCKED, so
--      there was no repair path. A full membership vote is a stronger mandate
--      than two panel sign-offs, so decisions now carry hash_derived and
--      release_decision accepts that in place of the approval count.
--
--   2. The audit row leaked the ballot. "Jane voted on applicant A at 8:04pm"
--      renders on the applicant dossier next to Jane's name, and the board can
--      read the tally, so for any applicant with a single vote the count was
--      Jane's vote. The row now records only that a vote happened in the cycle.
--      Turnout stays countable from rush.hash_votes.
--
--   3. apply_hash_result skipped guards that rush.create_decision enforces, so a
--      withdrawn applicant could be given an offer from a stale tally, and a
--      board member who had declared a conflict could record the outcome for
--      their own roommate.
--
--   4. Voting stayed open after a result was recorded, and decided applicants
--      stayed on the ballot, so a member could vote and then hit an error on
--      save.

alter table rush.decisions
  add column if not exists hash_derived boolean not null default false;

create or replace function rush.cast_hash_vote(target_application_id text, vote_value text, vote_note text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  app_row rush.applications%rowtype;
  clean_note text := coalesce(vote_note, '');
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into app_row from rush.applications where id = target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(
    app_row.cycle_id,
    array['MEMBER', 'BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE']::rush.member_role[]
  ) then
    raise exception 'membership required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from rush.rush_cycles c where c.id = app_row.cycle_id and c.status = 'DECISION_LOCK'
  ) then
    raise exception 'voting is not open' using errcode = '55000';
  end if;
  if exists (
    select 1 from rush.conflict_declarations cd
    where cd.application_id = app_row.id and cd.declarer_id = actor
  ) then
    raise exception 'conflict declared for this applicant' using errcode = '42501';
  end if;
  if app_row.status in ('DRAFT', 'WITHDRAWN') then
    raise exception 'application is not votable' using errcode = '55000';
  end if;
  -- The page tells members they can change their vote "until the board applies
  -- the result", so stop accepting changes at exactly that point. Otherwise the
  -- tally drifts away from the frozen counts in decision.reason and the two
  -- disagree with no way to tell which one decided anything.
  if exists (
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

  insert into rush.hash_votes (cycle_id, application_id, voter_id, vote, note)
  values (app_row.cycle_id, app_row.id, actor, vote_value, clean_note)
  on conflict (application_id, voter_id)
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
  if not rush.has_cycle_role(app_row.cycle_id, array['BOARD', 'PANEL', 'OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into cycle_row from rush.rush_cycles where id = app_row.cycle_id;
  if cycle_row.status <> 'DECISION_LOCK' then
    raise exception 'voting is not open' using errcode = '55000';
  end if;

  -- The outcome is recomputed here and never taken from the caller: a board
  -- member applying a result must not be able to apply a different one.
  select
    count(*) filter (where v.vote = 'YES')::int,
    count(*) filter (where v.vote = 'NO')::int,
    count(*) filter (where v.vote = 'UNSURE')::int,
    count(*)::int
  into yes_votes, no_votes, unsure_votes, total_cast
  from rush.hash_votes v
  where v.application_id = app_row.id;
  if total_cast < cycle_row.hash_quorum then
    raise exception 'not enough votes yet' using errcode = '55000';
  end if;
  -- rush.create_decision blocks these and this path must not be the soft way
  -- around them: a withdrawn applicant can still hold a passing tally from
  -- before they withdrew, and a conflicted board member must not be the one who
  -- records their own roommate's outcome.
  if app_row.status in ('DRAFT', 'WITHDRAWN') then
    raise exception 'application is not votable' using errcode = '55000';
  end if;
  if exists (
    select 1 from rush.conflict_declarations cd
    where cd.application_id = app_row.id and cd.declarer_id = actor
  ) then
    raise exception 'conflict declared for this applicant' using errcode = '42501';
  end if;

  select d.id into existing_id
  from rush.decisions d
  where d.application_id = app_row.id
    and d.status in ('PENDING', 'APPROVED', 'LOCKED', 'RELEASED');
  if existing_id is not null then return existing_id; end if;

  computed_outcome := case when yes_votes > no_votes then 'OFFER' else 'REJECT' end;
  insert into rush.decisions (cycle_id, application_id, outcome, status, reason, created_by_id, locked_at, hash_derived)
  values (app_row.cycle_id, app_row.id, computed_outcome, 'LOCKED',
          format('Member vote: %s yes, %s no, %s unsure', yes_votes, no_votes, unsure_votes),
          actor, now(), true)
  returning id into result_id;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, app_row.cycle_id, 'HASH_RESULT_APPLIED', 'Decision', result_id,
          jsonb_build_object(
            'applicationId', app_row.id,
            'yesCount', yes_votes,
            'noCount', no_votes,
            'unsureCount', unsure_votes,
            'totalVotes', total_cast,
            'quorum', cycle_row.hash_quorum,
            'outcome', computed_outcome
          ));
  return result_id;
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
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not rush.has_cycle_role(
    target_cycle_id,
    array['MEMBER', 'BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE']::rush.member_role[]
  ) then
    raise exception 'membership required' using errcode = '42501';
  end if;

  return query
  select a.id, p.name
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where a.cycle_id = target_cycle_id
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

create or replace function rush.release_decision(target_decision_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d rush.decisions%rowtype;
  valid_approvals bigint;
begin
  select * into d from rush.decisions where id=target_decision_id for update;
  if d.id is null then raise exception 'decision missing' using errcode='P0002'; end if;
  if not rush.has_cycle_role(d.cycle_id,array['PANEL','OWNER']::rush.member_role[]) then raise exception 'panel role required' using errcode='42501'; end if;
  if exists(select 1 from rush.conflict_declarations where application_id=d.application_id and declarer_id=rush.actor_id()) then raise exception 'conflict declared' using errcode='42501'; end if;
  select count(*) into valid_approvals from rush.decision_approvals da join rush.profiles p on p.id=da.approver_id and p.active
  where da.decision_id=d.id and exists(select 1 from rush.memberships m where m.user_id=da.approver_id and m.cycle_id=d.cycle_id and m.active and m.role in ('PANEL','OWNER'))
    and not exists(select 1 from rush.conflict_declarations c where c.application_id=d.application_id and c.declarer_id=da.approver_id);
  if d.status<>'LOCKED' or (valid_approvals<2 and not d.hash_derived) then raise exception 'decision not locked' using errcode='55000'; end if;
  perform 1 from rush.applications where id=d.application_id for update;
  update rush.applications set status=case d.outcome when 'OFFER' then 'OFFERED'::rush.application_status when 'WAITLIST' then 'WAITLISTED'::rush.application_status when 'REJECT' then 'REJECTED'::rush.application_status else 'FINAL_REVIEW'::rush.application_status end where id=d.application_id;
  update rush.decisions set status='RELEASED',released_at=now() where id=d.id and status='LOCKED';
  insert into rush.notification_outbox (cycle_id, application_id, decision_id, recipient, template_key, template_version, idempotency_key)
  select d.cycle_id, d.application_id, d.id, p.contact, 'DECISION_RELEASED', 1, 'decision-release:' || d.id
  from rush.applications a join rush.pnms p on p.id=a.pnm_id where a.id=d.application_id
  on conflict (decision_id, template_key, template_version) do nothing;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(rush.actor_id(),d.cycle_id,'DECISION_RELEASED','Decision',d.id);
end;
$$;
