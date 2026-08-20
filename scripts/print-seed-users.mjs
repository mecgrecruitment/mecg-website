#!/usr/bin/env node
/**
 * Print the synthetic local seed logins (from supabase/seed.sql comments/contract).
 * Usage: npm run seed:users
 */
const password = "password123";

const users = [
  { email: "board01.test@umich.edu", role: "board", note: "President (typical login for /internal)" },
  { email: "board02.test@umich.edu", role: "board", note: "VP External" },
  { email: "board03.test@umich.edu", role: "board", note: "VP Internal" },
  { email: "board04.test@umich.edu", role: "board", note: "VP Recruitment" },
  { email: "board05.test@umich.edu", role: "board", note: "VP Consulting" },
  { email: "board06.test@umich.edu", role: "board", note: "VP Consulting" },
  { email: "board07.test@umich.edu", role: "board", note: "VP Education" },
  { email: "board08.test@umich.edu", role: "board", note: "VP Education" },
  { email: "board09.test@umich.edu", role: "board", note: "VP Finance" },
  { email: "board10.test@umich.edu", role: "board", note: "VP Marketing" },
  { email: "committee.test@umich.edu", role: "recruitment_committee", note: "Committee surface" },
  { email: "member.test@umich.edu", role: "general_member", note: "General member surface" },
  { email: "applicant.test@umich.edu", role: "(no members row)", note: "Applicant /apply path" },
];

console.log("Local seed users (created by `npm run db:reset` / supabase/seed.sql)");
console.log(`Password for all: ${password}`);
console.log("Open http://127.0.0.1:3000/auth/login (use 127.0.0.1, not localhost)\n");

const emailWidth = Math.max(...users.map((u) => u.email.length));
const roleWidth = Math.max(...users.map((u) => u.role.length));

for (const user of users) {
  console.log(
    `${user.email.padEnd(emailWidth)}  ${user.role.padEnd(roleWidth)}  ${user.note}`
  );
}

console.log(`
Quick role smoke (manual):
  1. board01…     → /internal and /internal/members
  2. committee…   → /internal (committee-allowed pages; board-only pages should deny)
  3. member…      → /internal (member-allowed pages only)
  4. applicant…   → /apply/dashboard and /apply/application
  5. signed-out   → /internal, /apply/dashboard → redirect /auth/login?next=…

Automated redirect smoke (no login): npm run test:role-smoke
RLS / SQL smokes (needs local Supabase): npm run db:test
`);
