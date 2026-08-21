-- Phase 0 · Migration 10: demo → production convergence.
-- Retires the demo_* layer by giving the real schema the few capabilities the
-- demo portal had that production lacked: self-serve applicant signup, a board
-- approval queue, open-rush events + phrase check-in, applicant-side read RPCs,
-- and a speed-dating team label. RLS conventions mirror migration 7
-- (default-deny; helpers wrapped in (select …) for the init-plan pattern).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Signup gate: admit everyone; membership is decided by member-row presence.
--    A signup with no live allowlist row = applicant (no members row); with one
--    = member (the existing AFTER INSERT handler mints the row). We therefore
--    (a) relax the BEFORE INSERT gate to a no-op, and (b) guard the handler so
--    it only inserts a members row WHEN an allowlist row exists (previously it
--    always inserted, defaulting to general_member — which would have turned
--    every applicant into a member).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_enforce_signup_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Open signup. Applicant vs member is resolved by fn_handle_new_auth_user
  -- (member row only when allowlisted). Domain restriction, if ever wanted
  -- again, belongs in a hosted "before user created" Auth Hook.
  return new;
end;
$$;

create or replace function public.fn_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allow public.invite_allowlist%rowtype;
begin
  select * into v_allow
    from public.invite_allowlist ia
   where lower(ia.email) = lower(new.email)
     and ia.consumed_at is null
     and (ia.expires_at is null or ia.expires_at > now())
   limit 1;

  -- No allowlist row ⇒ this is an applicant, not a member. Leave them
  -- member-less; current_member_role() returns NULL ⇒ applicant routing.
  if found then
    insert into public.members (user_id, email, full_name, role)
    values (
      new.id,
      new.email,
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        initcap(replace(split_part(new.email, '@', 1), '.', ' '))
      ),
      v_allow.role
    );

    update public.invite_allowlist
       set consumed_at = now()
     where id = v_allow.id;
  end if;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Membership requests: self-serve "request access → pending → board approves"
--    (replaces the demo's demo_internal_accounts approval workflow). Writes go
--    through request_membership() (SECURITY DEFINER) so an applicant can never
--    set their own status; board approval is a normal board-RLS write.
-- ─────────────────────────────────────────────────────────────────────────────

create type public.membership_request_status as enum ('pending', 'approved', 'denied');

create table public.membership_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  -- The role the applicant is asking for; clamped to committee/board by the RPC.
  requested_role public.member_role not null default 'recruitment_committee',
  status public.membership_request_status not null default 'pending',
  reviewed_by uuid references public.members (id) on delete set null,
  reviewed_at timestamptz
);

create index membership_requests_status_idx on public.membership_requests (status);

create trigger trg_membership_requests_updated_at before update on public.membership_requests
  for each row execute function public.fn_set_updated_at();

alter table public.membership_requests enable row level security;
revoke all on public.membership_requests from anon;

-- Self sees own request (pending page); board sees all.
create policy membership_requests_select on public.membership_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_board()));

-- Board reviews (approve/deny). Inserts/self-updates happen via the RPC only.
create policy membership_requests_update on public.membership_requests for update to authenticated
  using ((select public.is_board()))
  with check ((select public.is_board()));

create or replace function public.request_membership(
  p_full_name text,
  p_requested_role public.member_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(auth.email());
  v_role public.member_role := case when p_requested_role = 'board' then 'board' else 'recruitment_committee' end;
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;
  if exists (select 1 from public.members where user_id = v_uid and deleted_at is null) then
    raise exception 'already a member';
  end if;

  insert into public.membership_requests (user_id, email, full_name, requested_role, status)
  values (v_uid, v_email, coalesce(nullif(trim(p_full_name), ''), v_email), v_role, 'pending')
  on conflict (user_id) do update
    set full_name      = excluded.full_name,
        requested_role = excluded.requested_role,
        status         = 'pending',
        reviewed_by    = null,
        reviewed_at    = null,
        updated_at     = now();
end;
$$;

revoke execute on function public.request_membership(text, public.member_role) from anon, public;
grant execute on function public.request_membership(text, public.member_role) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Recruitment events + check-ins (replaces demo_events / demo_checkins).
--    Open-rush events are publicly listable (safe columns only, via the view);
--    attendance codes live on the base table, readable by committee+ only.
-- ─────────────────────────────────────────────────────────────────────────────

create type public.event_type as enum ('open_rush', 'invite_only', 'internal');

create table public.recruitment_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cycle_id uuid not null references public.recruitment_cycles (id) on delete cascade,
  title text not null,
  event_type public.event_type not null default 'open_rush',
  event_date timestamptz,
  location text,
  attendance_code text, -- the phrase applicants enter to check in
  is_active boolean not null default true
);

create index recruitment_events_cycle_idx on public.recruitment_events (cycle_id);

create trigger trg_recruitment_events_updated_at before update on public.recruitment_events
  for each row execute function public.fn_set_updated_at();

create table public.event_checkins (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.recruitment_events (id) on delete cascade,
  email text not null,
  applicant_name text
);

create unique index event_checkins_event_email_key on public.event_checkins (event_id, lower(email));
create index event_checkins_email_idx on public.event_checkins (lower(email));

alter table public.recruitment_events enable row level security;
alter table public.event_checkins enable row level security;
revoke all on public.recruitment_events from anon;
revoke all on public.event_checkins from anon;

-- Events: committee+ read all (incl. codes); board manages.
create policy recruitment_events_select on public.recruitment_events for select to authenticated
  using ((select public.is_committee_or_above()));
create policy recruitment_events_insert on public.recruitment_events for insert to authenticated
  with check ((select public.is_board()));
create policy recruitment_events_update on public.recruitment_events for update to authenticated
  using ((select public.is_board()))
  with check ((select public.is_board()));
create policy recruitment_events_delete on public.recruitment_events for delete to authenticated
  using ((select public.is_board()));

-- Check-ins: committee+ read all; an applicant may read their own. Inserts only
-- via check_in_by_phrase() (SECURITY DEFINER) — no client INSERT policy, so a
-- check-in can't be forged without the correct phrase.
create policy event_checkins_select on public.event_checkins for select to authenticated
  using (
    (select public.is_committee_or_above())
    or lower(email) = lower((select auth.email()))
  );

-- Public, safe-column-only listing of current open-rush events (no codes).
create view public.v_open_rush_events as
  select e.id, e.title, e.event_date, e.location
  from public.recruitment_events e
  join public.recruitment_cycles rc on rc.id = e.cycle_id
  where e.event_type = 'open_rush'
    and e.is_active = true
    and rc.is_active = true;

grant select on public.v_open_rush_events to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Applicant-side read/write RPCs. Applicants are auth users with NO members
--    row, so RLS hides candidates/event_checkins from them. These SECURITY
--    DEFINER functions scope strictly to the caller's own verified email.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.my_application()
returns table (
  stage public.candidate_stage,
  status public.candidate_status,
  display_code text,
  submitted_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select c.current_stage,
         c.status,
         'C' || lpad(c.per_cycle_seq::text, 2, '0'),
         c.created_at
  from public.candidates c
  where lower(c.email) = lower(auth.email())
    and c.deleted_at is null
    and c.cycle_id = (select id from public.recruitment_cycles where is_active)
  limit 1;
$$;

revoke execute on function public.my_application() from anon, public;
grant execute on function public.my_application() to authenticated;

create or replace function public.my_checkins()
returns table (
  event_title text,
  event_date timestamptz,
  checked_in_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select e.title, e.event_date, ck.created_at
  from public.event_checkins ck
  join public.recruitment_events e on e.id = ck.event_id
  where lower(ck.email) = lower(auth.email())
  order by ck.created_at desc;
$$;

revoke execute on function public.my_checkins() from anon, public;
grant execute on function public.my_checkins() to authenticated;

create or replace function public.check_in_by_phrase(p_phrase text)
returns text -- 'ok' | 'invalid' | 'duplicate' | 'unauthenticated'
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(auth.email());
  v_name text;
  v_event public.recruitment_events%rowtype;
begin
  if v_email is null then
    return 'unauthenticated';
  end if;

  select e.* into v_event
    from public.recruitment_events e
    join public.recruitment_cycles rc on rc.id = e.cycle_id
   where upper(trim(e.attendance_code)) = upper(trim(p_phrase))
     and e.event_type = 'open_rush'
     and e.is_active = true
     and rc.is_active = true
   limit 1;

  if not found then
    return 'invalid';
  end if;

  select coalesce(raw_user_meta_data ->> 'full_name', v_email)
    into v_name from auth.users where id = auth.uid();

  begin
    insert into public.event_checkins (event_id, email, applicant_name)
    values (v_event.id, v_email, v_name);
  exception when unique_violation then
    return 'duplicate';
  end;

  return 'ok';
end;
$$;

revoke execute on function public.check_in_by_phrase(text) from anon, public;
grant execute on function public.check_in_by_phrase(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Speed-dating team label on assignments (demo's team_number).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.evaluator_assignments add column team_label text;
;
