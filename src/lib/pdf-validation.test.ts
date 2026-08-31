import assert from "node:assert/strict";
import test from "node:test";
import { MAX_RESUME_BYTES, validateResumePdf } from "./pdf-validation.ts";

function pdf(pageCount = 1, extra = "") {
  const pageObjectIds = Array.from({ length: pageCount }, (_, index) => index + 3);
  const contentObjectId = pageCount + 3;
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R ${extra} >>`,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    ...pageObjectIds.map(() => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjectId} 0 R >>`),
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

test("accepts a parsed PDF and records stable metadata", async () => {
  const bytes = pdf();
  const result = await validateResumePdf(bytes);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.pageCount, 1);
  assert.equal(result.byteSize, bytes.byteLength);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
});

test("uses the parsed page tree instead of text markers", async () => {
  const result = await validateResumePdf(pdf(3));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.pageCount, 3);
});

test("rejects renamed non-PDF files", async () => {
  assert.deepEqual(await validateResumePdf(new TextEncoder().encode("not a pdf")), {
    ok: false,
    message: "The uploaded file is not a valid PDF.",
  });
});

test("rejects truncated, encrypted, and active PDFs", async () => {
  assert.equal((await validateResumePdf(new TextEncoder().encode("%PDF-1.7"))).ok, false);
  assert.equal((await validateResumePdf(new TextEncoder().encode("%PDF-1.7\n/Encrypt 1 0 R\n%%EOF"))).ok, false);
  assert.equal((await validateResumePdf(new TextEncoder().encode("%PDF-1.7\n/JavaScript 1 0 R\n%%EOF"))).ok, false);
  assert.equal((await validateResumePdf(new TextEncoder().encode("%PDF-1.7\n/EmbeddedFile 1 0 R\n%%EOF"))).ok, false);
});

test("rejects oversized and overlong resumes", async () => {
  assert.equal((await validateResumePdf(new Uint8Array(MAX_RESUME_BYTES + 1))).ok, false);
  assert.equal((await validateResumePdf(pdf(21))).ok, false);
});
