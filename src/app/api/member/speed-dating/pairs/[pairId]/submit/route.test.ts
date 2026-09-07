import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const USER = { id: "member-1", email: "member@umich.edu", name: "Member", active: true, memberships: [] };

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function request(members: unknown) {
  return new NextRequest("http://localhost/api/member/speed-dating/pairs/pair-1/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ members }),
  });
}

const context = { params: Promise.resolve({ pairId: "pair-1" }) };

test("pair submit validates both ratings before opening a database client", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("database should not be called"); } },
  });
  const { POST } = await importRoute("invalid");
  const response = await POST(request([
    { applicationId: "app-1", score: 5, note: "" },
    { applicationId: "app-2", score: 3, note: "" },
  ]), context);
  assert.equal(response.status, 400);
});

test("pair submit delegates one bounded atomic command to the database", async (t) => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: {
      createClient: async () => ({
        rpc: async (name: string, args: Record<string, unknown>) => {
          calls.push({ name, args });
          return { data: { pairId: "pair-1", submitted: true }, error: null };
        },
      }),
    },
  });
  const { POST } = await importRoute("success");
  const members = [
    { applicationId: "app-1", score: 4, note: "" },
    { applicationId: "app-2", score: 2, note: "Needed stronger examples" },
  ];
  const response = await POST(request(members), context);
  assert.equal(response.status, 201);
  assert.deepEqual(calls, [{
    name: "submit_speed_dating_pair",
    args: { target_pair_id: "pair-1", submitted_members: members },
  }]);
});
