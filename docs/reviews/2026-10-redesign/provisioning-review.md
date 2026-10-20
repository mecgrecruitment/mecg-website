disposition: ship

Focused privacy/correctness source review of the provisioning continuation. No database execution, live-provider operation, browser session or participant panel was performed by this reviewer. This report does not count earlier reviews as new panel members.

## persistence

Reviewed `provisioning-incident.ts`, ADD_USER and error logging in the admin rush route, the existing identity/allowlist implementation, migration `20261016195000`, incident SQL tests, the provisioning owner page and People link, resolution API/button, and relevant route/page/helper tests. The final inspected route includes the uncertainty-classification correction described below.

## fidelity

Failure logging contains a generated incident reference, bounded phase/event values and cleanup/recording booleans. It does not copy submitted email/name/password, Clerk user ID, provider response/error bodies or database error messages. Failure JSON returns generic recovery instructions, incident reference and truthful `remediationRecorded`; necessary lookup identity is confined to the restricted incident record and authorized owner page. A failed incident insert reports false and asks the initiating owner to retain the form details; it does not fall back to logging PII.

The People recovery link includes the selected cycle. The incident page honors an explicitly requested cycle only when the caller has membership-management permission. Owner-only RLS scopes reads by each incident’s actual cycle. Authenticated callers cannot insert/rewrite/delete incident facts; the service writer has only named insert columns and cannot pre-resolve records. The resolution API derives the actual incident cycle through caller-scoped lookup, and its RPC rechecks current owner authority. Resolution changes only the incident’s resolution fields and its audit entry; it does not delete/repair an account, grant access or send mail. Repeated resolution is idempotent.

Creation transport/timeouts/server failures remain uncertain and require reconciliation. Once identity linking succeeds, a later grant failure preserves both provider/local accounts because allowlist claims may have created legitimate access. False cleanup booleans mean no failed cleanup was recorded; UI explicitly explains that cleanup may not have been attempted. Unknown identity-link acknowledgements likewise preserve state for review.

## ceiling

No further confirmed material privacy, authorization or destructive-recovery defect was found in the final inspected source. The owner page displays the identity needed for manual remediation, labels unavailable IDs and unattempted cleanup honestly, paginates unresolved incidents and distinguishes an unavailable queue from an empty queue. Retention policy and live Clerk/Supabase/operator acceptance remain external release evidence; no policy or production-readiness certification is implied.

## material_fixes

Resolved during review: ADD_USER originally treated every five-character RPC error code as a definite failed identity transaction and permitted Clerk deletion. This included connection failure `08006` and unknown statement completion `40003`, where a committed identity/allowlist claim cannot be excluded. The parent changed compensation to an explicit allowlist of known semantic failures (`22023`, `23505`, `42501`); all other codes preserve the account and record an incident. Inspected regression scenarios now assert no deletion for `08006`/`40003` and no identity/provider text in logs or failure responses. No code edits were made by this reviewer; none remain requested by this review.

## keep

Preserve owner/cycle-scoped incident access, minimal remediation data, truthful failed-recording fallback, conservative uncertain-outcome preservation, and resolution as an audit action separate from actual account remediation. Test source was reviewed; database/provider verification belongs to the parent and was not independently rerun here.
