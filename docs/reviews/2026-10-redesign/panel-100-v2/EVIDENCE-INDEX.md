# Frozen V2 evidence index

The coordinator prompt supplies the exact immutable `/tmp/mecg-panel-20261016-v2` snapshotId. Its root `content-manifest.json` contains the full file-hash inventory; `SNAPSHOT.json` records the package identity and exclusions. Read snapshot-relative paths only. The mutable review output directory is separate.

## Current code and verification

- `docs/PRODUCT.md`, `docs/DESIGN.md` and `docs/reviews/2026-10-redesign/implementation-receipt.md` identify product authority, identity and chronological verification. Historical entries in that receipt are explicitly superseded by later sections; they are not current test totals.
- Final local Node baseline:780passed; build/TypeScript, ESLint and whitespace checks pass. Raw latest logs: `docs/reviews/2026-10-redesign/evidence/release-evidence-final-node.log`, `release-evidence-final-build.log`, `release-evidence-final-lint.log`.
- Database:170migrations,753assertions/14SQLfiles, clean lint/parser and runtime ACL checks. `docs/reviews/2026-10-redesign/evidence/release-evidence-sql/` includes inputs.json hashes, migrations.log, tests.log, security.log, lint.log, parser.log and cleanup.log. An initial field-name privacy regex failure and corrected runs remain in focused*.log. See release-evidence-diagnostics.md for exact guarded helper/reader scope. No hosted database was used.
- Current browser collection655 scenario/configuration checks across five configured engines/devices, **not** one655-pass run. Integrated610run passed586/failed24; corrected110follow-up established passing coverage of615then-current combinations. Later application105/105, motion35/35, mobile instrument5/5 and diagnostics15/15 scoped runs add/retest changed behavior; existing operator/release35passed separately. These runs overlap. Exact logs are in `evidence/integrated-final-browser.log`, `integrated-followup-browser.log`, `application-combine-browser.log`, `deck-motion-browser.log`, `mobile-hierarchy-browser.log`, `release-evidence-final-browser.log`, and `release-evidence-entry-browser.log`. Original failures/stopped iterations remain; read their documented causes rather than silently adding counts.
- Framework/library source and test files are included; node_modules/build outputs are excluded. Review relevant source and test assertions rather than assuming a named test proves every edge. No full suite should be launched by a voter.

## Captures and provenance

All paths below are relative to the snapshot root. `captures/PROVENANCE.json` records original local artifact paths. The images are supplied artifacts; no shared browser or account should be used.

- `captures/public-home-mobile-390.png`, `public-home-mobile-320.png`, `public-home-desktop-1280.png`, `public-home-webkit-mobile-390.png`: actual public homepage rendered locally after composition changes; unavailable-service fixtures. Chromium is the usable culture-photo inspection; some lazy images in full-page WebKit were not loaded. No hosted dependency or field outcome is implied.
- `captures/public-home-expanded-mobile-320.png`: expanded mobile bench. The sticky header position was neutralized only to avoid screenshot occlusion; development indicator hidden. Do not infer this adjustment is product behavior. The native disclosure/station interaction is tested separately in mobile-hierarchy-browser.log.
- `captures/synthetic-application-mixed-copies-mobile.png`: local intercepted application conflict/recovery harness, mobile Chromium. Synthetic private profile/essays, not a real applicant or authenticated provider account. Related source/tests: application-recovery-review.tsx and application-combine.spec.ts.
- `captures/synthetic-release-round-diagnostics-mobile-webkit.png`: synthetic private release-evidence harness, mobile WebKit; exact round blockers/readiness UI with intercepted responses. It is not a real released decision or live authenticated account.

Other private states have source/test/SSR evidence where no final capture is supplied. Do not claim to have seen an unprovided screenshot. Visual craft can be assessed within supplied scope; state important visual unknowns.

## Local public lab

`evidence-lab/home-composition-mobile.report.json` and `.html` are the exact latest Lighthouse13.5.0 mobile-localhost report for the revised homepage. `docs/reviews/2026-10-redesign/evidence/home-composition-lab-summary.json` summarizes98performance/100accessibility/100best-practices/100SEO, LCP2346ms/CLS0/TBT35ms, no warnings. This is a synthetic production-build lab, not field speed, ranking, conversion or accessibility certification. Other public lab results are documented in public-production-lab.md and are separately scoped.

## Prior objections and responses

Read this directory's ORIGINAL-BRIEF.md, BRIEF.md, prior-findings-and-responses.json, RESPONSES.md and UNRESOLVED.md. Original141findings are preserved with historical responses; no prior verdict prescribes V2 agreement. Updated detailed receipts include application-mixed-copy-recovery.md, shared-display-motion.md, mobile-proof-hierarchy.md, release-evidence-diagnostics.md, release-evidence-source-review.md, cohort-workspace-selection.md, account-provisioning-followup.md and operator-review-and-scale.md. Nonvoting source QA remains nonvoting.

No staging exists per the user; approved project artifacts/workload facts, hosted provider acceptance and Board policy approvals remain unavailable. This scope has not been lowered to make agreement easier.
