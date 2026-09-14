-- Presenting at hash: the projector deck walks one applicant at a time and
-- members' phones follow it.
--
-- The deck already shows the board every Speed Dating and Group Case score
-- and note for the applicant on screen. Members in the room see only the
-- projector, which is too far away to read a paragraph of grader notes from,
-- so the phone gets the same notes for the same applicant. Two pieces:
--
--   1. rush.rush_cycles.hash_presenting_application_id is the cursor. It is a
--      pointer, not a decision, so moving it writes no audit row; deleting
--      the application clears it rather than blocking the delete.
--
--   2. rush.hash_applicant_notes hands a member the grader notes for one
--      applicant. It is gated the way the ballot is: a hash must be open, the
--      caller must hold a role that votes in it, and the applicant must be on
--      that ballot. Hash vote notes are deliberately NOT included: those stay
--      board-only in rush.hash_notes, since a member reading "3 people said
--      no" before voting is the thing a secret ballot exists to prevent.

alter table rush.rush_cycles
  add column if not exists hash_presenting_application_id text null
  references rush.applications(id) on delete set null;

create or replace function rush.set_hash_presenting(target_cycle_id text, target_application_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not rush.has_cycle_role(target_cycle_id, array['BOARD', 'OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target_application_id is not null and not exists (
    select 1 from rush.applications a
    where a.id = target_application_id and a.cycle_id = target_cycle_id
  ) then
    raise exception 'application missing' using errcode = 'P0002';
  end if;

  update rush.rush_cycles c
  set hash_presenting_application_id = target_application_id, updated_at = now()
  where c.id = target_cycle_id;
  if not found then raise exception 'cycle missing' using errcode = 'P0002'; end if;
end;
$$;

create or replace function rush.hash_applicant_notes(target_application_id text)
returns table (source text, note text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  app_row rush.applications%rowtype;
  open_stage text;
  rule record;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into app_row from rush.applications where id = target_application_id;
  if app_row.id is null then raise exception 'application missing' using errcode = 'P0002'; end if;
  -- No open vote is an empty list, not an error: the phone polls this on
  -- every load, including after the board closes the stage.
  open_stage := rush.current_hash_stage(app_row.cycle_id);
  if open_stage is null then return; end if;
  select * into rule from rush.hash_stage_rule(open_stage);
  if not rush.has_cycle_role(app_row.cycle_id, rule.voter_roles) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (app_row.status = any(rule.ballot_statuses)) then return; end if;
  -- Same recusal as cast_hash_vote: a declared conflict means no notes either.
  if rush.actor_has_application_conflict(app_row.id) then return; end if;

  -- Group Case writes its note to evaluations.evidence; Speed Dating writes
  -- it to the single criterion rating (rate_speed_dating_applicant), so read
  -- whichever the round filled in.
  -- No evaluator id, and no timestamps: ordering by a hash of the row id keeps
  -- a note from being lined up against the roster to re-attribute it.
  return query
  select round.kind, written.note
  from rush.evaluation_assignments assignment
  join rush.rounds round
    on round.id = assignment.round_id
   and round.cycle_id = app_row.cycle_id
   and round.kind in ('SPEED_DATING', 'GROUP_CASE')
  join lateral (
    select evaluation.id, evaluation.evidence
    from rush.evaluations evaluation
    where evaluation.assignment_id = assignment.id
      and evaluation.voided_at is null
      and evaluation.status in ('SUBMITTED', 'LOCKED')
    order by evaluation.version desc
    limit 1
  ) evaluation on true
  cross join lateral (
    select coalesce(
      nullif(trim(evaluation.evidence), ''),
      (
        select nullif(trim(rating.note), '')
        from rush.criterion_ratings rating
        join rush.rubric_criteria criterion on criterion.id = rating.criterion_id
        where rating.evaluation_id = evaluation.id
        order by criterion.position
        limit 1
      )
    ) note
  ) written
  where assignment.application_id = app_row.id
    and written.note is not null
  order by round.kind, extensions.digest(evaluation.id, 'sha256');
end;
$$;

revoke all on function
  rush.set_hash_presenting(text, text),
  rush.hash_applicant_notes(text)
from public, anon;
grant execute on function
  rush.set_hash_presenting(text, text),
  rush.hash_applicant_notes(text)
to authenticated, service_role;

-- The phone ballot pins the applicant being presented at hash with a headshot.
-- Members who may vote in the open stage may open it while that applicant is
-- on the ballot, on top of the Speed Dating window above. The conflict recusal
-- after it still applies.
create or replace function rush.authorize_headshot_access(target_application_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  target_application rush.applications%rowtype;
  open_stage text;
  rule record;
  on_ballot boolean := false;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  select * into target_application
  from rush.applications
  where id = target_application_id;

  if target_application.id is null then
    raise exception 'headshot not found' using errcode = 'P0002';
  end if;
  open_stage := rush.current_hash_stage(target_application.cycle_id);
  if open_stage is not null then
    select * into rule from rush.hash_stage_rule(open_stage);
    on_ballot := target_application.status = any(rule.ballot_statuses)
      and rush.has_cycle_role(target_application.cycle_id, rule.voter_roles);
  end if;
  if not rush.has_cycle_capability(target_application.cycle_id, 'CANDIDATE_ACCESS')
     and not on_ballot
     and not exists (
       select 1 from rush.evaluation_assignments assignment
       where assignment.application_id = target_application.id and assignment.evaluator_id = actor
     )
     and not (
       rush.has_cycle_role(target_application.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
       and exists (
         select 1
         from rush.round_participations participation
         join rush.rounds round on round.id = participation.round_id
         where participation.application_id = target_application.id
           and round.kind = 'SPEED_DATING'
           and round.status in ('PUBLISHED','ACTIVE')
       )
     ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if rush.actor_has_application_conflict(target_application.id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target_application.headshot_storage_path is null then
    raise exception 'headshot not found' using errcode = 'P0002';
  end if;

  return target_application.headshot_storage_path;
end;
$$;
revoke all on function rush.authorize_headshot_access(text) from public, anon;
grant execute on function rush.authorize_headshot_access(text) to authenticated, service_role;
