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

async function importRoute(testCase: string) {
  const specifier = `./route.ts?case=${testCase}`;
  return import(specifier) as Promise<typeof import("./route.ts")>;
}

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
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

function mockCommon(t: test.TestContext, client: unknown, options: { rateLimited?: boolean; sendEmail?: () => Promise<void> } = {}) {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => FAKE_USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => !options.rateLimited, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/email", {
    namedExports: {
      sendEmail: options.sendEmail ?? (async () => undefined),
      wrapEmail: (html: string) => html,
    },
  });
}

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
  mockCommon(t, client, { rateLimited: true });
  const { POST } = await importRoute("429");
  const res = await POST(postRequest(VALID_BODY));
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, "Too many requests, try again later");
  assert.deepEqual(calls, []);
});

test("POST /api/apply submits all fields in one persistence call", async (t) => {
  const { calls, client } = fakeSupabaseClient({
    submit_application: () => ({ data: { applicationId: "application-1", submittedNow: true }, error: null }),
  });
  let emailCount = 0;
  mockCommon(t, client, { sendEmail: async () => { emailCount += 1; } });
  const { POST } = await importRoute("success");
  const res = await POST(postRequest(VALID_BODY));
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { applicationId: "application-1" });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    name: "submit_application",
    args: {
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
  assert.equal(emailCount, 1);
});

test("POST /api/apply does not resend confirmation for an idempotent retry", async (t) => {
  const { calls, client } = fakeSupabaseClient({
    submit_application: () => ({ data: { applicationId: "application-1", submittedNow: false }, error: null }),
  });
  let emailCount = 0;
  mockCommon(t, client, { sendEmail: async () => { emailCount += 1; } });
  const { POST } = await importRoute("retry");
  const res = await POST(postRequest(VALID_BODY));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { applicationId: "application-1" });
  assert.equal(calls.length, 1);
  assert.equal(emailCount, 0);
});

test("POST /api/apply maps RPC failures without leaking database messages", async (t) => {
  const secret = "duplicate normalized_contact ada@umich.edu";
  const { client } = fakeSupabaseClient({
    submit_application: () => ({ data: null, error: { code: "23505", message: secret } }),
  });
  mockCommon(t, client);
  t.mock.method(console, "error", () => undefined);
  const { POST } = await importRoute("rpc-failure");
  const res = await POST(postRequest(VALID_BODY));
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error, "Could not submit application");
  assert.equal(JSON.stringify(body).includes(secret), false);
});

test("POST /api/apply returns a generic error for unknown RPC failures", async (t) => {
  const { client } = fakeSupabaseClient({
    submit_application: () => ({ data: null, error: { code: "XX000", message: "internal table detail" } }),
  });
  mockCommon(t, client);
  t.mock.method(console, "error", () => undefined);
  const { POST } = await importRoute("unknown-rpc-failure");
  const res = await POST(postRequest(VALID_BODY));
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: "An unexpected error occurred" });
});

test("POST /api/apply succeeds when confirmation email delivery fails", async (t) => {
  const { calls, client } = fakeSupabaseClient({
    submit_application: () => ({ data: { applicationId: "application-2", submittedNow: true }, error: null }),
  });
  mockCommon(t, client, { sendEmail: async () => { throw new Error("SMTP unavailable"); } });
  t.mock.method(console, "error", () => undefined);
  const { POST } = await importRoute("email-failure");
  const res = await POST(postRequest(VALID_BODY));
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { applicationId: "application-2" });
  assert.equal(calls.length, 1);
});
