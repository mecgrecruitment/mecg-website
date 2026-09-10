import assert from "node:assert/strict";
import test from "node:test";
import { rateLimitRouteResponse, requestReference, routeJsonResponse } from "./api-route.ts";

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
