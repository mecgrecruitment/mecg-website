-- Client work lived in src/content/projects.public.ts, a hand-edited TypeScript
-- array. Members had no view of who was staffed on what, and the public /work
-- and /team pages drifted from reality every time somebody forgot to edit the
-- file. Moving projects into the database makes the marketing pages a byproduct
-- of real data instead of a parallel copy of it.
--
-- The public/private split is explicit and defaults to private. Client work is
-- confidential by default, and a project only reaches the marketing site when
-- somebody deliberately sets is_public.
create table if not exists rush.projects (
  id text primary key default gen_random_uuid()::text,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$' and char_length(slug) <= 80),
  title text not null check (char_length(trim(title)) between 1 and 200),
  client_label text not null default '' check (char_length(client_label) <= 200),
  industry text not null default '' check (char_length(industry) <= 120),
  semester text not null default '' check (char_length(semester) <= 60),
  decision text not null default '' check (char_length(decision) <= 400),
  context text not null default '' check (char_length(context) <= 4000),
  handoff text not null default '' check (char_length(handoff) <= 2000),
  methods jsonb not null default '[]'::jsonb,
  deliverables jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '[]'::jsonb,
  member_work jsonb not null default '[]'::jsonb,
  is_public boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_public_sort_idx on rush.projects (is_public, sort_order);

create table if not exists rush.project_members (
  project_id text not null references rush.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_label text not null default '' check (char_length(role_label) <= 120),
  primary key (project_id, user_id)
);

alter table rush.projects enable row level security;
alter table rush.projects force row level security;
alter table rush.project_members enable row level security;
alter table rush.project_members force row level security;

-- Anyone signed in to the workspace may read the project list; the marketing
-- site reads public projects through a dedicated RPC below rather than through
-- a policy, so an anonymous visitor never touches this table.
drop policy if exists projects_read_internal on rush.projects;
create policy projects_read_internal on rush.projects for select to authenticated
using (exists (
  select 1 from rush.memberships m
  join rush.profiles p on p.id = m.user_id
  where m.user_id = auth.uid() and m.active and p.active
));

drop policy if exists project_members_read_internal on rush.project_members;
create policy project_members_read_internal on rush.project_members for select to authenticated
using (exists (
  select 1 from rush.memberships m
  join rush.profiles p on p.id = m.user_id
  where m.user_id = auth.uid() and m.active and p.active
));

grant select on rush.projects to authenticated;
grant select on rush.project_members to authenticated;

-- The only thing the public site may see. Selects the public columns
-- explicitly, so adding a confidential column later cannot leak it by default.
create or replace function rush.public_projects()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'slug', p.slug,
      'title', p.title,
      'clientLabel', p.client_label,
      'industry', p.industry,
      'semester', p.semester,
      'decision', p.decision,
      'context', p.context,
      'handoff', p.handoff,
      'methods', p.methods,
      'deliverables', p.deliverables,
      'constraints', p.constraints,
      'memberWork', p.member_work
    ) order by p.sort_order, p.title)
    from rush.projects p where p.is_public
  ), '[]'::jsonb);
$$;

revoke all on function rush.public_projects() from public;
grant execute on function rush.public_projects() to anon, authenticated, service_role;

create or replace function rush.upsert_project(project jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  project_slug text := lower(trim(coalesce(project->>'slug', '')));
  project_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not exists (
    select 1 from rush.memberships m join rush.profiles p on p.id = m.user_id
    where m.user_id = actor and m.active and p.active and m.role in ('BOARD','OWNER')
  ) then raise exception 'forbidden' using errcode = '42501'; end if;
  if project_slug !~ '^[a-z0-9][a-z0-9-]*$' or char_length(project_slug) > 80 then
    raise exception 'invalid project slug' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(project->>'title', ''))) not between 1 and 200 then
    raise exception 'invalid project title' using errcode = '22023';
  end if;

  insert into rush.projects (slug, title, client_label, industry, semester, decision, context, handoff,
                             methods, deliverables, constraints, member_work, is_public, sort_order)
  values (
    project_slug,
    trim(project->>'title'),
    coalesce(project->>'clientLabel', ''),
    coalesce(project->>'industry', ''),
    coalesce(project->>'semester', ''),
    coalesce(project->>'decision', ''),
    coalesce(project->>'context', ''),
    coalesce(project->>'handoff', ''),
    coalesce(project->'methods', '[]'::jsonb),
    coalesce(project->'deliverables', '[]'::jsonb),
    coalesce(project->'constraints', '[]'::jsonb),
    coalesce(project->'memberWork', '[]'::jsonb),
    coalesce((project->>'isPublic')::boolean, false),
    coalesce((project->>'sortOrder')::integer, 0)
  )
  on conflict (slug) do update set
    title = excluded.title,
    client_label = excluded.client_label,
    industry = excluded.industry,
    semester = excluded.semester,
    decision = excluded.decision,
    context = excluded.context,
    handoff = excluded.handoff,
    methods = excluded.methods,
    deliverables = excluded.deliverables,
    constraints = excluded.constraints,
    member_work = excluded.member_work,
    is_public = excluded.is_public,
    sort_order = excluded.sort_order,
    updated_at = now()
  returning id into project_id;

  insert into rush.audit_events (actor_id, action, resource, resource_id, metadata)
  values (actor, 'PROJECT_SAVED', 'Project', project_id,
          jsonb_build_object('slug', project_slug, 'isPublic', coalesce((project->>'isPublic')::boolean, false)));
  return project_id;
end;
$$;

revoke all on function rush.upsert_project(jsonb) from public, anon;
grant execute on function rush.upsert_project(jsonb) to authenticated, service_role;

create or replace function rush.set_project_staffing(target_project_id text, members jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  entry jsonb;
  written integer := 0;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not exists (
    select 1 from rush.memberships m join rush.profiles p on p.id = m.user_id
    where m.user_id = actor and m.active and p.active and m.role in ('BOARD','OWNER')
  ) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from rush.projects where id = target_project_id) then
    raise exception 'project missing' using errcode = 'P0002';
  end if;
  if jsonb_typeof(members) <> 'array' or jsonb_array_length(members) > 40 then
    raise exception 'invalid staffing' using errcode = '22023';
  end if;

  delete from rush.project_members where project_id = target_project_id;
  for entry in select value from jsonb_array_elements(members) loop
    -- Silently skipping an unknown user id would produce a roster that looks
    -- saved but is not, so an unknown member is an error.
    if not exists (select 1 from rush.profiles p where p.id = (entry->>'userId')::uuid) then
      raise exception 'unknown member' using errcode = 'P0002';
    end if;
    insert into rush.project_members (project_id, user_id, role_label)
    values (target_project_id, (entry->>'userId')::uuid, coalesce(entry->>'roleLabel', ''));
    written := written + 1;
  end loop;

  insert into rush.audit_events (actor_id, action, resource, resource_id, metadata)
  values (actor, 'PROJECT_STAFFING_SET', 'Project', target_project_id, jsonb_build_object('count', written));
  return written;
end;
$$;

revoke all on function rush.set_project_staffing(text, jsonb) from public, anon;
grant execute on function rush.set_project_staffing(text, jsonb) to authenticated, service_role;
