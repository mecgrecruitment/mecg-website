import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const USER = { id: "member-1", email: "m@umich.edu", name: "Member", active: true, memberships: [] };
const SIGNED_URL = "https://storage.example/resumes/signed.pdf";

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function getRequest() {
  return new NextRequest("http://localhost/api/member/screening/assignment-1/resume");
}

const params = Promise.resolve({ assignmentId: "assignment-1" });

function client(rpcResult: { data: unknown; error: unknown }) {
  return {
    rpc: async (name: string, args?: Record<string, unknown>) => {
      assert.equal(name, "authorize_screening_resume");
      assert.deepEqual(args, { target_assignment_id: "assignment-1" });
      return rpcResult;
    },
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: SIGNED_URL }, error: null }) }) },
  };
}

test("GET screening resume returns 401 when signed out", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { GET } = await importRoute("401");
  const res = await GET(getRequest(), { params });
  assert.equal(res.status, 401);
});

test("GET screening resume returns 404 when the RPC reports P0002", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => client({ data: null, error: { code: "P0002", message: "not found" } }) },
  });
  t.mock.method(console, "error", () => {});
  const { GET } = await importRoute("404");
  const res = await GET(getRequest(), { params });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, "Not found");
});

test("GET screening resume redirects to the signed URL", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => client({ data: "cycle-1/app-1/resume.pdf", error: null }) },
  });
  const { GET } = await importRoute("302");
  const res = await GET(getRequest(), { params });
  assert.equal(res.status, 307);
  assert.equal(res.headers.get("location"), SIGNED_URL);
  assert.equal(res.headers.get("cache-control"), "private, no-store");
});
