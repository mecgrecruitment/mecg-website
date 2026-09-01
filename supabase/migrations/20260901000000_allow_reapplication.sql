-- Applicants may reapply in a later cycle. The schema already allowed it:
-- rush.pnms is one row per person (auth_user_id and normalized_contact are
-- both unique) and rush.applications is unique (pnm_id, cycle_id), so a second
-- cycle is a second row for the same person. save_application_draft already
-- inserts per cycle.
--
-- Routing was the blocker. rush.is_applicant() answers "have you ever applied"
-- and resolve_auth_destination sends that to /applicant, while /apply bounces
-- anyone whose destination is not /apply. A student rejected last cycle was
-- redirected to the old decision forever with no route to a new application.
--
-- This adds the question routing actually needs: is there an open cycle the
-- caller has not applied to yet. It mirrors rush.intake_schema exactly, same
-- single-cycle selection and same portal gate, so /apply can never disagree
-- with the destination that sent the user there.
create or replace function rush.can_start_application()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with open_cycle as (
    select c.id
    from rush.rush_cycles c
    where c.status = 'OPEN'
      and (c.opens_at is null or c.opens_at <= now())
      and (c.closes_at is null or c.closes_at >= now())
    order by c.created_at desc
    limit 1
  )
  select exists (
    select 1
    from open_cycle o
    where rush.application_portal_allows(auth.uid())
      and not exists (
        select 1
        from rush.applications a
        join rush.pnms p on p.id = a.pnm_id
        where p.auth_user_id = auth.uid() and a.cycle_id = o.id
      )
  );
$$;

revoke all on function rush.can_start_application() from public, anon;
grant execute on function rush.can_start_application() to authenticated, service_role;
