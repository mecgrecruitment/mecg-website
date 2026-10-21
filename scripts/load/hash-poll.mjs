#!/usr/bin/env node
// Replays what one open Hash ballot costs the database, for many laptops at once.
// Each virtual laptop is a distinct signed-in member and repeats the requests that
// /api/member/hash/live makes per poll, straight against PostgREST, every 3 seconds.
//
//   node scripts/load/hash-poll.mjs --users users.json --cycle c_open --laptops 1000 --seconds 60
//
// users.json: [{ "iss": "...", "sub": "..." }] mapped in rush.auth_identities to members
// of --cycle. Needs SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_JWT_SECRET of a LOCAL
// stack: it signs its own tokens, so it cannot and must not target the hosted project.
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: {
  users: { type: "string" }, cycle: { type: "string" }, laptops: { type: "string", default: "1000" },
  seconds: { type: "string", default: "60" }, interval: { type: "string", default: "3000" },
  // chain: the six requests the route made per poll before member_hash_live; single: one RPC.
  mode: { type: "string", default: "single" },
} });
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_JWT_SECRET;
if (!url || !anonKey || !secret || !values.users || !values.cycle) throw new Error("Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET, --users and --cycle.");
if (!/^http:\/\/(127\.0\.0\.1|localhost|172\.\d+\.\d+\.\d+)(:\d+)?$/.test(url)) throw new Error(`Refusing a non-local SUPABASE_URL: ${url}`);
// The local Kong gateway drops sockets long before the database is busy, which the
// hosted gateway does not. POSTGREST_DIRECT=1 with the rest container's address skips it.
const restBase = process.env.POSTGREST_DIRECT === "1" ? url : `${url}/rest/v1`;

const users = JSON.parse(readFileSync(values.users, "utf8"));
const laptops = Number(values.laptops);
const durationMs = Number(values.seconds) * 1000;
const intervalMs = Number(values.interval);

const base64url = (value) => Buffer.from(value).toString("base64url");
function token({ iss, sub }) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${base64url(JSON.stringify({ iss, sub, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 }))}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}

async function call(jwt, path, init = {}) {
  const response = await fetch(`${restBase}/${path}`, {
    ...init,
    headers: { apikey: anonKey, authorization: `Bearer ${jwt}`, "accept-profile": "rush", "content-profile": "rush", "content-type": "application/json", ...init.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path} ${response.status} ${JSON.stringify(body).slice(0, 120)}`);
  return body;
}
const rpc = (jwt, name, args = {}) => call(jwt, `rpc/${name}`, { method: "POST", body: JSON.stringify(args) });

async function pollSingle(jwt) {
  await rpc(jwt, "member_hash_live", { target_cycle_id: values.cycle, target_application_id: "" });
}

// The route before member_hash_live: identity, then profile and memberships together,
// then the presenting row and the ballot together, then the presented applicant's notes.
async function pollChain(jwt) {
  const appUserId = await rpc(jwt, "actor_id");
  await Promise.all([
    call(jwt, `profiles?select=id,display_name,primary_email,active&id=eq.${appUserId}`),
    call(jwt, `memberships?select=id,cycle_id,role,active,rush_cycles!inner(id,name,status,hash_stage,created_at)&user_id=eq.${appUserId}&active=eq.true`),
  ]);
  const [cycleRows, ballot] = await Promise.all([
    call(jwt, `rush_cycles?select=hash_presenting_application_id&id=eq.${values.cycle}`),
    rpc(jwt, "hash_ballot", { target_cycle_id: values.cycle }),
  ]);
  const presenting = cycleRows[0]?.hash_presenting_application_id ?? ballot?.[0]?.id;
  if (presenting) await rpc(jwt, "hash_applicant_notes", { target_application_id: presenting });
}

const poll = values.mode === "chain" ? pollChain : pollSingle;
const latencies = [];
const errors = new Map();
const deadline = Date.now() + durationMs;
async function laptop(index) {
  const jwt = token(users[index % users.length]);
  // Laptops open the page over one interval, not in the same millisecond.
  await new Promise((resolve) => setTimeout(resolve, Math.random() * intervalMs));
  while (Date.now() < deadline) {
    const started = performance.now();
    try {
      await poll(jwt);
      latencies.push(performance.now() - started);
    } catch (error) {
      const key = `${error.message} ${error.cause?.code ?? ""}`.slice(0, 80);
      errors.set(key, (errors.get(key) ?? 0) + 1);
    }
    const wait = intervalMs - (performance.now() - started);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

await Promise.all(Array.from({ length: laptops }, (_, index) => laptop(index)));
latencies.sort((a, b) => a - b);
const at = (q) => latencies.length ? Math.round(latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))]) : null;
const failed = [...errors.values()].reduce((sum, count) => sum + count, 0);
console.log(JSON.stringify({
  mode: values.mode, laptops, seconds: durationMs / 1000, intervalMs,
  polls: latencies.length, failed, pollsPerSecond: Math.round(latencies.length / (durationMs / 1000)),
  ms: { p50: at(0.5), p95: at(0.95), p99: at(0.99), max: at(1) },
  errors: Object.fromEntries(errors),
}, null, 2));
