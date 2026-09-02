-- Two gaps in how the system talks to applicants.
--
-- First: nothing recorded that an email was ever sent. Three send sites exist
-- (application received, contact relay, decision released) and all three fire
-- and forget, so "did anyone actually tell them?" could only be answered by
-- asking whoever pressed the button. rush.messages is the log.
--
-- Second: rush.release_decision releases exactly one decision. On decision
-- night that is sixty separate calls, each of which can half-fail, with no
-- record of how far the board got. release_ready_decisions does the whole
-- cycle in one transaction and reports the count.
create table if not exists rush.messages (
  id text primary key default gen_random_uuid()::text,
  cycle_id text references rush.rush_cycles (id) on delete set null,
  application_id text references rush.applications (id) on delete set null,
  recipient text not null check (char_length(trim(recipient)) between 3 and 254),
  subject text not null check (char_length(trim(subject)) between 1 and 200),
  kind text not null check (char_length(trim(kind)) between 1 and 60),
  delivered boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_application_created_idx on rush.messages (application_id, created_at desc);
create index if not exists messages_cycle_created_idx on rush.messages (cycle_id, created_at desc);
alter table rush.messages enable row level security;
alter table rush.messages force row level security;
-- Staff read the log for their own cycle; an applicant reads their own
-- messages, which is what the portal's future message list needs. Writes go
-- only through log_message, matching every other table here.
drop policy if exists messages_read_internal on rush.messages;
create policy messages_read_internal on rush.messages for select to authenticated
using (
  rush.has_cycle_role(cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[])
  or exists (
    select 1 from rush.applications a
    join rush.pnms p on p.id = a.pnm_id
    where a.id = messages.application_id and p.auth_user_id = auth.uid()
  )
);
grant select on rush.messages to authenticated;
-- Called right after a send attempt. Delivery is best effort by design, so a
-- failed send is logged as delivered = false rather than thrown away.
create or replace function rush.log_message(
  target_application_id text,
  message_kind text,
  message_recipient text,
  message_subject text,
  was_delivered boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  app_row rush.applications%rowtype;
  message_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into app_row from rush.applications where id = target_application_id;
  if app_row.id is null then raise exception 'application missing' using errcode = 'P0002'; end if;

  -- Either the applicant themselves (the intake confirmation) or staff acting
  -- on the cycle (everything else).
  if not (
    exists (select 1 from rush.pnms p where p.id = app_row.pnm_id and p.auth_user_id = actor)
    or rush.has_cycle_role(app_row.cycle_id, array['BOARD','PANEL','OWNER','RECRUITMENT_COMMITTEE']::rush.member_role[])
  ) then raise exception 'forbidden' using errcode = '42501'; end if;

  insert into rush.messages (cycle_id, application_id, recipient, subject, kind, delivered)
  values (app_row.cycle_id, app_row.id, trim(message_recipient), trim(message_subject), trim(message_kind), coalesce(was_delivered, false))
  returning id into message_id;
  return message_id;
end;
$$;
revoke all on function rush.log_message(text, text, text, text, boolean) from public, anon;
grant execute on function rush.log_message(text, text, text, text, boolean) to authenticated, service_role;
-- Releases every decision in a cycle that release_decision would accept, and
-- skips the rest rather than failing the batch. Reuses release_decision itself
-- so the approval count, conflict and status rules cannot drift apart from the
-- single-decision path.
create or replace function rush.release_ready_decisions(target_cycle_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  decision_row record;
  released integer := 0;
  skipped integer := 0;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not rush.has_cycle_role(target_cycle_id, array['PANEL','OWNER']::rush.member_role[]) then
    raise exception 'panel role required' using errcode = '42501';
  end if;

  for decision_row in
    select d.id from rush.decisions d
    where d.cycle_id = target_cycle_id and d.status = 'LOCKED'
    order by d.created_at
  loop
    begin
      perform rush.release_decision(decision_row.id);
      released := released + 1;
    exception when others then
      -- A decision the caller is conflicted on, or one that lost an approval,
      -- must not strand the other fifty-nine.
      skipped := skipped + 1;
    end;
  end loop;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (auth.uid(), target_cycle_id, 'DECISIONS_RELEASED_BATCH', 'RushCycle', target_cycle_id,
          jsonb_build_object('released', released, 'skipped', skipped));
  return jsonb_build_object('released', released, 'skipped', skipped);
end;
$$;
revoke all on function rush.release_ready_decisions(text) from public, anon;
grant execute on function rush.release_ready_decisions(text) to authenticated, service_role;
