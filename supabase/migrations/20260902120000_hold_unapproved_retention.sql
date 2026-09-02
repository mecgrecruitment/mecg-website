-- Applicant-data retention periods have not been approved by the Board and
-- privacy owner. Keep the tested anonymization implementation dormant until a
-- later policy migration supplies the approved periods and explicitly enables
-- it. This avoids silently treating the earlier two-year proposal as policy.
select cron.unschedule('anonymize-archived-applicants')
where exists (select 1 from cron.job where jobname = 'anonymize-archived-applicants');

revoke execute on function rush.anonymize_archived_applicants() from service_role;
