create function rush.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
begin
  profile_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'MECG user'
  );

  insert into rush.profiles (id, display_name)
  values (new.id, left(profile_name, 120))
  on conflict (id) do update
  set display_name = excluded.display_name,
      active = true;

  return new;
end;
$$;

revoke all on function rush.handle_new_auth_user() from public, anon, authenticated;

create trigger rush_auth_user_profile
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function rush.handle_new_auth_user();

insert into rush.profiles (id, display_name)
select
  u.id,
  left(
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'MECG user'
    ),
    120
  )
from auth.users u
on conflict (id) do nothing;
