import test from "node:test";
import assert from "node:assert/strict";
const board = { id: "00000000-0000-4000-8000-000000000002", active: true, memberships: [{ cycleId: "test", role: "BOARD", active: true }] };
async function route(name: string): Promise<typeof import("./route")> { return import(`./route.ts?${name}`); }
const decision = { decidedOn: "2026-11-12", title: "Adopt dues", category: "FINANCE", outcome: "APPROVED", summary: "", votes: null, minutesUrl: "" };
const create = { id: null, revision: 0, decision };
function request(payload: unknown) { return new Request("https://example.com/api/board/decisions", { method: "POST", body: JSON.stringify(payload) }); }
function unreachable() { return { namedExports: { createClient: async () => { throw new Error("Persistence must not be reached"); } } }; }

test("signed-out callers cannot reach persistence", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("signedout");
  assert.equal((await POST(request(create))).status, 401);
});

test("callers without an active board membership are refused", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => ({ ...board, memberships: [{ cycleId: "test", role: "MEMBER", active: true }, { cycleId: "old", role: "BOARD", active: false }] }) } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("member");
  assert.equal((await POST(request(create))).status, 403);
});

test("invalid payloads are refused before the database", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => board } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("invalid");
  for (const payload of [
    { ...create, revision: 1 },
    { ...create, id: "not-a-uuid", revision: 1 },
    { id: "00000000-0000-4000-8000-000000000010", revision: 0, decision },
    { ...create, revision: -1 },
    { ...create, decision: { ...decision, outcome: "PASSED" } },
    { ...create, extra: true },
    [create],
  ]) assert.equal((await POST(request(payload))).status, 400, JSON.stringify(payload));
});

test("a save calls the RPC with the parsed form and returns the entry", async (t) => {
  const calls: Record<string, unknown>[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => board } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, ...args }); return { data: { id: "x" }, error: null }; } }) } });
  const { POST } = await route("save");
  const response = await POST(request({ ...create, decision: { ...decision, title: "  Adopt dues  " } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  await POST(request({ id: "00000000-0000-4000-8000-000000000010", revision: 3, decision }));
  assert.deepEqual(calls, [
    { name: "save_board_decision", target_id: null, expected_revision: 0, payload: { ...decision, title: "Adopt dues" } },
    { name: "save_board_decision", target_id: "00000000-0000-4000-8000-000000000010", expected_revision: 3, payload: decision },
  ]);
});

test("database refusals keep their meaning", async (t) => {
  let error = { code: "55000", message: "This decision changed since you opened it. Reload before saving." };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => board } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async () => ({ data: null, error }) }) } });
  const { POST } = await route("refusals");
  const stale = await POST(request(create));
  assert.equal(stale.status, 409);
  assert.match((await stale.json()).error, /Reload/);
  error = { code: "42501", message: "Board access required" };
  assert.equal((await POST(request(create))).status, 403);
  error = { code: "P0002", message: "Decision not found" };
  assert.equal((await POST(request(create))).status, 404);
});
