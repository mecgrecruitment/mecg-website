import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

const USER = { id: "11111111-1111-1111-1111-111111111111", email: "ada@umich.edu", name: "Ada", active: true, memberships: [] };
const DOCUMENT_ID = "22222222-2222-2222-2222-222222222222";
const PATH = `${USER.id}/cycle/${DOCUMENT_ID}.pdf`;

function request(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function importStartRoute(testCase: string) {
  return import(`./start/route.ts?case=${testCase}`) as Promise<typeof import("./start/route.ts")>;
}

function importFinalizeRoute(testCase: string) {
  return import(`./finalize/route.ts?case=${testCase}`) as Promise<typeof import("./finalize/route.ts")>;
}

test("resume start creates a server-controlled upload target", async (t) => {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: { documentId: DOCUMENT_ID, path: PATH }, error: null };
    },
  };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { POST } = await importStartRoute("success");
  const response = await POST(request("/api/apply/resume/start", { filename: "Ada Resume.pdf", size: 26 }));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { documentId: DOCUMENT_ID, path: PATH });
  assert.deepEqual(calls, [{ name: "begin_resume_upload", args: { upload_filename: "Ada Resume.pdf", upload_size: 26 } }]);
});

test("resume start rejects invalid files before creating an upload", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("should not connect"); } } });
  const { POST } = await importStartRoute("invalid");
  const response = await POST(request("/api/apply/resume/start", { filename: "resume.docx", size: 26 }));
  assert.equal(response.status, 400);
});

test("resume finalize verifies bytes and records the digest", async (t) => {
  const pdf = new TextEncoder().encode("%PDF-1.7\n/Type /Page\n%%EOF");
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "pending_resume_upload") return { data: { documentId: DOCUMENT_ID, path: PATH, declaredSize: pdf.byteLength, filename: "resume.pdf" }, error: null };
      if (name === "finalize_resume_upload") return { data: { documentId: DOCUMENT_ID, path: PATH, filename: "resume.pdf", size: pdf.byteLength, pageCount: 1, supersededPaths: [] }, error: null };
      throw new Error(`unexpected RPC ${name}`);
    },
    storage: {
      from: () => ({
        download: async () => ({ data: new Blob([pdf], { type: "application/pdf" }), error: null }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
  };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => client } });
  const { POST } = await importFinalizeRoute("success");
  const response = await POST(request("/api/apply/resume/finalize", { documentId: DOCUMENT_ID }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).path, PATH);
  const finalize = calls.find((call) => call.name === "finalize_resume_upload");
  assert.equal(finalize?.args?.actual_size, pdf.byteLength);
  assert.equal(finalize?.args?.detected_page_count, 1);
  assert.match(String(finalize?.args?.content_sha256), /^[0-9a-f]{64}$/);
});

test("resume finalize rejects and removes non-PDF content", async (t) => {
  let removed: string[] = [];
  const bytes = new TextEncoder().encode("not a PDF");
  const client = {
    rpc: async (name: string) => {
      if (name === "pending_resume_upload") return { data: { documentId: DOCUMENT_ID, path: PATH, declaredSize: bytes.byteLength, filename: "resume.pdf" }, error: null };
      if (name === "reject_resume_upload") return { data: PATH, error: null };
      throw new Error(`unexpected RPC ${name}`);
    },
    storage: {
      from: () => ({
        download: async () => ({ data: new Blob([bytes], { type: "application/pdf" }), error: null }),
        remove: async (paths: string[]) => { removed = paths; return { data: [], error: null }; },
      }),
    },
  };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => client } });
  const { POST } = await importFinalizeRoute("invalid");
  const response = await POST(request("/api/apply/resume/finalize", { documentId: DOCUMENT_ID }));
  assert.equal(response.status, 400);
  assert.deepEqual(removed, [PATH]);
});
