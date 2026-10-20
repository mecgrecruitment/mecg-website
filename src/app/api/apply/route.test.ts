import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

type RpcError = { code?: string; message: string };
type RpcResponse = { data: unknown; error: RpcError | null };
type RpcHandlers = Record<string, (args?: Record<string, unknown>) => RpcResponse>;

const VALID_BODY = {
  name: "Ada Lovelace",
  consent: true,
  classYear: "JUNIOR",
  major: "ME",
  uniqname: "adal",
  college: "Engineering",
  gradTerm: "Winter 2027",
  accessibilityNotes: "Step-free access",
  linkedinUrl: "https://linkedin.com/in/ada",
  resumeStoragePath: "11111111-1111-1111-1111-111111111111/cycle/22222222-2222-2222-2222-222222222222.pdf",
  answers: { why_mecg: "Projects" },
};

const FAKE_USER = { id: "u1", email: "ada@umich.edu", name: "Ada", active: true, memberships: [] };

/** The argument list of rush.submit_application, in declaration order, from
 * supabase/migrations/20260830100000_harden_applicant_workflow.sql:185-199.
 * scripts/check-sql.py:91-95 deliberately compares RPC names only and never
 * argument names, so a call carrying an argument the function does not define
 * passes check:sql, tsc and lint and only fails in production as PGRST202 —
 * a dead portal. Asserting the key set here is what catches that drift. */
const SUBMIT_APPLICATION_ARGUMENTS = [
  "expected_revision",
  "cycle_id",
  "applicant_name",
  "applicant_contact",
  "preferred_name",
  "phone",
  "class_year",
  "major",
  "linkedin_url",
  "resume_storage_path",
  "answers",
  "consent",
  "uniqname",
  "college",
  "grad_term",
  "accessibility_notes",
];

async function importRoute(testCase: string) {
  const specifier = `./route.ts?case=${testCase}`;
  return import(specifier) as Promise<typeof import("./route.ts")>;
}

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ ...(body && typeof body === "object" ? body : {}), expectedRevision: null, cycleId: "cycle" }),
  });
}

function fakeSupabaseClient(handlers: RpcHandlers) {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  return {
    calls,
    client: {
      rpc: async (name: string, args?: Record<string, unknown>): Promise<RpcResponse> => {
        calls.push({ name, args });
        const handler = handlers[name];
        if (!handler) throw new Error(`unexpected rpc call: ${name}`);
        return handler(args);
      },
    },
  };
}

function mockCommon(t: test.TestContext, client: unknown, options: {
  rateLimitStatus?: "allowed" | "limited" | "unavailable";
  schedule?: (input: unknown) => void;
} = {}) {
  const rateLimitKeys: string[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => FAKE_USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/application-receipt-delivery", { namedExports: { scheduleApplicationReceiptDelivery: options.schedule ?? (() => undefined) } });
  t.mock.module("@/lib/rate-limit", {
    namedExports: {
      checkRateLimitStatus: async (key: string) => { rateLimitKeys.push(key); return options.rateLimitStatus ?? "allowed"; },
      clientIp: () => "203.0.113.7",
    },
  });
  return rateLimitKeys;
}

test("POST /api/apply rejects an empty submission ID without scheduling a receipt", async (t) => {
  const { client } = fakeSupabaseClient({ submit_application_v2: () => ({ data: { applicationId: "", submittedNow: true }, error: null }) });
  let receipts = 0;
  mockCommon(t, client, { schedule: () => { receipts += 1; } });
  const { POST } = await importRoute("empty-submission-id");
  const response = await POST(postRequest(VALID_BODY));
  assert.equal(response.status, 500);
  assert.equal((await response.json()).code, "INVALID_SUBMISSION_RESPONSE");
  assert.equal(receipts, 0);
});

// The per-user key alone is not a ceiling: with user.id in the bucket name the
// IP is only a discriminator, so N minted accounts on one host buy N buckets.
test("POST /api/apply rate limits per user and per IP, not either alone", async (t) => {
  const { client } = fakeSupabaseClient({
    submit_application_v2: () => ({ data: { applicationId: "application-1", submittedNow: false }, error: null }),
  });
  const keys = mockCommon(t, client);
  const { POST } = await importRoute("rate-limit-key");
  await POST(postRequest(VALID_BODY));
  assert.deepEqual(keys, ["apply:u1:203.0.113.7", "apply-ip:203.0.113.7"]);
});

test("POST /api/apply returns 401 when unauthenticated", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("401");
  const res = await POST(postRequest(VALID_BODY));
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, "Sign in before applying");
});

test("POST /api/apply returns 503 rather than 401 when authentication dependencies fail", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => { throw new Error("profile query unavailable"); } } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("auth-unavailable");
  const res = await POST(postRequest(VALID_BODY));
  assert.equal(res.status, 503);
  assert.equal((await res.json()).code, "AUTH_SERVICE_UNAVAILABLE");
  assert.equal(res.headers.get("retry-after"), "30");
});

test("POST /api/apply rejects declared payloads over 64 KiB before parsing", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => FAKE_USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("413");
  const request = postRequest(VALID_BODY, { "content-length": String(64 * 1024 + 1) });
  t.mock.method(request, "json", async () => { throw new Error("json should not be read"); });
  const res = await POST(request);
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error, "Application payload is too large");
});

test("POST /api/apply rejects streamed payloads over 64 KiB without Content-Length", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => FAKE_USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("streamed-413");
  const request = new NextRequest("http://localhost/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ padding: "x".repeat(64 * 1024) }),
  });
  assert.equal(request.headers.has("content-length"), false);
  const res = await POST(request);
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error, "Application payload is too large");
});

test("POST /api/apply rejects malformed JSON safely", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => FAKE_USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("malformed-json");
  const request = new NextRequest("http://localhost/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not-json",
  });
  const res = await POST(request);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "Invalid application payload");
});

test("POST /api/apply returns 400 when required fields are missing", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => FAKE_USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("400");
  const { major, ...withoutMajor } = VALID_BODY;
  void major;
  const res = await POST(postRequest(withoutMajor));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "A valid name, resume, answers, and consent are required");
});

test("POST /api/apply returns 429 without persisting when rate limited", async (t) => {
  const { calls, client } = fakeSupabaseClient({});
  mockCommon(t, client, { rateLimitStatus: "limited" });
  const { POST } = await importRoute("429");
  const res = await POST(postRequest(VALID_BODY));
  assert.equal(res.status, 429);
  assert.equal((await res.json()).code, "RATE_LIMITED");
  assert.equal(res.headers.get("retry-after"), "3600");
  assert.deepEqual(calls, []);
});

test("POST /api/apply returns 503 when rate limiting is unavailable", async (t) => {
  const { calls, client } = fakeSupabaseClient({});
  mockCommon(t, client, { rateLimitStatus: "unavailable" });
  const { POST } = await importRoute("limiter-unavailable");
  const res = await POST(postRequest(VALID_BODY, { "x-request-id": "apply-test-1" }));
  assert.equal(res.status, 503);
  assert.equal((await res.json()).code, "SERVICE_UNAVAILABLE");
  assert.equal(res.headers.get("x-request-id"), "apply-test-1");
  assert.equal(res.headers.get("retry-after"), "30");
  assert.deepEqual(calls, []);
});

test("POST /api/apply submits all fields in one persistence call", async (t) => {
  const { calls, client } = fakeSupabaseClient({
    submit_application_v2: () => ({ data: { applicationId: "application-1", submittedNow: true }, error: null }),
  });
  mockCommon(t, client);
  const { POST } = await importRoute("success");
  const res = await POST(postRequest(VALID_BODY));
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { applicationId: "application-1" });
  assert.equal(calls.length, 1);
  assert.deepEqual(Object.keys(calls[0].args ?? {}), SUBMIT_APPLICATION_ARGUMENTS);
  assert.deepEqual(calls[0], {
    name: "submit_application_v2",
    args: {
      expected_revision: null,
      cycle_id: "cycle",
      applicant_name: "Ada Lovelace",
      applicant_contact: "ada@umich.edu",
      preferred_name: undefined,
      phone: undefined,
      class_year: "JUNIOR",
      major: "ME",
      linkedin_url: "https://linkedin.com/in/ada",
      resume_storage_path: VALID_BODY.resumeStoragePath,
      answers: { why_mecg: "Projects" },
      consent: true,
      uniqname: "adal",
      college: "Engineering",
      grad_term: "Winter 2027",
      accessibility_notes: "Step-free access",
    },
  });
});

test("POST /api/apply does not resend confirmation for an idempotent retry", async (t) => {
  const { calls, client } = fakeSupabaseClient({
    submit_application_v2: () => ({ data: { applicationId: "application-1", submittedNow: false }, error: null }),
  });
  mockCommon(t, client);
  const { POST } = await importRoute("retry");
  const res = await POST(postRequest(VALID_BODY));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { applicationId: "application-1" });
  assert.equal(calls.length, 1);
});

test("POST /api/apply fails closed when the revision-aware RPC is absent", async (t) => {
  const scheduled: unknown[] = [];
  const { calls, client } = fakeSupabaseClient({
    submit_application_v2: () => ({ data: null, error: { code: "PGRST202", message: "function missing" } }),
  });
  mockCommon(t, client, { schedule: (input) => scheduled.push(input) });
  const { POST } = await importRoute("missing-cas-database");
  const res = await POST(postRequest(VALID_BODY));
  assert.equal(res.status, 500);
  assert.deepEqual(calls.map((call) => call.name), ["submit_application_v2"]);
  assert.deepEqual(scheduled, []);
});

test("POST /api/apply maps RPC failures without leaking database messages", async (t) => {
  const secret = "duplicate normalized_contact ada@umich.edu";
  const { client } = fakeSupabaseClient({
    submit_application_v2: () => ({ data: null, error: { code: "23505", message: secret } }),
  });
  mockCommon(t, client);
  t.mock.method(console, "error", () => undefined);
  const { POST } = await importRoute("rpc-failure");
  const res = await POST(postRequest(VALID_BODY));
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.code, "APPLICANT_IDENTITY_CONFLICT");
  assert.equal(JSON.stringify(body).includes(secret), false);
});

test("POST /api/apply returns a generic error for unknown RPC failures", async (t) => {
  const { client } = fakeSupabaseClient({
    submit_application_v2: () => ({ data: null, error: { code: "XX000", message: "internal table detail" } }),
  });
  mockCommon(t, client);
  t.mock.method(console, "error", () => undefined);
  const { POST } = await importRoute("unknown-rpc-failure");
  const res = await POST(postRequest(VALID_BODY));
  assert.equal(res.status, 500);
  assert.equal((await res.json()).code, "SUBMISSION_FAILED");
});

test("POST /api/apply does not wait for notification delivery after commit", async (t) => {
  const { calls, client } = fakeSupabaseClient({
    submit_application_v2: () => ({ data: { applicationId: "application-2", submittedNow: true }, error: null }),
  });
  mockCommon(t, client);
  const { POST } = await importRoute("email-failure");
  const res = await POST(postRequest(VALID_BODY));
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { applicationId: "application-2" });
  assert.equal(calls.length, 1);
});

test("POST /api/apply returns the newer draft when the submission revision is stale", async (t) => {
  const { client } = fakeSupabaseClient({ submit_application_v2: () => ({ data: { kind: "conflict", draft: null }, error: null }) });
  const scheduled: unknown[] = [];
  mockCommon(t, client, { schedule: (input) => scheduled.push(input) });
  const { POST } = await importRoute("stale-submit");
  const response = await POST(postRequest(VALID_BODY));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "DRAFT_REVISION_CONFLICT");
  assert.deepEqual(scheduled, []);
});

test("POST /api/apply requires the revision contract even for otherwise valid legacy submissions", async (t) => {
  const { calls, client } = fakeSupabaseClient({});
  mockCommon(t, client);
  const { POST } = await importRoute("missing-submit-revision");
  const response = await POST(new NextRequest("http://localhost/api/apply", { method: "POST", body: JSON.stringify(VALID_BODY) }));
  assert.equal(response.status, 400);
  assert.deepEqual(calls, []);
});
