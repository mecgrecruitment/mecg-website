-- Minimal identity and membership fixtures for the disposable proof.
create role anon;
create role authenticated;
create schema rush;
create type rush.member_role as enum ('MEMBER','BOARD','PANEL','OWNER','RECRUITMENT_COMMITTEE');
create table rush.profiles(id uuid primary key, active boolean default true, display_name text default 'Synthetic member');
create table rush.memberships(cycle_id text, user_id uuid, role rush.member_role, active boolean default true);
create table rush.audit_events(actor_id uuid,cycle_id text,action text,resource text,resource_id text,metadata jsonb);
create function rush.actor_id() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
grant usage on schema rush to authenticated,anon;
