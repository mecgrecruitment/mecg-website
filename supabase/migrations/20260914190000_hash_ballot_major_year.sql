-- The phone ballot pins the applicant being presented; the room wants to see
-- major and year under the name, the same line the projector shows. Return
-- type changes need a drop, so the body is copied from 20260912120000 with
-- only the two extra columns.
drop function if exists rush.hash_ballot(text);

create or replace function rush.hash_ballot(target_cycle_id text)
returns table (id text, name text, major text, class_year text)
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
  select a.id, p.name, p.major, p.class_year::text
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

revoke all on function rush.hash_ballot(text) from public, anon;
grant execute on function rush.hash_ballot(text) to authenticated, service_role;
