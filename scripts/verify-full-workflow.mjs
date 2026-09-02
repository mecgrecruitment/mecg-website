import { resolve } from "node:path";
import { createClerkClient } from "@clerk/backend";
import { createClient } from "@supabase/supabase-js";
import { loadSupabaseEnv, requireServiceRoleKey } from "./lib/supabase-env.mjs";

const root = resolve(import.meta.dirname, "..");
const { url, serviceRoleKey } = loadSupabaseEnv(root);
const serviceKey = requireServiceRoleKey(serviceRoleKey);
const secretKey = process.env.CLERK_SECRET_KEY?.trim();
const issuer = process.env.CLERK_ISSUER?.trim().replace(/\/+$/, "");
if (!secretKey || !issuer) throw new Error("CLERK_SECRET_KEY and CLERK_ISSUER are required");
const clerk = createClerkClient({ secretKey });
const client = createClient(url, serviceKey, {
  db: { schema: "rush" },
  auth: { persistSession: false, autoRefreshToken: false },
});
const suffix = crypto.randomUUID();
const identities = [];
let primaryError;

try {
  for (const label of ["owner", "panel", "applicant"]) {
    const email = `workflow-${label}-${suffix}@example.invalid`;
    const clerkUser = await clerk.users.createUser({
      emailAddress: [email],
      firstName: "Workflow",
      lastName: label,
      skipPasswordRequirement: true,
    });
    const { data: appUserId, error } = await client.rpc("ensure_external_identity", {
      identity_issuer: issuer,
      identity_subject: clerkUser.id,
      identity_email: email,
      identity_display_name: `Workflow ${label}`,
    });
    if (error) throw new Error(`Could not provision ${label}: ${error.message}`);
    identities.push({ clerkUserId: clerkUser.id, appUserId });
  }
  const { error } = await client.rpc("verify_full_workflow", {
    owner_id: identities[0].appUserId,
    panel_id: identities[1].appUserId,
    applicant_id: identities[2].appUserId,
  });
  if (!error || error.message !== "WORKFLOW_SELF_TEST_PASSED") {
    throw new Error(`Workflow self-test failed: ${JSON.stringify(error)}`);
  }
  console.log("Full Clerk-backed workflow passed and its workflow transaction was rolled back.");
} catch (error) {
  primaryError = error;
  throw error;
} finally {
  const cleanup = await Promise.allSettled(identities.flatMap((identity) => [
    clerk.users.deleteUser(identity.clerkUserId),
    client.from("profiles").delete().eq("id", identity.appUserId),
  ]));
  const cleanupErrors = cleanup.filter((result) => result.status === "rejected").map((result) => result.reason);
  if (cleanupErrors.length) {
    const cleanupError = new AggregateError(cleanupErrors, "Could not clean up every Clerk workflow identity");
    if (primaryError) console.error(cleanupError);
    else throw cleanupError;
  }
}
