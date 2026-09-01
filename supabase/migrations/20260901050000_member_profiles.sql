-- rush.profiles held display_name and active, and nothing else. That was enough
-- while a "member" only meant "someone who can open an evaluation form", but it
-- left the workspace with no way to answer who anybody is. It also means the
-- public team page is a hand-edited content file that drifts from the roster.
--
-- These columns are all optional. A member who fills in nothing keeps working
-- exactly as before.
alter table rush.profiles
  add column if not exists grad_term text check (grad_term is null or char_length(trim(grad_term)) between 1 and 40),
  add column if not exists major text check (major is null or char_length(trim(major)) between 1 and 120),
  add column if not exists position_title text check (position_title is null or char_length(trim(position_title)) between 1 and 120),
  add column if not exists bio text check (bio is null or char_length(bio) <= 1000);

-- Self-service only. Nobody edits anyone else's profile here; role changes stay
-- in set_membership_role where they are already audited.
create or replace function rush.update_my_profile(
  display_name text,
  grad_term text,
  major text,
  position_title text,
  bio text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  clean_name text := trim(coalesce(display_name, ''));
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if char_length(clean_name) not between 1 and 120 then
    raise exception 'invalid display name' using errcode = '22023';
  end if;
  if grad_term is not null and char_length(trim(grad_term)) > 40 then raise exception 'invalid graduation term' using errcode = '22023'; end if;
  if major is not null and char_length(trim(major)) > 120 then raise exception 'invalid major' using errcode = '22023'; end if;
  if position_title is not null and char_length(trim(position_title)) > 120 then raise exception 'invalid position' using errcode = '22023'; end if;
  if bio is not null and char_length(bio) > 1000 then raise exception 'invalid bio' using errcode = '22023'; end if;

  update rush.profiles p set
    display_name = clean_name,
    grad_term = nullif(trim(coalesce(grad_term, '')), ''),
    major = nullif(trim(coalesce(major, '')), ''),
    position_title = nullif(trim(coalesce(position_title, '')), ''),
    bio = nullif(trim(coalesce(bio, '')), ''),
    updated_at = now()
  where p.id = actor;
  if not found then raise exception 'profile missing' using errcode = 'P0002'; end if;
  return true;
end;
$$;

revoke all on function rush.update_my_profile(text, text, text, text, text) from public, anon;
grant execute on function rush.update_my_profile(text, text, text, text, text) to authenticated, service_role;

-- The directory. Scoped to one cycle and readable by anyone with access to that
-- cycle, which is the same bar the workspace already uses. Deliberately returns
-- no email or contact detail: this answers "who is on the team", not "how do I
-- reach them outside the tools we already have".
create or replace function rush.cycle_directory(target_cycle_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (
      select 1 from rush.memberships m
      join rush.profiles p on p.id = m.user_id
      where m.cycle_id = target_cycle_id and m.user_id = auth.uid() and m.active and p.active
    ) then '[]'::jsonb
    else coalesce((
      select jsonb_agg(entry order by entry->>'name')
      from (
        select jsonb_build_object(
          'id', p.id,
          'name', p.display_name,
          'gradTerm', p.grad_term,
          'major', p.major,
          'position', p.position_title,
          'bio', p.bio,
          'roles', (
            select jsonb_agg(distinct m2.role::text)
            from rush.memberships m2
            where m2.user_id = p.id and m2.cycle_id = target_cycle_id and m2.active
          )
        ) as entry
        from rush.profiles p
        where p.active and exists (
          select 1 from rush.memberships m3
          where m3.user_id = p.id and m3.cycle_id = target_cycle_id and m3.active
        )
      ) rows
    ), '[]'::jsonb)
  end;
$$;

revoke all on function rush.cycle_directory(text) from public, anon;
grant execute on function rush.cycle_directory(text) to authenticated, service_role;

-- Everything a member has done in one cycle, for their own record. Same
-- self-service boundary as update_my_profile.
create or replace function rush.my_member_record(target_cycle_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'evaluationsSubmitted', (
      select count(*) from rush.evaluations e
      join rush.evaluation_assignments a on a.id = e.assignment_id
      join rush.rounds r on r.id = a.round_id
      where e.evaluator_id = auth.uid() and r.cycle_id = target_cycle_id
        and e.status in ('SUBMITTED', 'LOCKED')
    ),
    'assignmentsOpen', (
      select count(*) from rush.evaluation_assignments a
      join rush.rounds r on r.id = a.round_id
      where a.evaluator_id = auth.uid() and r.cycle_id = target_cycle_id
        and a.status in ('ASSIGNED', 'IN_PROGRESS')
    ),
    'eventsAttended', (
      select count(*) from rush.member_checkins c
      join rush.events e on e.id = c.event_id
      where c.member_id = auth.uid() and e.cycle_id = target_cycle_id
    ),
    'conflictsDeclared', (
      select count(*) from rush.conflict_declarations d
      join rush.applications a on a.id = d.application_id
      where d.declarer_id = auth.uid() and a.cycle_id = target_cycle_id
    )
  );
$$;

revoke all on function rush.my_member_record(text) from public, anon;
grant execute on function rush.my_member_record(text) to authenticated, service_role;
