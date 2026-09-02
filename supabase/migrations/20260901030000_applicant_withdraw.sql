-- WITHDRAWN was an unreachable status. It is in rush.application_status, four
-- guards check for it, and the applicant portal renders a whole "Application
-- withdrawn" branch, but nothing could ever set it: rush.set_application_status
-- explicitly refuses the outcome statuses, and no applicant-facing RPC existed.
-- So every one of those guards was dead code and an applicant who wanted out
-- had to email the board and ask someone to edit the database.
--
-- Withdrawal is the applicant's own decision, so it is theirs to make. It stays
-- off set_application_status: staff moving someone to WITHDRAWN on their behalf
-- is exactly the ambiguity the existing refusal was protecting against.
create or replace function rush.withdraw_application(target_application_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  app_row rush.applications%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  select * into app_row from rush.applications a
  where a.id = target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode = 'P0002'; end if;

  if not exists (
    select 1 from rush.pnms p
    where p.id = app_row.pnm_id and p.auth_user_id = actor
  ) then raise exception 'forbidden' using errcode = '42501'; end if;

  -- A DRAFT was never submitted, so there is nothing to withdraw from; the
  -- applicant can simply not finish it. The rest are already final.
  if app_row.status in ('DRAFT', 'WITHDRAWN', 'REJECTED') then
    raise exception 'application cannot be withdrawn' using errcode = '55000';
  end if;

  update rush.applications a
  set status = 'WITHDRAWN', updated_at = now()
  where a.id = app_row.id;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, app_row.cycle_id, 'APPLICATION_WITHDRAWN', 'Application', app_row.id,
          jsonb_build_object('previousStatus', app_row.status));
  return true;
end;
$$;
revoke all on function rush.withdraw_application(text) from public, anon;
grant execute on function rush.withdraw_application(text) to authenticated, service_role;
