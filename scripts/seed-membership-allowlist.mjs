// Load the membership roster into rush.membership_allowlist so the people who
// already belong land in the right role when they sign themselves up. Anyone
// who has already signed in is claimed immediately, because the in-database
// claim only fires on a first authenticated request.
//
// Usage: node scripts/seed-membership-allowlist.mjs roster.csv [--apply]
// The CSV is `email,role,name` with no header. Never commit the real roster.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROLES = new Set(["MEMBER", "BOARD", "PANEL", "RECRUITMENT_COMMITTEE"]);
const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/** Parse and validate the whole roster before anything is written. */
export function buildAllowlistPlan(csv) {
  const rows = [];
  const seen = new Set();
  const lines = csv.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const source = `row ${index + 1}`;
    const [rawEmail = "", rawRole = "", ...rest] = line.split(",");
    const email = rawEmail.trim().toLowerCase();
    const role = rawRole.trim().toUpperCase();
    const name = rest.join(",").trim();
    if (!EMAIL.test(email)) throw new Error(`${source} has an invalid email: ${JSON.stringify(rawEmail.trim())}`);
    if (role === "OWNER") throw new Error(`${source} (${email}) asks for OWNER, which is never granted from a roster`);
    if (!ROLES.has(role)) throw new Error(`${source} (${email}) has an unknown role: ${JSON.stringify(rawRole.trim())}`);
    if (seen.has(email)) throw new Error(`${source} repeats an email already in the roster: ${email}`);
    seen.add(email);
    rows.push({ email, role, note: name || null });
  }
  if (!rows.length) throw new Error("The roster is empty");
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const csvPath = args.find((value) => !value.startsWith("--"));
  if (!csvPath) throw new Error("Usage: node scripts/seed-membership-allowlist.mjs roster.csv [--apply]");

  const rows = buildAllowlistPlan(await readFile(resolve(csvPath), "utf8"));
  const tally = {};
  for (const row of rows) tally[row.role] = (tally[row.role] ?? 0) + 1;
  console.log(`Plan from ${resolve(csvPath)}: ${rows.length} rows (${Object.entries(tally).map(([role, count]) => `${count} ${role}`).join(", ")})`);
  rows.forEach((row, index) => {
    console.log(`${String(index + 1).padStart(3)}. ${row.email.padEnd(34)} ${row.role.padEnd(22)} ${row.note ?? ""}`);
  });

  if (!apply) {
    console.log("\nDRY RUN. Nothing was written. Re-run with --apply to load these rows.");
    process.exit(0);
  }

  for (const name of ["NEXT_PUBLIC_MECG_SUPABASE_URL", "MECG_SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[name]?.trim()) throw new Error(`Missing required environment variable: ${name}`);
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_MECG_SUPABASE_URL.trim(), process.env.MECG_SUPABASE_SERVICE_ROLE_KEY.trim(), {
    db: { schema: "rush" }, auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: upsertError } = await supabase.from("membership_allowlist").upsert(rows, { onConflict: "email" });
  if (upsertError) throw upsertError;
  console.log(`\nUpserted ${rows.length} allowlist rows.`);

  // Anyone already signed in has a profile, so their first-request claim has
  // been and gone. Claim for them now instead of making them sign in again.
  const { data: profiles, error: profileError } = await supabase
    .from("profiles").select("id, primary_email").in("primary_email", rows.map((row) => row.email));
  if (profileError) throw profileError;
  const existing = new Map((profiles ?? []).map((profile) => [profile.primary_email, profile.id]));

  let claimed = 0;
  let waiting = 0;
  let failed = 0;
  for (const row of rows) {
    const userId = existing.get(row.email);
    if (!userId) {
      waiting += 1;
      console.log(`${row.email.padEnd(34)} pending  no profile yet, claims on first sign-in`);
      continue;
    }
    const { error } = await supabase.rpc("claim_membership_allowlist", { target_user_id: userId, candidate_email: row.email });
    if (error) {
      failed += 1;
      console.log(`${row.email.padEnd(34)} FAILED   ${error.message}`);
    } else {
      claimed += 1;
      console.log(`${row.email.padEnd(34)} claimed  ${row.role}`);
    }
  }
  console.log(`\nApplied: ${rows.length} rows, ${claimed} claimed now, ${waiting} waiting for first sign-in, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}
