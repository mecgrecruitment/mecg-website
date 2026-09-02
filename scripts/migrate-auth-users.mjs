import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClerkClient } from "@clerk/backend";
import { createClient } from "@supabase/supabase-js";
import { withRetryAfter } from "./retry-after.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const inputFlag = process.argv.indexOf("--input");
const manifestFlag = process.argv.indexOf("--manifest");
const inputPath = inputFlag >= 0 ? resolve(process.argv[inputFlag + 1] ?? "") : null;
const manifestPath = resolve(manifestFlag >= 0 ? process.argv[manifestFlag + 1] ?? "" : ".clerk-migration-manifest.json");

if (!inputPath) throw new Error("Usage: npm run clerk:migrate-users -- --input secure-export.json [--manifest path] [--apply]");
const source = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(source)) throw new Error("Migration input must be an array");

function normalizeRecord(value, index) {
  if (!value || typeof value !== "object" || !UUID.test(value.id ?? "")) throw new Error(`Record ${index} has an invalid UUID`);
  const email = String(value.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) throw new Error(`Record ${index} has an invalid email`);
  if (value.passwordDigest != null && !/^\$2[abxy]\$/.test(value.passwordDigest)) throw new Error(`Record ${index} is not a bcrypt digest`);
  return {
    id: value.id,
    email,
    emailVerified: value.emailVerified === true,
    displayName: String(value.displayName ?? email.split("@")[0]).trim().slice(0, 120),
    passwordDigest: value.passwordDigest || null,
  };
}

const records = source.map(normalizeRecord);
if (!apply) {
  console.log(JSON.stringify({ mode: "dry-run", users: records.length, withPasswordDigest: records.filter((r) => r.passwordDigest).length }));
  process.exit(0);
}

for (const name of ["CLERK_SECRET_KEY", "CLERK_ISSUER", "NEXT_PUBLIC_MECG_SUPABASE_URL", "MECG_SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[name]?.trim()) throw new Error(`Missing required environment variable: ${name}`);
}
const issuer = process.env.CLERK_ISSUER.trim().replace(/\/+$/, "");
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY.trim() });
const supabase = createClient(process.env.NEXT_PUBLIC_MECG_SUPABASE_URL.trim(), process.env.MECG_SUPABASE_SERVICE_ROLE_KEY.trim(), {
  db: { schema: "rush" }, auth: { persistSession: false, autoRefreshToken: false },
});
let manifest = { version: 1, users: {} };
try { manifest = JSON.parse(await readFile(manifestPath, "utf8")); } catch {}

async function saveManifest() {
  const temporary = `${manifestPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, manifestPath);
}

for (const record of records) {
  if (manifest.users[record.id]?.status === "linked") continue;
  const attempts = (manifest.users[record.id]?.attempts ?? 0) + 1;
  manifest.users[record.id] = { sourceUserId: record.id, status: "started", attempts };
  await saveManifest();
  try {
    const { error: prepareError } = await supabase.rpc("prepare_auth_migration", { source_user_id: record.id, expected_email: record.email });
    if (prepareError) throw prepareError;
    const existing = await withRetryAfter(() => clerk.users.getUserList({ externalId: [record.id], limit: 1 }));
    let user = existing.data[0];
    if (!user) {
      const [firstName, ...last] = record.displayName.split(/\s+/);
      user = await withRetryAfter(() => clerk.users.createUser({
        externalId: record.id,
        emailAddress: [record.email],
        emailAddressIdentificationStatus: [record.emailVerified ? "verified" : "reserved"],
        firstName,
        lastName: last.join(" ") || undefined,
        ...(record.passwordDigest ? { passwordDigest: record.passwordDigest, passwordHasher: "bcrypt" } : {}),
      }));
    }
    const { error: linkError } = await supabase.rpc("ensure_external_identity", {
      identity_issuer: issuer, identity_subject: user.id, identity_email: record.email,
      identity_display_name: record.displayName, existing_app_user_id: record.id,
    });
    if (linkError) throw linkError;
    manifest.users[record.id] = { sourceUserId: record.id, clerkUserId: user.id, status: "linked", attempts };
  } catch {
    manifest.users[record.id] = { sourceUserId: record.id, status: "failed", attempts };
  }
  await saveManifest();
}
const failed = Object.values(manifest.users).filter((entry) => entry.status === "failed").length;
console.log(JSON.stringify({ mode: "apply", users: records.length, failed, manifest: manifestPath }));
if (failed) process.exitCode = 1;
