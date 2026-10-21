begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.plan(2);

-- The once-per-statement RLS helpers bypass row security, so each must stay a
-- hardened definer that only signed-in callers can run.
select extensions.is(
  (select count(*)::int from pg_proc p
   where p.pronamespace = 'rush'::regnamespace
     and p.proname in ('actor_cycles_with_role', 'actor_cycles_with_capability', 'actor_active_screening_reviewer_cycles',
       'actor_conflicted_application_ids', 'actor_assigned_application_ids', 'actor_owned_application_ids',
       'actor_application_cycle_ids', 'actor_readable_colleague_ids', 'actor_managed_application_ids')
     and p.prosecdef and p.proretset and p.provolatile = 's' and p.proconfig @> array['search_path=""']
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and not has_function_privilege('anon', p.oid, 'EXECUTE')),
  9,
  'every actor set helper is a stable, hardened definer callable only when signed in'
);
select extensions.is(
  (select count(*)::int from pg_policies where schemaname = 'rush' and qual ~ 'rush\.(has_cycle_role|has_cycle_capability|is_active_screening_reviewer|owns_application|actor_has_application_conflict|actor_is_assigned_evaluator|actor_has_application_in_cycle|actor_manages_application_cycle|actor_can_read_colleague_profile)\('),
  0,
  'no read policy calls a per-row helper'
);

select * from extensions.finish();
rollback;
