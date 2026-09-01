-- Qualify reminder inputs positionally. The original parameter names match
-- table columns, which made PL/pgSQL resolution ambiguous in the INSERT and
-- conflict target.
create or replace function rush.mark_reminder_sent(reminder_kind text, subject_id text, recipient_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  insert into rush.reminders_sent (kind, subject_id, recipient_id)
  values (trim($1), $2, $3)
  on conflict on constraint reminders_sent_kind_subject_id_recipient_id_key do nothing;
  return true;
end;
$$;
-- A temporary table created inside PL/pgSQL is invisible to static analysis
-- of later statements. Keep the candidate set in one materialized CTE and run
-- every retention write as part of that statement.
create or replace function rush.anonymize_archived_applicants()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  anonymized integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  with stale_pnms as materialized (
    select p.id
    from rush.pnms p
    where p.normalized_contact not like 'redacted-%'
      and exists (select 1 from rush.applications a where a.pnm_id = p.id)
      and not exists (
        select 1 from rush.applications a
        join rush.rush_cycles c on c.id = a.cycle_id
        where a.pnm_id = p.id
          and (c.status <> 'ARCHIVED' or c.updated_at > now() - interval '2 years')
      )
  ), deleted_responses as (
    delete from rush.application_responses r
    using rush.applications a
    where r.application_id = a.id
      and a.pnm_id in (select id from stale_pnms)
    returning r.id
  ), cleared_drafts as (
    update rush.applications a
    set draft_payload = null
    where a.pnm_id in (select id from stale_pnms)
      and a.draft_payload is not null
    returning a.id
  )
  update rush.pnms p set
    name = 'Redacted applicant',
    contact = 'redacted-' || p.id || '@example.invalid',
    normalized_contact = 'redacted-' || p.id || '@example.invalid',
    preferred_name = null,
    phone = null,
    linkedin_url = null,
    uniqname = null,
    accessibility_notes = null,
    auth_user_id = null,
    updated_at = now()
  where p.id in (select id from stale_pnms);

  get diagnostics anonymized = row_count;
  if anonymized > 0 then
    insert into rush.audit_events (action, resource, resource_id, metadata)
    values ('APPLICANTS_ANONYMIZED', 'Retention', 'pnms', jsonb_build_object('count', anonymized));
  end if;
  return anonymized;
end;
$$;
