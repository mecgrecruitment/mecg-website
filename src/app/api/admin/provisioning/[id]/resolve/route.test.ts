import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

const incidentId = "42000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ id: incidentId }) };
function user(role = "OWNER", cycleId = "owned-cycle") {
  return { id: "owner", email: "private-owner@example.invalid", name: "Owner", active: true,
    memberships: [{ id: "membership", cycleId, role, active: true,
      cycle: { id: cycleId, name: "Cycle", status: "OPEN", createdAt: new Date() } }] };
}
type RpcError = { code: string; message: string };
function client({ cycleId = "owned-cycle", lookupError = null, missing = false, rpcError = null }: {
  cycleId?: string; lookupError?: RpcError | null; missing?: boolean; rpcError?: RpcError | null;
} = {}) {
  const calls: Array<{ name: string; args: unknown }> = [];
  const result = {
    from(table: string) {
      assert.equal(table, "provisioning_incidents");
      return { select(columns: string) {
        assert.equal(columns, "id,cycle_id");
        return { eq(key: string, value: string) {
          assert.equal(key, "id"); assert.equal(value, incidentId);
          return { async maybeSingle() { return { data: missing ? null : { id: incidentId, cycle_id: cycleId }, error: lookupError }; } };
        } };
      } };
    },
    async rpc(name: string, args: unknown) { calls.push({ name, args }); return { data: null, error: rpcError }; },
  };
  return { result, calls };
}
async function route(caseName: string) { return import(`./route.ts?case=${caseName}`); }
const request = () => new NextRequest(`http://localhost/api/admin/provisioning/${incidentId}/resolve`, { method: "POST" });

test("unauthenticated resolution never initializes a data client", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("must not initialize"); } } });
  assert.equal((await (await route("anonymous")).POST(request(), context)).status, 401);
});
test("Board access alone cannot resolve provisioning incidents", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user("BOARD") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("must not initialize"); } } });
  assert.equal((await (await route("board")).POST(request(), context)).status, 403);
});
test("the real incident cycle defeats an owner role in another cycle", async (t) => {
  const fake = client({ cycleId: "another-cycle" });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user() } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.result } });
  const response = await (await route("wrong-cycle")).POST(request(), context);
  assert.equal(response.status, 403); assert.deepEqual(fake.calls, []);
});
test("malformed incident references are rejected before querying", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user() } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("must not initialize"); } } });
  assert.equal((await (await route("bad-id")).POST(request(), { params: Promise.resolve({ id: "not-a-uuid" }) })).status, 400);
});
test("a lookup outage preserves the incident and does not leak database PII", async (t) => {
  const fake = client({ lookupError: { code: "08006", message: "private-person@example.invalid user_secret" } });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user() } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.result } });
  const response = await (await route("lookup-outage")).POST(request(), context);
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private-person|user_secret/); assert.deepEqual(fake.calls, []);
});
test("invisible or missing incidents cannot invoke the resolver", async (t) => {
  const fake = client({ missing: true });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user() } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.result } });
  assert.equal((await (await route("missing")).POST(request(), context)).status, 404); assert.deepEqual(fake.calls, []);
});
test("resolution invokes only the caller-scoped canonical RPC", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user() } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.result } });
  const response = await (await route("success")).POST(request(), context);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { resolved: true });
  assert.deepEqual(fake.calls, [{ name: "resolve_provisioning_incident", args: { target_incident_id: incidentId } }]);
});
test("a role revocation enforced by the RPC fails without claiming resolution", async (t) => {
  const fake = client({ rpcError: { code: "42501", message: "private-person@example.invalid" } });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user() } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.result } });
  const response = await (await route("revoked")).POST(request(), context);
  assert.equal(response.status, 403); const body = await response.text();
  assert.match(body, /Resolution was not recorded/); assert.doesNotMatch(body, /private-person|resolved.*true/);
});
test("a database failure returns no raw identity diagnostics", async (t) => {
  const fake = client({ rpcError: { code: "XX000", message: "clerk_user_private private-person@example.invalid" } });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user() } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.result } });
  const response = await (await route("db-failure")).POST(request(), context);
  assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /clerk_user_private|private-person/);
});

test("a transport exception preserves the action without logging identity diagnostics", async (t) => {
  const fake = client();
  const errorLog = t.mock.method(console, "error", () => {});
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user() } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ ...fake.result,
    rpc: async () => { throw new Error("private-person@example.invalid clerk_user_secret"); },
  }) } });
  const response = await (await route("transport-failure")).POST(request(), context);
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.match(body, /could not be recorded/); assert.doesNotMatch(body, /private-person|clerk_user_secret|resolved.*true/);
  assert.equal(errorLog.mock.calls.length, 0);
});
