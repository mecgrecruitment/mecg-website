-- Closes the MEDIUM/LOW findings from docs/audit/02-database-rls.md (Section 2,
-- database/RLS audit). No CRITICAL/HIGH findings existed; this migration only
-- touches the four items below.

-- [LOW] rush.resume_upload_locked is dead SECURITY DEFINER code still granted to
-- authenticated. The three storage policies that called it were dropped and
-- replaced by document-table-backed policies in 20260831120000_resume_document_
-- lifecycle.sql, which never reference it. Confirmed unreferenced by grepping
-- src/ and scripts/ (only the generated database.types.ts type stub mentions it).
drop function if exists rush.resume_upload_locked(text);
-- [LOW] rush.events and rush.case_groups have no index on cycle_id despite both
-- being filtered by it in RLS policies (events_read_participant,
-- events_read_cycle_staff, groups_read) and in app queries.
create index if not exists events_cycle_id_idx on rush.events (cycle_id);
create index if not exists case_groups_cycle_id_idx on rush.case_groups (cycle_id);
-- [LOW] rush.application_documents.application_id (FK to rush.applications) has
-- no dedicated index; it's the join key require_ready_resume()/
-- authorize_resume_access() traverse indirectly.
create index if not exists application_documents_application_id_idx
  on rush.application_documents (application_id);
-- [MEDIUM] application_documents_internal_read and storage_resumes_internal_select
-- grant RECRUITMENT_COMMITTEE resume access via a raw role check instead of the
-- has_cycle_capability(cycle_id, 'CANDIDATE_ACCESS') gate used everywhere else,
-- so committee access to resumes does not expire with cycle status
-- (CLOSED/ARCHIVED) the way every other committee capability does. Drop and
-- recreate both policies in the same statement group so there is no window
-- with no policy on either relation.
drop policy if exists application_documents_internal_read on rush.application_documents;
create policy application_documents_internal_read on rush.application_documents
for select to authenticated
using (
  status = 'ATTACHED'
  and (
    rush.has_cycle_role(cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[])
    or rush.has_cycle_capability(cycle_id, 'CANDIDATE_ACCESS')
  )
  and not exists (
    select 1 from rush.conflict_declarations c
    where c.application_id = application_documents.application_id and c.declarer_id = auth.uid()
  )
);
drop policy if exists storage_resumes_internal_select on storage.objects;
create policy storage_resumes_internal_select on storage.objects for select to authenticated
using (
  bucket_id = 'resumes'
  and exists (
    select 1
    from rush.application_documents d
    where d.object_path = name
      and d.status = 'ATTACHED'
      and (
        rush.has_cycle_role(d.cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[])
        or rush.has_cycle_capability(d.cycle_id, 'CANDIDATE_ACCESS')
      )
      and not exists (
        select 1 from rush.conflict_declarations c
        where c.application_id = d.application_id and c.declarer_id = auth.uid()
      )
  )
);
