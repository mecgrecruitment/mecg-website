import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = readFileSync(resolve(root, ".env.local"), "utf8");
const read = (name) => source.match(new RegExp(`^${name}=["']?([^\\n"']+)`, "m"))?.[1]?.trim();
const url = read("NEXT_PUBLIC_SUPABASE_URL");
const publicKey = read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = read("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !publicKey || !serviceKey) throw new Error("Supabase environment is incomplete");

const anonHeaders = { apikey: publicKey, Authorization: `Bearer ${publicKey}`, "Accept-Profile": "rush" };
const serviceHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Accept-Profile": "rush" };
const anonRead = await fetch(`${url}/rest/v1/rush_cycles?select=id&limit=1`, { headers: anonHeaders });
if (![401,403].includes(anonRead.status)) throw new Error(`Anonymous base-table read was not denied: HTTP ${anonRead.status}`);
const serviceRead = await fetch(`${url}/rest/v1/rush_cycles?select=id&limit=0`, { headers: serviceHeaders });
if (!serviceRead.ok) throw new Error(`Service schema read failed: HTTP ${serviceRead.status}`);
const publicEventLookup = await fetch(`${url}/rest/v1/rpc/event_for_token`, { method: "POST", headers: { ...anonHeaders, "Content-Type": "application/json", "Content-Profile": "rush" }, body: JSON.stringify({ raw_token: crypto.randomUUID() }) });
if (!publicEventLookup.ok || JSON.stringify(await publicEventLookup.json()) !== "[]") throw new Error("Public event lookup did not safely return an empty result");
const openApi = await fetch(`${url}/rest/v1/`, { headers: serviceHeaders });
if (!openApi.ok) throw new Error(`Rush OpenAPI metadata failed: HTTP ${openApi.status}`);
const paths = Object.keys((await openApi.json()).paths ?? {});
for (const required of ["/rpc/submit_application","/rpc/submit_evaluation","/rpc/declare_conflict","/rpc/create_decision","/rpc/approve_decision","/rpc/release_decision"]) {
  if (!paths.includes(required)) throw new Error(`Missing RPC from API: ${required}`);
}
const migrations = JSON.parse(execFileSync("supabase", ["migration","list","--linked","--output-format","json"], { cwd: root, encoding: "utf8" }));
if (migrations.migrations?.some((migration) => migration.local !== migration.remote)) throw new Error("Local and remote migration ledgers differ");
console.log("Supabase backend verification passed: project, RLS denial, public token lookup, required RPCs, and migration parity.");
