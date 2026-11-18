import test from "node:test";
import assert from "node:assert/strict";
const user = { id: "00000000-0000-4000-8000-000000000001", active: true, memberships: [{ cycleId: "test", role: "MEMBER", active: true }] };
async function route(name: string): Promise<typeof import("./route")> { return import(`./route.ts?${name}`); }
const save = { action: "save", projectId: "p1", revision: 0, delivery: { status: "ACTIVE", milestones: [], risks: [], lastContactOn: "", lastContactNote: "" } };
function request(payload: unknown) { return new Request("https://example.com/api/projects/delivery", { method: "POST", body: JSON.stringify(payload) }); }
function unreachable() { return { namedExports: { createClient: async () => { throw new Error("Persistence must not be reached"); } } }; }

test("signed-out callers cannot reach persistence", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("signedout");
  assert.equal((await POST(request(save))).status, 401);
});

test("callers without an active membership are refused", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => ({ ...user, memberships: [{ ...user.memberships[0], active: false }] }) } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("inactive");
  assert.equal((await POST(request(save))).status, 403);
});

test("invalid payloads are refused before the database", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("invalid");
  for (const payload of [
    { ...save, delivery: { ...save.delivery, health: "ON_TRACK" } },
    { ...save, revision: -1 },
    { ...save, projectId: "" },
    { action: "health", projectId: "p1", revision: 1, health: "AT_RISK", note: "" },
    { action: "lead", projectId: "p1", revision: 1, leadId: "not-a-uuid" },
    { action: "drop", projectId: "p1", revision: 1 },
  ]) assert.equal((await POST(request(payload))).status, 400, JSON.stringify(payload));
});

test("each action calls its own RPC with the parsed values", async (t) => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { data: {}, error: null }; } }) } });
  const { POST } = await route("actions");
  assert.equal((await POST(request({ ...save, delivery: { ...save.delivery, lastContactNote: "  Call  " } }))).status, 200);
  assert.equal((await POST(request({ action: "health", projectId: "p1", health: "ON_TRACK", note: "" }))).status, 200);
  assert.equal((await POST(request({ action: "lead", projectId: "p1", revision: 2, leadId: null }))).status, 200);
  assert.deepEqual(calls.map((call) => call.name), ["save_project_delivery", "set_project_health", "set_project_lead"]);
  assert.equal((calls[0]?.args.payload as { lastContactNote: string }).lastContactNote, "Call");
  assert.equal(calls[2]?.args.target_user, null);
  assert.equal("expected_revision" in (calls[1]?.args ?? {}), false);
});

test("database refusals keep their meaning", async (t) => {
  let error = { code: "55000", message: "Delivery record changed. Reload before saving." };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async () => ({ data: null, error }) }) } });
  const { POST } = await route("refusals");
  assert.equal((await POST(request(save))).status, 409);
  error = { code: "42501", message: "Board or project lead access required" };
  assert.equal((await POST(request(save))).status, 403);
});
