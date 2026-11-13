# Consulting workbench

Implementation owner: Codex for Rahil, November 12, 2026. Deployed to https://mecgmichigan.com/member/consulting at release 0feaa9888cf0f91ee92f967109e0349b7d3e4d81; release and production CI passed. The earlier local-only verification receipt is historical. Route: `/member/consulting?cycleId=…`, linked from the three existing project-tool pages. Member page uses existing `requireMember` and selected-cycle authorization. No recruitment permissions, outcomes, database policies or public capability claims changed. Existing pipeline/evidence/lab work is preserved.

## What is implemented

Nine workflows share one validated, versioned public/synthetic project:

1. Research: exact quote checks, source authority/licence fields, configurable as-of freshness, same-topic value conflict candidates, explicit human semantic review, evidence appendix.
2. Feedback: editable codebook, saved coding, reversible original records, exact text/segment duplicate exclusion, English-only coded denominator, per-segment counts, record-backed quotes and separate severe-issue output. Counts are records, never inferred customers; priority remains human.
3. Knowledge: approved-corpus passage retrieval with exact citations and abstention. This is transparent lexical retrieval, not an embedded semantic search service; optional model assistance can propose source-linked work for review. Revoked/draft/superseded passages are excluded from retrieval. No client permission-security claim.
4. Process: editable stages/resources/edges, evidence-basis labels, simple independent-stage capacity estimates, invalid-edge and shared-resource warnings, measurement-plan output. No simulation, queueing forecast or causal diagnosis.
5. Reporting: defined metric IDs/units/periods/owners, sum/mean/aggregate-ratio calculations, missing-input and zero-denominator blocking, independent control reconciliation, source references, typed `[[metric:ID]]` narrative interpolation.
6. Proposal: requirement/capability/deliverable/acceptance/capacity mapping; unconfirmed scope, expired/unsupported credentials and missing items flagged. No commercial terms generated.
7. Discovery: source-linked requirements, speaker/authority fields and explicit confirmation states/evidence. Notes and client confirmation remain separate. Model output cannot import confirmations.
8. Review: structured evidence/number/scope checks, inspection coverage, stable finding IDs, snapshot hashes, stale-result export protection, causal/free-number heuristics and a self-recorded disposition log. Rechecks never treat waivers or a lack of findings as approval. No automatic visual/PDF/original-file extraction.
9. Handoff: tasks, steps, recipient, recurring cost, restore/shutdown, fresh operator and observed result/evidence. Missing ownership or untested tasks block handoff claims.

All workflows provide editable forms, synthetic case, local checks and Markdown export. Project JSON import/export preserves records and review entries. An explicit opt-in browser save is bound to member and cycle; nothing autosaves or silently uploads. Invalid imports leave open work intact. One saved project slot per member/cycle; export additional projects before replacing it.

The synthetic example deliberately includes a stale superseded source, possible contradiction, duplicate feedback, severe minority issue, wrong reporting control, tentative requirement, unsupported causal statement and incomplete handoff. These are fixtures, not club/client records or independent performance evidence.

## Model assistance

Server adapter: `/api/member/consulting`, OpenAI Responses API. Verified official API shape against [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). JSON mode is followed by strict application validation; malformed, incomplete, duplicate/unrelated table suggestions are rejected. No tools are exposed, no automatic action is possible, and model numbers never replace deterministic metric calculation. Response storage is disabled using `store:false`; this is not a claim of zero provider retention or approved client processing.

Set server-only configuration in the deployment environment only after an operator approves the provider/cost route:

```
CONSULTING_AI_ENABLED=true
CONSULTING_OPENAI_MODEL=<approved JSON-mode-capable Responses model ID>
CONSULTING_OPENAI_API_KEY=<restricted project key>
```

Do not use `NEXT_PUBLIC_` keys. No default model is guessed, no dependency was added, and no real model invocation or spending was performed during implementation. Without explicit configuration, endpoint returns 503 and explains how to continue with local checks/exports. Do not infer ChatGPT plan/API eligibility or credits. A maintainer must validate the chosen model/account, provider data handling and configured spend limits before enabling it. Page requires explicit public/synthetic send consent. Potential secret patterns block the request; pattern detection does not establish absence of personal/confidential data.

Model summaries are unapproved prose, rendered as text. Proposed rows are previewed, then individually appended only on user action; IDs cannot overwrite records. Approval/semantic-review/confirmation/fresh-operator state is reset on both server and client. Ordinary edits invalidate suggestions; accepting a row removes that proposal and keeps the remaining proposals tied to the updated local revision. Endpoint checks origin, current user and cycle membership; limits request size, total response tokens, duration, per-process concurrency and per-user cadence. These are not distributed quotas. Before multi-instance enablement, apply provider-side project spend/rate limits and an accepted deployment-wide budget mechanism; no distributed limiter or cost guarantee is claimed.

## Data and access boundary

This is a sandbox for permitted public material and synthetic data. Selecting `public-synthetic` is a user assertion, not an automatic data classifier. Unknown data classes are rejected. Member sign-in does not make browser storage secure against others using the same device/profile. No shared backend project store, collaborator ACL, client data agreement, backup service, retention automation or confidential client deployment is implemented. That scope remains gated by the council and must not be marketed as delivered.

Browser drafts are unencrypted and remain after logout until explicitly deleted. Closing a tab removes its unsaved working copy; browser recovery may retain tab state. Use Delete browser draft to remove the saved record, then clear/close the tab. Downloads and copies already exported require separate deletion. No claim that revocation recalls downloaded exports. Source removal/revocation immediately affects new local checks and retrieval but cannot erase prior exports/model responses.

No secret belongs in sources, notes or runbooks; use safe credential-location references. Imported source text has no tool execution or URL fetching authority. The workbench never sends outreach, submits deliverables, grants access or changes recruitment decisions.

## Verification and handoff

From repository root:

```
node --experimental-test-module-mocks --import ./scripts/esm-loader.mjs --test src/lib/consulting-workbench/engine.test.ts src/app/api/member/consulting/route.test.ts
npx tsc --noEmit
npx eslint src/lib/consulting-workbench src/app/member/consulting src/app/api/member/consulting scripts/consulting-check.mjs scripts/verify-consulting-workbench.mjs
node scripts/design-tokens.mjs
node scripts/verify-consulting-workbench.mjs
```

Use the machine's workload-budget wrapper for heavy/full suites and the UI batch, per global CI policy. UI verification creates a tiny isolated Next app importing the actual component and styles; it does not copy the checkout, alter auth, or load credentials. API responses in the browser exercise are explicit fixtures; separate route tests exercise denial, unavailable configuration and an intercepted provider request. No live membership/model/provider security acceptance is implied. The script removes only its own temporary app and stops only its own process.

Command-line check (no model or server needed):

```
node --import ./scripts/esm-loader.mjs scripts/consulting-check.mjs docs/features/consulting-workbench/synthetic-project.json reporting 2026-11-12
```

Exit 1 means blockers; exit 2 means invalid input/I/O; exit 0 still requires human review. Optional final argument writes a new Markdown file with exclusive-create, never overwrites an existing file. Correcting demo control M1 from 31 to 30 reconciles its 12+18 inputs; it does not validate source truth.

Fresh-operator exercise: load the sample, identify and correct the reporting control, rerun, export JSON/Markdown, reload/restore the browser draft, revoke source S1 and observe research/retrieval changes, then delete the draft and downloads. Record actual operator, completion, minutes, questions and failures; implementation tests are not a real-member acceptance observation. Deployment support owner and end date remain unassigned. Disable model access by setting `CONSULTING_AI_ENABLED=false`; deterministic local work continues.

## Remaining council proof

No comparative time saving, larger delivery scope, national exclusivity, client result, trained member or sponsor is evidenced by this build. Actual client use needs a named operational owner, evaluator, successor, approved data/processing/storage route and representative task. [Pilot protocol](pilot-protocol.md) addresses the outstanding sample-size/capacity questions as proposed future measurement, not invented acceptance. The council's single revision allowance governed the planning review; this explicitly requested implementation is separate work, not a claim to reopen that review to obtain unanimity.

## Completed release verification

Hosted release run [43353214677](https://github.com/mecgrecruitment/mecg-website/actions/runs/43353214677) and production CI [43354122305](https://github.com/mecgrecruitment/mecg-website/actions/runs/43354122305) passed. Release results: 991 unit tests, 463 E2E passed with eight existing skips, 891 database tests, lint, TypeScript, SQL parser, production build and the nine-workflow desktop/phone exercise. Live health returned 200/ok; anonymous member routes redirect to login and the consulting API rejects anonymous POST. Authenticated Clerk integration remains skipped under its existing configured condition; no live member acceptance or paid-model invocation was performed. Deployment authority and exact receipts are retained in the MECG operations release record at operations/releases/consulting-workbench-2026-11-12/.

Production-branch final E2E result: 464 passed, eight existing skips. The earlier release run reported 463 passed and one pre-existing evaluation-CAS timing test passing on configured retry; the same-SHA production rerun passed all 464 without a flaky summary. No test was removed or weakened.

## Workflow improvements

The refinement adds entity-aware research comparison; feedback coding coverage, keyword candidates and theme-overlap counts; ranked exact-passage retrieval with required quoted phrases and approved/permitted-source filtering; process entry/exit and rework-cycle checks with explicit sensitivity scenarios; source-linked period comparisons and reconciliation differences; a readable acceptance-based proposal draft; actionable discovery follow-ups and confirmed/rejected conflict checks; `[[claim:ID]]` rendering with source/support validation and unfinished-copy detection; and fresh-builder/operator independence plus support-date checks for handoff.

Each register supports search, paging, a downloadable CSV header template and all-or-nothing CSV append. Commas, escaped quotes, multiline values and CRLF are supported. Unique IDs are generated for blank IDs. Unknown/duplicate columns, repeated IDs, invalid numbers or an oversized register reject the whole append. No formula is evaluated. Filtering changes the displayed rows, never the dataset used by checks. CSV intake does not establish permission to process client data; public/synthetic restriction remains.

Undo restores up to twenty previous in-memory edits and invalidates stale checks/suggestions. Unsaved working changes trigger the browser's leave-page warning; saving a browser draft resets that warning until the next edit. Existing exported version-one files remain accepted: additive fields receive blank defaults. No field or prior record is silently deleted during upgrade.

AI requests now use per-workflow strict JSON Schemas derived from the same field catalogue as forms/imports, with a small draft-output allowance. Runtime validation and approval-state stripping remain in force. The model must support Responses structured outputs; configuring an unsupported model will not silently fall back to unvalidated prose. Live provider access remains blocked because the requested OpenAI and Vercel credentials were declined; no paid calls or provider settings were changed.

For a provider already available to the user, export the task/schema and import its JSON response through Import model suggestions JSON. Imported suggestions are marked as unverified provenance, cannot overwrite rows or import confirmations, and require individual acceptance. This is a manual option, not a claim that a model was connected or run.

## Native provider connection

The supported default on Vercel is now AI Gateway with the platform's short-lived OIDC identity. This supersedes the earlier assumption that activation always needs separately supplied OpenAI and Vercel API keys. Official sources: https://vercel.com/docs/ai-gateway/authentication-and-byok , https://vercel.com/docs/oidc , https://vercel.com/docs/ai-gateway/sdks-and-apis/responses . The public Gateway model catalogue confirms `openai/gpt-4.1-mini` supports structured outputs; it is the bounded default, with an optional `CONSULTING_GATEWAY_MODEL` override.

Functions use `x-vercel-oidc-token` supplied by Vercel at runtime, not the expiring build-time `VERCEL_OIDC_TOKEN`. The build verifier uses the build-time token in its own correct context. Neither token is logged, returned to the browser, saved to this repository, or exposed in a diagnostic response. A non-Vercel request cannot activate OIDC merely by supplying that header. Explicit `CONSULTING_AI_ENABLED=false` remains a kill switch. Existing explicitly enabled direct-OpenAI configuration remains supported; no credential settings are removed or manufactured.

Before Vercel builds the app, `verify-consulting-provider.mjs` runs nine actual synthetic workflow requests through the shared provider implementation, with no retries, no external tools, `store:false`, and 3,000 output tokens maximum per request. Every response is checked by the same per-workflow schema/approval-state parser used at runtime. A Vercel deployment fails if provider verification fails, preserving the previous production version. A successful deployment exposes only sanitized synthetic verification results and its Git SHA at `/.well-known/mecg-ai-provider.json`; this read-only static file cannot trigger model calls.

Gateway calls use the existing team's allowance and any existing Gateway budgets. This setup does not purchase credits, change billing/autorecharge settings, or claim free usage is guaranteed. Authentication, exhausted-credit and rate-limit failures have separate safe messages. Per-user cadence/per-instance concurrency controls remain; these are not a distributed/team spending cap. Team/project budgets are managed by the corresponding Vercel account administrator, not fabricated by this application.

Public/synthetic input restrictions, existing member/cycle checks, secret-pattern guard and human acceptance of model-proposed rows remain unchanged. Actual provider connectivity is distinct from correctness, client approval or production member acceptance.
