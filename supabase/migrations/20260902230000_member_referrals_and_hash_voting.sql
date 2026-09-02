-- Two member-facing changes to how a class gets picked.
--
-- Referrals: recruiting has always happened in group chats, so the names never
-- reached the board. A member-submitted referral row makes that pipeline visible
-- and reviewable without giving members any applicant-operations power.
--
-- Hash voting: the outcome used to rest on the PANEL role alone. Every active
-- member now votes and the tally binds, so the board's remaining act is
-- releasing a result it cannot author. rush.rush_cycles.hash_quorum is what
-- stops a low-turnout night from letting three people decide a membership.
-- The existing decision and release machinery is untouched: a bound tally
-- becomes an ordinary LOCKED rush.decisions row.

alter table rush.rush_cycles
  add column if not exists hash_quorum int not null default 5 check (hash_quorum between 1 and 500);

create table rush.referrals (
  id text primary key default gen_random_uuid()::text,
  cycle_id text not null references rush.rush_cycles (id) on delete cascade,
  referrer_id uuid not null references rush.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 255),
  normalized_email text not null check (char_length(normalized_email) between 3 and 255),
  year_major text not null default '' check (char_length(year_major) <= 120),
  reason text not null check (char_length(reason) between 1 and 2000),
  status text not null default 'NEW' check (status in ('NEW', 'REVIEWED', 'INVITED', 'PASSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One member cannot refer the same person twice in a cycle. Two different
-- members referring the same person is signal, not spam, so it stays allowed.
create unique index referrals_cycle_referrer_normalized_email_idx
  on rush.referrals (cycle_id, referrer_id, normalized_email);
create index referrals_cycle_status_idx on rush.referrals (cycle_id, status);

create table rush.hash_votes (
  id text primary key default gen_random_uuid()::text,
  cycle_id text not null references rush.rush_cycles (id) on delete cascade,
  application_id text not null references rush.applications (id) on delete cascade,
  voter_id uuid not null references rush.profiles (id) on delete cascade,
  vote text not null check (vote in ('YES', 'NO', 'UNSURE')),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, voter_id)
);

create index hash_votes_cycle_application_idx on rush.hash_votes (cycle_id, application_id);

create or replace function rush.submit_referral(
  target_cycle_id text,
  referral_name text,
  referral_email text,
  referral_year_major text,
  referral_reason text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  cycle_row rush.rush_cycles%rowtype;
  clean_name text := trim(coalesce(referral_name, ''));
  clean_email text := trim(coalesce(referral_email, ''));
  clean_year_major text := trim(coalesce(referral_year_major, ''));
  clean_reason text := trim(coalesce(referral_reason, ''));
  clean_normalized_email text := lower(trim(coalesce(referral_email, '')));
  referral_count integer;
  result_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not rush.has_cycle_role(
    target_cycle_id,
    array['MEMBER', 'BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE']::rush.member_role[]
  ) then
    raise exception 'membership required' using errcode = '42501';
  end if;
  select * into cycle_row from rush.rush_cycles where id = target_cycle_id;
  if cycle_row.id is null then raise exception 'cycle missing' using errcode = 'P0002'; end if;
  if cycle_row.status in ('CLOSED', 'ARCHIVED') then
    raise exception 'cycle is finished' using errcode = '55000';
  end if;
  if char_length(clean_name) not between 1 and 120 then
    raise exception 'invalid referral name' using errcode = '22023';
  end if;
  if char_length(clean_email) not between 3 and 255 or position('@' in clean_normalized_email) = 0 then
    raise exception 'invalid referral email' using errcode = '22023';
  end if;
  if char_length(clean_year_major) > 120 then
    raise exception 'invalid referral year and major' using errcode = '22023';
  end if;
  if char_length(clean_reason) not between 1 and 2000 then
    raise exception 'invalid referral reason' using errcode = '22023';
  end if;
  select count(*) into referral_count
  from rush.referrals r
  where r.cycle_id = target_cycle_id and r.referrer_id = actor;
  if referral_count >= 20 then
    raise exception 'referral limit reached for this cycle' using errcode = '53400';
  end if;

  begin
    insert into rush.referrals (cycle_id, referrer_id, name, email, normalized_email, year_major, reason)
    values (target_cycle_id, actor, clean_name, clean_email, clean_normalized_email, clean_year_major, clean_reason)
    returning id into result_id;
  exception when unique_violation then
    raise exception 'you already referred this person' using errcode = '23505';
  end;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, target_cycle_id, 'REFERRAL_SUBMITTED', 'Referral', result_id, '{}'::jsonb);
  return result_id;
end;
$$;

create or replace function rush.set_referral_status(target_referral_id text, next_status text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  referral_row rush.referrals%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into referral_row from rush.referrals where id = target_referral_id for update;
  if referral_row.id is null then raise exception 'referral missing' using errcode = 'P0002'; end if;
  if not (
    rush.has_cycle_role(referral_row.cycle_id, array['BOARD', 'OWNER']::rush.member_role[])
    or rush.has_cycle_capability(referral_row.cycle_id, 'APPLICANT_OPERATIONS')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if next_status is null or next_status not in ('NEW', 'REVIEWED', 'INVITED', 'PASSED') then
    raise exception 'invalid referral status' using errcode = '22023';
  end if;

  update rush.referrals r set status = next_status, updated_at = now()
  where r.id = referral_row.id;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, referral_row.cycle_id, 'REFERRAL_STATUS_SET', 'Referral', referral_row.id,
          jsonb_build_object('previousStatus', referral_row.status, 'nextStatus', next_status));
  return true;
end;
$$;

create or replace function rush.cast_hash_vote(target_application_id text, vote_value text, vote_note text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  app_row rush.applications%rowtype;
  clean_note text := coalesce(vote_note, '');
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into app_row from rush.applications where id = target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(
    app_row.cycle_id,
    array['MEMBER', 'BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE']::rush.member_role[]
  ) then
    raise exception 'membership required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from rush.rush_cycles c where c.id = app_row.cycle_id and c.status = 'DECISION_LOCK'
  ) then
    raise exception 'voting is not open' using errcode = '55000';
  end if;
  if exists (
    select 1 from rush.conflict_declarations cd
    where cd.application_id = app_row.id and cd.declarer_id = actor
  ) then
    raise exception 'conflict declared for this applicant' using errcode = '42501';
  end if;
  if app_row.status in ('DRAFT', 'WITHDRAWN') then
    raise exception 'application is not votable' using errcode = '55000';
  end if;
  if vote_value is null or vote_value not in ('YES', 'NO', 'UNSURE') then
    raise exception 'invalid vote' using errcode = '22023';
  end if;
  if char_length(clean_note) > 1000 then
    raise exception 'note too long' using errcode = '22023';
  end if;

  insert into rush.hash_votes (cycle_id, application_id, voter_id, vote, note)
  values (app_row.cycle_id, app_row.id, actor, vote_value, clean_note)
  on conflict (application_id, voter_id)
  do update set vote = excluded.vote, note = excluded.note, updated_at = now();

  -- The ballot is private: staff can read the audit trail, so the vote value
  -- never leaves this function. Only the fact that the actor voted is recorded.
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, app_row.cycle_id, 'HASH_VOTE_CAST', 'Application', app_row.id, '{}'::jsonb);
  return true;
end;
$$;

create or replace function rush.hash_tally(target_cycle_id text)
returns table (
  application_id text,
  yes_count int,
  no_count int,
  unsure_count int,
  total_votes int,
  quorum int,
  outcome text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cycle_quorum int;
begin
  if rush.actor_id() is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  -- Board only. `grant execute ... to authenticated` means any member could
  -- call this straight from a browser console, and a live running count is
  -- exactly what a secret ballot must not expose: seeing an applicant sitting
  -- at 3 yes / 9 no tells you how to vote. Members read the quorum they need
  -- from rush.rush_cycles.hash_quorum instead, which carries no counts.
  if not rush.has_cycle_role(
    target_cycle_id,
    array['BOARD', 'PANEL', 'OWNER']::rush.member_role[]
  ) then
    raise exception 'board role required' using errcode = '42501';
  end if;
  select c.hash_quorum into cycle_quorum from rush.rush_cycles c where c.id = target_cycle_id;
  if cycle_quorum is null then raise exception 'cycle missing' using errcode = 'P0002'; end if;

  return query
  select a.id,
    count(*) filter (where v.vote = 'YES')::int,
    count(*) filter (where v.vote = 'NO')::int,
    count(*) filter (where v.vote = 'UNSURE')::int,
    count(v.id)::int,
    cycle_quorum,
    case
      when count(v.id) < cycle_quorum then 'PENDING'
      when count(*) filter (where v.vote = 'YES') > count(*) filter (where v.vote = 'NO') then 'OFFER'
      else 'REJECT'
    end
  from rush.applications a
  left join rush.hash_votes v on v.application_id = a.id
  where a.cycle_id = target_cycle_id
    and a.status not in ('DRAFT', 'WITHDRAWN')
  group by a.id
  order by a.id;
end;
$$;

create or replace function rush.apply_hash_result(target_application_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  app_row rush.applications%rowtype;
  cycle_row rush.rush_cycles%rowtype;
  yes_votes int;
  no_votes int;
  unsure_votes int;
  total_cast int;
  computed_outcome rush.decision_outcome;
  existing_id text;
  result_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into app_row from rush.applications where id = target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(app_row.cycle_id, array['BOARD', 'PANEL', 'OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into cycle_row from rush.rush_cycles where id = app_row.cycle_id;
  if cycle_row.status <> 'DECISION_LOCK' then
    raise exception 'voting is not open' using errcode = '55000';
  end if;

  -- The outcome is recomputed here and never taken from the caller: a board
  -- member applying a result must not be able to apply a different one.
  select
    count(*) filter (where v.vote = 'YES')::int,
    count(*) filter (where v.vote = 'NO')::int,
    count(*) filter (where v.vote = 'UNSURE')::int,
    count(*)::int
  into yes_votes, no_votes, unsure_votes, total_cast
  from rush.hash_votes v
  where v.application_id = app_row.id;
  if total_cast < cycle_row.hash_quorum then
    raise exception 'not enough votes yet' using errcode = '55000';
  end if;

  select d.id into existing_id
  from rush.decisions d
  where d.application_id = app_row.id
    and d.status in ('PENDING', 'APPROVED', 'LOCKED', 'RELEASED');
  if existing_id is not null then return existing_id; end if;

  computed_outcome := case when yes_votes > no_votes then 'OFFER' else 'REJECT' end;
  -- PENDING, not LOCKED. The decision then goes through the existing two-approval
  -- path: approve_decision only accepts PENDING or APPROVED, and release_decision
  -- demands status LOCKED with at least two approvals. Inserting a LOCKED row with
  -- zero approvals produces a decision that can never be approved and never released.
  insert into rush.decisions (cycle_id, application_id, outcome, status, reason, created_by_id)
  values (app_row.cycle_id, app_row.id, computed_outcome, 'PENDING',
          format('Member vote: %s yes, %s no, %s unsure', yes_votes, no_votes, unsure_votes),
          actor)
  returning id into result_id;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, app_row.cycle_id, 'HASH_RESULT_APPLIED', 'Decision', result_id,
          jsonb_build_object(
            'applicationId', app_row.id,
            'yesCount', yes_votes,
            'noCount', no_votes,
            'unsureCount', unsure_votes,
            'totalVotes', total_cast,
            'quorum', cycle_row.hash_quorum,
            'outcome', computed_outcome
          ));
  return result_id;
end;
$$;

create or replace function rush.hash_notes(target_cycle_id text)
returns table (application_id text, note text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if rush.actor_id() is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not rush.has_cycle_role(
    target_cycle_id,
    array['BOARD', 'PANEL', 'OWNER']::rush.member_role[]
  ) then
    raise exception 'board role required' using errcode = '42501';
  end if;

  -- No voter_id, and no created_at: an ordered-by-time list of notes could be
  -- lined up against the audit log's HASH_VOTE_CAST timestamps to re-attribute
  -- them. Ordering by a hash of the row id breaks that correlation.
  return query
  select v.application_id, v.note
  from rush.hash_votes v
  where v.cycle_id = target_cycle_id
    and char_length(trim(v.note)) > 0
  order by v.application_id, extensions.digest(v.id, 'sha256');
end;
$$;

-- The ballot list. rush.member_applicants cannot serve this: it excludes anyone
-- who is an active screening reviewer (so those members would see nothing to
-- vote on at all), it keeps DRAFT and WITHDRAWN applications that
-- rush.cast_hash_vote then refuses, and it ignores conflict declarations. Every
-- row this returns is one the caller may actually vote on.
create or replace function rush.hash_ballot(target_cycle_id text)
returns table (id text, name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not rush.has_cycle_role(
    target_cycle_id,
    array['MEMBER', 'BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE']::rush.member_role[]
  ) then
    raise exception 'membership required' using errcode = '42501';
  end if;

  return query
  select a.id, p.name
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where a.cycle_id = target_cycle_id
    and a.status not in ('DRAFT', 'WITHDRAWN')
    and not exists (
      select 1 from rush.conflict_declarations cd
      where cd.application_id = a.id and cd.declarer_id = actor
    )
  order by p.name;
end;
$$;

alter table rush.referrals enable row level security;
alter table rush.referrals force row level security;
alter table rush.hash_votes enable row level security;
alter table rush.hash_votes force row level security;

-- Both tables are select-only; every write goes through the RPCs above.
create policy referrals_read_own_or_staff on rush.referrals
for select to authenticated
using (
  referrer_id = rush.actor_id()
  or rush.has_cycle_role(
    cycle_id,
    array['BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE']::rush.member_role[]
  )
);

-- A secret ballot, and secret from the board too. Nobody reads an individual
-- vote but the member who cast it. The board works from rush.hash_tally
-- (counts) and rush.hash_notes (notes with no author), both security definer,
-- so no role needs row access here. An attributable ballot invites members to
-- vote the way they think the board wants.
create policy hash_votes_read_own on rush.hash_votes
for select to authenticated
using (voter_id = rush.actor_id());

grant select on rush.referrals, rush.hash_votes to authenticated;
grant all on rush.referrals, rush.hash_votes to service_role;

revoke all on function
  rush.submit_referral(text, text, text, text, text),
  rush.set_referral_status(text, text),
  rush.cast_hash_vote(text, text, text),
  rush.hash_tally(text),
  rush.hash_notes(text),
  rush.hash_ballot(text),
  rush.apply_hash_result(text)
from public, anon;
grant execute on function
  rush.submit_referral(text, text, text, text, text),
  rush.set_referral_status(text, text),
  rush.cast_hash_vote(text, text, text),
  rush.hash_tally(text),
  rush.hash_notes(text),
  rush.hash_ballot(text),
  rush.apply_hash_result(text)
to authenticated, service_role;
