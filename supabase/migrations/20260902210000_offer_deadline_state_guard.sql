-- A deadline belongs to the active offer transaction, not merely to an
-- application row. Enforce that invariant here so direct RPC callers cannot
-- attach offer semantics to a rejected, waitlisted, or undecided application.
create or replace function rush.set_offer_deadline(target_application_id text, expires_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  app_row rush.applications%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into app_row from rush.applications where id = target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(app_row.cycle_id, array['PANEL','OWNER']::rush.member_role[]) then
    raise exception 'panel role required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from rush.decisions d
    where d.application_id = app_row.id
      and d.cycle_id = app_row.cycle_id
      and d.outcome = 'OFFER'
      and d.status in ('LOCKED','RELEASED')
  ) then
    raise exception 'active offer decision required' using errcode = '55000';
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
