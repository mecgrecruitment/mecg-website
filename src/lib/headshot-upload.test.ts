import assert from "node:assert/strict";
import test from "node:test";
import { uploadHeadshot } from "./headshot-upload.ts";

test("headshot upload reports a clear timeout", async () => {
  const fetcher: typeof fetch = async (_input, init) => new Promise((_, reject) => {
    const keepAlive = setTimeout(() => reject(new Error("test request did not abort")), 1_000);
    init?.signal?.addEventListener("abort", () => {
      clearTimeout(keepAlive);
      reject(init.signal?.reason);
    }, { once: true });
  });
  const headshot = new File(["image"], "headshot.webp", { type: "image/webp" });

  await assert.rejects(
    uploadHeadshot(headshot, { fetcher, timeoutMs: 5 }),
    /uploading your photo took too long/i,
  );
});

test("headshot upload preserves server error messages", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({ error: "Photo service unavailable" }), {
    status: 503,
    headers: { "content-type": "application/json" },
  });
  const headshot = new File(["image"], "headshot.webp", { type: "image/webp" });

  await assert.rejects(uploadHeadshot(headshot, { fetcher }), /photo service unavailable/i);
});
