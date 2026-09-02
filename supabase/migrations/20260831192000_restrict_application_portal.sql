-- Close the application portal to everyone except an explicit allowlist.
--
-- This cannot live in the UI or the route handlers: submit_application,
-- save_application_draft and intake_schema are SECURITY DEFINER RPCs granted to
-- `authenticated`, so any signed-in user can call them directly with the anon
-- key and the browser client. The gate has to be in the database.
--
-- Rule: a NON-EMPTY allowlist restricts the portal to those addresses. An empty
-- allowlist means no restriction, which is the normal open-cycle behaviour. So
-- reopening to everyone is `delete from rush.application_portal_allowlist;` and
-- there is no way to accidentally lock everyone out by clearing the table.
create table if not exists rush.application_portal_allowlist (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);
alter table rush.application_portal_allowlist enable row level security;
alter table rush.application_portal_allowlist force row level security;
-- No policies, matching every other rush table: reads and writes go through
-- SECURITY DEFINER functions or service_role, never straight from a client.

insert into rush.application_portal_allowlist (email, note)
values ('rbhavan@umich.edu', 'Portal closed to everyone else pending launch.')
on conflict (email) do nothing;
create or replace function rush.application_portal_allows(actor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from rush.application_portal_allowlist)
      or exists (
        select 1
        from rush.application_portal_allowlist a
        join auth.users u on lower(u.email) = lower(a.email)
        where u.id = actor
      );
$$;
revoke all on function rush.application_portal_allows(uuid) from public, anon, authenticated;
grant execute on function rush.application_portal_allows(uuid) to service_role;
-- The authoritative gate. A trigger rather than an edit to each of the three
-- RPCs, so every caller routes through one guard and a future write path cannot
-- miss it.
create or replace function rush.enforce_application_portal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- service_role is the workflow self-test and admin tooling, not an applicant.
  if auth.role() = 'service_role' then return new; end if;

  -- Only applicant-driven writes are gated. Board operations that advance an
  -- application's status or attach decisions must keep working while closed.
  if tg_op = 'INSERT'
     or (new.status = 'SUBMITTED' and old.status is distinct from 'SUBMITTED')
     or new.draft_payload is distinct from old.draft_payload then
    if not rush.application_portal_allows(auth.uid()) then
      raise exception 'applications are not open' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists applications_portal_guard on rush.applications;
create trigger applications_portal_guard
before insert or update on rush.applications
for each row execute function rush.enforce_application_portal();
-- intake_schema drives the UI. Without this it would advertise an open portal
-- and then fail at submit, which reads as a broken site rather than a closed one.
-- Body reproduced verbatim from 20260825020000 with one added condition.
create or replace function rush.intake_schema()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  cycle_row rush.rush_cycles%rowtype;
  draft jsonb;
  needs_info boolean;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  select * into cycle_row from rush.rush_cycles
  where status = 'OPEN' and (opens_at is null or opens_at <= now()) and (closes_at is null or closes_at >= now())
  order by created_at desc limit 1;

  if cycle_row.id is null or not rush.application_portal_allows(actor) then
    return jsonb_build_object('open', false, 'cycleId', null, 'cycleName', null, 'questions', '[]'::jsonb, 'draft', null, 'needsInfo', false);
  end if;

  select a.draft_payload, (a.status = 'NEEDS_INFO') into draft, needs_info
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = actor and a.cycle_id = cycle_row.id and a.status in ('DRAFT', 'NEEDS_INFO');

  return jsonb_build_object(
    'open', true,
    'cycleId', cycle_row.id,
    'cycleName', cycle_row.name,
    'draft', draft,
    'needsInfo', coalesce(needs_info, false),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', q.key,
        'prompt', q.prompt,
        'inputType', q.input_type,
        'required', q.required,
        'sortOrder', q.sort_order,
        'options', q.options
      ) order by q.sort_order)
      from rush.application_questions q where q.cycle_id = cycle_row.id
    ), '[]'::jsonb)
  );
end;
$$;
comment on table rush.application_portal_allowlist is
  'Non-empty = application portal restricted to these emails. Empty = open to everyone. Delete all rows to reopen.';
