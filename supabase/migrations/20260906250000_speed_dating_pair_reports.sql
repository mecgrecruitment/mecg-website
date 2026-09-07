create table rush.speed_dating_pair_reports (
  id text primary key default gen_random_uuid()::text,
  pair_id text not null references rush.speed_dating_pairs(id) on delete cascade,
  evaluator_id uuid not null references rush.profiles(id) on delete restrict,
  reason text not null default 'WRONG_PAIR' check (reason in ('WRONG_PAIR')),
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references rush.profiles(id) on delete restrict
);

create unique index speed_dating_pair_reports_open_unique
  on rush.speed_dating_pair_reports(pair_id, evaluator_id)
  where status = 'OPEN';
create index speed_dating_pair_reports_pair_status_idx
  on rush.speed_dating_pair_reports(pair_id, status, created_at desc);

alter table rush.speed_dating_pair_reports enable row level security;
alter table rush.speed_dating_pair_reports force row level security;
revoke all on rush.speed_dating_pair_reports from public, anon, authenticated;
grant select, insert, update, delete on rush.speed_dating_pair_reports to service_role;

create function rush.report_wrong_speed_dating_pair(target_pair_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  pair_row rush.speed_dating_pairs%rowtype;
  cycle_id text;
  report_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into pair_row from rush.speed_dating_pairs where id = target_pair_id;
  if pair_row.id is null then raise exception 'pair missing' using errcode = 'P0002'; end if;
  select round.cycle_id into cycle_id from rush.rounds round where round.id = pair_row.round_id;
  if not exists (
    select 1 from rush.speed_dating_pair_claims claim
    where claim.pair_id = target_pair_id and claim.evaluator_id = actor and claim.submitted_at is null
  ) then raise exception 'open claim required' using errcode = '55000'; end if;

  insert into rush.speed_dating_pair_reports(pair_id, evaluator_id)
  values(target_pair_id, actor)
  on conflict (pair_id, evaluator_id) where status = 'OPEN'
  do update set created_at = excluded.created_at
  returning id into report_id;

  insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id, metadata)
  values(actor, cycle_id, 'SPEED_DATING_WRONG_PAIR_REPORTED', 'SpeedDatingPair', target_pair_id,
         jsonb_build_object('reportId', report_id));
  return jsonb_build_object('pairId', target_pair_id, 'reported', true);
end;
$$;

revoke all on function rush.report_wrong_speed_dating_pair(text) from public, anon;
grant execute on function rush.report_wrong_speed_dating_pair(text) to authenticated, service_role;
