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
        if (name === "submit_screening_review") return { data: 82, error: null };
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
  }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).nextAssignmentId, "assignment-2");
  assert.deepEqual(calls.map((call) => call.name), ["submit_screening_review", "next_screening_assignment"]);
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
