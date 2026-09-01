import test from "node:test";
import assert from "node:assert/strict";
import { runAction } from "./run-action.ts";

test("runAction returns the parsed body on a 2xx response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ id: "1" }), { status: 200 })) as typeof fetch;
  try {
    const result = await runAction("/api/x", { a: 1 }, "fallback");
    assert.deepEqual(result, { ok: true, body: { id: "1" } });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runAction surfaces the server's error message on a non-2xx response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: "nope" }), { status: 400 })) as typeof fetch;
  try {
    const result = await runAction("/api/x", {}, "fallback");
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error, "nope");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runAction falls back to the caller's message when the network call throws", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;
  try {
    const result = await runAction("/api/x", {}, "fallback message");
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error, "fallback message");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runAction falls back to the caller's message when a non-2xx response has no error field", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("not json", { status: 500 })) as typeof fetch;
  try {
    const result = await runAction("/api/x", {}, "fallback message");
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error, "fallback message");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
