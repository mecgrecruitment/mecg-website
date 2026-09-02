-- Both prune functions existed but nothing ever called them, so the cleanup they
-- describe never happened: abandoned PENDING resume objects accumulated in the
-- resumes bucket forever, and rush.rate_limits grew without bound. Scheduling is
-- what makes them real.
create extension if not exists pg_cron with schema pg_catalog;
-- Idempotent: re-running this migration replaces the jobs instead of duplicating
-- them. cron.unschedule raises if the job is absent, hence the exists guard.
select cron.unschedule('prune-pending-resume-uploads')
where exists (select 1 from cron.job where jobname = 'prune-pending-resume-uploads');
-- Hourly, off the hour so it does not pile onto other scheduled work. The
-- function itself only touches documents older than one hour, so an applicant
-- mid-upload is never affected.
select cron.schedule(
  'prune-pending-resume-uploads',
  '17 * * * *',
  $job$select rush.prune_pending_resume_uploads();$job$
);
select cron.unschedule('prune-rate-limits')
where exists (select 1 from cron.job where jobname = 'prune-rate-limits');
-- Daily is enough: the table is small and the buckets expire on their own
-- windows. This is about not retaining the keys indefinitely.
select cron.schedule(
  'prune-rate-limits',
  '47 3 * * *',
  $job$select rush.prune_rate_limits();$job$
);
