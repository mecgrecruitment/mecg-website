import test from "node:test";
import assert from "node:assert/strict";
const member = { id: "00000000-0000-4000-8000-000000000001", active: true, memberships: [{ cycleId: "test", role: "MEMBER", active: true }] };
const board = { ...member, memberships: [{ cycleId: "test", role: "BOARD", active: true }] };
async function route(name: string): Promise<typeof import("./route")> { return import(`./route.ts?${name}`); }
const id = "00000000-0000-4000-8000-000000000010";
function request(payload: unknown) { return new Request("https://example.com/api/member/budget/actions", { method: "POST", body: JSON.stringify(payload) }); }
function unreachable() { return { namedExports: { createClient: async () => { throw new Error("Persistence must not be reached"); } } }; }

test("signed-out callers cannot reach persistence", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("signedout");
  assert.equal((await POST(request({ id, revision: 1, action: "WITHDRAW", payload: {} }))).status, 401);
});

test("members cannot approve, deny or mark paid", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => ({ ...member, memberships: [...member.memberships, { cycleId: "old", role: "BOARD", active: false }] }) } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("member");
  for (const [action, payload] of [["APPROVE", { note: "" }], ["DENY", { note: "No" }], ["MARK_PAID", { paidOn: "2026-11-14", paymentNote: "" }]] as const) {
    assert.equal((await POST(request({ id, revision: 1, action, payload }))).status, 403, action);
  }
});

test("invalid actions are refused before the database", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => board } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("invalid");
  for (const payload of [
    { id, revision: 1, action: "DELETE", payload: {} },
    { id: "nope", revision: 1, action: "APPROVE", payload: { note: "" } },
    { id, revision: 0, action: "APPROVE", payload: { note: "" } },
    { id, revision: 1, action: "DENY", payload: { note: " " } },
    { id, revision: 1, action: "MARK_PAID", payload: { paidOn: "soon", paymentNote: "" } },
    { id, revision: 1, action: "WITHDRAW", payload: { note: "" } },
    { id, revision: 1, action: "APPROVE", payload: { note: "" }, extra: 1 },
  ]) assert.equal((await POST(request(payload))).status, 400, JSON.stringify(payload));
});

test("actions call the RPC with the parsed payload and keep refusals", async (t) => {
  const calls: Record<string, unknown>[] = [];
  let error: { code: string; message: string } | null = null;
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => board } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, ...args }); return { data: error ? null : {}, error }; } }) } });
  const { POST } = await route("save");
  assert.equal((await POST(request({ id, revision: 2, action: "DENY", payload: { note: "  Use the recruitment line.  " } }))).status, 200);
  assert.equal((await POST(request({ id, revision: 3, action: "WITHDRAW", payload: {} }))).status, 200, "board members are members and may withdraw their own");
  assert.deepEqual(calls, [
    { name: "act_on_budget_request", target_id: id, expected_revision: 2, action: "DENY", payload: { note: "Use the recruitment line." } },
    { name: "act_on_budget_request", target_id: id, expected_revision: 3, action: "WITHDRAW", payload: {} },
  ]);
  error = { code: "42501", message: "Another board member has to act on your own request" };
  const own = await POST(request({ id, revision: 1, action: "APPROVE", payload: { note: "" } }));
  assert.equal(own.status, 403);
  assert.match((await own.json()).error, /Another board member/);
  error = { code: "55000", message: "This request is paid and cannot take that step." };
  assert.equal((await POST(request({ id, revision: 1, action: "APPROVE", payload: { note: "" } }))).status, 409);
});
