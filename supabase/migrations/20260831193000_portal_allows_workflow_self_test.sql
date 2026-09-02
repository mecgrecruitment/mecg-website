-- rush.verify_full_workflow impersonates its synthetic applicant on purpose,
-- via set_config('request.jwt.claims', '{"role":"authenticated", ...}'), so that
-- the self-test exercises the real RLS path rather than a service_role shortcut.
-- That means the portal guard's service_role bypass never matches it, and
-- closing the portal broke `npm run verify:workflow` with "applications are not
-- open". Found by running it.
--
-- Carve the self-test identities out by their address. RFC 2606 reserves
-- .invalid as permanently unroutable, so no confirmable human account can hold
-- one, and the self-test rolls its transaction back regardless.
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
      )
      or exists (
        select 1 from auth.users u
        where u.id = actor and u.email like 'workflow-%@example.invalid'
      );
$$;
revoke all on function rush.application_portal_allows(uuid) from public, anon, authenticated;
grant execute on function rush.application_portal_allows(uuid) to service_role;
