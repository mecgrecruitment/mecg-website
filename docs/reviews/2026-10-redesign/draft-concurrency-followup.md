# Application draft concurrency follow-up

Implemented in the working tree on 2026-10-16. This is a local implementation and verification record, not a production rollout or a claim of real-user acceptance.

## Database contract

`20261016190000_application_draft_revisions.sql` adds an opaque UUID revision to every application. `application_draft()` and `intake_schema().draft` return the revision alongside the existing allowlisted fields. An absent application has a `null` revision precondition. Revisions change on every accepted draft save (including identical content), application payload/status changes, and a resume becoming READY because draft reads project that resume. Status transitions clear prior mutation receipts.

`save_application_draft_v2(payload, expected_revision, mutation_id, cycle_id)` serializes first saves with an actor-specific transaction advisory lock, then locks an existing application row before comparing its revision. A mismatch returns the current caller-owned draft without writing. The writer retains its existing validation, verified-email adoption, question, portal and document-ownership checks. The exact latest mutation, expected revision and request payload can be retried after a lost acknowledgement without a second write; reusing that mutation with different content is rejected. A later accepted mutation invalidates the earlier receipt, so an old retry gets a recoverable conflict rather than overwriting newer work. A stale non-null revision cannot recreate a deleted row. Submission/status locking prevents delayed saves from reopening submitted applications.

`submit_application_v2` uses the same actor lock and row revision precondition before calling the existing submission and transactional receipt implementation. A committed submission is acknowledged before checking its obsolete draft revision. A stale submission returns the same explicit draft conflict. Existing full-payload validation, scoring and recruitment policies remain unchanged.

The legacy one-argument draft RPC fails closed with a reload instruction. Its private unchecked implementation and both legacy submission entry points cannot be executed by application roles. The HTTP routes require the new preconditions, validate receipts, and have no fallback to an unconditional writer. The service-only synthetic workflow fixture now exercises the new contracts.

## Applicant recovery

Autosaves are serialized. After an uncertain network result the client retries the exact mutation before sending later edits with its returned revision. An HTTP success without a valid revision does not show “Saved” or clear recovery.

On a server conflict, editing, automatic saves and submission pause. The comparison preserves the current local answers and the returned server answers; it includes caller-scoped links to both resume PDFs. The applicant explicitly chooses whether to continue with the saved copy or replace it with this page's answers. A second server change can cause another conflict rather than being silently overwritten. Consent is cleared after choosing. Existing tab recovery still survives reload and requires its own explicit comparison choice; no timestamps are used to decide a winner.

## Checks

- `node --experimental-test-module-mocks --import ./scripts/esm-loader.mjs --test src/app/api/apply/route.test.ts src/app/api/apply/draft/route.test.ts src/app/apply/application-server-draft.test.ts src/app/apply/application-form.test.ts src/app/apply/page.test.ts`: **40 passed**.
- `npx tsc --noEmit --pretty false`: passed.
- ESLint over the changed application routes, form, parsers and tests: passed.
- `PLAYWRIGHT_PORT=3000 npx playwright test tests/e2e/application-reliability.spec.ts --project=chromium --workers=1`: **13 passed**. Uses the local harness and synthetic HTTP responses, including exact mutation retry, both conflict choices and stale submit recovery.
- The same browser suite with `--project=mobile-chromium`: **13 passed** in Pixel 7 emulation. After the final definite-4xx retry fix, targeted uncertain-retry and corrected-edit cases passed on both projects (**4 passed**); targeted preservation of in-flight keystrokes and refusal of fake success receipts also passed on both projects (**4 passed**). The suite now contains 16 cases per project.
- `supabase/tests/application_draft_concurrency.sql` exercises real RPC/ACL/row state with transaction-local synthetic fixtures. The final parent isolated database run passed all 21 assertions, including the identical-content revision assertion, alongside all 10 files / 642 assertions. Its serialized interleavings do not by themselves prove parallel-session scheduling.
- Parent-authored `scripts/verify-draft-race.mjs` ran two real sessions against the dedicated disposable Docker database. The inspected `/tmp/mecg-draft-race.log` reports one save, one conflict, and the winning answers/revision persisted. The initial baseline workflow fixture exposed a local-variable qualification defect; after the migration rewrite was corrected, the complete baseline and new suite passed. A final two-session race rerun also passed with cleanup and exit zero.

## Rollout and remaining evidence

Apply and verify the migration in staging before routing traffic to the updated application. Deploying the migration intentionally makes old tabs/old application instances fail closed; users must reload and retain any browser answers. Coordinate app rollout and explain this temporary compatibility boundary. Do not deploy the app against a database lacking these functions. No production database writes or deployment were performed here.

Staging still needs Clerk sessions, actual hosted RPC/RLS identities, uploads, submission/save races and outbox delivery with synthetic accounts. The isolated two-session initial-save proof covers its specific race. Browser evidence does not replace those integration checks or physical-device/Safari/Firefox/assistive-technology testing. Resume READY transitions deliberately produce a fresh conflict if they change a draft while a tab has pending answers. Draft deletion has no permanent tombstone: an explicitly absent-row (`null`) precondition can create a new row when the portal permits it; a token from a known deleted row cannot.
