import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const VALID_BODY = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: "Project question",
  message: "Could MECG help us evaluate a new market?",
  website: "",
};

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function mockDependencies(t: test.TestContext, options: { allowed?: boolean; delivered?: boolean; onSend?: (params: Record<string, unknown>) => void } = {}) {
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => options.allowed ?? true } });
  t.mock.module("@/lib/email", {
    namedExports: {
      escapeHtml,
      wrapEmail: (html: string) => html,
      sendEmail: async (params: Record<string, unknown>) => {
        options.onSend?.(params);
        return options.delivered ?? true;
      },
    },
  });
}

test("POST /api/contact rejects malformed JSON", async (t) => {
  mockDependencies(t);
  const { POST } = await importRoute("malformed");
  const response = await POST(new NextRequest("http://localhost/api/contact", { method: "POST", body: "{bad" }));
  assert.equal(response.status, 400);
});

test("POST /api/contact rejects payloads over 16 KiB", async (t) => {
  mockDependencies(t);
  const { POST } = await importRoute("large");
  const response = await POST(request(VALID_BODY, { "content-length": String(16 * 1024 + 1) }));
  assert.equal(response.status, 413);
});

test("POST /api/contact validates fields and rejects subject line breaks", async (t) => {
  mockDependencies(t);
  const { POST } = await importRoute("validation");
  const response = await POST(request({ ...VALID_BODY, subject: "Hello\r\nBcc: someone@example.com" }));
  assert.equal(response.status, 400);
});

test("POST /api/contact silently accepts a filled honeypot without sending", async (t) => {
  let sends = 0;
  mockDependencies(t, { onSend: () => { sends += 1; } });
  const { POST } = await importRoute("honeypot");
  const response = await POST(request({ ...VALID_BODY, website: "https://spam.example" }));
  assert.equal(response.status, 200);
  assert.equal(sends, 0);
});

test("POST /api/contact returns 429 without sending when rate limited", async (t) => {
  let sends = 0;
  mockDependencies(t, { allowed: false, onSend: () => { sends += 1; } });
  const { POST } = await importRoute("rate-limit");
  const response = await POST(request(VALID_BODY));
  assert.equal(response.status, 429);
  assert.equal(sends, 0);
});

test("POST /api/contact sends escaped content with reply-to", async (t) => {
  let sent: Record<string, unknown> | undefined;
  mockDependencies(t, { onSend: (params) => { sent = params; } });
  const { POST } = await importRoute("success");
  const response = await POST(request({ ...VALID_BODY, name: "<Ada>", message: "This is <script>alert(1)</script> text." }));
  assert.equal(response.status, 200);
  assert.equal(sent?.replyTo, VALID_BODY.email);
  assert.equal(String(sent?.html).includes("<script>"), false);
  assert.equal(String(sent?.html).includes("&lt;script&gt;"), true);
});

test("POST /api/contact reports provider failure", async (t) => {
  mockDependencies(t, { delivered: false });
  const { POST } = await importRoute("delivery-failure");
  const response = await POST(request(VALID_BODY));
  assert.equal(response.status, 502);
});
