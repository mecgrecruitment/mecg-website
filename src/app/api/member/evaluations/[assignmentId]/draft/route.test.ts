import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
const assignmentId = "assignment-1";
const revision = "10000000-0000-4000-8000-000000000001";
const mutationId = "20000000-0000-4000-8000-000000000002";
const draft = { ratings: [{ criterionId: "analysis", score: "3", note: "Observed" }], evidence: "Private evidence", updatedAt: "2026-10-16T20:00:00Z" };
const params = () => ({ params: Promise.resolve({ assignmentId }) });
const req = (method: string, body?: unknown) => new NextRequest(`http://localhost/api/member/evaluations/${assignmentId}/draft`, { method, ...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}) });
for (const scenario of ["get", "write", "conflict", "malformed", "legacy", "delete"] as const) {
  test(`evaluation draft v2 route ${scenario}`, async (t) => {
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => ({ id: "evaluator" }) } });
    const calls: { name: string; args: unknown }[] = [];
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { error: null, data: scenario === "malformed" ? { savedAt: draft.updatedAt } : scenario === "get" ? { assignmentId, revision, draft } : scenario === "conflict" ? { kind: "conflict", snapshot: { assignmentId, revision, draft } } : { kind: "saved", assignmentId, revision, mutationId, draft } };
    } }) } });
    const route = await import(`./route.ts?case=${scenario}`) as typeof import("./route");
    const response = scenario === "get" ? await route.GET(req("GET"), params()) : scenario === "delete" ? await route.DELETE() : await route.PUT(req("PUT", scenario === "legacy" ? draft : { ...draft, expectedRevision: null, mutationId }), params());
    assert.equal(response.status, { get: 200, write: 200, conflict: 409, malformed: 503, legacy: 400, delete: 405 }[scenario]);
    if (scenario === "legacy" || scenario === "delete") assert.equal(calls.length, 0);
    if (scenario === "write") assert.deepEqual(calls, [{ name: "save_evaluation_draft_v2", args: { target_assignment_id: assignmentId, submitted_ratings: draft.ratings, submitted_evidence: draft.evidence, expected_revision: null, mutation_id: mutationId } }]);
    if (scenario === "get") assert.equal(calls[0]?.name, "get_evaluation_draft_v2");
  });
}
