import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

const USER = { id: "11111111-1111-1111-1111-111111111111", email: "ada@umich.edu", name: "Ada", active: true, memberships: [] };
const DOCUMENT_ID = "22222222-2222-2222-2222-222222222222";
const PATH = `${USER.id}/cycle/${DOCUMENT_ID}.pdf`;

function validPdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\n\nendstream",
  ];
  let source = "%PDF-1.7\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(source).byteLength);
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = new TextEncoder().encode(source).byteLength;
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  source += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(source);
}

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

function importCancelRoute(testCase: string) {
  return import(`./cancel/route.ts?case=${testCase}`) as Promise<typeof import("./cancel/route.ts")>;
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
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { POST } = await importStartRoute("success");
  const response = await POST(request("/api/apply/resume/start", { filename: "Ada Resume.pdf", size: 26 }));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { documentId: DOCUMENT_ID, path: PATH });
  assert.deepEqual(calls, [{ name: "begin_resume_upload", args: { upload_filename: "Ada Resume.pdf", upload_size: 26 } }]);
});

test("resume start rejects invalid files before creating an upload", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("should not connect"); } } });
  const { POST } = await importStartRoute("invalid");
  const response = await POST(request("/api/apply/resume/start", { filename: "resume.docx", size: 26 }));
  assert.equal(response.status, 400);
});

test("resume finalize verifies bytes and records the digest", async (t) => {
  const pdf = validPdf();
  const userCalls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const adminCalls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const userClient = {
    rpc: async (name: string, args?: Record<string, unknown>) => {
      userCalls.push({ name, args });
      if (name === "pending_resume_upload") return { data: { documentId: DOCUMENT_ID, path: PATH, declaredSize: pdf.byteLength, filename: "resume.pdf" }, error: null };
      throw new Error(`unexpected RPC ${name}`);
    },
    storage: {
      from: () => ({
        download: async () => ({ data: new Blob([pdf], { type: "application/pdf" }), error: null }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
  };
  const adminClient = {
    rpc: async (name: string, args?: Record<string, unknown>) => {
      adminCalls.push({ name, args });
      return { data: { documentId: DOCUMENT_ID, path: PATH, filename: "resume.pdf", size: pdf.byteLength, pageCount: 1, supersededPaths: [] }, error: null };
    },
  };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => userClient } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => adminClient } });
  const { POST } = await importFinalizeRoute("success");
  const response = await POST(request("/api/apply/resume/finalize", { documentId: DOCUMENT_ID }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).path, PATH);
  assert.deepEqual(userCalls.map((call) => call.name), ["pending_resume_upload"]);
  const finalize = adminCalls.find((call) => call.name === "finalize_resume_upload");
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
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => client } });
  const { POST } = await importFinalizeRoute("invalid");
  const response = await POST(request("/api/apply/resume/finalize", { documentId: DOCUMENT_ID }));
  assert.equal(response.status, 400);
  assert.deepEqual(removed, [PATH]);
});

test("resume finalize never deletes content when rejection loses a race", async (t) => {
  let removed = false;
  const bytes = new TextEncoder().encode("not a PDF");
  const client = {
    rpc: async (name: string) => {
      if (name === "pending_resume_upload") return { data: { documentId: DOCUMENT_ID, path: PATH, declaredSize: bytes.byteLength, filename: "resume.pdf" }, error: null };
      if (name === "reject_resume_upload") return { data: null, error: { code: "55000", message: "upload is not pending" } };
      throw new Error(`unexpected RPC ${name}`);
    },
    storage: { from: () => ({
      download: async () => ({ data: new Blob([bytes], { type: "application/pdf" }), error: null }),
      remove: async () => { removed = true; return { data: [], error: null }; },
    }) },
  };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { POST } = await importFinalizeRoute("rejection-race");
  const response = await POST(request("/api/apply/resume/finalize", { documentId: DOCUMENT_ID }));
  assert.equal(response.status, 400);
  assert.equal(removed, false);
});

test("resume finalize removes files superseded by a successful replacement", async (t) => {
  const bytes = validPdf();
  const oldPath = `${USER.id}/cycle/33333333-3333-3333-3333-333333333333.pdf`;
  let removed: string[] = [];
  const userClient = {
    rpc: async () => ({ data: { documentId: DOCUMENT_ID, path: PATH, declaredSize: bytes.byteLength, filename: "resume.pdf" }, error: null }),
    storage: { from: () => ({
      download: async () => ({ data: new Blob([bytes], { type: "application/pdf" }), error: null }),
      remove: async (paths: string[]) => { removed = paths; return { data: [], error: null }; },
    }) },
  };
  const adminClient = { rpc: async () => ({
    data: { documentId: DOCUMENT_ID, path: PATH, filename: "resume.pdf", size: bytes.byteLength, pageCount: 1, supersededPaths: [oldPath] },
    error: null,
  }) };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => userClient } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => adminClient } });
  const { POST } = await importFinalizeRoute("replacement-cleanup");
  const response = await POST(request("/api/apply/resume/finalize", { documentId: DOCUMENT_ID }));
  assert.equal(response.status, 200);
  assert.deepEqual(removed, [oldPath]);
});

test("resume cancel does not remove a document the database refuses to reject", async (t) => {
  let removed = false;
  const client = {
    rpc: async () => ({ data: null, error: { code: "55000", message: "upload is not pending" } }),
    storage: { from: () => ({ remove: async () => { removed = true; return { data: [], error: null }; } }) },
  };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { POST } = await importCancelRoute("ready-document");
  const response = await POST(request("/api/apply/resume/cancel", { documentId: DOCUMENT_ID }));
  assert.equal(response.status, 409);
  assert.equal(removed, false);
});
