-- An offer had no deadline. The applicant saw Accept and Decline with nothing
-- telling them how long they had, and the board had no way to close out a
-- cohort except by asking people individually.
--
-- The deadline is advisory until it passes and then it is enforced, in
-- respond_to_offer rather than in the UI, so a stale page cannot accept an
-- offer that expired while it sat open.
alter table rush.applications
  add column if not exists offer_expires_at timestamptz;

create or replace function rush.set_offer_deadline(target_application_id text, expires_at timestamptz)
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
  select * into app_row from rush.applications where id = target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(app_row.cycle_id, array['PANEL','OWNER']::rush.member_role[]) then
    raise exception 'panel role required' using errcode = '42501';
  end if;
  if expires_at is not null and expires_at <= now() then
    raise exception 'deadline must be in the future' using errcode = '22023';
  end if;
  if app_row.offer_response is not null then
    raise exception 'offer already answered' using errcode = '55000';
  end if;

  update rush.applications a set offer_expires_at = expires_at, updated_at = now()
  where a.id = app_row.id;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, app_row.cycle_id, 'OFFER_DEADLINE_SET', 'Application', app_row.id,
          jsonb_build_object('expiresAt', expires_at));
  return true;
end;
$$;

revoke all on function rush.set_offer_deadline(text, timestamptz) from public, anon;
grant execute on function rush.set_offer_deadline(text, timestamptz) to authenticated, service_role;

-- Reproduced from 20260830100000 with one added condition: an expired offer can
-- no longer be answered. Everything else, including the row lock and the
-- single-response guard, is unchanged.
create or replace function rush.respond_to_offer(target_application_id text, accept boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  app_row rush.applications%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if accept is null then raise exception 'response required' using errcode='22023'; end if;
  select a.* into app_row from rush.applications a where a.id=target_application_id for update;
  if app_row.id is null then raise exception 'no offer' using errcode='P0002'; end if;
  if not exists (select 1 from rush.pnms p where p.id=app_row.pnm_id and p.auth_user_id=actor) then raise exception 'forbidden' using errcode='42501'; end if;
  if app_row.status<>'OFFERED' or not exists (select 1 from rush.decisions d where d.application_id=app_row.id and d.outcome='OFFER' and d.status='RELEASED') then raise exception 'no released offer' using errcode='42501'; end if;
  if app_row.offer_response is not null then raise exception 'offer already answered' using errcode='55000'; end if;
  if app_row.offer_expires_at is not null and app_row.offer_expires_at <= now() then
    raise exception 'offer expired' using errcode='55000';
  end if;
  update rush.applications a set offer_response=case when accept then 'ACCEPTED' else 'DECLINED' end,offer_responded_at=now() where a.id=app_row.id;
  insert into rush.audit_events (actor_id,cycle_id,action,resource,resource_id,metadata)
  values (actor,app_row.cycle_id,'OFFER_RESPONSE','Application',app_row.id,jsonb_build_object('response',case when accept then 'ACCEPTED' else 'DECLINED' end));
  return true;
end;
$$;

revoke all on function rush.respond_to_offer(text, boolean) from public, anon;
grant execute on function rush.respond_to_offer(text, boolean) to authenticated, service_role;

-- applicant_dashboard is a table-returning function whose column list cannot be
-- changed with CREATE OR REPLACE, and reproducing all of it to add one column
-- risks silently dropping a rule from a function that decides what an applicant
-- may see. A separate small reader is the safer shape.
create or replace function rush.my_offer_deadlines()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_object_agg(a.id, a.offer_expires_at)
    from rush.applications a
    join rush.pnms p on p.id = a.pnm_id
    where p.auth_user_id = auth.uid() and a.offer_expires_at is not null
  ), '{}'::jsonb);
$$;

revoke all on function rush.my_offer_deadlines() from public, anon;
grant execute on function rush.my_offer_deadlines() to authenticated, service_role;
