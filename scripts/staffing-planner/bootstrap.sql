-- Minimal identity, cycle and project fixtures for the disposable proof.
create role anon;
create role authenticated;
create schema rush;
create type rush.member_role as enum ('MEMBER','BOARD','PANEL','OWNER','RECRUITMENT_COMMITTEE');
create table rush.profiles(id uuid primary key, active boolean default true, display_name text default 'Synthetic member');
create table rush.rush_cycles(id text primary key);
create table rush.memberships(cycle_id text references rush.rush_cycles(id), user_id uuid references rush.profiles(id), role rush.member_role, active boolean default true);
create table rush.audit_events(actor_id uuid,cycle_id text,action text,resource text,resource_id text,metadata jsonb);
create table rush.projects(id text primary key, title text not null, semester text not null default '', sort_order integer not null default 0);
create table rush.project_members(project_id text references rush.projects(id) on delete cascade, user_id uuid references rush.profiles(id), primary key(project_id,user_id));
create function rush.actor_id() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
grant usage on schema rush to authenticated,anon;
