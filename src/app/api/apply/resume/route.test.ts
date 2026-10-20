import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

const PATH = "owner/cycle/resume.pdf";
const URL = "https://storage.example/resume.pdf?token=private";

function importRoute(key: string) {
  return import(`./route.ts?case=${key}`) as Promise<typeof import("./route.ts")>;
}

for (const scenario of ["signed-out", "missing-path", "foreign-resume", "ready", "signing-failure", "storage-denied", "network-failure"]) {
  test(`applicant resume route: ${scenario}`, async (t) => {
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => scenario === "signed-out" ? null : { id: "owner" } } });
    let authorized = false;
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => {
      assert.ok(!["signed-out", "missing-path"].includes(scenario));
      return {
        rpc: async (name: string, args: unknown) => {
          assert.equal(name, "my_ready_resume");
          assert.deepEqual(args, { target_path: PATH });
          authorized = scenario !== "foreign-resume";
          return { data: authorized ? { path: PATH, filename: "Private Name.pdf" } : null, error: null };
        },
        storage: { from: (bucket: string) => ({ createSignedUrl: async (path: string) => {
          assert.ok(authorized);
          assert.equal(bucket, "resumes");
          assert.equal(path, PATH);
          return scenario === "signing-failure" ? { data: null, error: { message: URL } } : { data: { signedUrl: URL }, error: null };
        } }) },
      };
    } } });
    const fetchMock = t.mock.method(globalThis, "fetch", async (input: string | Request | URL, init?: RequestInit) => {
      assert.ok(authorized);
      assert.equal(String(input), URL);
      assert.equal(init?.cache, "no-store");
      if (scenario === "network-failure") throw new Error(URL);
      return new Response(scenario === "storage-denied" ? URL : "%PDF-private", { status: scenario === "storage-denied" ? 403 : 200 });
    });
    const { GET } = await importRoute(scenario);
    const response = await GET(new NextRequest(`http://localhost/api/apply/resume${scenario === "missing-path" ? "" : `?path=${PATH}`}`));
    assert.equal(response.headers.get("location"), null);
    if (["signed-out", "missing-path", "foreign-resume"].includes(scenario)) {
      assert.equal(response.status, scenario === "signed-out" ? 401 : 404);
      assert.equal(fetchMock.mock.callCount(), 0);
    } else {
      assert.equal(response.status, scenario === "ready" ? 200 : 502);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.headers.get("content-type"), scenario === "ready" ? "application/pdf" : "application/json");
      const body = await response.text();
      assert.equal(body.includes(URL), false);
      assert.equal(body.includes(PATH), false);
      if (scenario === "ready") {
        assert.equal(body, "%PDF-private");
        assert.equal(response.headers.get("content-disposition"), 'inline; filename="resume.pdf"');
      }
    }
  });
}
