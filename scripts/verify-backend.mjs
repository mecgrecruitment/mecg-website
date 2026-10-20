import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import {
  fetchWithTimeout,
  loadSupabaseEnv,
  requireServiceRoleKey,
} from "./lib/supabase-env.mjs";

const root = resolve(import.meta.dirname, "..");
const { url, anonKey: publicKey, serviceRoleKey } = loadSupabaseEnv(root);
const serviceKey = requireServiceRoleKey(serviceRoleKey);

const anonHeaders = { apikey: publicKey, Authorization: `Bearer ${publicKey}`, "Accept-Profile": "rush" };
const serviceHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Accept-Profile": "rush" };
const anonRead = await fetchWithTimeout(`${url}/rest/v1/rush_cycles?select=id&limit=1`, { headers: anonHeaders });
if (![401,403].includes(anonRead.status)) throw new Error(`Anonymous base-table read was not denied: HTTP ${anonRead.status}`);
const serviceRead = await fetchWithTimeout(`${url}/rest/v1/rush_cycles?select=id&limit=0`, { headers: serviceHeaders });
if (!serviceRead.ok) throw new Error(`Service schema read failed: HTTP ${serviceRead.status}`);
const publicEventLookup = await fetchWithTimeout(`${url}/rest/v1/rpc/event_for_token`, { method: "POST", headers: { ...anonHeaders, "Content-Type": "application/json", "Content-Profile": "rush" }, body: JSON.stringify({ raw_token: crypto.randomUUID() }) });
if (!publicEventLookup.ok || JSON.stringify(await publicEventLookup.json()) !== "[]") throw new Error("Public event lookup did not safely return an empty result");
const fixtureAttempt = await fetchWithTimeout(`${url}/rest/v1/rpc/submit_application_self_test`, { method: "POST", headers: { ...anonHeaders, "Content-Type": "application/json", "Content-Profile": "rush" }, body: JSON.stringify({ applicant_name: "Denied Applicant", applicant_contact: "denied@example.invalid" }) });
if (![401,403].includes(fixtureAttempt.status)) throw new Error(`Public workflow fixture was not denied: HTTP ${fixtureAttempt.status}`);
const openApi = await fetchWithTimeout(`${url}/rest/v1/`, { headers: serviceHeaders });
if (!openApi.ok) throw new Error(`Rush OpenAPI metadata failed: HTTP ${openApi.status}`);
const paths = Object.keys((await openApi.json()).paths ?? {});
for (const required of ["/rpc/submit_application_v2","/rpc/save_application_draft_v2","/rpc/submit_evaluation","/rpc/declare_conflict","/rpc/create_decision","/rpc/approve_decision","/rpc/release_decision"]) {
  if (!paths.includes(required)) throw new Error(`Missing RPC from API: ${required}`);
}
const migrations = JSON.parse(execFileSync("supabase", ["migration","list","--linked","--output-format","json"], { cwd: root, encoding: "utf8", timeout: 15_000 }));
if (migrations.migrations?.some((migration) => migration.local !== migration.remote)) throw new Error("Local and remote migration ledgers differ");
console.log("Supabase backend verification passed: project, RLS and fixture denial, public token lookup, required RPCs, and migration parity.");
