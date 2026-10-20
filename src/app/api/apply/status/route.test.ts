import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

const USER = { id: "u1", email: "ada@umich.edu", name: "Ada", active: true, memberships: [] };

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function request() {
  return new NextRequest("http://localhost/api/apply/status?cycleId=cycle-1", { headers: { "x-request-id": "status-test-1" } });
}

test("GET /api/apply/status returns caller-scoped submission state without caching", async (t) => {
  const calls: string[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({
    from: (table: string) => ({ select: (columns: string) => ({ eq: (field: string, id: string) => ({ eq: (cycleField: string, cycle: string) => ({ maybeSingle: async () => {
      assert.deepEqual([table, columns, field, id, cycleField, cycle], ["applications", "id", "id", "application-1", "cycle_id", "cycle-1"]);
      return { data: { id }, error: null };
    } }) }) }) }),
    rpc: async (name: string) => {
      calls.push(name);
      return { data: { applicationId: "application-1", status: "SUBMITTED", submitted: true }, error: null };
    },
  }) } });
  const { GET } = await importRoute("submitted");
  const response = await GET(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-request-id"), "status-test-1");
  assert.deepEqual(await response.json(), { application: { applicationId: "application-1", cycleId: "cycle-1", status: "SUBMITTED", submitted: true } });
  assert.deepEqual(calls, ["my_application_submission_status"]);
});

test("GET /api/apply/status safely represents no application", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async () => ({ data: null, error: null }) }) } });
  const { GET } = await importRoute("none");
  const response = await GET(request());
  assert.deepEqual(await response.json(), { application: null });
});

test("GET /api/apply/status rejects malformed dependency responses", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async () => ({ data: { submitted: "yes" }, error: null }) }) } });
  const { GET } = await importRoute("malformed");
  const response = await GET(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "INVALID_STATUS_RESPONSE");
});


test("GET /api/apply/status cannot confirm an application from a different cycle", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({
    rpc: async () => ({ data: { applicationId: "older-application", status: "SUBMITTED", submitted: true }, error: null }),
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
  }) } });
  const { GET } = await importRoute("wrong-cycle");
  assert.deepEqual(await (await GET(request())).json(), { application: null });
});

test("GET /api/apply/status requires the cycle being submitted", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("Must not query without a cycle"); } } });
  const { GET } = await importRoute("missing-cycle");
  const response = await GET(new NextRequest("http://localhost/api/apply/status"));
  assert.equal(response.status, 400);
});
