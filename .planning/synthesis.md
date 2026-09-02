# Clerk architecture synthesis

## Inputs

- Repository auth-flow exploration
- Database identity and authorization exploration
- First-party Clerk, Supabase, and Next.js research in `docs/clerk-auth-research.md`
- Candidate A in `.planning/candidate-a.md`
- Candidate B in `.planning/candidate-b.md`
- Independent cross-judge review

## Decision

Use Candidate B as the structural base. It has the clearest module ownership and the strongest atomic provisioning contract. Both candidates independently converged on the same central design: keep UUID application identities, map exact external issuer and subject pairs to those UUIDs, and make `rush.actor_id()` the database identity boundary.

The cross-judge scored Candidate A 24/25 and Candidate B 23/25. Candidate A was slightly stronger on rollback detail. Candidate B was stronger on interface depth. The final plan uses B's structure and A's operational safeguards.

## Grafts from Candidate A

- Add an application-owned primary email source and move background email consumers off `auth.users`.
- Require a pre-implementation spike that includes direct browser Storage, not only database RLS.
- Return `410 Gone` from dormant legacy auth endpoints during the recovery window.
- Keep the provider-neutral database migration in place during rollback.
- Define degraded rollback after public Clerk-only accounts exist and require numeric rollback triggers.
- Require an exception path for unsupported authentication methods and prove the old application against `rush.actor_id()`.

## Corrections made during synthesis

- Prevent the Clerk import and webhook race with a preloaded migration ledger plus queued or import-aware reconciliation.
- Revoke only the deleted external identity by default. Do not deactivate or erase the whole profile until retention and multi-identity policy says to do so.
- Grant `rush.actor_id()` only where needed and accept anonymous denial rather than claiming both denial and a null anonymous result.
- Deploy the provider-neutral database before Clerk cutover. The cutover deploy contains only Clerk application changes and a rehearsed small database delta.
- Add a signing-key rotation and incident step for Supabase's third-party signing-key cache delay.

## Rejected

- Clerk string IDs as domain primary keys
- UUID custom session claims as the authorization source
- Webhook-only provisioning
- Automatic email linking
- Deprecated Supabase JWT templates
- Password dual-write
- Reversing the provider-neutral database during an incident
- Deleting Supabase users or secrets before recovery closes

## Verification result

The synthesized plan preserves the current UUID authorization model, keeps provider details behind one TypeScript boundary and one SQL boundary, sequences reversible work before cutover, and makes provider capacity, password portability, Storage, RLS, import reconciliation, and rollback measurable stop/go gates. No implementation was performed.
