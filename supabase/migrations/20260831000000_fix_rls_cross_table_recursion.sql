-- The live migration ledger predates the helper definitions now present in the local copies of
-- 20260830090000 and 20260830100000. Define the two helpers this migration uses before replacing
-- policies so an already-linked database can move forward without rewriting applied migrations.
create or replace function rush.actor_has_application_conflict(target_application_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from rush.conflict_declarations c
    where c.application_id = target_application_id and c.declarer_id = auth.uid()
  );
$$;
revoke all on function rush.actor_has_application_conflict(text) from public,anon;
grant execute on function rush.actor_has_application_conflict(text) to authenticated;

create or replace function rush.actor_has_application_in_cycle(target_cycle_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from rush.applications a
    join rush.pnms p on p.id = a.pnm_id
    where a.cycle_id = target_cycle_id and p.auth_user_id = auth.uid()
  );
$$;
revoke all on function rush.actor_has_application_in_cycle(text) from public,anon;
grant execute on function rush.actor_has_application_in_cycle(text) to authenticated;

-- These six policies still queried rush.applications/rush.pnms/rush.conflict_declarations with a
-- raw subquery instead of the security definer helpers introduced in
-- 20260830090000_recruitment_committee_role.sql and 20260830100000_harden_applicant_workflow.sql.
-- Each lives in an already-committed migration, so it is fixed here rather than edited in place.
-- Confirmed against a real Postgres instance that leaving any one of these unconverted reproduces
-- "infinite recursion detected in policy for relation ..." for a real query through it.

drop policy if exists buddy_slots_read on rush.buddy_slots;
create policy buddy_slots_read on rush.buddy_slots for select to authenticated
using (
  member_id = auth.uid()
  or rush.has_cycle_role(cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
  or rush.actor_has_application_in_cycle(cycle_id)
);

drop policy if exists groups_read on rush.case_groups;
create policy groups_read on rush.case_groups for select to authenticated
using (
  rush.has_cycle_role(cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
  or rush.actor_has_application_in_cycle(cycle_id)
);

drop policy if exists slots_read on rush.event_slots;
create policy slots_read on rush.event_slots for select to authenticated
using (
  exists (
    select 1 from rush.events e
    where e.id = event_slots.event_id
      and (
        rush.has_cycle_role(e.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
        or rush.actor_has_application_in_cycle(e.cycle_id)
      )
  )
);

drop policy if exists evaluations_read_author_or_locked_panel on rush.evaluations;
create policy evaluations_read_author_or_locked_panel on rush.evaluations for select to authenticated
using (
  evaluator_id = auth.uid()
  or exists (
    select 1 from rush.evaluation_assignments ea
    join rush.rounds r on r.id = ea.round_id
    where ea.id = evaluations.assignment_id
      and evaluations.status = 'LOCKED'
      and rush.has_cycle_role(r.cycle_id, array['PANEL','OWNER']::rush.member_role[])
      and not rush.actor_has_application_conflict(ea.application_id)
  )
);

drop policy if exists decisions_read_owner_or_panel on rush.decisions;
create policy decisions_read_owner_or_panel on rush.decisions for select to authenticated
using (
  (status = 'RELEASED' and rush.owns_application(application_id))
  or (
    rush.has_cycle_role(cycle_id, array['PANEL','OWNER']::rush.member_role[])
    and not rush.actor_has_application_conflict(application_id)
  )
);

drop policy if exists responses_read_owner_or_board on rush.application_responses;
create policy responses_read_owner_or_board on rush.application_responses for select to authenticated
using (
  exists (
    select 1 from rush.applications a
    where a.id = application_responses.application_id
      and (rush.owns_application(a.id) or rush.has_cycle_role(a.cycle_id, array['BOARD','OWNER']::rush.member_role[]))
      and not (
        rush.actor_has_application_conflict(a.id)
        and rush.has_cycle_role(a.cycle_id, array['BOARD','OWNER']::rush.member_role[])
      )
  )
);
