-- Restricted remediation evidence for uncertain account creation or failed
-- compensation. Store only identity needed for a later operator lookup; never
-- credentials, provider error bodies or an automatic account-deletion command.
create table rush.provisioning_incidents (
  id uuid primary key,
  cycle_id text not null references rush.rush_cycles(id) on delete restrict,
  requested_by uuid not null references rush.profiles(id) on delete restrict,
  email text not null check (email=trim(email) and char_length(email) between 3 and 320),
  clerk_user_id text check (clerk_user_id is null or (clerk_user_id=trim(clerk_user_id) and char_length(clerk_user_id) between 1 and 200)),
  -- Deliberately no FK: compensation can remove the partial local profile.
  app_user_id uuid,
  phase text not null check (phase in ('CREATE_ACCOUNT','IDENTITY_LINK','MEMBERSHIP_GRANT')),
  clerk_cleanup_failed boolean not null,
  profile_cleanup_failed boolean not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references rush.profiles(id) on delete restrict,
  constraint provisioning_incidents_resolution_pair check ((resolved_at is null)=(resolved_by is null))
);
create index provisioning_incidents_cycle_created_idx on rush.provisioning_incidents(cycle_id,created_at desc);
alter table rush.provisioning_incidents enable row level security;
alter table rush.provisioning_incidents force row level security;
revoke all on table rush.provisioning_incidents from public,anon,authenticated,service_role;
grant select on table rush.provisioning_incidents to authenticated;
create policy provisioning_incidents_owner_read on rush.provisioning_incidents for select to authenticated
using (rush.has_cycle_role(cycle_id,array['OWNER']::rush.member_role[]));
-- A writer cannot pretend an incident was resolved by supplying resolution
-- fields. It already knows the server-generated ID; RETURNING is unnecessary.
grant insert(id,cycle_id,requested_by,email,clerk_user_id,app_user_id,phase,clerk_cleanup_failed,profile_cleanup_failed)
  on rush.provisioning_incidents to service_role;

create or replace function rush.resolve_provisioning_incident(target_incident_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare incident rush.provisioning_incidents%rowtype; actor uuid := rush.actor_id();
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into incident from rush.provisioning_incidents where id=target_incident_id for update;
  if incident.id is null then raise exception 'incident missing' using errcode='P0002'; end if;
  if not rush.has_cycle_role(incident.cycle_id,array['OWNER']::rush.member_role[]) then raise exception 'owner role required' using errcode='42501'; end if;
  if incident.resolved_at is not null then return; end if;
  update rush.provisioning_incidents set resolved_at=now(),resolved_by=actor where id=incident.id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
  values(actor,incident.cycle_id,'PROVISIONING_INCIDENT_RESOLVED','ProvisioningIncident',incident.id::text,
    jsonb_build_object('incidentId',incident.id));
end $$;
revoke all on function rush.resolve_provisioning_incident(uuid) from public,anon,service_role;
grant execute on function rush.resolve_provisioning_incident(uuid) to authenticated;
