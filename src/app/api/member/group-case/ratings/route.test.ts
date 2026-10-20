import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const USER = { id: "member-1", email: "member@umich.edu", name: "Member", active: true, memberships: [] };
const SCORES = { "crit-1": 4, "crit-2": null };
const MUTATION = "11111111-1111-4111-8111-111111111111";
const REVISION = "22222222-2222-4222-8222-222222222222";
const QUALITY = { valid: false, coverage: 0.5, observedCount: 1, criteriaCount: 2, minimumObserved: 2, missingRequired: [] };
const SAVED = { kind: "saved", revision: REVISION, mutationId: MUTATION, quality: QUALITY, applicationId: "app-1", scores: SCORES, note: "Sharp", savedAt: "2026-09-13T20:00:00Z" };

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function request(body: unknown) {
  return new NextRequest("http://localhost/api/member/group-case/ratings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body && typeof body === "object" && !Array.isArray(body) ? { expectedRevision: null, mutationId: MUTATION, note: "", ...body } : body),
  });
}

test("group case rating requires authentication", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("database should not be called"); } },
  });
  const { POST } = await importRoute("unauthorized");
  const response = await POST(request({ roundId: "round-1", applicationId: "app-1", scores: SCORES }));
  assert.equal(response.status, 401);
});

test("group case rating validates the body before opening a database client", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("database should not be called"); } },
  });
  const { POST } = await importRoute("invalid");
  for (const body of [
    { roundId: "round-1", applicationId: "app-1", scores: {} },
    { roundId: "round-1", applicationId: "app-1", scores: { "crit-1": 0 } },
    { roundId: "round-1", applicationId: "app-1", scores: { "crit-1": 6 } },
    { roundId: "round-1", applicationId: "app-1", scores: { "crit-1": 3.5 } },
    { roundId: "round-1", applicationId: "app-1", scores: { "crit-1": "4" } },
    { roundId: "round-1", applicationId: "app-1", scores: [4] },
    { roundId: "round-1", applicationId: "app-1", scores: 4 },
    { roundId: "round-1", applicationId: "app-1" },
    { roundId: "round-1", applicationId: "", scores: SCORES },
    { applicationId: "app-1", scores: SCORES },
    { roundId: "round-1", applicationId: "app-1", scores: SCORES, note: "x".repeat(4001) },
    { roundId: "round-1", applicationId: "app-1", scores: SCORES, note: 7 },
    { roundId: "round-1", applicationId: "app-1", scores: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`crit-${i}`, 3])) },
  ]) {
    const response = await POST(request(body));
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});

test("group case rating passes the round, applicant, scores, and note to the guarded RPC", async (t) => {
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
  const response = await POST(request({ roundId: "round-1", applicationId: "app-1", scores: SCORES, note: "Sharp" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), SAVED);
  assert.deepEqual(calls, [{
    name: "rate_group_case_applicant_v2",
    args: { target_round_id: "round-1", target_application_id: "app-1", scores: SCORES, note: "Sharp", expected_revision: null, mutation_id: MUTATION },
  }]);
});

test("group case rating preserves an explicit empty note", async (t) => {
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
  const response = await POST(request({ roundId: "round-1", applicationId: "app-1", scores: SCORES }));
  assert.equal(response.status, 200);
  assert.equal(calls[0]?.note, "");
});

test("group case rating surfaces the database's own message when the round is frozen", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", {
    namedExports: { screeningRpc: async () => ({ data: null, error: { code: "55000", message: "round is frozen" } }) },
  });
  const { POST } = await importRoute("frozen");
  const response = await POST(request({ roundId: "round-1", applicationId: "app-1", scores: SCORES }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "round is frozen" });
});

test("group case route preserves a note-only request with null scores and canonical quality", async (t) => {
  const scores = { "crit-1": null, "crit-2": null };
  const quality = { valid: false, coverage: 0, observedCount: 0, criteriaCount: 2, minimumObserved: 2, missingRequired: ["Collaboration"] };
  const saved = { ...SAVED, scores, note: "Observed listening", quality };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", { namedExports: { screeningRpc: async (_client: unknown, _name: string, args?: Record<string, unknown>) => {
    assert.deepEqual(args?.scores, scores);
    assert.equal(args?.note, saved.note);
    return { data: saved, error: null };
  } } });
  const { POST } = await importRoute("note-only");
  const response = await POST(request({ roundId: "round-1", applicationId: "app-1", scores, note: saved.note }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), saved);
});

test("versioned route rejects legacy requests before opening the database", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("must not query"); } } });
  const { POST } = await importRoute("v2-required");
  for (const patch of [{ expectedRevision: undefined }, { mutationId: undefined }, { expectedRevision: "bad" }, { mutationId: "bad" }]) {
    const response = await POST(request({ roundId: "round-1", applicationId: "app-1", scores: SCORES, ...patch }));
    assert.equal(response.status, 400);
  }
});
test("versioned route returns the current conflict snapshot without claiming a save", async (t) => {
  const snapshot = { applicationId: "app-1", revision: REVISION, scores: SCORES, note: "Other tab", savedAt: SAVED.savedAt, quality: QUALITY };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", { namedExports: { screeningRpc: async () => ({ data: { kind: "conflict", snapshot }, error: null }) } });
  const { POST } = await importRoute("v2-conflict");
  const response = await POST(request({ roundId: "round-1", applicationId: "app-1", scores: SCORES }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { kind: "conflict", snapshot });
});
test("malformed successful database acknowledgement is unknown, not a successful save", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", { namedExports: { screeningRpc: async () => ({ data: { ...SAVED, revision: null }, error: null }) } });
  const { POST } = await importRoute("v2-malformed");
  const response = await POST(request({ roundId: "round-1", applicationId: "app-1", scores: SCORES }));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /may already be saved/);
});

for (const [name, receipt] of [
  ["wrong-applicant", { ...SAVED, applicationId: "another-app" }],
  ["wrong-mutation", { ...SAVED, mutationId: "99999999-9999-4999-8999-999999999999" }],
  ["wrong-conflict-applicant", { kind: "conflict", snapshot: { ...SAVED, applicationId: "another-app" } }],
] satisfies Array<[string, unknown]>) {
  test(`route refuses a ${name} acknowledgement`, async (t) => {
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
    t.mock.module("@/lib/screening-rpc", { namedExports: { screeningRpc: async () => ({ data: receipt, error: null }) } });
    const { POST } = await importRoute(`v2-${name}`);
    const response = await POST(request({ roundId: "round-1", applicationId: "app-1", scores: SCORES }));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /may already be saved/);
  });
}
