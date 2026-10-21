-- Colleague profiles lose the closed-cycle committee rule; rc_closed would then see members of its closed cycle.
create or replace function rush.actor_readable_colleague_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select theirs.user_id
  from rush.profiles actor_profile
  join rush.memberships mine on mine.user_id = actor_profile.id
  join rush.memberships theirs on theirs.cycle_id = mine.cycle_id
  where actor_profile.id = (select rush.actor_id()) and actor_profile.active and mine.active and theirs.active
    and (mine.role in ('BOARD','OWNER') or mine.role in ('MEMBER','PANEL') or mine.role = 'RECRUITMENT_COMMITTEE');
$$;
