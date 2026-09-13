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

const speedDatingPayload = {
  roundId: "round-sd",
  roundName: "Speed Dating",
  roundStatus: "OPEN",
  summary: { applicants: 2, graded: 2, graders: 2, thin: 1, split: 0, scores: 3 },
  applicants: [
    {
      applicationId: "app-1", name: "Ada Lovelace", status: "SUBMITTED", mean: 4.5, median: 4.5, count: 2, stddev: 0.71, adjusted: 4.2,
      histogram: [0, 0, 0, 1, 1], thin: false, split: false,
      scores: [
        { evaluatorName: "Grace Hopper", evaluatorId: "m-1", session: 1, score: 5, note: 'Sharp, said "yes" fast', submittedAt: "2026-09-13T20:00:00Z" },
        { evaluatorName: "Alan Turing", evaluatorId: "m-2", session: 2, score: 4, note: "", submittedAt: "2026-09-13T20:10:00Z" },
      ],
    },
    {
      applicationId: "app-2", name: "=Bob", status: "SUBMITTED", mean: 3, median: null, count: 1, stddev: null, adjusted: null,
      histogram: [0, 0, 1, 0, 0], thin: true, split: false,
      scores: [{ evaluatorName: "Grace Hopper", evaluatorId: "m-1", session: null, score: 3, note: "", submittedAt: "2026-09-13T20:20:00Z" }],
    },
  ],
  graders: [],
};

function speedDatingClient(round: { id: string; cycle_id: string; kind: string } | null, rpcCalls: Array<{ name: string; args: unknown }> = []) {
  return async () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: round, error: null }) }) }) }),
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return { data: speedDatingPayload, error: null };
    },
  });
}

test("Speed Dating export rejects a missing round before querying", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => boardUser } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("should not query"); } },
  });
  const { GET } = await importRoute("speed-dating-missing-round");
  const response = await GET(new Request(`http://localhost/api/admin/export?kind=speed-dating-summary&cycleId=${cycleId}`));
  assert.equal(response.status, 400);
});

test("Speed Dating export hides a round from another cycle", async (t) => {
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => boardUser } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: speedDatingClient({ id: "round-sd", cycle_id: "other-cycle", kind: "SPEED_DATING" }, rpcCalls) },
  });
  const { GET } = await importRoute("speed-dating-other-cycle");
  const response = await GET(new Request(`http://localhost/api/admin/export?kind=speed-dating-summary&cycleId=${cycleId}&roundId=round-sd`));
  assert.equal(response.status, 404);
  assert.deepEqual(rpcCalls, []);
});

test("Speed Dating summary exports one ranked row per applicant", async (t) => {
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => boardUser } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: speedDatingClient({ id: "round-sd", cycle_id: cycleId, kind: "SPEED_DATING" }, rpcCalls) },
  });
  const { GET } = await importRoute("speed-dating-summary");
  const response = await GET(new Request(`http://localhost/api/admin/export?kind=speed-dating-summary&cycleId=${cycleId}&roundId=round-sd`));
  const csv = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="speed-dating-summary.csv"');
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(csv.split("\n"), [
    "rank,name,status,adjusted,mean,median,graders,spread,stars_1,stars_2,stars_3,stars_4,stars_5,thin,split",
    "1,Ada Lovelace,SUBMITTED,4.2,4.5,4.5,2,0.71,0,0,0,1,1,no,no",
    "2,'=Bob,SUBMITTED,,3,,1,,0,0,1,0,0,yes,no",
    "",
  ]);
  assert.deepEqual(rpcCalls, [{ name: "speed_dating_results", args: { target_round_id: "round-sd" } }]);
});

test("Speed Dating scores export escapes notes with commas and quotes", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => boardUser } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: speedDatingClient({ id: "round-sd", cycle_id: cycleId, kind: "SPEED_DATING" }) },
  });
  const { GET } = await importRoute("speed-dating-scores");
  const response = await GET(new Request(`http://localhost/api/admin/export?kind=speed-dating-scores&cycleId=${cycleId}&roundId=round-sd`));
  const csv = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="speed-dating-scores.csv"');
  assert.deepEqual(csv.split("\n"), [
    "applicant,grader,score,note,session,submitted_at",
    'Ada Lovelace,Grace Hopper,5,"Sharp, said ""yes"" fast",1,2026-09-13T20:00:00Z',
    "Ada Lovelace,Alan Turing,4,,2,2026-09-13T20:10:00Z",
    "'=Bob,Grace Hopper,3,,,2026-09-13T20:20:00Z",
    "",
  ]);
});
