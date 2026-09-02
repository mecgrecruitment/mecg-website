-- Accepted applicants need a durable handoff without becoming members before
-- the Board is ready. These five rows are the fixed onboarding contract.
create table rush.member_onboarding_items (
  application_id text not null references rush.applications(id) on delete cascade,
  item_key text not null check (item_key in ('CONTACT_CONFIRMATION','ORIENTATION','COMMUNICATIONS_CHANNEL','PROFILE_SETUP','BOARD_HANDOFF')),
  owner_id uuid references rush.profiles(id) on delete set null,
  completed_at timestamptz,
  -- Keep the actor id as historical evidence even if their profile is later removed.
  completed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (application_id, item_key),
  check ((completed_at is null) = (completed_by is null))
);
create index member_onboarding_owner_idx on rush.member_onboarding_items(owner_id) where completed_at is null;

alter table rush.member_onboarding_items enable row level security;
alter table rush.member_onboarding_items force row level security;
revoke all on rush.member_onboarding_items from public, anon, authenticated;
grant all on rush.member_onboarding_items to service_role;

create or replace function rush.respond_to_offer(target_application_id text, accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := rush.actor_id(); app_row rush.applications%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if accept is null then raise exception 'response required' using errcode='22023'; end if;
  select a.* into app_row from rush.applications a where a.id=target_application_id for update;
  if app_row.id is null then raise exception 'no offer' using errcode='P0002'; end if;
  if not exists (select 1 from rush.pnms p where p.id=app_row.pnm_id and p.auth_user_id=actor) then raise exception 'forbidden' using errcode='42501'; end if;
  if app_row.status<>'OFFERED' or not exists (select 1 from rush.decisions d where d.application_id=app_row.id and d.outcome='OFFER' and d.status='RELEASED') then raise exception 'no released offer' using errcode='42501'; end if;
  if app_row.offer_response is not null then raise exception 'offer already answered' using errcode='55000'; end if;
  if app_row.offer_expires_at is not null and app_row.offer_expires_at <= now() then raise exception 'offer expired' using errcode='55000'; end if;
  update rush.applications a set offer_response=case when accept then 'ACCEPTED' else 'DECLINED' end,offer_responded_at=now() where a.id=app_row.id;
  if accept then
    insert into rush.member_onboarding_items(application_id,item_key)
    select app_row.id, item_key_value from unnest(array['CONTACT_CONFIRMATION','ORIENTATION','COMMUNICATIONS_CHANNEL','PROFILE_SETUP','BOARD_HANDOFF']) item_key_value
    on conflict (application_id,item_key) do nothing;
  end if;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
  values(actor,app_row.cycle_id,'OFFER_RESPONSE','Application',app_row.id,jsonb_build_object('response',case when accept then 'ACCEPTED' else 'DECLINED' end));
end $$;

insert into rush.member_onboarding_items(application_id,item_key)
select a.id, item_key_value
from rush.applications a
cross join unnest(array['CONTACT_CONFIRMATION','ORIENTATION','COMMUNICATIONS_CHANNEL','PROFILE_SETUP','BOARD_HANDOFF']) item_key_value
where a.offer_response='ACCEPTED'
on conflict (application_id,item_key) do nothing;

create function rush.my_member_onboarding()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'applicationId', i.application_id, 'key', i.item_key,
    'completedAt', i.completed_at, 'ownerName', owner.display_name,
    'contact', p.contact, 'cycleName', c.name
  ) order by a.offer_responded_at desc, case i.item_key when 'CONTACT_CONFIRMATION' then 1 when 'ORIENTATION' then 2 when 'COMMUNICATIONS_CHANNEL' then 3 when 'PROFILE_SETUP' then 4 else 5 end), '[]'::jsonb)
  from rush.member_onboarding_items i
  join rush.applications a on a.id=i.application_id and a.offer_response='ACCEPTED'
  join rush.pnms p on p.id=a.pnm_id and p.auth_user_id=rush.actor_id()
  join rush.rush_cycles c on c.id=a.cycle_id
  left join rush.profiles owner on owner.id=i.owner_id;
$$;

create function rush.cycle_member_onboarding(target_cycle_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not rush.has_cycle_role(target_cycle_id,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'applicationId', i.application_id, 'applicantName', p.name, 'contact', p.contact,
    'key', i.item_key, 'ownerId', i.owner_id, 'ownerName', owner.display_name,
    'completedAt', i.completed_at, 'completedByName', completer.display_name
  ) order by p.name,case i.item_key when 'CONTACT_CONFIRMATION' then 1 when 'ORIENTATION' then 2 when 'COMMUNICATIONS_CHANNEL' then 3 when 'PROFILE_SETUP' then 4 else 5 end), '[]'::jsonb)
  from rush.member_onboarding_items i
  join rush.applications a on a.id=i.application_id and a.cycle_id=target_cycle_id and a.offer_response='ACCEPTED'
  join rush.pnms p on p.id=a.pnm_id
  left join rush.profiles owner on owner.id=i.owner_id
  left join rush.profiles completer on completer.id=i.completed_by);
end $$;

create function rush.set_my_onboarding_item(target_application_id text,target_item_key text,complete boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=rush.actor_id(); app_row rush.applications%rowtype; changed_count integer;
begin
  if complete is null then raise exception 'completion required' using errcode='22023'; end if;
  if target_item_key not in ('CONTACT_CONFIRMATION','ORIENTATION','COMMUNICATIONS_CHANNEL','PROFILE_SETUP','BOARD_HANDOFF') then raise exception 'invalid onboarding item' using errcode='22023'; end if;
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if target_item_key not in ('CONTACT_CONFIRMATION','PROFILE_SETUP') then raise exception 'board action required' using errcode='42501'; end if;
  select a.* into app_row from rush.applications a join rush.pnms p on p.id=a.pnm_id where a.id=target_application_id and p.auth_user_id=actor for update of a;
  if app_row.id is null or app_row.offer_response<>'ACCEPTED' then raise exception 'accepted offer required' using errcode='42501'; end if;
  update rush.member_onboarding_items set completed_at=case when complete then now() else null end,completed_by=case when complete then actor else null end,updated_at=now()
  where application_id=app_row.id and item_key=target_item_key and (completed_at is not null) is distinct from complete;
  get diagnostics changed_count = row_count;
  if changed_count > 0 then insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(actor,app_row.cycle_id,'ONBOARDING_ITEM_SET','MemberOnboarding',app_row.id,jsonb_build_object('itemKey',target_item_key,'complete',complete,'source','APPLICANT')); end if;
  return changed_count > 0;
end $$;

create function rush.set_member_onboarding_owner(target_application_id text,target_item_key text,target_owner_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=rush.actor_id(); app_row rush.applications%rowtype; changed_count integer;
begin
  if target_item_key not in ('CONTACT_CONFIRMATION','ORIENTATION','COMMUNICATIONS_CHANNEL','PROFILE_SETUP','BOARD_HANDOFF') then raise exception 'invalid onboarding item' using errcode='22023'; end if;
  select * into app_row from rush.applications where id=target_application_id for update;
  if app_row.id is null or app_row.offer_response<>'ACCEPTED' then raise exception 'accepted offer required' using errcode='42501'; end if;
  if not rush.has_cycle_role(app_row.cycle_id,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  if target_owner_id is not null and not exists(select 1 from rush.memberships m where m.cycle_id=app_row.cycle_id and m.user_id=target_owner_id and m.active) then raise exception 'owner must be an active cycle member' using errcode='22023'; end if;
  update rush.member_onboarding_items set owner_id=target_owner_id,updated_at=now() where application_id=app_row.id and item_key=target_item_key and owner_id is distinct from target_owner_id;
  get diagnostics changed_count = row_count;
  if changed_count > 0 then insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(actor,app_row.cycle_id,'ONBOARDING_OWNER_SET','MemberOnboarding',app_row.id,jsonb_build_object('itemKey',target_item_key,'ownerId',target_owner_id)); end if;
  return changed_count > 0;
end $$;

create function rush.set_member_onboarding_completion(target_application_id text,target_item_key text,complete boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=rush.actor_id(); app_row rush.applications%rowtype; changed_count integer;
begin
  if complete is null then raise exception 'completion required' using errcode='22023'; end if;
  if target_item_key not in ('CONTACT_CONFIRMATION','ORIENTATION','COMMUNICATIONS_CHANNEL','PROFILE_SETUP','BOARD_HANDOFF') then raise exception 'invalid onboarding item' using errcode='22023'; end if;
  select * into app_row from rush.applications where id=target_application_id for update;
  if app_row.id is null or app_row.offer_response<>'ACCEPTED' then raise exception 'accepted offer required' using errcode='42501'; end if;
  if not rush.has_cycle_role(app_row.cycle_id,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  update rush.member_onboarding_items set completed_at=case when complete then now() else null end,completed_by=case when complete then actor else null end,owner_id=case when complete then coalesce(owner_id,actor) else owner_id end,updated_at=now()
  where application_id=app_row.id and item_key=target_item_key and (completed_at is not null) is distinct from complete;
  get diagnostics changed_count = row_count;
  if changed_count > 0 then insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(actor,app_row.cycle_id,'ONBOARDING_ITEM_SET','MemberOnboarding',app_row.id,jsonb_build_object('itemKey',target_item_key,'complete',complete,'source','BOARD')); end if;
  return changed_count > 0;
end $$;

revoke all on function rush.my_member_onboarding(),rush.cycle_member_onboarding(text),rush.set_my_onboarding_item(text,text,boolean),rush.set_member_onboarding_owner(text,text,uuid),rush.set_member_onboarding_completion(text,text,boolean) from public,anon;
grant execute on function rush.my_member_onboarding(),rush.cycle_member_onboarding(text),rush.set_my_onboarding_item(text,text,boolean),rush.set_member_onboarding_owner(text,text,uuid),rush.set_member_onboarding_completion(text,text,boolean) to authenticated,service_role;
