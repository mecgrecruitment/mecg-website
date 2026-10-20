# Grading and operator recovery checkpoint

2026-10-16. Later local working tree; not deployed. This supplements the earlier implementation receipt and does not alter either frozen panel snapshot or any independent vote.

Group Case saves, screening drafts and written-evaluation drafts now use database revisions and exact mutation receipts. Concurrent stale edits return the current own copy instead of overwriting it. Unknown outcomes retain the exact pending request; explicit retry confirms it before newer observations drain. Both interfaces preserve newer local edits, offer private copies and require an explicit comparison choice after conflicts. Final written-evaluation submission checks the draft revision under the same assignment lock, preventing another device's newer draft from being finalized by a stale tab.

Browser tests reproduced two asynchronous rating-click failures: note-save feedback moved Group Case stars, and changing draft feedback moved native radios on WebKit. Stable status geometry and feedback placement below the controls repaired both. Group Case also warns before its direct rubric link leaves unconfirmed observations. These scoped warnings supplement private-copy recovery; they do not guarantee protection for every client navigation.

Individual decision release, rubric writes and deck result application now have bounded full-body requests, operation-specific receipts and persistent uncertain-outcome recovery. Their verification is recorded separately; scoring thresholds and eligibility rules were preserved.

## Recorded verification

| Scope | Result | Evidence |
| --- | --- | --- |
| Complete Node suite, latest | 861/861 pass | [Raw log](evidence/offer-deadline/node-verified.log) |
| Complete isolated SQL suite, latest | 872 assertions, 17 files; 173 migrations | [Screening SQL receipt](screening-draft-write-revisions.md) |
| Group Case browser matrix | 90/90 in one run | [Interface receipt](group-case-v2-integration-tests.md) |
| Group Case navigation/revision follow-up | 40/40 in one run; 35 overlap with the prior matrix | [Follow-up log](evidence/group-case-navigation-final.log) |
| Written evaluation browser matrix | 110/110 in one run | [Interface receipt](generic-evaluation-cas.md) |
| Offer deadline captured value/recovery | 50/50 browser checks; 10/10 repeated capture follow-up | [Deadline receipt](offer-deadline-write-recovery.md) |
| Individual release and rubric | 55 API tests; all 80 browser scenarios have passing coverage across recorded runs | [Operator receipt](operator-write-receipts.md) |
| Deck responsive identity, targets, context and result recovery | 90/90 browser checks in latest single run | [Responsive receipt](deck-mobile-density.md), [prior target/context receipt](deck-touch-and-context.md) |
| Round close keyboard continuation | 90/90 full matrix; 10/10 affected follow-up repeats | [Focus receipt](round-close-completion-focus.md) |
| Screening draft/final recovery | 100 main checks, 30 receipt follow-ups, 50 reading-desk follow-ups; overlapping scopes | [Interface receipt](screening-review-interface-verification.md) |
| Sequential native keyboard application | 5/5 configurations; local form through navigation boundary | [Keyboard receipt](application-keyboard-continuity.md) |
| Applicant editable states | 24 focused, 45 broader tests; 8 styled synthetic SSR captures | [Applicant receipt](applicant-editable-status.md) |
| Production build, full ESLint, diff check | Pass | [Build](evidence/offer-deadline/build-final.log), [ESLint](evidence/offer-deadline/lint-final.log), [final test lint](evidence/offer-deadline/test-lint.log), [diff](evidence/offer-deadline/diff-final.log) |

These are separate scopes and runs; overlapping counts must not be added into a single full-site pass. The production build checks TypeScript. The refreshed task-local production preview returned HTTP200 for `/home`. Its `/api/health` returned HTTP503: this preview has no verified backend connection, so the public render does not establish service health. See [probe statuses](evidence/screening-applicant-preview-health.json).

Real PostgreSQL two-connection experiments verified Group Case first-save serialization, written-draft first-save conflict, stale final submission after a competing save, and refusal of a late save after final submission without draft resurrection. Four additional real screening connection races verify first saves, stale final submission, late saves after submission and late saves after recusal. Runtime ACL/RLS checks deny legacy unconditional authenticated writes and private helper/table access. Both application and migration rollout must use the v2 contracts together. Task databases were cleaned; no hosted project was mutated.

Earlier checkpoint source hashes are in [grading-revisions-final-inputs.json](evidence/grading-revisions-final-inputs.json). SQL inputs, scripts and raw proof are retained under [Group Case SQL evidence](evidence/group-case-write-revisions/) and [written-evaluation SQL evidence](evidence/evaluation-draft-write-revisions/). The interface receipts retain the genuine failing pointer runs and the corrected fixture/locator failures; later passes do not erase those findings.

## Acceptance remains open

The second AI-panel round is still in progress against its immutable earlier snapshot. No panel consensus or human/Apple endorsement is claimed. Later fixes are not retroactive votes. The panel's live counts belong to its [checkpoint](panel-100-v2/checkpoint.json).

The user reports no staging environment. Local synthetic browser requests, isolated SQL and a successful build do not verify real Clerk sessions, hosted Supabase/storage, email delivery or operator reconciliation. Approved real engagement evidence, Board-confirmed workload and relevant policy authority remain outstanding. Physical devices, assistive technology and observed human acceptance are also unverified. The goal remains active.

Latest screening source hashes and SQL proofs are retained in [SQL evidence](evidence/screening-draft-write-revisions/) and [interface evidence](evidence/screening-ui-revisions/). Latest deck/round source hashes are in [deck-round-focus-inputs.json](evidence/deck-round-focus-inputs.json); applicant hashes and styled synthetic captures are in [applicant evidence](evidence/applicant-editable-status/).
