-- Runs after the member-tools bootstrap and migration, which supply profiles,
-- memberships, cycles, audit events and the member-tool tables. Adds the
-- columns and the project tables the cycle-records functions read.
alter table rush.rush_cycles add column name text, add column updated_at timestamptz not null default now();
alter table rush.audit_events add column created_at timestamptz not null default now();
create table rush.projects(id text primary key, slug text not null, title text not null, client_label text not null default '', is_public boolean not null default false, sort_order integer not null default 0);
create table rush.project_members(project_id text references rush.projects(id), user_id uuid, role_label text not null default '', primary key(project_id,user_id));
alter table rush.projects enable row level security;
alter table rush.project_members enable row level security;
