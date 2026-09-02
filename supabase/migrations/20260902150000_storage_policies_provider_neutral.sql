-- Move the resume Storage policies onto the provider-neutral identity boundary.
--
-- 20260902090000_provider_neutral_auth_identity.sql rewrote auth.uid() ->
-- rush.actor_id() everywhere, but both its function loop and its policy loop are
-- scoped `where n.nspname = 'rush'` ("never count or rewrite policies outside
-- rush"), and its guards count only rush objects. storage.objects lives in
-- storage, so the resume policies kept calling auth.uid() and the gap passed
-- silently. Under a Clerk token `sub` is a string ('user_2abc...'), so auth.uid()
-- either raises 22P02 casting it to uuid or yields null; either way
-- `d.owner_user_id = auth.uid()` never matches, POST /api/apply/resume/start
-- fails its RLS check on storage_resumes_applicant_insert, and no applicant can
-- attach the resume that submission requires. Same break on the download path.
-- docs/CLERK_AUTH_MIGRATION_PLAN.md (Phase 2, step 5) requires this rewrite.
--
-- rush.actor_id() is security definer with `set search_path = ''` and is granted
-- to authenticated and service_role (20260902090000:60-61). A Storage policy is
-- evaluated as the requesting role, which for these `to authenticated` policies
-- is exactly `authenticated`, so that grant is sufficient here; no new grant is
-- needed. Bodies below are the current definitions from
-- 20260831120000_resume_document_lifecycle.sql, unchanged apart from that one
-- substitution. storage_resumes_applicant_update and
-- storage_resumes_board_select_rush were dropped in 20260831120000 and never
-- recreated; there is nothing left to rewrite under either name.
-- storage_resumes_internal_select is deliberately absent:
-- 20260902145000_resume_access_and_attach_consistency.sql already recreated it on
-- rush.has_cycle_capability + rush.actor_has_application_conflict with no
-- auth.uid() left, and recreating it here would silently revert that policy
-- change. The guard at the end still holds it to the boundary.

drop policy if exists storage_resumes_applicant_insert on storage.objects;
drop policy if exists storage_resumes_applicant_delete on storage.objects;
drop policy if exists storage_resumes_applicant_select on storage.objects;

create policy storage_resumes_applicant_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'resumes'
  and exists (
    select 1 from rush.application_documents d
    where d.object_path = name
      and d.owner_user_id = rush.actor_id()
      and d.status = 'PENDING'
      and d.created_at >= now() - interval '1 hour'
  )
);

create policy storage_resumes_applicant_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'resumes'
  and exists (
    select 1 from rush.application_documents d
    where d.object_path = name
      and d.owner_user_id = rush.actor_id()
      and d.status in ('PENDING', 'REJECTED', 'SUPERSEDED')
  )
);

create policy storage_resumes_applicant_select on storage.objects for select to authenticated
using (
  bucket_id = 'resumes'
  and exists (
    select 1 from rush.application_documents d
    where d.object_path = name
      and d.owner_user_id = rush.actor_id()
      and d.status in ('PENDING', 'READY', 'ATTACHED')
  )
);

-- Regression guard. The 20260902090000 guards count rush objects only, which is
-- how this gap survived. This one counts every schema, so any policy anywhere
-- that reaches back to auth.uid() fails the deploy instead of failing an
-- applicant at upload time. A legitimate non-rush exception gets its own entry in
-- allowed_policies by exact 'schema.table:policy' name -- never by narrowing the
-- scan. Functions are deliberately not scanned: pg_get_functiondef('auth.uid()')
-- contains its own name, so a function-level scan matches Supabase internals.
do $$
declare
  coupled_policies text[];
  allowed_policies text[] := array[]::text[];
begin
  select coalesce(array_agg(format('%s.%s:%s', n.nspname, c.relname, p.polname)
                            order by n.nspname, c.relname, p.polname), array[]::text[])
  into coupled_policies
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where pg_get_expr(p.polqual, p.polrelid) like '%auth.uid()%'
     or pg_get_expr(p.polwithcheck, p.polrelid) like '%auth.uid()%';
  if coupled_policies is distinct from allowed_policies then
    raise exception 'unexpected auth.uid()-coupled policy set outside the rush.actor_id() boundary: %', coupled_policies;
  end if;
end;
$$;
