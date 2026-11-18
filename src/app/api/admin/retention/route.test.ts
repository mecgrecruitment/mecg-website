import test from "node:test";
import assert from "node:assert/strict";

function mock(t: import("node:test").TestContext, user: unknown, rpc: (name: string, args: unknown) => unknown) {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: unknown) => rpc(name, args) }) } });
}
const load = (name: string) => import(`./route.ts?case=${name}`) as Promise<typeof import("./route.ts")>;
const post = (body: unknown) => new Request("http://x/api/admin/retention", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

test("only an Owner may save, and bad months never reach the database", async (t) => {
  mock(t, { memberships: [{ cycleId: "c1", role: "BOARD", active: true }] }, () => { throw new Error("should not call"); });
  const { POST } = await load("board");
  assert.equal((await POST(post({ category: "audit_events", keepMonths: 12, revision: 1 }))).status, 403);
});

test("saves a period and reports a stale revision as a conflict", async (t) => {
  const calls: unknown[] = [];
  let error: unknown = null;
  mock(t, { memberships: [{ cycleId: "c1", role: "OWNER", active: true }] }, (name, args) => { calls.push([name, args]); return { data: { revision: 2, changed: true }, error }; });
  const { POST } = await load("owner");
  assert.equal((await POST(post({ category: "audit_events", keepMonths: 0, revision: 1 }))).status, 400);
  const ok = await POST(post({ category: "audit_events", keepMonths: null, revision: 1 }));
  assert.equal(ok.status, 200);
  assert.deepEqual(calls, [["save_retention_policy", { target_category: "audit_events", months: null, expected_revision: 1 }]]);
  error = { code: "40001", message: "changed" };
  assert.equal((await POST(post({ category: "audit_events", keepMonths: 12, revision: 1 }))).status, 409);
});
