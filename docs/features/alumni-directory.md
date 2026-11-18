# Alumni directory

Graduating and graduated members can choose to be listed so current members and the board can find them. Nobody is listed until they add themselves, each person chooses which details to share, and opting out deletes the listing straight away. The directory is visible only inside the signed-in workspace. It is never public, and the site sends no messages.

- `/member/alumni` (member nav: "Alumni"): your own listing (add, edit, opt out) and the directory with search.

## What works

- **Opt-in only.** A member with no listing sees an open form and a "List me in the directory" button. Until they press it, nothing about them appears.
- **Choose what to share.** Every detail is optional: graduation term, major, employer, role, city, LinkedIn link, email for members and a "happy to talk about" note. An empty field is not shared. Graduation term and major start from the member's profile, but nothing is saved until they submit. The name shown is always the member's current profile name.
- **Directory.** Listings are sorted by name. Search matches every word across the name and shared details (for example "ford detroit" or "2025"). LinkedIn links open in a new tab. Emails are `mailto:` links.
- **Easy opt-out.** "Take me off the directory" deletes the row, so the shared details are gone, not hidden. The member can add themselves again later.
- **Opting out after leaving the club.** Removing your own listing needs only a signed-in profile, not an active membership. Today, someone without an active membership cannot open any workspace page, so the board removes a listing for an alum who asks: each listing has "Remove on their request" for board and owner members. The board cannot create or edit anyone else's listing.

## Access

- Data lives in `rush.alumni_listings`, one row per profile, with RLS forced, no policies and no table grants. Deleting a profile deletes its listing.
- Access goes only through SECURITY DEFINER functions that check the caller on every call:
  - `rush.alumni_directory()`: any active member with an active profile, in any cycle and any role except PANEL alone. Returns the directory, the caller's own listing, and their profile's grad term and major as form defaults.
  - `rush.save_alumni_listing(expected_revision, payload)`: same people. It only ever writes the caller's own row.
  - `rush.remove_alumni_listing(target_id)`: `null` removes the caller's own listing (any signed-in profile; having no listing returns `false`, not an error). An id removes that listing: the caller's own, or anyone's for an active BOARD or OWNER member. For anyone else, another person's listing id returns "not found".
- The API routes are `POST /api/member/alumni` (save) and `POST /api/member/alumni/remove`, both under the proxy-protected `/api/member` prefix. The save route repeats the membership check. The remove route only requires sign-in, matching the opt-out rule. Both validate input before calling the database.
- LinkedIn links must be `https://` on `linkedin.com` or one of its subdomains. Emails must look like an address. Both are checked in the database, the API and the page. When reading, a stored link that isn't LinkedIn https is dropped rather than linked.
- Writes carry an optimistic revision. A stale save gets a 409. A save opened before an opt-out or board removal does not silently re-list the person. Saving an unchanged form creates no new revision.
- Every add, edit and removal adds a row to `rush.audit_events` (resource `AlumniListing`; actions `ALUMNI_LISTING_ADDED`, `_UPDATED`, `_REMOVED`). The metadata holds only which fields are shared or changed, the revision and, for removals, whether the person removed it themselves. It never holds a shared value. These events have no `cycle_id`, so the cycle-scoped Activity page does not list them.

## Rollout

1. Review and merge the PR.
2. Apply `supabase/migrations/20261118210000_alumni_directory.sql` to staging. Check that a member can add, edit and remove their listing; that another member sees only the shared fields; that a board member can remove someone else's listing but not edit it; and that a panel-only account sees the explanation and gets a 403 from `POST /api/member/alumni`.
3. Apply the migration to production. Until it is applied, the page shows "unavailable" and no data.
4. Tell graduating members the directory exists (the board decides who sends that message and when).

## Verification

- `npm run verify:alumni-directory`: applies the migration to a disposable PostgreSQL 17 container (no network). It checks opt-in, access by role (panel-only, inactive profile, ended membership, no profile), validation, shared-field-only reads, live names, revisions and the no-op save, self and board removal, opt-out after membership ends, that a stale save cannot re-list, that deleted rows are gone, and that audit metadata has only the allowed keys and no listing values. Five deliberate mutations made it fail: any member removing others, a listing value in audit metadata, PANEL allowed, a stale save re-listing, and a non-idempotent opt-out.
- Unit tests: `src/lib/alumni/model.test.ts` (form and response parsing, LinkedIn and email rules, search, and that fields and limits match the migration), `src/app/api/member/alumni/route.test.ts` and `remove/route.test.ts` (auth, validation before the database, RPC arguments, error mapping), and `src/components/alumni-directory.test.ts` (rendered states).
- UI preview with fixtures at 1440 and 390, listed and not-listed states: no horizontal overflow and no console errors.
- Not verified: hosted Clerk and PostgREST, staging acceptance, real-browser save.

## Owner decisions (defaults chosen)

- Who can list themselves: every active member except panel-only accounts. "Graduating" is not checked, because grad term is free text. Should listing be limited, for example to members whose grad term is this year or earlier?
- Who can read: active members and the board (not panel-only). Should recruitment-committee-only or newly admitted members see contact details?
- Listings of people whose profile was later deactivated stay visible. Should a deactivated profile hide its listing?
- Alumni without an active membership can't reach the page, so they opt out through the board. Should alumni keep a sign-in that only reaches this page or an account page?
- The board can remove any listing but not edit one. Board removal is for opt-out requests, not moderation of content.
- The fields offered, and their limits (term 40, text 120, LinkedIn 300, email 254, note 500 characters). Adding a field needs a migration.
- The board does not get an export, and no shared value goes into audit metadata. There is no retention or automatic expiry.
