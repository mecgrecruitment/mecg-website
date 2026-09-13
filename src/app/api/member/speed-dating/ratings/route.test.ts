import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const USER = { id: "member-1", email: "member@umich.edu", name: "Member", active: true, memberships: [] };
const SAVED = { applicationId: "app-1", score: 4, note: "Sharp", session: 2, savedAt: "2026-09-13T20:00:00Z" };

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function request(body: unknown) {
  return new NextRequest("http://localhost/api/member/speed-dating/ratings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("rating requires authentication", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("database should not be called"); } },
  });
  const { POST } = await importRoute("unauthorized");
  const response = await POST(request({ roundId: "round-1", applicationId: "app-1", session: 1, score: 3 }));
  assert.equal(response.status, 401);
});

test("rating validates the body before opening a database client", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("database should not be called"); } },
  });
  const { POST } = await importRoute("invalid");
  for (const body of [
    { roundId: "round-1", applicationId: "app-1", session: 1, score: 0 },
    { roundId: "round-1", applicationId: "app-1", session: 1, score: 6 },
    { roundId: "round-1", applicationId: "app-1", session: 1, score: 3.5 },
    { roundId: "round-1", applicationId: "app-1", session: 1, score: "4" },
    { roundId: "round-1", applicationId: "app-1", session: 0, score: 4 },
    { roundId: "round-1", applicationId: "app-1", session: 5, score: 4 },
    { roundId: "round-1", applicationId: "app-1", session: 1.5, score: 4 },
    { roundId: "round-1", applicationId: "app-1", session: "1", score: 4 },
    { roundId: "round-1", applicationId: "", session: 1, score: 4 },
    { applicationId: "app-1", session: 1, score: 4 },
    { roundId: "round-1", applicationId: "app-1", session: 1, score: 4, note: "x".repeat(2001) },
    { roundId: "round-1", applicationId: "app-1", session: 1, score: 4, note: 7 },
  ]) {
    const response = await POST(request(body));
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});

test("rating passes the round, applicant, session, score, and note to the guarded RPC", async (t) => {
  const calls: Array<{ name: string; args: Record<string, unknown> | undefined }> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", {
    namedExports: {
      screeningRpc: async (_client: unknown, name: string, args?: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: SAVED, error: null };
      },
    },
  });
  const { POST } = await importRoute("success");
  const response = await POST(request({ roundId: "round-1", applicationId: "app-1", session: 2, score: 4, note: "Sharp" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), SAVED);
  assert.deepEqual(calls, [{
    name: "rate_speed_dating_applicant",
    args: { target_round_id: "round-1", target_application_id: "app-1", target_session: 2, score: 4, note: "Sharp" },
  }]);
});

test("rating defaults the session to 1 and the note to an empty string", async (t) => {
  const calls: Array<Record<string, unknown> | undefined> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", {
    namedExports: {
      screeningRpc: async (_client: unknown, _name: string, args?: Record<string, unknown>) => {
        calls.push(args);
        return { data: { ...SAVED, note: "" }, error: null };
      },
    },
  });
  const { POST } = await importRoute("default-note");
  const response = await POST(request({ roundId: "round-1", applicationId: "app-1", score: 5 }));
  assert.equal(response.status, 200);
  assert.equal(calls[0]?.note, "");
  assert.equal(calls[0]?.target_session, 1);
});

test("rating surfaces the database's own message when the round is frozen", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", {
    namedExports: { screeningRpc: async () => ({ data: null, error: { code: "55000", message: "round is frozen" } }) },
  });
  const { POST } = await importRoute("frozen");
  const response = await POST(request({ roundId: "round-1", applicationId: "app-1", session: 1, score: 2 }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "round is frozen" });
});
