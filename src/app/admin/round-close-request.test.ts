import { test } from "node:test";
import assert from "node:assert/strict";
import { roundCloseJsonRequest } from "./round-close-request";

for (const stage of ["headers", "body"] as const) {
  test(`round close deadline bounds stalled ${stage} and aborts the request`, async () => {
    let signal: AbortSignal | null | undefined;
    const fetcher: typeof fetch = async (_input, init) => {
      signal = init?.signal;
      if (stage === "headers") return new Promise<Response>(() => {});
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"ok":')); } }));
    };
    await assert.rejects(roundCloseJsonRequest("/synthetic", {}, 20, fetcher), { name: "RequestTimeoutError" });
    assert.equal(signal?.aborted, true);
  });
}

test("round close request reads and parses the complete acknowledgement", async () => {
  const result = await roundCloseJsonRequest("/synthetic", {}, 100, async () => Response.json({ ok: true }));
  assert.equal(result.response.ok, true);
  assert.deepEqual(result.body, { ok: true });
});
