import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const USER = { id: "member-1", email: "m@umich.edu", name: "Member", active: true, memberships: [] };

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/member/evaluations/assignment-1", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function params() {
  return { params: Promise.resolve({ assignmentId: "assignment-1" }) };
}

test("POST /api/member/evaluations/[assignmentId] rejects payloads over the 128 KiB cap before parsing", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("413");
  const request = postRequest({ ratings: [{ criterionId: "c1", score: 5, note: "" }] }, { "content-length": String(128 * 1024 + 1) });
  t.mock.method(request, "json", async () => { throw new Error("json should not be read"); });
  const res = await POST(request, params());
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error, "Payload is too large");
});

for (const scenario of ["missing-revision", "conflict", "bound-receipt", "wrong-assignment"] as const) {
  test(`evaluation final submit v2 ${scenario}`, async (t) => {
    const revision = "10000000-0000-4000-8000-000000000001";
    const calls: { name: string; args: unknown }[] = [];
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { error: null, data: scenario === "conflict" ? { kind: "conflict", snapshot: { assignmentId: "assignment-1", revision, draft: null } } : { kind: "submitted", assignmentId: scenario === "wrong-assignment" ? "another-assignment" : "assignment-1", evaluationId: "evaluation-1", score: 60 } };
    } }) } });
    const { POST } = await importRoute(scenario);
    const payload = { ratings: [{ criterionId: "analysis", score: 3, note: "Observed" }], evidence: "Private evidence", ...(scenario === "missing-revision" ? {} : { expectedDraftRevision: revision }) };
    const response = await POST(postRequest(payload), params());
    assert.equal(response.status, { "missing-revision": 400, conflict: 409, "bound-receipt": 201, "wrong-assignment": 503 }[scenario]);
    if (scenario === "missing-revision") assert.equal(calls.length, 0);
    if (scenario === "bound-receipt") {
      assert.equal((await response.json()).assignmentId, "assignment-1");
      assert.deepEqual(calls, [{ name: "submit_evaluation_v2", args: { target_assignment_id: "assignment-1", submitted_ratings: payload.ratings, submitted_evidence: payload.evidence, expected_draft_revision: revision } }]);
    }
  });
}
