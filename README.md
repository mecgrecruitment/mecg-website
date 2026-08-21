# MECG Rush Platform

A cycle-based rush system for applications, event attendance, structured Member evaluations, Hash deliberation, and locked Board decisions.

## Setup

```bash
npm install
cp .env.example .env
npm run supabase:link
npm run supabase:verify-project
npm run dev
```

Open `http://localhost:3000/admin/login` and sign in with a Supabase Auth account. The first cycle can only be created by the existing MECG Recruitment board account. Later accounts are created from the Board dashboard.

## Roles and access

- Applicants submit through `/apply` while a cycle is open and receive a private status link. Final outcomes appear only after a locked decision is explicitly released.
- Members can open Speed Dating, Group Case, and Hash workspaces. They can submit only assigned evaluations and cannot see peer scores or aggregate rankings.
- Board operations roles can manage assignments and round status. A separate Hash panel role can see locked aggregates and make decisions after every evaluated round is frozen.
- Owners can create Member, Board operations, and Hash panel roles. Users cannot grant roles to themselves.

Every privileged action uses a named session and server-side cycle permission check. Submitted evaluations are immutable. Final decisions need two distinct, conflict-free Board or Owner approvals before locking.

Users can replace temporary passwords from the Evaluation Hub. Changing a password increments the account's session version, invalidating every older session.

## Evaluation rules

Ratings use anchored scores from 1 through 5 plus `N/O`. `N/O` remains missing and never becomes zero. A valid form needs at least 75 percent observed rubric weight and its required criterion. A round needs at least two valid independent evaluations. A score spread of 25 points or more enters structured review.

The dry-run round weights are:

- Speed Dating: 40 percent
- Group Case: 60 percent

Attendance is operational only. It does not contribute to evaluation rankings or final scores. The QR check-in remains a convenience rather than proof of identity.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL` is the MECG Recruitment project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the project's publishable browser key.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and is used for account administration and project verification.
- `BASE_URL` optionally sets the host encoded in check-in QR codes.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code or prefix it with `NEXT_PUBLIC_`.

## Verification

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run supabase:verify-project
npm run verify:backend
```

`supabase:verify-project` fails unless both `.env.local` and the Supabase CLI
link point to the healthy MECG Recruitment project. Run `npm run supabase:link`
to repair a missing or incorrect local CLI link. Run `npm run supabase:sync-env`
to replace a stale browser key with MECG Recruitment's publishable key.

For the full HTTP state-machine check, start the development server and run `npm run verify:backend` in another terminal. The verifier creates uniquely named records, checks privacy and authorization failures as well as the successful path, and removes its records afterward.

The scoring functions are pure and tested independently from Supabase. Database migrations and RLS policies live in `supabase/migrations`.
