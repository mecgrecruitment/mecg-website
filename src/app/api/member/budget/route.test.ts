import test from "node:test";
import assert from "node:assert/strict";
const member = { id: "00000000-0000-4000-8000-000000000001", active: true, memberships: [{ cycleId: "test", role: "MEMBER", active: true }] };
async function route(name: string): Promise<typeof import("./route")> { return import(`./route.ts?${name}`); }
const form = { kind: "REIMBURSEMENT", title: "Pizza", category: "EVENTS", amountCents: 8450, spentOn: "2026-11-10", receiptUrl: "", notes: "" };
const create = { id: null, revision: 0, request: form };
function request(payload: unknown) { return new Request("https://example.com/api/member/budget", { method: "POST", body: JSON.stringify(payload) }); }
function unreachable() { return { namedExports: { createClient: async () => { throw new Error("Persistence must not be reached"); } } }; }

test("signed-out callers cannot reach persistence", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("signedout");
  assert.equal((await POST(request(create))).status, 401);
});

test("panel-only and inactive memberships are refused", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => ({ ...member, memberships: [{ cycleId: "test", role: "PANEL", active: true }, { cycleId: "old", role: "MEMBER", active: false }] }) } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("panel");
  assert.equal((await POST(request(create))).status, 403);
});

test("invalid payloads are refused before the database", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => member } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("invalid");
  for (const payload of [
    { ...create, revision: 1 },
    { ...create, id: "not-a-uuid", revision: 1 },
    { id: "00000000-0000-4000-8000-000000000010", revision: 0, request: form },
    { ...create, request: { ...form, amountCents: 84.5 } },
    { ...create, request: { ...form, spentOn: null } },
    { ...create, extra: true },
    [create],
  ]) assert.equal((await POST(request(payload))).status, 400, JSON.stringify(payload));
});

test("a save calls the RPC with the parsed form", async (t) => {
  const calls: Record<string, unknown>[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => member } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, ...args }); return { data: { id: "x" }, error: null }; } }) } });
  const { POST } = await route("save");
  const response = await POST(request({ ...create, request: { ...form, title: "  Pizza  " } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  await POST(request({ id: "00000000-0000-4000-8000-000000000010", revision: 3, request: form }));
  assert.deepEqual(calls, [
    { name: "save_budget_request", target_id: null, expected_revision: 0, payload: form },
    { name: "save_budget_request", target_id: "00000000-0000-4000-8000-000000000010", expected_revision: 3, payload: form },
  ]);
});

test("database refusals keep their meaning", async (t) => {
  let error = { code: "55000", message: "This request is approved. Only its receipt link can change." };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => member } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async () => ({ data: null, error }) }) } });
  const { POST } = await route("refusals");
  const closed = await POST(request(create));
  assert.equal(closed.status, 409);
  assert.match((await closed.json()).error, /receipt link/);
  error = { code: "P0002", message: "Request not found" };
  assert.equal((await POST(request(create))).status, 404);
});
