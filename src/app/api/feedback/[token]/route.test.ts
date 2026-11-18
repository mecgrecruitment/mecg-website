import test from "node:test";
import assert from "node:assert/strict";
const token = "c".repeat(64);
const answers = { satisfaction: 4, wouldRehire: "MAYBE", quote: "", attribution: "", quotePermission: false, logoPermission: false, permissionScope: "" };
async function route(name: string): Promise<typeof import("./route")> { return import(`./route.ts?${name}`); }
function request(payload: unknown) { return new Request(`https://example.com/api/feedback/${token}`, { method: "POST", body: JSON.stringify(payload) }); }
const params = (value = token) => ({ params: Promise.resolve({ token: value }) });
function limiter(status: "allowed" | "limited" | "unavailable") { return { namedExports: { checkRateLimitStatus: async () => status, clientIp: () => "203.0.113.7" } }; }
function unreachable() { return { namedExports: { createPublicClient: () => { throw new Error("Persistence must not be reached"); } } }; }

test("malformed tokens and answers are refused before the database", async (t) => {
  t.mock.module("@/lib/rate-limit", limiter("allowed"));
  t.mock.module("@/lib/supabase/public", unreachable());
  const { POST } = await route("invalid");
  assert.equal((await POST(request(answers), params("not-a-token"))).status, 404);
  assert.equal((await POST(request({ ...answers, satisfaction: 7 }), params())).status, 400);
  assert.equal((await POST(request({ ...answers, logoPermission: true }), params())).status, 400);
});

test("rate limits apply before the database", async (t) => {
  t.mock.module("@/lib/rate-limit", limiter("limited"));
  t.mock.module("@/lib/supabase/public", unreachable());
  const { POST } = await route("limited");
  assert.equal((await POST(request(answers), params())).status, 429);
});

test("a valid submission goes to the token-checked RPC without a session", async (t) => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  t.mock.module("@/lib/rate-limit", limiter("allowed"));
  t.mock.module("@/lib/supabase/public", { namedExports: { createPublicClient: () => ({ rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { data: true, error: null }; } }) } });
  const { POST } = await route("valid");
  assert.equal((await POST(request({ ...answers, quote: "  Helpful  " }), params())).status, 200);
  assert.equal(calls[0]?.name, "submit_client_feedback");
  assert.equal(calls[0]?.args.raw_token, token);
  assert.equal((calls[0]?.args.payload as { quote: string }).quote, "Helpful");
});

test("a used or expired link says so", async (t) => {
  t.mock.module("@/lib/rate-limit", limiter("allowed"));
  t.mock.module("@/lib/supabase/public", { namedExports: { createPublicClient: () => ({ rpc: async () => ({ data: null, error: { code: "P0002", message: "This feedback link has expired or was already used" } }) }) } });
  const { POST } = await route("used");
  const response = await POST(request(answers), params());
  assert.equal(response.status, 410);
  assert.match((await response.json()).error, /already used/);
});
