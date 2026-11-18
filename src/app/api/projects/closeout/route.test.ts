import test from "node:test";
import assert from "node:assert/strict";
const user = { id: "00000000-0000-4000-8000-000000000002", active: true, memberships: [{ cycleId: "test", role: "BOARD", active: true }] };
const token = "b".repeat(64);
async function route(name: string): Promise<typeof import("./route")> { return import(`./route.ts?${name}`); }
function request(payload: unknown) { return new Request("https://example.com/api/projects/closeout", { method: "POST", body: JSON.stringify(payload) }); }
function unreachable() { return { namedExports: { createClient: async () => { throw new Error("Persistence must not be reached"); } } }; }

test("signed-out and non-member callers cannot reach persistence", async (t) => {
  let current: unknown = null;
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => current } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("signedout");
  assert.equal((await POST(request({ action: "create", projectId: "p1", cycleId: "test" }))).status, 401);
  current = { ...user, memberships: [{ ...user.memberships[0], active: false }] };
  assert.equal((await POST(request({ action: "create", projectId: "p1", cycleId: "test" }))).status, 403);
});

test("invalid payloads are refused before the database", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("invalid");
  for (const payload of [{ action: "create", projectId: "", cycleId: "test" }, { action: "create", projectId: "p1" }, { action: "send", projectId: "p1" }, []]) {
    assert.equal((await POST(request(payload))).status, 400, JSON.stringify(payload));
  }
});

test("create returns the one-time link and revoke calls its RPC", async (t) => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    return { data: name === "create_client_feedback_link" ? { token, expiresAt: "2026-12-18T05:00:00Z" } : {}, error: null };
  } }) } });
  const { POST } = await route("actions");
  const created = await POST(new Request("https://mecg.example/api/projects/closeout", { method: "POST", body: JSON.stringify({ action: "create", projectId: "p1", cycleId: "test" }) }));
  assert.equal(created.status, 200);
  assert.deepEqual(await created.json(), { ok: true, link: `https://mecg.example/feedback/${token}`, expiresAt: "2026-12-18T05:00:00Z" });
  assert.equal((await POST(request({ action: "revoke", projectId: "p1" }))).status, 200);
  assert.deepEqual(calls, [
    { name: "create_client_feedback_link", args: { target_project_id: "p1", target_cycle_id: "test" } },
    { name: "revoke_client_feedback_link", args: { target_project_id: "p1" } },
  ]);
});

test("database refusals keep their meaning and a malformed link is not shown", async (t) => {
  let result: { data: unknown; error: { code: string; message: string } | null } = { data: null, error: { code: "22023", message: "Close the project before asking for feedback" } };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async () => result }) } });
  const { POST } = await route("refusals");
  const refused = await POST(request({ action: "create", projectId: "p1", cycleId: "test" }));
  assert.equal(refused.status, 400);
  assert.equal((await refused.json()).error, "Close the project before asking for feedback");
  result = { data: null, error: { code: "55000", message: "Feedback already received for this project" } };
  assert.equal((await POST(request({ action: "create", projectId: "p1", cycleId: "test" }))).status, 409);
  result = { data: { token: "short" }, error: null };
  assert.equal((await POST(request({ action: "create", projectId: "p1", cycleId: "test" }))).status, 502);
});
