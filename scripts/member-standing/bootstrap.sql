-- Minimal identity, cycle, event, project and onboarding fixtures for the disposable proof.
create role anon;
create role authenticated;
create schema rush;
create type rush.member_role as enum ('MEMBER','BOARD','PANEL','OWNER','RECRUITMENT_COMMITTEE');
create type rush.event_status as enum ('DRAFT','PUBLISHED','CLOSED','CANCELLED');
create table rush.profiles(id uuid primary key, active boolean default true, display_name text default 'Synthetic member');
create table rush.rush_cycles(id text primary key);
create table rush.memberships(cycle_id text references rush.rush_cycles(id), user_id uuid references rush.profiles(id), role rush.member_role, active boolean default true, created_at timestamptz not null default now()-interval '60 days');
create table rush.audit_events(actor_id uuid,cycle_id text,action text,resource text,resource_id text,metadata jsonb);
create table rush.events(id text primary key, cycle_id text references rush.rush_cycles(id), status rush.event_status not null, starts_at timestamptz not null, checkin_closes_at timestamptz not null);
create table rush.member_checkins(member_id uuid, event_id text references rush.events(id), unique(member_id,event_id));
create table rush.projects(id text primary key);
create table rush.project_members(project_id text references rush.projects(id), user_id uuid references rush.profiles(id), primary key(project_id,user_id));
create table rush.pnms(id text primary key, auth_user_id uuid unique);
create table rush.applications(id text primary key, cycle_id text references rush.rush_cycles(id), pnm_id text references rush.pnms(id), offer_response text, offer_responded_at timestamptz);
create table rush.member_onboarding_items(application_id text references rush.applications(id), item_key text, completed_at timestamptz, primary key(application_id,item_key));
create function rush.actor_id() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
grant usage on schema rush to authenticated,anon;
