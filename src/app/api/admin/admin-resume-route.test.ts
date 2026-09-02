import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

const APPLICATION_ID = "11111111-1111-1111-1111-111111111111";
const PATH = `22222222-2222-2222-2222-222222222222/cycle/${APPLICATION_ID}.pdf`;
const SIGNED_URL = `https://storage.example/object/sign/resumes/${PATH}?token=read-token`;
const USER = { id: "user-1", memberships: [] };

function request() {
  return new NextRequest(`http://localhost/api/admin/applications/${APPLICATION_ID}/resume`);
}

function context() {
  return { params: Promise.resolve({ id: APPLICATION_ID }) };
}

function importRoute(testCase: string) {
  return import(`./applications/[id]/resume/route.ts?case=${testCase}`) as Promise<typeof import("./applications/[id]/resume/route.ts")>;
}

test("admin resume route requires authentication", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("not called"); } } });
  const { GET } = await importRoute("unauthorized");

  const response = await GET(request(), context());

  assert.equal(response.status, 401);
});

test("admin resume route returns forbidden when the access RPC denies the user", async (t) => {
  const client = { rpc: async () => ({ data: null, error: { code: "42501", message: "forbidden" } }) };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { GET } = await importRoute("forbidden");

  const response = await GET(request(), context());

  assert.equal(response.status, 403);
});

test("admin resume route returns not found for an application without an attached resume", async (t) => {
  const client = { rpc: async () => ({ data: null, error: { code: "P0002", message: "resume not found" } }) };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { GET } = await importRoute("not-found");

  const response = await GET(request(), context());

  assert.equal(response.status, 404);
});

test("admin resume route redirects an authorized user to a short-lived URL", async (t) => {
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      assert.equal(name, "authorize_resume_access");
      assert.deepEqual(args, { target_application_id: APPLICATION_ID });
      return { data: PATH, error: null };
    },
    storage: { from: (bucket: string) => ({
      createSignedUrl: async (path: string, seconds: number) => {
        assert.equal(bucket, "resumes");
        assert.equal(path, PATH);
        assert.equal(seconds, 300);
        return { data: { signedUrl: SIGNED_URL }, error: null };
      },
    }) },
  };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { GET } = await importRoute("success");

  const response = await GET(request(), context());

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), SIGNED_URL);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("admin resume route reports a signed URL failure as unavailable", async (t) => {
  const client = {
    rpc: async () => ({ data: PATH, error: null }),
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: { message: "storage failed" } }) }) },
  };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { GET } = await importRoute("storage-failure");

  const response = await GET(request(), context());

  assert.equal(response.status, 502);
});
