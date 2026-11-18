import test from "node:test";
import assert from "node:assert/strict";
const member = { id: "00000000-0000-4000-8000-000000000002", active: true, memberships: [{ cycleId: "fall", role: "MEMBER", active: true }] };
async function route(name: string): Promise<typeof import("./route")> { return import(`./route.ts?${name}`); }
const save = { cycleId: "fall", revision: 0, availability: { weeklyHours: 8, skills: ["Excel"], preferredProjectIds: ["p1"], notes: "" } };
function request(payload: unknown) { return new Request("https://example.com/api/member/staffing", { method: "POST", body: JSON.stringify(payload) }); }
function unreachable() { return { namedExports: { createClient: async () => { throw new Error("Persistence must not be reached"); } } }; }

test("signed-out callers cannot reach persistence", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("signedout");
  assert.equal((await POST(request(save))).status, 401);
});

test("panel-only, inactive and other-cycle members are refused", async (t) => {
  let user = { ...member, memberships: [{ cycleId: "fall", role: "PANEL", active: true }] };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("forbidden");
  assert.equal((await POST(request(save))).status, 403);
  user = { ...member, memberships: [{ cycleId: "fall", role: "MEMBER", active: false }] };
  assert.equal((await POST(request(save))).status, 403);
  user = { ...member, memberships: [{ cycleId: "spring", role: "MEMBER", active: true }] };
  assert.equal((await POST(request(save))).status, 403);
});

test("invalid payloads are refused before the database", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => member } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("invalid");
  for (const payload of [
    { ...save, cycleId: "" },
    { ...save, revision: -1 },
    { ...save, revision: "0" },
    { ...save, availability: { ...save.availability, weeklyHours: 41 } },
    { ...save, availability: { ...save.availability, skills: ["  "] } },
    { ...save, availability: { ...save.availability, extra: true } },
    [],
  ]) assert.equal((await POST(request(payload))).status, 400, JSON.stringify(payload));
});

test("a valid save calls the RPC with the parsed values", async (t) => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => member } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { data: { revision: 1 }, error: null }; } }) } });
  const { POST } = await route("save");
  const response = await POST(request({ ...save, availability: { ...save.availability, skills: [" Excel "], notes: " Fridays " } }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ name: "save_my_staffing_availability", args: { target_cycle_id: "fall", expected_revision: 0, weekly_hours: 8, skills: ["Excel"], preferred_project_ids: ["p1"], notes: "Fridays" } }]);
});

test("database refusals keep their meaning", async (t) => {
  let error = { code: "55000", message: "Your availability changed in another tab. Reload before saving." };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => member } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async () => ({ data: null, error }) }) } });
  const { POST } = await route("refusals");
  const stale = await POST(request(save));
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error, "Your availability changed in another tab. Reload before saving.");
  error = { code: "22023", message: "A chosen project no longer exists. Reload and choose again." };
  const gone = await POST(request(save));
  assert.equal(gone.status, 400);
  assert.equal((await gone.json()).error, "A chosen project no longer exists. Reload and choose again.");
  error = { code: "42501", message: "Active membership required" };
  assert.equal((await POST(request(save))).status, 403);
});
