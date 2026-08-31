import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  fetchWithTimeout,
  loadSupabaseEnv,
  requireServiceRoleKey,
} from "./lib/supabase-env.mjs";

const root = resolve(import.meta.dirname, "..");
const { url, anonKey, serviceRoleKey } = loadSupabaseEnv(root);
const serviceKey = requireServiceRoleKey(serviceRoleKey);
const options = {
  db: { schema: "rush" },
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchWithTimeout },
};
const client = createClient(url, serviceKey, options);
const suffix = crypto.randomUUID();
const password = `${crypto.randomUUID()}Aa1!`;
const ids = [];
let primaryError;

try {
  for (const label of ["owner", "panel", "applicant"]) {
    const { data, error } = await client.auth.admin.createUser({ email: `workflow-${label}-${suffix}@example.invalid`, password, email_confirm: true, user_metadata: { display_name: `Workflow ${label}` } });
    if (error || !data.user) throw new Error(`Could not create ${label} test identity: ${error?.message}`);
    ids.push(data.user.id);
  }
  for (let index = 0; index < ids.length; index += 1) {
    const userClient = createClient(url, anonKey, options);
    const label = ["owner", "panel", "applicant"][index];
    const { error: loginError } = await userClient.auth.signInWithPassword({ email: `workflow-${label}-${suffix}@example.invalid`, password });
    if (loginError) throw new Error(`Test identity could not sign in: ${loginError.message}`);
    const { data: visibleProfile, error: profileError } = await userClient.from("profiles").select("id").eq("id", ids[index]).single();
    if (profileError || visibleProfile.id !== ids[index]) throw new Error(`Profile RLS did not expose the authenticated user: ${profileError?.message ?? "unexpected profile"}`);
    await userClient.auth.signOut();
  }
  const { error } = await client.rpc("verify_full_workflow", { owner_id: ids[0], panel_id: ids[1], applicant_id: ids[2] });
  if (!error || error.message !== "WORKFLOW_SELF_TEST_PASSED") throw new Error(`Workflow self-test failed: ${JSON.stringify(error)}`);
  console.log("Full Supabase workflow passed and its database transaction was rolled back.");
} catch (error) {
  primaryError = error;
  throw error;
} finally {
  const cleanup = await Promise.allSettled(ids.map((id) => client.auth.admin.deleteUser(id)));
  const cleanupErrors = cleanup
    .map((result) => result.status === "rejected" ? result.reason : result.value.error)
    .filter(Boolean);
  if (cleanupErrors.length) {
    const cleanupError = new AggregateError(cleanupErrors, "Could not clean up every workflow test identity");
    if (primaryError) console.error(cleanupError);
    else throw cleanupError;
  }
}
