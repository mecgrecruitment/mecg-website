import test from "node:test";
import assert from "node:assert/strict";
const board = { id: "00000000-0000-4000-8000-000000000001", active: true, memberships: [{ cycleId: "fall", role: "BOARD", active: true }] };
async function route(name: string): Promise<typeof import("./route")> { return import(`./route.ts?${name}`); }
const save = { cycleId: "fall", revision: 0, thresholds: { minAttendancePct: 60, minProjects: 1, requireOnboarding: false } };
function request(payload: unknown) { return new Request("https://example.com/api/admin/standing", { method: "POST", body: JSON.stringify(payload) }); }
function unreachable() { return { namedExports: { createClient: async () => { throw new Error("Persistence must not be reached"); } } }; }

test("signed-out callers cannot reach persistence", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("signedout");
  assert.equal((await POST(request(save))).status, 401);
});

test("members and board of another cycle are refused", async (t) => {
  let user = { ...board, memberships: [{ cycleId: "fall", role: "MEMBER", active: true }] };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("forbidden");
  assert.equal((await POST(request(save))).status, 403);
  user = { ...board, memberships: [{ cycleId: "spring", role: "BOARD", active: true }] };
  assert.equal((await POST(request(save))).status, 403);
  user = { ...board, memberships: [{ cycleId: "fall", role: "BOARD", active: false }] };
  assert.equal((await POST(request(save))).status, 403);
});

test("invalid payloads are refused before the database", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => board } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("invalid");
  for (const payload of [
    { ...save, cycleId: "" },
    { ...save, revision: -1 },
    { ...save, revision: "0" },
    { ...save, thresholds: { ...save.thresholds, minAttendancePct: 101 } },
    { ...save, thresholds: { ...save.thresholds, minProjects: 1.5 } },
    { ...save, thresholds: { ...save.thresholds, extra: true } },
    [],
  ]) assert.equal((await POST(request(payload))).status, 400, JSON.stringify(payload));
});

test("a valid save calls the RPC with the parsed values", async (t) => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => board } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { data: { revision: 1 }, error: null }; } }) } });
  const { POST } = await route("save");
  assert.equal((await POST(request(save))).status, 200);
  assert.deepEqual(calls, [{ name: "save_member_standing_thresholds", args: { target_cycle_id: "fall", expected_revision: 0, min_attendance_pct: 60, min_projects: 1, require_onboarding: false } }]);
});

test("database refusals keep their meaning", async (t) => {
  let error = { code: "55000", message: "Thresholds changed. Reload before saving." };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => board } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async () => ({ data: null, error }) }) } });
  const { POST } = await route("refusals");
  const stale = await POST(request(save));
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error, "Thresholds changed. Reload before saving.");
  error = { code: "42501", message: "Board access required" };
  assert.equal((await POST(request(save))).status, 403);
});
