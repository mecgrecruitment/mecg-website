-- A member can take a hash vote back. The phone shows Yes, Unsure and No as
-- one segmented control and a thumb lands on the wrong one often enough; the
-- old rule was that the only way out was to pick a different answer. Tapping
-- the selected answer again now sends a null vote and cast_hash_vote deletes
-- the row. Body copied from 20260912120000 with only that branch added; no
-- data is touched.
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
  -- A null vote takes the member's vote back: a slip of the thumb should not
  -- count. Every check above still applies, so nothing changes once the board
  -- has stamped the applicant.
  if vote_value is null then
    delete from rush.hash_votes v
    where v.application_id = app_row.id and v.voter_id = actor and v.stage = open_stage;
    insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
    values (null, app_row.cycle_id, 'HASH_VOTE_WITHDRAWN', 'Cycle', app_row.cycle_id, '{}'::jsonb);
    return true;
  end if;
  if vote_value not in ('YES', 'NO', 'UNSURE') then
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
revoke all on function rush.cast_hash_vote(text, text, text) from public, anon;
grant execute on function rush.cast_hash_vote(text, text, text) to authenticated, service_role;
