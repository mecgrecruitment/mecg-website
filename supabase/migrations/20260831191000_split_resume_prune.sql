-- The SQL-only prune could never have worked: Supabase installs a
-- storage.protect_delete() trigger that rejects any direct DELETE on
-- storage.objects ("Use the Storage API instead"), so the hourly cron job would
-- have raised 42501 every run and cleaned nothing. Verified by calling it.
--
-- Split the work along the boundary the platform actually enforces. SQL reports
-- which uploads are stale and retires a row once its object is confirmed gone;
-- the storage delete happens in app code through the Storage API, the same
-- supabase.storage.from("resumes").remove() call the finalize route already uses.
--
-- The row is deliberately NOT deleted up front: it is the only record of which
-- object is orphaned, so losing it would strand the file permanently.
drop function if exists rush.prune_pending_resume_uploads();

select cron.unschedule('prune-pending-resume-uploads')
where exists (select 1 from cron.job where jobname = 'prune-pending-resume-uploads');

create or replace function rush.stale_pending_resume_uploads(older_than interval default interval '1 hour')
returns table (document_id text, object_path text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  return query
    select d.id, d.object_path
    from rush.application_documents d
    where d.status = 'PENDING' and d.created_at < now() - older_than
    order by d.created_at;
end;
$$;

-- Called only after the storage object is gone, so the row and the file cannot
-- drift apart. Still status-scoped, so a document that raced to READY survives.
create or replace function rush.retire_pending_resume_upload(document_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare removed integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  delete from rush.application_documents where id = document_id and status = 'PENDING';
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

revoke all on function rush.stale_pending_resume_uploads(interval) from public, anon, authenticated;
revoke all on function rush.retire_pending_resume_upload(text) from public, anon, authenticated;
grant execute on function rush.stale_pending_resume_uploads(interval) to service_role;
grant execute on function rush.retire_pending_resume_upload(text) to service_role;

comment on function rush.stale_pending_resume_uploads(interval) is
  'Work list for the resume prune. Storage removal must go through the Storage API; see /api/maintenance/prune-resumes.';
comment on function rush.retire_pending_resume_upload(text) is
  'Drops a PENDING document row once its storage object has been removed. Call only after a successful Storage API delete.';
