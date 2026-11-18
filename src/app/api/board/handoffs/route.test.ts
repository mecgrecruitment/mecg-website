import test from "node:test";
import assert from "node:assert/strict";
const board = { id: "00000000-0000-4000-8000-000000000002", active: true, memberships: [{ cycleId: "test", role: "BOARD", active: true }] };
async function route(name: string): Promise<typeof import("./route")> { return import(`./route.ts?${name}`); }
const handoff = { roleTitle: "Treasurer", outgoingId: board.id, incomingId: null, dueOn: null, status: "OPEN", notes: "", items: [{ id: null, kind: "ACCOUNT", label: "Bank signatory", detail: "", done: false }] };
const create = { id: null, revision: 0, handoff };
const existing = "00000000-0000-4000-8000-000000000010";
function request(payload: unknown) { return new Request("https://example.com/api/board/handoffs", { method: "POST", body: JSON.stringify(payload) }); }
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
    { id: existing, revision: 0, handoff },
    { ...create, revision: -1 },
    { ...create, handoff: { ...handoff, status: "DONE" } },
    { ...create, handoff: { ...handoff, items: [{ ...handoff.items[0], id: existing }] } },
    { ...create, extra: true },
    [create],
  ]) assert.equal((await POST(request(payload))).status, 400, JSON.stringify(payload));
});

test("a save calls the RPC with the parsed form", async (t) => {
  const calls: Record<string, unknown>[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => board } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, ...args }); return { data: { id: "x" }, error: null }; } }) } });
  const { POST } = await route("save");
  const response = await POST(request({ ...create, handoff: { ...handoff, roleTitle: "  Treasurer  " } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  const edit = { ...handoff, items: [{ ...handoff.items[0], id: "00000000-0000-4000-8000-000000000011", done: true }] };
  await POST(request({ id: existing, revision: 3, handoff: edit }));
  assert.deepEqual(calls, [
    { name: "save_officer_handoff", target_id: null, expected_revision: 0, payload: handoff },
    { name: "save_officer_handoff", target_id: existing, expected_revision: 3, payload: edit },
  ]);
});

test("database refusals keep their meaning", async (t) => {
  let error = { code: "55000", message: "This handoff changed since you opened it. Reload before saving." };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => board } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async () => ({ data: null, error }) }) } });
  const { POST } = await route("refusals");
  const stale = await POST(request(create));
  assert.equal(stale.status, 409);
  assert.match((await stale.json()).error, /Reload/);
  error = { code: "22023", message: "Choose the incoming officer from current members" };
  const refused = await POST(request(create));
  assert.equal(refused.status, 400);
  assert.match((await refused.json()).error, /current members/);
  error = { code: "42501", message: "Board access required" };
  assert.equal((await POST(request(create))).status, 403);
  error = { code: "P0002", message: "Handoff not found" };
  assert.equal((await POST(request(create))).status, 404);
});
