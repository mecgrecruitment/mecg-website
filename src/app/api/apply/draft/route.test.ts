import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

type RpcError = { code?: string; message: string };
type RpcResponse = { data: unknown; error: RpcError | null };

const DRAFT_BODY = {
  name: "Ada Lovelace",
  classYear: "JUNIOR",
  major: "ME",
  college: "Engineering",
  uniqname: "adal",
  answers: { why_mecg: "Projects" },
  currentStep: "responses",
};

type FakeUser = { id: string; email: string; name: string; active: boolean; memberships: [] };

function fakeUser(id: string): FakeUser {
  return { id, email: `${id}@umich.edu`, name: id, active: true, memberships: [] };
}

async function importRoute(testCase: string) {
  const specifier = `./route.ts?case=${testCase}`;
  return import(specifier) as Promise<typeof import("./route.ts")>;
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/apply/draft", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Models the part of the schema this route can break. save_application_draft
 * reads rush.profiles.primary_email for the calling actor and writes it into
 * rush.pnms, where normalized_contact is `not null unique`: one shared value
 * for every applicant makes the second applicant a duplicate-key failure. The
 * route deliberately sends no email, so the profile map is the only source. */
function fakeDatabase(actorId: () => string, profiles: Record<string, string | null>) {
  const pnms: Array<{ authUserId: string; normalizedContact: string }> = [];
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args?: Record<string, unknown>): Promise<RpcResponse> => {
      calls.push({ name, args });
      if (name === "application_draft") return { data: DRAFT_BODY, error: null };
      if (name !== "save_application_draft") throw new Error(`unexpected rpc call: ${name}`);
      // scripts/check-sql.py:91-95 compares RPC names only, never argument
      // names, so a call with invented arguments passes check:sql, tsc and
      // lint and dies at runtime as PGRST202 with the portal down. This
      // assertion is that guard: the key set must match the argument list of
      // rush.save_application_draft(payload jsonb) in
      // supabase/migrations/20260830100000_harden_applicant_workflow.sql:336.
      assert.deepEqual(Object.keys(args ?? {}), ["payload"], "the draft RPC takes the payload only");
      assert.equal((args?.payload as { currentStep?: string })?.currentStep, "responses", "the exact form step is saved");
      const owner = actorId();
      const normalized = (profiles[owner] ?? "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
        return { data: null, error: { code: "22023", message: "a verified email is required" } };
      }
      if (!pnms.some((row) => row.authUserId === owner)) {
        if (pnms.some((row) => row.normalizedContact === normalized)) {
          return { data: null, error: { code: "23505", message: `duplicate key value violates unique constraint "pnms_normalized_contact_key"` } };
        }
        pnms.push({ authUserId: owner, normalizedContact: normalized });
      }
      return { data: `application-${owner}`, error: null };
    },
  };
  return { pnms, calls, client };
}

function mockCommon(t: test.TestContext, user: () => FakeUser | null, client: unknown, options: { rateLimited?: boolean } = {}) {
  const rateLimitKeys: string[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user() } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/rate-limit", {
    namedExports: {
      checkRateLimit: async (key: string) => { rateLimitKeys.push(key); return !options.rateLimited; },
      clientIp: () => "203.0.113.7",
    },
  });
  return rateLimitKeys;
}

test("POST /api/apply/draft returns 401 when unauthenticated", async (t) => {
  mockCommon(t, () => null, { rpc: () => { throw new Error("rpc should not be called"); } });
  const { POST } = await importRoute("401");
  const res = await POST(postRequest(DRAFT_BODY));
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, "Sign in first");
});

test("POST /api/apply/draft rejects an unknown form step before persistence", async (t) => {
  const { calls, client } = fakeDatabase(() => "user-invalid", { "user-invalid": "ada@umich.edu" });
  mockCommon(t, () => fakeUser("user-invalid"), client);
  const { POST } = await importRoute("invalid-step");
  const res = await POST(postRequest({ ...DRAFT_BODY, currentStep: "confirmation" }));
  assert.equal(res.status, 400);
  assert.deepEqual(calls, []);
});

test("GET /api/apply/draft loads only through the caller-scoped RPC", async (t) => {
  const { calls, client } = fakeDatabase(() => "user-get", { "user-get": "ada@umich.edu" });
  mockCommon(t, () => fakeUser("user-get"), client);
  const { GET } = await importRoute("get-own-draft");
  const res = await GET();
  assert.equal(res.status, 200);
  assert.equal((await res.json()).draft.currentStep, "responses");
  assert.deepEqual(calls, [{ name: "application_draft", args: undefined }]);
});

test("POST /api/apply/draft saves drafts for two different applicants without a contact collision", async (t) => {
  let user = fakeUser("user-1");
  const { pnms, client } = fakeDatabase(() => user.id, { "user-1": "ada@umich.edu", "user-2": "Grace@umich.edu" });
  mockCommon(t, () => user, client);
  const { POST } = await importRoute("two-applicants");

  const first = await POST(postRequest(DRAFT_BODY));
  assert.equal(first.status, 200);
  user = fakeUser("user-2");
  const second = await POST(postRequest({ ...DRAFT_BODY, name: "Grace Hopper" }));
  assert.equal(second.status, 200, JSON.stringify(await second.clone().json()));

  assert.deepEqual(pnms, [
    { authUserId: "user-1", normalizedContact: "ada@umich.edu" },
    { authUserId: "user-2", normalizedContact: "grace@umich.edu" },
  ]);
});

test("POST /api/apply/draft surfaces a profile with no verified email instead of writing a placeholder", async (t) => {
  const { pnms, client } = fakeDatabase(() => "user-3", { "user-3": null });
  mockCommon(t, () => fakeUser("user-3"), client);
  t.mock.method(console, "error", () => undefined);
  const { POST } = await importRoute("missing-email");
  const res = await POST(postRequest(DRAFT_BODY));
  assert.equal(res.status, 400);
  assert.deepEqual(pnms, []);
});

// The per-user key alone is not a ceiling: with user.id in the bucket name the
// IP is only a discriminator, so N minted accounts on one host buy N buckets.
test("POST /api/apply/draft rate limits per user and per IP, not either alone", async (t) => {
  const { client } = fakeDatabase(() => "user-4", { "user-4": "ada@umich.edu" });
  const keys = mockCommon(t, () => fakeUser("user-4"), client);
  const { POST } = await importRoute("rate-limit-key");
  await POST(postRequest(DRAFT_BODY));
  assert.deepEqual(keys, ["apply-draft:user-4:203.0.113.7", "apply-draft-ip:203.0.113.7"]);
});

test("POST /api/apply/draft returns 429 without persisting when rate limited", async (t) => {
  const { calls, client } = fakeDatabase(() => "user-5", { "user-5": "ada@umich.edu" });
  mockCommon(t, () => fakeUser("user-5"), client, { rateLimited: true });
  const { POST } = await importRoute("429");
  const res = await POST(postRequest(DRAFT_BODY));
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, "Too many requests, try again later");
  assert.deepEqual(calls, []);
});

test("POST /api/apply/draft maps a contact conflict without leaking database detail", async (t) => {
  let user = fakeUser("user-6");
  const { client } = fakeDatabase(() => user.id, { "user-6": "shared@umich.edu", "user-7": "shared@umich.edu" });
  mockCommon(t, () => user, client);
  t.mock.method(console, "error", () => undefined);
  const { POST } = await importRoute("conflict");
  assert.equal((await POST(postRequest(DRAFT_BODY))).status, 200);
  user = fakeUser("user-7");
  const res = await POST(postRequest(DRAFT_BODY));
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error, "Could not save draft");
  assert.equal(JSON.stringify(body).includes("pnms_normalized_contact_key"), false);
});
