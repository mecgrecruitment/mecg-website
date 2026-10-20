import assert from "node:assert/strict";
import test from "node:test";
import { mapRpcError, mapRpcErrorVerbose, rateLimitRouteResponse, readJsonBody, requestReference, routeJsonResponse } from "./api-route.ts";

function streamedRequest(body: ReadableStream<Uint8Array>, headers?: HeadersInit) {
  // Node requires duplex for stream bodies; the DOM RequestInit omits it.
  const init: RequestInit & { duplex: "half" } = { method: "POST", body, duplex: "half", headers };
  return new Request("http://localhost", init);
}

test("readJsonBody parses JSON split across UTF-8 byte boundaries and releases the stream", async () => {
  const bytes = new TextEncoder().encode('{"name":"Zoë"}');
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });
  const request = streamedRequest(body);
  assert.deepEqual(await readJsonBody(request, bytes.length), { data: { name: "Zoë" } });
  assert.equal(body.locked, false);
});

test("readJsonBody rejects an interrupted stream even after receiving valid JSON", async () => {
  let pulled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled) controller.error(new Error("connection reset"));
      else {
        pulled = true;
        controller.enqueue(new TextEncoder().encode('{"consent":true}'));
      }
    },
  });
  const request = streamedRequest(body);
  assert.deepEqual(await readJsonBody(request, 1024), { error: "invalid_json" });
  assert.equal(body.locked, false);
});

test("readJsonBody rejects an already locked body without stealing its reader", async () => {
  const request = new Request("http://localhost", { method: "POST", body: "{}" });
  const reader = request.body!.getReader();
  try {
    assert.deepEqual(await readJsonBody(request, 1024), { error: "invalid_json" });
    assert.equal(request.body!.locked, true);
  } finally {
    reader.releaseLock();
  }
});

test("readJsonBody enforces actual byte size despite a smaller declared length", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new TextEncoder().encode('"ëë"')); },
    cancel() { cancelled = true; },
  });
  const request = streamedRequest(body, { "content-length": "1" });
  assert.deepEqual(await readJsonBody(request, 4), { error: "too_large" });
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
});

test("requestReference accepts a safe upstream request id and rejects log injection", () => {
  assert.equal(requestReference({ headers: new Headers({ "x-request-id": "edge:request-1" }) }), "edge:request-1");
  const generated = requestReference({ headers: { get: () => "bad\nrequest" } as unknown as Headers });
  assert.match(generated, /^[0-9a-f-]{36}$/);
});

test("routeJsonResponse correlates public errors with privacy-safe operational logs", async (t) => {
  let output = "";
  t.mock.method(console, "warn", (value: string) => { output = value; });
  const response = routeJsonResponse(
    "application.submit",
    "request-1",
    performance.now(),
    { error: "Review your application" },
    400,
    { code: "INVALID_APPLICATION" },
  );
  assert.equal(response.headers.get("x-request-id"), "request-1");
  assert.deepEqual(await response.json(), {
    error: "Review your application",
    code: "INVALID_APPLICATION",
    reference: "request-1",
  });
  const logged = JSON.parse(output);
  assert.equal(logged.event, "application.submit");
  assert.equal(logged.requestId, "request-1");
  assert.equal(logged.detail.status, 400);
  assert.equal(output.includes("Review your application"), false);
});

test("rateLimitRouteResponse distinguishes an exhausted limit from limiter unavailability", async (t) => {
  t.mock.method(console, "warn", () => undefined);
  t.mock.method(console, "error", () => undefined);
  const limited = rateLimitRouteResponse("application.submit", "limited-1", performance.now(), "limited");
  const unavailable = rateLimitRouteResponse("application.submit", "unavailable-1", performance.now(), "unavailable");
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  assert.equal((await limited.json()).code, "RATE_LIMITED");
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("retry-after"), "30");
  assert.equal((await unavailable.json()).code, "SERVICE_UNAVAILABLE");
});

test("mapRpcErrorVerbose surfaces the Postgres message only for the operator-facing codes", () => {
  assert.deepEqual(mapRpcErrorVerbose({ code: "55000", message: "Batch already has reviews" }), { body: { error: "Batch already has reviews" }, status: 409 });
  assert.deepEqual(mapRpcErrorVerbose({ code: "22023", message: "Pick at least three readers" }), { body: { error: "Pick at least three readers" }, status: 400 });
  assert.deepEqual(mapRpcErrorVerbose({ code: "42501", message: "Not a reader" }), { body: { error: "Not a reader" }, status: 403 });
  assert.deepEqual(mapRpcErrorVerbose({ code: "P0002", message: "row missing" }), mapRpcError({ code: "P0002", message: "row missing" }));
  assert.deepEqual(mapRpcErrorVerbose({ code: "XX000", message: "internal" }), { body: { error: "An unexpected error occurred" }, status: 500 });
  assert.deepEqual(mapRpcErrorVerbose({ code: "55000", message: "  " }), { body: { error: "Request could not be completed" }, status: 409 });
});
