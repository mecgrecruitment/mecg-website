create or replace function rush.unassign_case_group(target_group_id text, target_application_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_cycle text;
begin
  select cycle_id into target_cycle from rush.case_groups where id = target_group_id;
  if target_cycle is null then raise exception 'group missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_capability(target_cycle, 'APPLICANT_OPERATIONS') then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from rush.case_group_members where group_id = target_group_id and application_id = target_application_id;
  if not found then raise exception 'group assignment missing' using errcode = 'P0002'; end if;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (auth.uid(), target_cycle, 'CASE_GROUP_UNASSIGNED', 'CaseGroup', target_group_id, jsonb_build_object('applicationId', target_application_id));
end;
$$;

create or replace function rush.delete_case_group(target_group_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_cycle text;
begin
  select cycle_id into target_cycle from rush.case_groups where id = target_group_id for update;
  if target_cycle is null then raise exception 'group missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_capability(target_cycle, 'APPLICANT_OPERATIONS') then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from rush.case_group_members where group_id = target_group_id) then raise exception 'group is not empty' using errcode = '55000'; end if;
  delete from rush.case_groups where id = target_group_id;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (auth.uid(), target_cycle, 'CASE_GROUP_DELETED', 'CaseGroup', target_group_id);
end;
$$;

revoke all on function rush.unassign_case_group(text, text), rush.delete_case_group(text) from public, anon;
grant execute on function rush.unassign_case_group(text, text), rush.delete_case_group(text) to authenticated, service_role;
