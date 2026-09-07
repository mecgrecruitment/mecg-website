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

test("Group Case backup exports blank rubric cells with stable recovery identifiers", async (t) => {
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => boardUser } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: {
      createClient: async () => ({
        rpc: async (name: string, args: unknown) => {
          rpcCalls.push({ name, args });
          return {
            data: {
              fileId: "file-1",
              cycleId,
              cycleName: "Fall 2026",
              roundId: "round-1",
              roundName: "Group Case",
              rubricVersion: 2,
              exportedAt: "2026-09-06T18:00:00Z",
              criteria: [{ id: "criterion-1", key: "collaboration", name: "Collaboration", weight: 25, required: true, position: 0 }],
              rows: [{
                groupId: "group-1",
                groupName: "+Team One",
                assignmentId: "assignment-1",
                evaluatorId: "judge-1",
                evaluatorName: "@Judge",
                applicationId: "application-1",
                applicantName: "=Applicant",
                status: "ASSIGNED",
              }],
            },
            error: null,
          };
        },
      }),
    },
  });
  const { GET } = await importRoute("group-case-backup");
  const response = await GET(new Request(`http://localhost/api/admin/export?kind=group-case&cycleId=${cycleId}&roundId=round-1`));
  const bytes = new Uint8Array(await response.arrayBuffer());
  const csv = new TextDecoder().decode(bytes.slice(3));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Array.from(bytes.slice(0, 3)), [0xef, 0xbb, 0xbf]);
  assert.ok(csv.startsWith("file_id,"));
  assert.match(csv, /collaboration_25pct_rating,evidence,flags,status/);
  assert.match(csv, /'\+Team One/);
  assert.match(csv, /'@Judge/);
  assert.match(csv, /'=Applicant/);
  assert.match(csv, /application-1,'=Applicant,,,,ASSIGNED/);
  assert.deepEqual(rpcCalls, [{
    name: "export_group_case_backup",
    args: { target_cycle_id: cycleId, target_round_id: "round-1" },
  }]);
});

test("Group Case backup rejects a missing round before querying", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => boardUser } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("should not query"); } },
  });
  const { GET } = await importRoute("group-case-missing-round");
  const response = await GET(new Request(`http://localhost/api/admin/export?kind=group-case&cycleId=${cycleId}`));
  assert.equal(response.status, 400);
});
