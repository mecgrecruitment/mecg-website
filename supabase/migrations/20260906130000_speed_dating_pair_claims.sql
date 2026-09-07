-- Speed Dating is run with two applicants at a time. The pair is only an
-- operational container: each applicant still receives an independent
-- evaluation when scoring is submitted.

create table rush.speed_dating_pairs (
  id text primary key default gen_random_uuid()::text,
  round_id text not null references rush.rounds(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 80),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED')),
  created_by uuid not null references rush.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, label),
  unique (id, round_id)
);

create table rush.speed_dating_pair_members (
  pair_id text not null,
  round_id text not null,
  application_id text not null references rush.applications(id) on delete restrict,
  position smallint not null check (position in (1, 2)),
  primary key (pair_id, application_id),
  unique (pair_id, position),
  unique (round_id, application_id),
  foreign key (pair_id, round_id)
    references rush.speed_dating_pairs(id, round_id) on delete cascade
);

create table rush.speed_dating_pair_claims (
  pair_id text not null references rush.speed_dating_pairs(id) on delete cascade,
  evaluator_id uuid not null references rush.profiles(id) on delete restrict,
  claimed_at timestamptz not null default now(),
  submitted_at timestamptz,
  primary key (pair_id, evaluator_id)
);

create index speed_dating_pairs_round_status_idx
  on rush.speed_dating_pairs(round_id, status, label);
create index speed_dating_pair_claims_evaluator_idx
  on rush.speed_dating_pair_claims(evaluator_id, claimed_at desc);

alter table rush.speed_dating_pairs enable row level security;
alter table rush.speed_dating_pairs force row level security;
alter table rush.speed_dating_pair_members enable row level security;
alter table rush.speed_dating_pair_members force row level security;
alter table rush.speed_dating_pair_claims enable row level security;
alter table rush.speed_dating_pair_claims force row level security;

revoke all on rush.speed_dating_pairs from public, anon, authenticated;
revoke all on rush.speed_dating_pair_members from public, anon, authenticated;
revoke all on rush.speed_dating_pair_claims from public, anon, authenticated;
grant select, insert, update, delete on rush.speed_dating_pairs to service_role;
grant select, insert, update, delete on rush.speed_dating_pair_members to service_role;
grant select, insert, update, delete on rush.speed_dating_pair_claims to service_role;

-- Board setup is an atomic replace so a partially saved pair list can never be
-- published. An applicant can appear in exactly one pair for a round.
create or replace function rush.replace_speed_dating_pairs(
  target_round_id text,
  submitted_pairs jsonb,
  publish_pairs boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
  pair_input jsonb;
  pair_id text;
  pair_number integer := 0;
  application_id text;
begin
  if actor is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select * into round_row from rush.rounds where id = target_round_id for update;
  if round_row.id is null then
    raise exception 'round missing' using errcode = 'P0002';
  end if;
  if round_row.kind <> 'SPEED_DATING' then
    raise exception 'round must be Speed Dating' using errcode = '22023';
  end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['BOARD','OWNER']::rush.member_role[]) then
    raise exception 'board role required' using errcode = '42501';
  end if;
  if round_row.status not in ('DRAFT', 'PUBLISHED') then
    raise exception 'pairs lock when the round opens' using errcode = '55000';
  end if;
  if jsonb_typeof(submitted_pairs) <> 'array'
     or jsonb_array_length(submitted_pairs) < 1
     or jsonb_array_length(submitted_pairs) > 200 then
    raise exception 'provide between 1 and 200 pairs' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(submitted_pairs) p
    where jsonb_typeof(p->'applicationIds') <> 'array'
       or jsonb_array_length(p->'applicationIds') <> 2
       or (select count(distinct value) from jsonb_array_elements_text(p->'applicationIds')) <> 2
       or exists (
         select 1 from jsonb_array_elements_text(p->'applicationIds') item(value)
         where nullif(trim(value), '') is null
       )
  ) then
    raise exception 'every pair needs two distinct application ids' using errcode = '22023';
  end if;
  if (
    select count(*) from (
      select item.value
      from jsonb_array_elements(submitted_pairs) p,
           jsonb_array_elements_text(p->'applicationIds') item(value)
    ) all_members
  ) <> (
    select count(distinct all_members.value) from (
      select item.value
      from jsonb_array_elements(submitted_pairs) p,
           jsonb_array_elements_text(p->'applicationIds') item(value)
    ) all_members
  ) then
    raise exception 'an applicant can appear in only one pair' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(submitted_pairs) p,
         jsonb_array_elements_text(p->'applicationIds') item(application_id)
    where not exists (
      select 1
      from rush.round_participations participation
      join rush.applications application on application.id = participation.application_id
      where participation.round_id = target_round_id
        and participation.application_id = item.application_id
        and application.cycle_id = round_row.cycle_id
    )
  ) then
    raise exception 'every applicant must be advanced into this round' using errcode = '22023';
  end if;
  if publish_pairs and (
    select count(*) from rush.round_participations where round_id = target_round_id
  ) <> jsonb_array_length(submitted_pairs) * 2 then
    raise exception 'every advanced applicant must be included before publishing pairs' using errcode = '22023';
  end if;
  if exists (
    select 1 from rush.speed_dating_pair_claims claim
    join rush.speed_dating_pairs pair on pair.id = claim.pair_id
    where pair.round_id = target_round_id
  ) then
    raise exception 'claimed pairs cannot be replaced' using errcode = '55000';
  end if;

  delete from rush.speed_dating_pairs where round_id = target_round_id;
  for pair_input in select value from jsonb_array_elements(submitted_pairs)
  loop
    pair_number := pair_number + 1;
    insert into rush.speed_dating_pairs (round_id, label, status, created_by, published_at)
    values (
      target_round_id,
      'Pair ' || lpad(pair_number::text, 2, '0'),
      case when publish_pairs then 'PUBLISHED' else 'DRAFT' end,
      actor,
      case when publish_pairs then now() else null end
    ) returning id into pair_id;

    insert into rush.speed_dating_pair_members (pair_id, round_id, application_id, position)
    select pair_id, target_round_id, item.value, item.ordinality::smallint
    from jsonb_array_elements_text(pair_input->'applicationIds') with ordinality item(value, ordinality);
  end loop;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (
    actor,
    round_row.cycle_id,
    case when publish_pairs then 'SPEED_DATING_PAIRS_PUBLISHED' else 'SPEED_DATING_PAIRS_SAVED' end,
    'Round',
    target_round_id,
    jsonb_build_object('pairCount', pair_number)
  );
  return jsonb_build_object('roundId', target_round_id, 'pairCount', pair_number, 'published', publish_pairs);
end;
$$;

-- The live queue deliberately omits conflicted pairs instead of disclosing
-- their names with a disabled claim button.
create or replace function rush.my_speed_dating_pairs(target_round_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if round_row.kind <> 'SPEED_DATING'
     or not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
     or rush.is_active_screening_reviewer(round_row.cycle_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'roundId', round_row.id,
    'roundName', round_row.name,
    'roundStatus', round_row.status::text,
    'pairs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pair.id,
        'label', pair.label,
        'claimed', claim.pair_id is not null,
        'members', members.items
      ) order by pair.label)
      from rush.speed_dating_pairs pair
      left join rush.speed_dating_pair_claims claim
        on claim.pair_id = pair.id and claim.evaluator_id = actor
      cross join lateral (
        select jsonb_agg(jsonb_build_object(
          'applicationId', member.application_id,
          'name', pnm.name,
          'position', member.position
        ) order by member.position) as items
        from rush.speed_dating_pair_members member
        join rush.applications application on application.id = member.application_id
        join rush.pnms pnm on pnm.id = application.pnm_id
        where member.pair_id = pair.id
      ) members
      where pair.round_id = target_round_id
        and pair.status = 'PUBLISHED'
        and not exists (
          select 1
          from rush.speed_dating_pair_members member
          join rush.conflict_declarations conflict
            on conflict.application_id = member.application_id and conflict.declarer_id = actor
          where member.pair_id = pair.id
        )
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function rush.claim_speed_dating_pair(target_pair_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  pair_row rush.speed_dating_pairs%rowtype;
  round_row rush.rounds%rowtype;
  created_count integer;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into pair_row from rush.speed_dating_pairs where id = target_pair_id for update;
  if pair_row.id is null then raise exception 'pair missing' using errcode = 'P0002'; end if;
  select * into round_row from rush.rounds where id = pair_row.round_id for update;
  if pair_row.status <> 'PUBLISHED'
     or round_row.status <> 'ACTIVE'
     or (round_row.closes_at is not null and round_row.closes_at < now()) then
    raise exception 'pair is not open for grading' using errcode = '55000';
  end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
     or rush.is_active_screening_reviewer(round_row.cycle_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (
    select 1
    from rush.speed_dating_pair_members member
    join rush.conflict_declarations conflict
      on conflict.application_id = member.application_id and conflict.declarer_id = actor
    where member.pair_id = pair_row.id
  ) then
    raise exception 'conflict declared' using errcode = '42501';
  end if;

  insert into rush.speed_dating_pair_claims (pair_id, evaluator_id)
  values (pair_row.id, actor)
  on conflict (pair_id, evaluator_id) do nothing;
  get diagnostics created_count = row_count;

  if created_count = 1 then
    insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
    values (actor, round_row.cycle_id, 'SPEED_DATING_PAIR_CLAIMED', 'SpeedDatingPair', pair_row.id);
  end if;

  return jsonb_build_object('pairId', pair_row.id, 'claimed', true);
end;
$$;

revoke all on function rush.replace_speed_dating_pairs(text, jsonb, boolean) from public, anon;
revoke all on function rush.my_speed_dating_pairs(text) from public, anon;
revoke all on function rush.claim_speed_dating_pair(text) from public, anon;
grant execute on function rush.replace_speed_dating_pairs(text, jsonb, boolean) to authenticated, service_role;
grant execute on function rush.my_speed_dating_pairs(text) to authenticated, service_role;
grant execute on function rush.claim_speed_dating_pair(text) to authenticated, service_role;
