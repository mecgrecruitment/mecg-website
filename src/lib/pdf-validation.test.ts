import assert from "node:assert/strict";
import test from "node:test";
import { MAX_RESUME_BYTES, validateResumePdf } from "./pdf-validation.ts";

function pdf(body = "/Type /Page") {
  return new TextEncoder().encode(`%PDF-1.7\n${body}\n%%EOF`);
}

test("accepts a plain PDF and records stable metadata", () => {
  const result = validateResumePdf(pdf());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.pageCount, 1);
  assert.equal(result.byteSize, 26);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
});

test("rejects renamed non-PDF files", () => {
  assert.deepEqual(validateResumePdf(new TextEncoder().encode("not a pdf")), {
    ok: false,
    message: "The uploaded file is not a valid PDF.",
  });
});

test("rejects truncated, encrypted, and active PDFs", () => {
  assert.equal(validateResumePdf(new TextEncoder().encode("%PDF-1.7" )).ok, false);
  assert.equal(validateResumePdf(pdf("/Encrypt 1 0 R")).ok, false);
  assert.equal(validateResumePdf(pdf("/JavaScript 1 0 R")).ok, false);
  assert.equal(validateResumePdf(pdf("/EmbeddedFile 1 0 R")).ok, false);
});

test("rejects oversized and overlong resumes", () => {
  assert.equal(validateResumePdf(new Uint8Array(MAX_RESUME_BYTES + 1)).ok, false);
  assert.equal(validateResumePdf(pdf(Array.from({ length: 21 }, () => "/Type /Page").join("\n"))).ok, false);
});
