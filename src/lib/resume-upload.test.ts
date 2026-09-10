import assert from "node:assert/strict";
import test from "node:test";
import { isAcceptableResumeFile, uploadResumeFile } from "./resume-upload.ts";

const DOCUMENT_ID = "22222222-2222-2222-2222-222222222222";
const PATH = `11111111-1111-1111-1111-111111111111/cycle/${DOCUMENT_ID}.pdf`;
const UPLOAD_URL = `https://storage.example/object/upload/sign/resumes/${PATH}?token=signed-token`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function resumeFile() {
  return new File(["%PDF-1.7\n%%EOF"], "Ada Resume.pdf", { type: "application/pdf" });
}

function pendingRequest(init?: RequestInit): Promise<Response> {
  return new Promise((_, reject) => {
    const keepAlive = setTimeout(() => reject(new Error("test request did not abort")), 1_000);
    init?.signal?.addEventListener("abort", () => {
      clearTimeout(keepAlive);
      reject(init.signal?.reason);
    }, { once: true });
  });
}

test("accepts PDFs when the browser leaves the MIME type empty", () => {
  assert.equal(isAcceptableResumeFile(new File(["pdf"], "resume.PDF", { type: "" })), true);
  assert.equal(isAcceptableResumeFile(new File(["pdf"], "resume.docx", { type: "" })), false);
});

test("signed resume upload sends Supabase multipart form data and finalizes", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ input, init });
    if (input === "/api/apply/resume/start") {
      return jsonResponse({ documentId: DOCUMENT_ID, uploadUrl: UPLOAD_URL }, 201);
    }
    if (input === UPLOAD_URL) return new Response(null, { status: 200 });
    if (input === "/api/apply/resume/finalize") {
      return jsonResponse({ documentId: DOCUMENT_ID, path: PATH, filename: "Ada Resume.pdf", size: 15, pageCount: 1 });
    }
    throw new Error(`Unexpected request ${String(input)}`);
  };

  const result = await uploadResumeFile(resumeFile(), { fetcher });

  assert.equal(result.path, PATH);
  assert.deepEqual(calls.map((call) => call.input), [
    "/api/apply/resume/start",
    UPLOAD_URL,
    "/api/apply/resume/finalize",
  ]);
  const upload = calls[1];
  assert.equal(upload.init?.method, "PUT");
  assert.deepEqual(upload.init?.headers, { "x-upsert": "false" });
  assert.ok(upload.init?.body instanceof FormData);
  assert.equal(upload.init.body.get("cacheControl"), "3600");
  const uploadedFile = upload.init.body.get("");
  assert.ok(uploadedFile instanceof File);
  assert.equal(uploadedFile.name, "Ada Resume.pdf");
  assert.equal(uploadedFile.type, "application/pdf");
});

test("replacement attaches the finalized resume", async () => {
  const calls: Array<RequestInfo | URL> = [];
  const fetcher: typeof fetch = async (input) => {
    calls.push(input);
    if (input === "/api/apply/resume/start") return jsonResponse({ documentId: DOCUMENT_ID, uploadUrl: UPLOAD_URL }, 201);
    if (input === UPLOAD_URL) return new Response(null, { status: 200 });
    if (input === "/api/apply/resume/finalize") return jsonResponse({ documentId: DOCUMENT_ID, path: PATH, filename: "resume.pdf", size: 15, pageCount: 1 });
    if (input === "/api/apply/resume/attach") return jsonResponse({ path: PATH });
    throw new Error(`Unexpected request ${String(input)}`);
  };

  await uploadResumeFile(resumeFile(), { attach: true, fetcher });

  assert.deepEqual(calls, [
    "/api/apply/resume/start",
    UPLOAD_URL,
    "/api/apply/resume/finalize",
    "/api/apply/resume/attach",
  ]);
});

test("an upload failure cancels the pending document", async () => {
  const calls: Array<RequestInfo | URL> = [];
  const fetcher: typeof fetch = async (input) => {
    calls.push(input);
    if (input === "/api/apply/resume/start") return jsonResponse({ documentId: DOCUMENT_ID, uploadUrl: UPLOAD_URL }, 201);
    if (input === UPLOAD_URL) return jsonResponse({ error: "storage failed" }, 500);
    if (input === "/api/apply/resume/cancel") return jsonResponse({ ok: true });
    throw new Error(`Unexpected request ${String(input)}`);
  };

  await assert.rejects(
    uploadResumeFile(resumeFile(), { fetcher }),
    /could not upload your resume/i,
  );
  assert.deepEqual(calls, [
    "/api/apply/resume/start",
    UPLOAD_URL,
    "/api/apply/resume/cancel",
  ]);
});

test("an attach failure preserves the finalized document", async () => {
  const calls: Array<RequestInfo | URL> = [];
  const fetcher: typeof fetch = async (input) => {
    calls.push(input);
    if (input === "/api/apply/resume/start") return jsonResponse({ documentId: DOCUMENT_ID, uploadUrl: UPLOAD_URL }, 201);
    if (input === UPLOAD_URL) return new Response(null, { status: 200 });
    if (input === "/api/apply/resume/finalize") return jsonResponse({ documentId: DOCUMENT_ID, path: PATH, filename: "resume.pdf", size: 15, pageCount: 1 });
    if (input === "/api/apply/resume/attach") return jsonResponse({ error: "attach failed" }, 500);
    if (input === "/api/apply/resume/cancel") throw new Error("finalized documents must not be cancelled");
    throw new Error(`Unexpected request ${String(input)}`);
  };

  await assert.rejects(
    uploadResumeFile(resumeFile(), { attach: true, fetcher }),
    /attach failed/i,
  );
  assert.equal(calls.includes("/api/apply/resume/cancel"), false);
});

test("reports the upload phase that timed out and cancels its pending document", async () => {
  const calls: Array<RequestInfo | URL> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push(input);
    if (input === "/api/apply/resume/start") return jsonResponse({ documentId: DOCUMENT_ID, uploadUrl: UPLOAD_URL }, 201);
    if (input === UPLOAD_URL) return pendingRequest(init);
    if (input === "/api/apply/resume/cancel") return jsonResponse({ ok: true });
    throw new Error(`Unexpected request ${String(input)}`);
  };

  await assert.rejects(
    uploadResumeFile(resumeFile(), { fetcher, phaseTimeouts: { upload: 5 } }),
    /uploading your resume took too long/i,
  );
  assert.deepEqual(calls, ["/api/apply/resume/start", UPLOAD_URL, "/api/apply/resume/cancel"]);
});

test("uses clear timeout errors for start, verification, and attachment", async (t) => {
  const cases = [
    { phase: "start", expected: /starting the resume upload took too long/i },
    { phase: "finalize", expected: /checking your resume took too long/i },
    { phase: "attach", expected: /updating your resume took too long/i },
  ] as const;

  for (const { phase, expected } of cases) {
    await t.test(phase, async () => {
      const fetcher: typeof fetch = async (input, init) => {
        if (phase === "start" && input === "/api/apply/resume/start") return pendingRequest(init);
        if (input === "/api/apply/resume/start") return jsonResponse({ documentId: DOCUMENT_ID, uploadUrl: UPLOAD_URL }, 201);
        if (input === UPLOAD_URL) return new Response(null, { status: 200 });
        if (phase === "finalize" && input === "/api/apply/resume/finalize") return pendingRequest(init);
        if (input === "/api/apply/resume/finalize") return jsonResponse({ documentId: DOCUMENT_ID, path: PATH, filename: "resume.pdf", size: 15, pageCount: 1 });
        if (phase === "attach" && input === "/api/apply/resume/attach") return pendingRequest(init);
        if (input === "/api/apply/resume/cancel") return jsonResponse({ ok: true });
        throw new Error(`Unexpected request ${String(input)}`);
      };

      await assert.rejects(
        uploadResumeFile(resumeFile(), {
          attach: phase === "attach",
          fetcher,
          phaseTimeouts: { [phase]: 5 },
        }),
        expected,
      );
    });
  }
});
