import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

const USER = { id: "reviewer-1", email: "r@umich.edu", name: "Reviewer", active: true, memberships: [] };
const DRAFT = {
  ratings: [{ criterionId: "motivation", score: "4", note: "Concrete evidence" }],
  evidence: "",
  recommendation: "",
};

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function request(method: "GET" | "PUT", body?: unknown) {
  return new NextRequest("http://localhost/api/member/screening/draft?assignmentId=assignment-1", {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("GET loads a draft only through the caller-owned assignment RPC", async (t) => {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({
    rpc: async (name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: DRAFT, error: null };
    },
  }) } });
  const { GET } = await importRoute("get");
  const response = await GET(request("GET"));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).draft, DRAFT);
  assert.deepEqual(calls, [{ name: "get_screening_review_draft", args: { target_assignment_id: "assignment-1" } }]);
});

test("PUT validates then saves only the current reviewer draft", async (t) => {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({
    rpc: async (name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: "2026-09-02T20:00:00Z", error: null };
    },
  }) } });
  const { PUT } = await importRoute("put");
  const response = await PUT(request("PUT", DRAFT));
  assert.equal(response.status, 200);
  assert.equal(calls[0]?.name, "save_screening_review_draft");
  assert.equal(calls[0]?.args?.target_assignment_id, "assignment-1");
});

test("PUT rejects malformed drafts before opening a database client", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("database should not be opened"); } } });
  const { PUT } = await importRoute("invalid");
  const response = await PUT(request("PUT", { ...DRAFT, recommendation: "IDENTIFY_APPLICANT" }));
  assert.equal(response.status, 400);
});
