-- Board operators need a safe way to correct the application window without
-- editing production data by hand. Keep the write transactional, authorized,
-- bounded to the intake phase, and visible in the audit trail.
create or replace function rush.set_cycle_application_window(
  target_cycle_id text,
  application_opens_at timestamptz,
  application_closes_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  current_row rush.rush_cycles%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  select * into current_row
  from rush.rush_cycles
  where id = target_cycle_id
  for update;

  if current_row.id is null then raise exception 'cycle missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(target_cycle_id, array['BOARD','OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if current_row.status not in ('DRAFT', 'OPEN') then
    raise exception 'application window is locked' using errcode = '55000';
  end if;
  if application_opens_at is null or application_closes_at is null
     or application_closes_at <= application_opens_at then
    raise exception 'invalid application window' using errcode = '22023';
  end if;

  update rush.rush_cycles
  set opens_at = application_opens_at,
      closes_at = application_closes_at,
      updated_at = now()
  where id = target_cycle_id;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (
    actor,
    target_cycle_id,
    'APPLICATION_WINDOW_SET',
    'RushCycle',
    target_cycle_id,
    jsonb_build_object(
      'previousOpensAt', current_row.opens_at,
      'previousClosesAt', current_row.closes_at,
      'opensAt', application_opens_at,
      'closesAt', application_closes_at
    )
  );

  return jsonb_build_object('opensAt', application_opens_at, 'closesAt', application_closes_at);
end;
$$;
revoke all on function rush.set_cycle_application_window(text, timestamptz, timestamptz) from public, anon;
grant execute on function rush.set_cycle_application_window(text, timestamptz, timestamptz) to authenticated, service_role;
