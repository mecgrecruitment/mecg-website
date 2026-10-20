# Recovery capture reconciliation after V2 freeze

V2 reviewer007 correctly observed that the supplied synthetic recovery capture predates the final button treatment: it shows Recover browser answers in orange, while frozen source uses a secondary button. This is an evidence mismatch, not an application-state or authorization defect.

The existing mobile Chromium combination/export scenario was rerun against current source:1/1 passed. The application form, comparison component and scenario source hashes exactly match frozen V2. The fresh full-page capture was visually inspected: Continue with combined answers is the single orange primary action, with both whole-copy choices secondary. Long text, download receipt and field grouping remain readable; the scenario reasserts no horizontal overflow and correct combined save.

The frozen V2 capture and content manifest were not replaced. All reviewers continue to inspect the same frozen packet; their reports/votes remain unchanged. This supplemental artifact is available for a subsequent evidence package. Source/capture hashes and exact scope are in evidence/post-v2-capture-reconciliation.json; raw result is evidence/post-v2-capture-reconciliation.log. The fresh image remains under .audit/v2-capture-reconciliation/. It depicts a synthetic harness in Linux mobile Chromium, not a hosted account, physical device or human study.
