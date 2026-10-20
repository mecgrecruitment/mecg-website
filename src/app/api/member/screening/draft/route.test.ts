import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
const assignmentId = "assignment-1";
const revision = "10000000-0000-4000-8000-000000000001";
const mutationId = "20000000-0000-4000-8000-000000000002";
const draft = { ratings: [{ criterionId: "analysis", score: "2", note: "" }], evidence: "Private observations", recommendation: "HOLD", updatedAt: "2026-10-16T20:00:00Z" };
const snapshot = { assignmentId, revision, draft };
const saved = { kind: "saved", ...snapshot, mutationId };
const write = { ...draft, expectedRevision: null, mutationId };
const req = (method: string, body?: unknown) => new NextRequest(`http://localhost/api/member/screening/draft?assignmentId=${assignmentId}`, { method, ...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}) });
for (const scenario of ["load", "old-rubric", "missing-revision", "malformed-content", "wrong-load-target", "write", "conflict", "wrong-write-target", "wrong-mutation", "wrong-content", "wrong-conflict-target", "legacy-write", "malformed-receipt"] as const) {
  test(`screening draft route ${scenario}`, async (t) => {
    const calls: { name: string; args: unknown }[] = [];
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => ({ id: "reader" }) } });
    const data = {
      load: snapshot, "old-rubric": { ...snapshot, draft: null }, "missing-revision": { assignmentId, draft: null },
      "malformed-content": { ...snapshot, draft: { ...draft, ratings: [{ criterionId: "analysis", score: 2, note: "" }] } },
      "wrong-load-target": { ...snapshot, assignmentId: "another" }, write: saved,
      conflict: { kind: "conflict", snapshot }, "wrong-write-target": { ...saved, assignmentId: "another" },
      "wrong-mutation": { ...saved, mutationId: revision }, "wrong-content": { ...saved, draft: { ...draft, evidence: "Different server observations" } }, "wrong-conflict-target": { kind: "conflict", snapshot: { ...snapshot, assignmentId: "another" } },
      "legacy-write": saved, "malformed-receipt": { savedAt: draft.updatedAt },
    }[scenario];
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: unknown) => { calls.push({ name, args }); return { data, error: null }; } }) } });
    const route = await import(`./route.ts?case=${scenario}`) as typeof import("./route");
    const isGet = ["load", "old-rubric", "missing-revision", "malformed-content", "wrong-load-target"].includes(scenario);
    const response = isGet ? await route.GET(req("GET")) : await route.PUT(req("PUT", scenario === "legacy-write" ? draft : write));
    assert.equal(response.status, scenario === "legacy-write" ? 400 : scenario === "conflict" ? 409 : ["load", "old-rubric", "write"].includes(scenario) ? 200 : 503);
    if (scenario === "legacy-write") assert.equal(calls.length, 0);
    if (scenario === "write") assert.deepEqual(calls, [{ name: "save_screening_review_draft_v2", args: { target_assignment_id: assignmentId, draft_ratings: draft.ratings, draft_evidence: draft.evidence, draft_recommendation: draft.recommendation, expected_revision: null, mutation_id: mutationId } }]);
    if (scenario === "load") assert.deepEqual(calls, [{ name: "get_screening_review_draft_v2", args: { target_assignment_id: assignmentId } }]);
    if (scenario === "conflict") assert.deepEqual(await response.json(), data);
  });
}
