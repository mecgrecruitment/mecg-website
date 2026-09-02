import test from "node:test";
import assert from "node:assert/strict";

const cycleId = "cycle-1";
const boardUser = {
  id: "board-1",
  memberships: [{
    cycleId,
    role: "BOARD",
    active: true,
    cycle: { status: "OPEN", createdAt: new Date("2026-01-01T00:00:00Z") },
  }],
};

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

test("attendance export rejects an unauthorized cycle before querying", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => boardUser } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("should not query"); } },
  });
  const { GET } = await importRoute("unauthorized-cycle");
  const response = await GET(new Request("http://localhost/api/admin/export?cycleId=other-cycle"));
  assert.equal(response.status, 403);
});

test("attendance export neutralizes spreadsheet formulas and disables caching", async (t) => {
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => boardUser } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: {
      createClient: async () => ({
        rpc: async (name: string, args: unknown) => {
          rpcCalls.push({ name, args });
          return {
            data: [{ applicant_code: "PNM-001", name: "=HYPERLINK(\"bad\")", status: "SUBMITTED", events_attended: 2 }],
            error: null,
          };
        },
      }),
    },
  });
  const { GET } = await importRoute("formula-guard");
  const response = await GET(new Request(`http://localhost/api/admin/export?cycleId=${cycleId}`));
  const csv = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.deepEqual(rpcCalls, [{ name: "export_attendance", args: { target_cycle_id: cycleId } }]);
});
