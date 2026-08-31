-- Trigger functions were left executable by anon and authenticated, so PostgREST
-- exposes them at /rest/v1/rpc/<name> even though they are only meaningful when
-- fired by a trigger. Flagged by Supabase's security advisor for
-- rush.enforce_application_portal() (added by 20260831192000) and
-- rush.require_ready_resume() (pre-existing).
--
-- Calling either directly would fail for want of a trigger context, so this is
-- surface reduction rather than a live hole, but a SECURITY DEFINER function
-- reachable by anon has no business being callable.
revoke all on function rush.enforce_application_portal() from public, anon, authenticated;
revoke all on function rush.require_ready_resume() from public, anon, authenticated;
