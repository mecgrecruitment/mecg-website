import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = resolve(import.meta.dirname, "..");
const source = readFileSync(resolve(root, ".env.local"), "utf8");
const read = (name) => source.match(new RegExp(`^${name}=["']?([^\\n"']+)`, "m"))?.[1]?.trim();
const url = read("NEXT_PUBLIC_SUPABASE_URL");
const publicKey = read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = read("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !publicKey || !serviceKey) throw new Error("Supabase environment is incomplete");
const client = createClient(url, serviceKey, { db: { schema: "rush" }, auth: { persistSession: false, autoRefreshToken: false } });
const suffix = crypto.randomUUID();
const password = `${crypto.randomUUID()}Aa1!`;
const ids = [];

try {
  for (const label of ["owner", "panel", "applicant"]) {
    const { data, error } = await client.auth.admin.createUser({ email: `workflow-${label}-${suffix}@example.invalid`, password, email_confirm: true, user_metadata: { display_name: `Workflow ${label}` } });
    if (error || !data.user) throw new Error(`Could not create ${label} test identity: ${error?.message}`);
    ids.push(data.user.id);
  }
  for (let index = 0; index < ids.length; index += 1) {
    const userClient = createClient(url, publicKey, { db: { schema: "rush" }, auth: { persistSession: false, autoRefreshToken: false } });
    const label = ["owner", "panel", "applicant"][index];
    const { error: loginError } = await userClient.auth.signInWithPassword({ email: `workflow-${label}-${suffix}@example.invalid`, password });
    if (loginError) throw new Error(`Test identity could not sign in: ${loginError.message}`);
    const { data: visibleProfiles, error: profileError } = await userClient.from("profiles").select("id");
    if (profileError || visibleProfiles.length !== 1 || visibleProfiles[0].id !== ids[index]) throw new Error("Profile RLS did not isolate the authenticated user");
    await userClient.auth.signOut();
  }
  const { error } = await client.rpc("verify_full_workflow", { owner_id: ids[0], panel_id: ids[1], applicant_id: ids[2] });
  if (!error || error.message !== "WORKFLOW_SELF_TEST_PASSED") throw new Error(`Workflow self-test failed: ${error?.message ?? "function unexpectedly committed"}`);
  console.log("Full Supabase workflow passed and its database transaction was rolled back.");
} finally {
  for (const id of ids) await client.auth.admin.deleteUser(id);
}
