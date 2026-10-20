# Release evidence recovery: independent source review

Reviewed 2026-10-16. This is a scoped, nonvoting review of the current implementation, not a new panel vote or a claim of human acceptance.

Sources reviewed: `src/lib/release-evidence.ts`, `src/app/admin/applications/[id]/release-evidence/page.tsx`, its `evidence-view.tsx`, and the new missing-evidence link in `src/app/admin/decision-form.tsx`. Existing Precision Instrument design authority, shared design workflow, TypeScript/type discipline, and the installed Next.js page conventions informed the review.

No targeted defect found in the reviewed page boundary and recovery presentation. The page obtains the application's actual cycle through the caller-scoped applications lookup, checks RELEASE in that cycle before requesting diagnostics, and respects diagnostic permission/missing-record denial. It does not rely on a selected navigation cohort to grant access. The diagnostic report is parsed, checked against the requested application, and shown as unavailable on transport, malformed, wrong-application or unknown responses. A successful read explicitly does not confirm release.

The presentation distinguishes open grading from closed-round remediation. Criterion names are shown only when valid locked evaluations are missing; an unrelated invalid additional observation does not create a misleading checklist after the requirement is met. Round workspaces, dossier, reload and recruitment links use the actual application's cycle. The batch review offers a diagnostic link for EVIDENCE_NOT_READY without fetching every application's round detail during the batch render.

## Executed verification

Added `src/app/admin/applications/[id]/release-evidence/page.test.ts`, exercising the actual async server page and evidence view with mocked network/authentication boundaries and the real permission evaluator/parser. Sixteen tests passed:

- Authentication precedes any database client/lookup.
- A membership in a different cycle, BOARD, committee and MEMBER cannot request the diagnostic RPC.
- Missing/RLS-hidden applications and lookup failures do not request diagnostics.
- RPC 42501 and P0002 denial returns not-found; these cases include the backend recusal-denial contract.
- RPC returned failure, thrown transport failure, malformed report, wrong application and null report show recovery without false evidence clearance or private error leakage.
- PANEL renders one canonical report and actual-cycle links; OWNER can see met evidence without a false release claim or unrelated missing-criterion checklist.

Command:

```sh
node --experimental-test-module-mocks --import ./scripts/esm-loader.mjs --test 'src/app/admin/applications/**/release-evidence/page.test.ts'
```

Result: **16 passed, 0 failed**. Raw output: `/tmp/mecg-release-evidence-page-node.log`. Targeted ESLint and diff whitespace checks passed. An initial exact `[id]` test-path attempt selected zero tests because Node treated the brackets as a glob; the corrected wildcard command above exercised all sixteen tests. The zero-test attempt is not verification evidence.

## Limits

These tests prove page behavior under explicit boundary responses. They do not prove hosted authentication/RLS, actual database recusal logic, canonical SQL validity calculations, production query performance, browser rendering/accessibility, or user acceptance. The separate SQL owner and parent integration/browser verification must cover those scopes. No schema, grading threshold, release mutation, permission grant or production state was changed by this review.
