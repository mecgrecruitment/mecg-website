import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const USER = { id: "member-1", email: "m@umich.edu", name: "Member", active: true, memberships: [] };

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/member/screening", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("POST /api/member/screening rejects payloads over the 128 KiB cap before parsing", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("413");
  const request = postRequest({ assignmentId: "a1", action: "SUBMIT" }, { "content-length": String(128 * 1024 + 1) });
  t.mock.method(request, "json", async () => { throw new Error("json should not be read"); });
  const res = await POST(request);
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error, "Payload is too large");
});

test("POST /api/member/screening returns the next private assignment after submit", async (t) => {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => ({
      rpc: async (name: string, args?: Record<string, unknown>) => {
        calls.push({ name, args });
        if (name === "submit_screening_review_v2") return { data: { kind: "submitted", assignmentId: "assignment-1", reviewId: "review-1", score: 82 }, error: null };
        if (name === "next_screening_assignment") return { data: "assignment-2", error: null };
        throw new Error(`unexpected RPC ${name}`);
      },
    }) },
  });
  const { POST } = await importRoute("submit-next");
  const res = await POST(postRequest({
    assignmentId: "assignment-1",
    action: "SUBMIT",
    ratings: [{ criterionId: "motivation", score: 4, note: "Evidence" }],
    evidence: "Specific evidence from the written response.",
    recommendation: "ADVANCE",
    expectedDraftRevision: null,
  }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).nextAssignmentId, "assignment-2");
  assert.deepEqual(calls.map((call) => call.name), ["submit_screening_review_v2", "next_screening_assignment"]);
});

test("POST /api/member/screening requires evidence notes for ratings 1 and 5 only", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("extreme-note");
  for (const score of [1, 5]) {
    const res = await POST(postRequest({
      assignmentId: "assignment-1",
      action: "SUBMIT",
      ratings: [{ criterionId: "motivation", score, note: "  " }],
      evidence: "Specific evidence from the written response.",
      recommendation: "HOLD",
    }));
    assert.equal(res.status, 400);
  }
});

const revision = "10000000-0000-4000-8000-000000000001";
const finalPayload = { assignmentId: "assignment-1", action: "SUBMIT", ratings: [{ criterionId: "analysis", score: 2, note: "" }], evidence: "Specific observations from the written response.", recommendation: "HOLD", expectedDraftRevision: revision };
for (const scenario of ["forward", "no-revision", "conflict", "wrong-conflict-target", "legacy-numeric", "wrong-target", "wrong-kind", "no-review", "recusal", "legacy-recusal", "recusal-wrong-target", "replacement-failed", "next-failed"] as const) {
  test(`screening final action v2 ${scenario}`, async (t) => {
    const calls: { name: string; args: unknown }[] = [];
    const recusal = scenario.startsWith("recusal") || scenario === "legacy-recusal" || scenario === "replacement-failed";
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      if (name === "next_screening_assignment") return scenario === "next-failed" ? { data: null, error: { code: "XX000", message: "Link unavailable" } } : { data: "assignment-2", error: null };
      const submitted = { kind: "submitted", assignmentId: "assignment-1", reviewId: "review-1", score: 25 };
      const snapshot = { assignmentId: "assignment-1", revision, draft: null };
      const data = scenario === "conflict" ? { kind: "conflict", snapshot } : scenario === "wrong-conflict-target" ? { kind: "conflict", snapshot: { ...snapshot, assignmentId: "another" } }
        : scenario === "legacy-numeric" ? 25 : scenario === "wrong-target" ? { ...submitted, assignmentId: "another" }
          : scenario === "wrong-kind" ? { kind: "recused", assignmentId: "assignment-1" } : scenario === "no-review" ? { ...submitted, reviewId: "" }
            : scenario === "legacy-recusal" ? null : scenario === "recusal-wrong-target" ? { kind: "recused", assignmentId: "another" }
              : recusal ? { kind: "recused", assignmentId: "assignment-1" } : submitted;
      return { data, error: scenario === "replacement-failed" ? { code: "55000", message: "no eligible replacement reviewer exists for this packet; the recusal cannot be completed" } : null };
    } }) } });
    const { POST } = await importRoute(`v2-${scenario}`);
    const { expectedDraftRevision, ...withoutRevision } = finalPayload;
    assert.ok(expectedDraftRevision);
    const response = await POST(postRequest(recusal ? { assignmentId: "assignment-1", action: "RECUSE", reason: "Prior close relationship" } : scenario === "no-revision" ? withoutRevision : finalPayload));
    assert.equal(response.status, scenario === "no-revision" ? 400 : scenario === "replacement-failed" || scenario === "conflict" ? 409 : ["forward", "recusal", "next-failed"].includes(scenario) ? 200 : 503);
    if (scenario === "no-revision") assert.equal(calls.length, 0);
    else assert.equal(calls[0]?.name, recusal ? "recuse_screening_assignment_v2" : "submit_screening_review_v2");
    if (scenario === "forward") assert.deepEqual(calls[0]?.args, { target_assignment_id: "assignment-1", ratings: finalPayload.ratings, review_evidence: finalPayload.evidence, review_recommendation: "HOLD", expected_draft_revision: revision });
    if (!["forward", "next-failed"].includes(scenario)) assert.ok(calls.every(({ name }) => name !== "next_screening_assignment"));
    if (scenario === "next-failed") assert.deepEqual(await response.json(), { kind: "submitted", assignmentId: "assignment-1", reviewId: "review-1", score: 25, nextAssignmentId: null });
  });
}

test("screening API rejects external evidence, recommendation and recusal types before RPC", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("Invalid external input must not reach Supabase"); } } });
  const { POST } = await importRoute("external-types");
  for (const body of [
    { ...finalPayload, evidence: { toString: "not observations" } }, { ...finalPayload, evidence: ["array observations"] },
    { ...finalPayload, evidence: "too short" }, { ...finalPayload, evidence: "a".repeat(6001) },
    { ...finalPayload, recommendation: { value: "HOLD" } }, { ...finalPayload, recommendation: "OFFER" },
    { assignmentId: "assignment-1", action: "RECUSE", reason: { value: "Prior relationship" } },
    { assignmentId: "assignment-1", action: "RECUSE", reason: 1234567 },
    { assignmentId: "assignment-1", action: "RECUSE", reason: "a".repeat(1001) },
  ]) assert.equal((await POST(postRequest(body))).status, 400);
});
