# Cycle records: export, archive and retention dry run

Implemented November 18, 2026. Route `/admin/records` (nav "Cycle records", Owners only). Migration `supabase/migrations/20261118170000_cycle_records_export.sql`. APIs `GET/POST /api/admin/cycle-records`, `POST /api/admin/retention`.

## What works

- **Export.** The selected cycle's Owner downloads the cycle's member-tool records and every project with its team, as one JSON file (`mecg-cycle-records/1`) or as two CSVs (member-tool records; projects). CSV cells that start with `=`, `+`, `-` or `@` are prefixed so spreadsheets don't run them. Every download is an audited `CYCLE_RECORDS_EXPORTED` event with counts and which tools were full, never content.
- **Private records stay private.** Owner rank alone doesn't unlock member-tool content (see `member-tools/README.md`). For each tool, the export holds full content and review only when the Owner also holds that tool's reviewer grant in the cycle. Otherwise it holds the record id, owner, dates, revision, verification and sharing status, marked `contentWithheld`. The page says which tools are full and how to get the rest (an explicit, audited reviewer grant).
- **Archive.** A CLOSED cycle can be archived from this page only after a member-tool export (the full JSON or the records CSV; the projects CSV alone doesn't count) has been logged since the cycle was closed. Archiving changes the status only; nothing is deleted. `rush.set_cycle_status` (Settings) still lets Board or Owner move CLOSED → ARCHIVED without an export; this page is the guarded route, not a database-wide rule.
- **Downloads** started from another site (`Sec-Fetch-Site: cross-site`/`same-site`) are refused, so a link elsewhere can't log an export with the Owner's session.
- **Retention dry run.** Two categories, both unset by default: member-tool records in archived cycles (counted from the archive date) and activity log entries (counted from when they were written). Any active Owner can set 1–240 months or clear a period (audited, optimistic revision). The report counts what each period would cover, broken down by cycle for member-tool records. Nothing deletes, anonymises or schedules anything. Applicant data keeps its own dormant process (`20260902120000_hold_unapproved_retention.sql`).

## Access

Export, overview and archive: active OWNER membership in that cycle with an active profile. Retention: active OWNER in any cycle (organisation-wide setting). Board, Panel, Member and Recruitment committee are refused in the route and again in the database. Tables have RLS on and no grants; access is only through the SECURITY DEFINER functions.

## Owner decisions (defaults chosen; change if wanted)

1. Content in exports follows reviewer grants (above). The alternative, every Owner exporting all content, would change the member-tools privacy rule.
2. Withheld records still show who owns each one, its dates, revision, and verification and sharing status. That is less than the README's "Owners don't read others' records" might suggest; drop those fields if the Owner should see counts only.
3. Projects aren't tied to a cycle, so every export includes every project and its team.
4. Archiving needs a member-tool export logged since the cycle closed, but not a confirmed safe copy (the checkbox is a prompt only), and a metadata-only export (Owner with no reviewer grant) counts.
5. Archive is a status change only. Members can still edit their member-tool records in an archived cycle and Owners can still grant reviewers (existing `member_tool_access` only closes it for the Recruitment committee). Freezing archived cycles would change shared member-tools code; say if wanted.
6. Any active Owner, in any cycle, can change the organisation-wide retention periods.
7. Archive dates come from the audit log, falling back to the cycle's `updated_at` for cycles archived without one; a later edit to such a cycle would move its retention clock. Purging old audit entries would also remove those dates, which matters if an activity-log period is ever acted on.
8. Retention periods start unset. Which periods to adopt, and whether any deletion should ever follow, is for the Board and privacy owner. No deletion is implemented.
9. Where exports are stored (the page says the board's restricted drive, not email).

## Rollout

1. Apply the migration to staging through the normal process (not applied anywhere yet). It needs the member-tools migration (`20261112120000`) and creates `rush.retention_policies` with two unset rows.
2. Staging acceptance: as a cycle Owner without reviewer grants, export and confirm content is withheld; grant yourself evidence review and confirm evidence content appears; confirm a Board account gets 403; close a cycle, try to archive (refused), export, archive; set and clear a retention period and read the dry run; check `rush.audit_events` for the export, archive and retention rows (retention rows have no cycle, so the Activity page does not list them).
3. Deploy the app after the migration. Before it exists, the page shows an unavailable state.

## Verification

- `npm run verify:cycle-records`: disposable network-isolated PostgreSQL 17 (member-tools bootstrap and migration, `scripts/cycle-records/bootstrap.sql`, this migration, `scripts/cycle-records/assertions.sql`). Proves access refusals, content withholding, cross-cycle isolation, audit metadata without content, archive needing a post-close export, idempotent archive, retention validation and conflicts, dry-run counts, and that nothing is deleted. It does not prove hosted Clerk/PostgREST.
- Unit tests: `src/lib/cycle-records/model.test.ts`, `src/app/api/admin/cycle-records/route.test.ts`, `src/app/api/admin/retention/route.test.ts`.
