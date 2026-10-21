# Resume upload and Board visibility plan

Status: implemented and deployed; its migrations are in the production ledger. A signed-in hosted upload check is still outstanding (see [releases/2026-10-17-upload.md](./releases/2026-10-17-upload.md)).

## Outcome

An applicant can upload a PDF during the application, replace it before review starts, and confirm which file is on record. Authorized recruitment staff can see the verified resume in the Board portal. Blind reviewers, conflicted staff, regular members, and anonymous users cannot read it.

The release is complete only after a real browser uploads a PDF to Supabase Storage and an authorized Board account opens that same PDF from the applicant dossier. Mocked route tests do not satisfy this gate.

## Decisions to encode

### Use one upload path

Use the server-issued signed upload URL for both the application form and post-submission replacement. The shared browser workflow is:

1. Call `POST /api/apply/resume/start` with the filename and byte count.
2. Upload the bytes to the returned `uploadUrl`.
3. Call `POST /api/apply/resume/finalize` with the returned `documentId`.
4. For a submitted application, call `POST /api/apply/resume/attach`.
5. If any step fails after step 1, call `POST /api/apply/resume/cancel`.

Move this sequence into one client helper and use it from both `src/app/apply/application-form.tsx` and `src/app/applicant/resume-replace.tsx`. Do not keep the replacement screen on its separate `useSupabase().storage.upload()` path.

Use Supabase's supported signed-upload request shape. Test the real HTTP upload, including the method, headers, content type, and body encoding. Do not infer compatibility from a mocked `createSignedUploadUrl()` response.

### Give resume access only to people who need it

Use this role matrix unless the Board approves a different policy:

| Person | See resume status | Open resume | Reason |
| --- | --- | --- | --- |
| Applicant | Own application only | Own attached or ready resume | Confirm the correct file is on record |
| Owner | Yes | Yes | Recruitment administration and incident response |
| Board | Yes | Yes | Applicant operations and final review |
| Recruitment Committee | Yes while the cycle is active | Yes while the cycle is active | Applicant operations |
| Panel-only member | No | No | Hash review stays blind |
| Assigned blind screener | No | No | Screening stays blind |
| Regular member | No | No | No applicant-operations duty |
| Conflicted staff member | No | No | Recusal applies to the entire applicant file |
| Anonymous user | No | No | Resume storage is private |
| Service role | Processing only | Processing only | Validate, finalize, and clean up uploads |

Apply the same rule at every boundary. The page, route, RPC, `application_documents` policy, and `storage.objects` policy must agree. In particular, replace the hard-coded `PANEL` allowance in `rush.authorize_resume_access` with the existing `CANDIDATE_ACCESS` capability and the conflict check. `CANDIDATE_ACCESS` already grants access to Board and Owner accounts and limits Recruitment Committee access to an active cycle.

### Keep the Board portal simple

Keep the existing resume locations:

- The Pipeline page shows `Resume on file` or `Missing resume` for each submitted applicant.
- The `Missing resumes` attention item opens the filtered applicant list.
- The applicant dossier shows the verified PDF and an **Open in new tab** action.
- A panel-only dossier explains that the resume is hidden for blind Hash review.
- A conflicted user receives the existing recusal screen and cannot bypass it through the resume URL.

Add verified document metadata to the dossier: the original filename, byte size, page count, and verification time. Load metadata from the `ATTACHED` `application_documents` row. Do not expose the storage object path or a reusable signed URL in the page HTML.

If the PDF preview fails, show a clear error and keep a retryable **Open in new tab** action. A missing, rejected, pending, or superseded document must never render as `Resume on file`.

## Implementation phases

### 1. Make configuration fail before an applicant starts

1. Add `MECG_SUPABASE_SERVICE_ROLE_KEY` to approved local, staging, and production secret stores. Never commit or print the value.
2. Keep `NEXT_PUBLIC_MECG_SUPABASE_URL` and `NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY` aligned with project `chrxtsohxazngabdcpzb`.
3. Confirm that Clerk-issued tokens resolve through `rush.actor_id()` in staging.
4. Add a deployment check that fails when the service-role key is absent. Resume finalization requires this key.
5. Confirm that the Supabase Storage CORS configuration accepts the application origin and the signed-upload request shape.

Exit gate: `npm run supabase:verify-project` passes in the environment that runs the app.

### 2. Unify initial upload and replacement

1. Add a client helper for start, signed upload, finalize, optional attach, and cancellation.
2. Update the application form to use the helper without changing its current progress and validation messages.
3. Update `ResumeReplace` to use the same helper and remove its direct Supabase Storage client dependency.
4. Return one typed response shape from the start and finalize routes.
5. Keep the 10 MB, 20-page, PDF structure, encryption, active-content, and declared-size checks.
6. Preserve the rule that replacement stops when a screening packet exists.
7. Make repeated cancel, finalize, and attach requests safe. A browser retry must not delete an attached document or attach the wrong replacement.

Exit gate: both UI entry points execute the same upload helper, and tests cover every state transition.

### 3. Align database and route authorization

1. Add a forward-only migration that updates `rush.authorize_resume_access`.
2. Update `application_documents_internal_read` and `storage_resumes_internal_select` to use the same `CANDIDATE_ACCESS` and conflict rules.
3. Keep applicant reads limited to documents owned by `rush.actor_id()`.
4. Keep `rush.finalize_resume_upload` restricted to `service_role`.
5. Return `404` for a missing application or resume and `403` for a known but unauthorized request.
6. Record `RESUME_VIEWED`, `RESUME_UPLOAD_READY`, and `RESUME_REPLACED` without recording filenames, object paths, signed URLs, or document contents.

Exit gate: the role matrix passes at the SQL and route layers. Direct URL access cannot bypass the dossier UI.

### 4. Finish the Board portal display

1. Keep the current Pipeline resume status and missing-resume filter.
2. Query the attached document metadata on the applicant dossier.
3. Render the PDF only after the server confirms access and creates a short-lived signed read URL.
4. Add explicit missing, forbidden, unavailable, and retry states.
5. Confirm that a successful replacement refreshes both the applicant portal and the Board dossier.
6. Confirm that the old object becomes `SUPERSEDED` and is removed only after the new object is ready and attached.

Exit gate: Board, Owner, and eligible Recruitment Committee accounts can find and open the resume without using Supabase directly.

### 5. Add proof at each layer

#### Unit and route tests

Add tests for:

- the shared client helper's start, upload, finalize, attach, and cancel sequence;
- the exact signed-upload HTTP request;
- invalid type, oversize, malformed PDF, encrypted PDF, active content, too many pages, and byte-count mismatch;
- upload, finalize, and attach retries;
- replacement before review and rejection after a screening packet exists;
- `GET /api/admin/applications/[id]/resume` returning `401`, `403`, `404`, and a redirect for an authorized user;
- failure to create a signed read or upload URL;
- cleanup when finalization fails and preservation when cancellation loses a race.

#### Database tests

Extend `supabase/tests/rush_foundation.sql` with data-driven checks for every row in the access matrix. Test active and closed cycles, dual-role users, active screeners, conflicts, cross-cycle IDs, and cross-owner document IDs.

Test the document lifecycle as a state machine:

```text
PENDING -> READY -> ATTACHED
PENDING -> REJECTED
READY -> SUPERSEDED
PENDING -> DELETED
SUPERSEDED -> DELETED
```

Reject every transition not shown above.

#### Real browser test

Run a staging Playwright test against real Clerk authentication, the real API routes, and real Supabase Storage:

1. Sign in as a controlled applicant.
2. Save a draft and upload a known safe PDF.
3. Refresh the page and open the uploaded PDF.
4. Submit the application.
5. Sign in as an authorized Board user.
6. Find the applicant through the Pipeline resume filter.
7. Open the applicant dossier and compare the downloaded bytes with the uploaded fixture.
8. Replace the resume as the applicant and confirm that the dossier shows the replacement.
9. Start screening and confirm that replacement is denied.
10. Sign in as panel-only, regular-member, conflicted, and anonymous users. Confirm that each cannot open the resume route.
11. Remove all test users, applications, documents, and storage objects through the approved test cleanup path.

The browser test must upload actual bytes. A mocked Storage client does not count.

### 6. Verify cleanup and operations

1. Confirm that `/api/maintenance/prune-resumes` has `CRON_SECRET` in staging and production.
2. Confirm that the daily job removes expired `PENDING` objects and retires their document rows.
3. Make cleanup retry-safe when Storage deletion succeeds but the database update fails, or the reverse.
4. Add a Board operations signal for failed resume finalization and stale pending uploads. Show counts and timestamps, never applicant content or filenames.
5. Check the last seven cleanup runs before opening applications.

Exit gate: abandoned uploads do not accumulate, and the Board can detect cleanup failures without opening logs that contain applicant data.

## Required verification

Run these checks in order:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run supabase:verify-project
npm run supabase:lint
npm run test:supabase
npm run verify:backend
npm run verify:auth
npm run verify:workflow
```

Then run the real staging browser test. Record each command, exit code, commit, environment, and short result. Do not copy secrets, applicant data, signed URLs, or PDF contents into the record.

## Release gate

Do not call resume upload complete until all of these statements are true:

- The initial application and replacement screens use one signed-upload implementation.
- A real PDF survives upload, server validation, attachment, refresh, and download.
- The Board portal shows the correct status and PDF for the correct applicant.
- Board, Owner, and eligible Recruitment Committee accounts can open the resume.
- Panel-only, screening, member, conflicted, cross-cycle, and anonymous access attempts fail.
- Replacements stop after screening starts.
- Invalid files never become `READY` or `ATTACHED`.
- Retries do not attach or delete the wrong document.
- The service-role key and cleanup secret exist in every deployed environment that needs them.
- The cleanup job has a recent successful run.
- All required checks pass with no skipped gate.

## Current evidence and gaps

As of September 2, 2026:

- The application form and replacement screen use the same signed-upload helper and Supabase multipart request shape.
- The 11 resume route tests, four upload-helper tests, and five Board resume-route tests pass.
- The combined JavaScript test suite passes (243 tests), as do TypeScript, lint, SQL consistency, and the webpack production build.
- Migration `20260902145000_resume_access_and_attach_consistency.sql` aligns the RPC and read policies on `CANDIDATE_ACCESS`, conflict recusal, attached-document state, and retry-safe attachment.
- The applicant dossier shows verified filename, size, page count, and verification time without exposing the object path or signed URL in the page HTML.
- The last recorded linked Supabase state remains migrated only through `20260902090000`; the local migration sequence now ends at `20260902180000`, and none of the pending migrations may be treated as remotely applied without a fresh hosted check.
- The local `.env.local` lacks the service-role key, so a real local finalization cannot complete.
- Local pgTAP is no longer blocked: the live local `rush_foundation.sql` suite passes 250/250 assertions, and the local schema lint returns zero errors. This does not replace the real hosted Storage upload and role-matrix test.
- Route tests mock Storage and do not replace the required real staging browser upload and role-matrix test.
- Cleanup operations and environment secrets still require staging/production verification before release.
