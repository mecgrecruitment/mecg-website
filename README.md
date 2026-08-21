# MECG Rush Platform

A cycle-based rush system for applications, event attendance, structured Member evaluations, Hash deliberation, and locked Board decisions.

## Setup

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

Open `http://localhost:3000/admin/login`. When the user table is empty, signing in with `OWNER_EMAIL` and `ADMIN_PASSWORD` creates the first named owner account. The Board dashboard then creates the first rush cycle and its versioned Speed Dating and Group Case rubrics.

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

- `DATABASE_URL` points to the Prisma database.
- `OWNER_EMAIL` is the bootstrap owner's email when no users exist.
- `ADMIN_PASSWORD` is used once to create the bootstrap owner.
- `SESSION_SECRET` signs expiring user sessions.
- `BASE_URL` optionally sets the host encoded in check-in QR codes.

Use a long random `SESSION_SECRET` and replace the bootstrap password before deployment.

## Verification

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

For the full HTTP state-machine check, start the development server and run `npm run verify:backend` in another terminal. The verifier creates uniquely named records, checks privacy and authorization failures as well as the successful path, and removes its records afterward.

The scoring functions are pure and tested independently from Prisma. The implementation plan and remaining policy decisions are documented in `docs/RUSH_PLATFORM_PLAN.md`.
