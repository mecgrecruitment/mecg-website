-- Two invariants that only the database can hold.
--
-- First: a withdrawn applicant stays withdrawn. rush.create_decision and
-- rush.apply_hash_result both refuse a WITHDRAWN application, but release did
-- not, so a decision locked before a withdrawal could still overwrite the
-- application status back to OFFERED and let rush.respond_to_offer accept it.
-- The re-check belongs here, after the row lock release already takes, because
-- the withdrawal and the release race in the same instant and only the lock
-- orders them.
create or replace function rush.release_decision(target_decision_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare d rush.decisions%rowtype; valid_approvals bigint;
begin
  select * into d from rush.decisions where id = target_decision_id for update;
  if d.id is null then raise exception 'decision missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(d.cycle_id, array['PANEL','OWNER']::rush.member_role[]) then raise exception 'panel role required' using errcode = '42501'; end if;
  if exists (select 1 from rush.conflict_declarations where application_id = d.application_id and declarer_id = rush.actor_id()) then raise exception 'conflict declared' using errcode = '42501'; end if;
  perform rush.assert_decision_ready(d.application_id);
  select count(*) into valid_approvals
  from rush.decision_approvals da
  join rush.profiles p on p.id = da.approver_id and p.active
  where da.decision_id = d.id
    and exists (select 1 from rush.memberships m where m.user_id = da.approver_id and m.cycle_id = d.cycle_id and m.active and m.role in ('PANEL','OWNER'))
    and not exists (select 1 from rush.conflict_declarations c where c.application_id = d.application_id and c.declarer_id = da.approver_id);
  if d.status <> 'LOCKED' or (valid_approvals < 2 and not d.hash_derived) then raise exception 'decision not locked' using errcode = '55000'; end if;

  perform 1 from rush.applications where id = d.application_id for update;
  if exists (select 1 from rush.applications where id = d.application_id and status = 'WITHDRAWN') then
    raise exception 'application withdrawn' using errcode = '55000';
  end if;
  update rush.applications
  set status = case d.outcome when 'OFFER' then 'OFFERED'::rush.application_status
                              when 'WAITLIST' then 'WAITLISTED'::rush.application_status
                              when 'REJECT' then 'REJECTED'::rush.application_status
                              else 'FINAL_REVIEW'::rush.application_status end
  where id = d.application_id;
  update rush.decisions set status = 'RELEASED', released_at = now() where id = d.id and status = 'LOCKED';
  insert into rush.notification_outbox (cycle_id, application_id, decision_id, recipient, template_key, template_version, idempotency_key)
  select d.cycle_id, d.application_id, d.id, p.contact, 'DECISION_RELEASED', 1, 'decision-release:' || d.id
  from rush.applications a join rush.pnms p on p.id = a.pnm_id where a.id = d.application_id
  on conflict (decision_id, template_key, template_version) do nothing;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (rush.actor_id(), d.cycle_id, 'DECISION_RELEASED', 'Decision', d.id);
end;
$$;

revoke all on function rush.release_decision(text) from public, anon;
grant execute on function rush.release_decision(text) to authenticated, service_role;

-- Second: a uniqname identifies exactly one applicant. rush.pnms.uniqname has
-- only a format CHECK, so two rows can share one uniqname, and then both
-- rush.staff_assisted_check_in and the festifall walkup lookup raise
-- 'ambiguous applicant identifier' with no override, dead-ending a check-in
-- line during a live event. Case-insensitive because those lookups compare
-- lower(coalesce(p.uniqname,'')).
--
-- Refuse rather than guess: if duplicates already exist, a migration cannot
-- know which row is the real applicant, so it fails and a human dedupes first.
do $$
declare duplicate_count integer;
begin
  select count(*) into duplicate_count from (
    select lower(uniqname) from rush.pnms where uniqname is not null group by 1 having count(*) > 1
  ) duplicates;
  if duplicate_count > 0 then
    raise exception 'refusing to enforce uniqname uniqueness: % duplicate values exist, dedupe them first', duplicate_count;
  end if;
end $$;

-- Built non-concurrently, which takes a brief exclusive lock on rush.pnms. One
-- cycle of applicants is a few thousand rows at most, so the pause is shorter
-- than the deploy around it and not worth the two-phase CONCURRENTLY dance.
create unique index if not exists pnms_uniqname_lower_idx on rush.pnms (lower(uniqname)) where uniqname is not null;
