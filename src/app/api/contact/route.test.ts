import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const VALID_BODY = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: "Project question",
  message: "Could MECG help us evaluate a new market?",
  website: "",
  requestId: "2c4cf650-f3ad-4a2a-8d35-4ec9da42c63b",
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

function mockDependencies(t: test.TestContext, options: { allowed?: boolean; unavailable?: boolean; delivered?: boolean; missingReceipt?: boolean; onSend?: (params: Record<string, unknown>) => void } = {}) {
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimitStatus: async () => options.unavailable ? "unavailable" : options.allowed === false ? "limited" : "allowed", clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/email", {
    namedExports: {
      escapeHtml,
      wrapEmail: (html: string) => html,
      sendEmailDetailed: async (params: Record<string, unknown>) => {
        options.onSend?.(params);
        return { delivered: options.delivered ?? true, providerMessageId: options.missingReceipt ? null : "provider-receipt", errorCategory: null, retryable: false };
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
  const body = await response.json();
  assert.equal(typeof body.fields.subject, "string");
});

test("POST /api/contact silently accepts a filled honeypot without sending", async (t) => {
  let sends = 0;
  mockDependencies(t, { onSend: () => { sends += 1; } });
  const { POST } = await importRoute("honeypot");
  const response = await POST(request({ ...VALID_BODY, website: "https://spam.example" }));
  assert.equal(response.status, 200);
  assert.equal(sends, 0);
});

test("POST /api/contact identifies trimmed whitespace errors before attempting delivery", async (t) => {
  let sends = 0;
  mockDependencies(t, { onSend: () => { sends += 1; } });
  const { POST } = await importRoute("whitespace");
  const response = await POST(request({ ...VALID_BODY, name: "   ", message: "          " }));
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(typeof body.fields.name, "string");
  assert.equal(typeof body.fields.message, "string");
  assert.equal(body.fields.email, undefined);
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
  assert.equal(sent?.idempotencyKey, `contact/${VALID_BODY.requestId}`);
  assert.equal(String(sent?.html).includes("<script>"), false);
  assert.equal(String(sent?.html).includes("&lt;script&gt;"), true);
});

test("POST /api/contact reports provider failure", async (t) => {
  mockDependencies(t, { delivered: false });
  const { POST } = await importRoute("delivery-failure");
  const response = await POST(request(VALID_BODY));
  assert.equal(response.status, 502);
});

for (const requestId of [undefined, "unbounded-invalid-key"]) {
  test(`POST /api/contact rejects invalid delivery intent ${requestId}`, async (t) => {
    let sends = 0;
    mockDependencies(t, { onSend: () => { sends += 1; } });
    const { POST } = await importRoute(`intent-${requestId}`);
    assert.equal((await POST(request({ ...VALID_BODY, requestId }))).status, 400);
    assert.equal(sends, 0);
  });
}
test("POST /api/contact reports limiter outage separately from quota", async (t) => {
  let sends = 0;
  mockDependencies(t, { unavailable: true, onSend: () => { sends += 1; } });
  const { POST } = await importRoute("limiter-outage");
  const response = await POST(request(VALID_BODY));
  assert.equal(response.status, 503);
  assert.doesNotMatch((await response.json()).error, /too many/i);
  assert.equal(sends, 0);
});
test("POST /api/contact requires a provider receipt before confirming delivery", async (t) => {
  mockDependencies(t, { missingReceipt: true });
  const { POST } = await importRoute("missing-provider-receipt");
  const response = await POST(request(VALID_BODY));
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /could not be confirmed/);
});
