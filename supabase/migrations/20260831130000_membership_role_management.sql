create function rush.set_membership_role(
  target_user_id uuid,
  target_cycle_id text,
  target_role rush.member_role
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id text;
  previous_roles text[];
begin
  if auth.uid() = target_user_id then
    raise exception 'self role change forbidden' using errcode = '42501';
  end if;

  if not rush.has_cycle_role(target_cycle_id, array['OWNER']::rush.member_role[]) then
    raise exception 'owner required' using errcode = '42501';
  end if;

  if not exists(select 1 from rush.profiles where id = target_user_id and active) then
    raise exception 'user missing' using errcode = 'P0002';
  end if;

  perform id
  from rush.memberships
  where cycle_id = target_cycle_id
  order by id
  for update;

  select array_agg(role::text order by role::text)
  into previous_roles
  from rush.memberships
  where user_id = target_user_id
    and cycle_id = target_cycle_id
    and active;

  if previous_roles is null then
    raise exception 'membership missing' using errcode = 'P0002';
  end if;

  if target_role in ('RECRUITMENT_COMMITTEE', 'BOARD', 'PANEL', 'OWNER') and exists(
    select 1
    from rush.screening_reviewers sr
    join rush.screening_batches b on b.id = sr.batch_id
    where sr.reviewer_id = target_user_id
      and b.cycle_id = target_cycle_id
  ) then
    raise exception 'screening reviewer cannot receive a privileged role in the same cycle' using errcode = '42501';
  end if;

  if 'OWNER' = any(previous_roles)
    and target_role <> 'OWNER'
    and not exists(
      select 1
      from rush.memberships
      where cycle_id = target_cycle_id
        and role = 'OWNER'
        and active
        and user_id <> target_user_id
    )
  then
    raise exception 'cycle must retain an owner' using errcode = '55000';
  end if;

  update rush.memberships
  set active = false,
      revoked_at = now()
  where user_id = target_user_id
    and cycle_id = target_cycle_id
    and active
    and role <> target_role;

  insert into rush.memberships(user_id, cycle_id, role, active, revoked_at)
  values(target_user_id, target_cycle_id, target_role, true, null)
  on conflict(user_id, cycle_id, role)
  do update set active = true, revoked_at = null
  returning id into result_id;

  insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id, metadata)
  values(
    auth.uid(),
    target_cycle_id,
    'MEMBERSHIP_ROLE_CHANGED',
    'Profile',
    target_user_id::text,
    jsonb_build_object('from', previous_roles, 'to', target_role)
  );

  return result_id;
end;
$$;

revoke all on function rush.set_membership_role(uuid, text, rush.member_role) from public, anon;
grant execute on function rush.set_membership_role(uuid, text, rush.member_role) to authenticated, service_role;
