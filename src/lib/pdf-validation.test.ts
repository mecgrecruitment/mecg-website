import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { MAX_RESUME_BYTES, validateResumePdf } from "./pdf-validation.ts";

// An incompressible stream stands in for the photo or scanned page a real
// resume carries: deflate leaves that data close to uniform bytes.
function pdfWithImageStream(image: Buffer) {
  const head = Buffer.from(
    "%PDF-1.7\n"
      + "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
      + "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
      + "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"
      + `4 0 obj\n<< /Type /XObject /Subtype /Image /Width 512 /Height 512 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.byteLength} >>\nstream\n`,
    "latin1",
  );
  const tail = Buffer.from(
    "\nendstream\nendobj\n5 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n"
      + "trailer\n<< /Size 6 /Root 1 0 R >>\n%%EOF",
    "latin1",
  );
  return new Uint8Array(Buffer.concat([head, image, tail]));
}

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

test("accepts a destination-only OpenAction", async () => {
  // Every common exporter writes /OpenAction [page /Fit] for the initial view.
  // pdf.js reports it as a Map keyed "dest", and rejecting that turned away
  // real resumes.
  const result = await validateResumePdf(pdf(1, "/OpenAction [3 0 R /Fit]"));
  assert.equal(result.ok, true);
});

test("rejects a JavaScript OpenAction", async () => {
  const result = await validateResumePdf(pdf(1, "/OpenAction << /S /JavaScript /JS (app.alert\\(1\\)) >>"));
  assert.equal(result.ok, false);
});

test("does not mistake compressed image data for active content", async () => {
  // The raw marker scan reads compressed streams too, so any marker short
  // enough to appear by chance rejects a resume that carries a photo or a
  // scanned page. Fifty 512 KB image streams caught a 3-character marker on
  // roughly four of them; none may be rejected now.
  const rejected: string[] = [];
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const image = randomBytes(512 * 1024);
    const result = await validateResumePdf(pdfWithImageStream(image));
    if (!result.ok) rejected.push(result.message);
  }
  assert.deepEqual(rejected, []);
});

test("rejects oversized and overlong resumes", async () => {
  assert.equal((await validateResumePdf(new Uint8Array(MAX_RESUME_BYTES + 1))).ok, false);
  assert.equal((await validateResumePdf(pdf(21))).ok, false);
});

test("destroys the PDF loading task when parsing times out", async (t) => {
  let destroyCalls = 0;
  t.mock.module("pdfjs-dist/legacy/build/pdf.mjs", {
    namedExports: {
      AnnotationType: {
        FILEATTACHMENT: 17,
        MOVIE: 19,
        SOUND: 18,
        SCREEN: 20,
        RICHMEDIA: 21,
        THREED: 16,
      },
      getDocument: () => ({
        promise: new Promise(() => {}),
        destroy: async () => { destroyCalls += 1; },
      }),
    },
  });
  const timeoutModule = "./pdf-validation.ts?case=timeout";
  const { validateResumePdf: validateWithStalledParser } = await import(timeoutModule) as typeof import("./pdf-validation.ts");

  const result = await validateWithStalledParser(pdf(), { timeoutMs: 5 });

  assert.deepEqual(result, {
    ok: false,
    message: "The PDF took too long to check. Re-export it and try again.",
  });
  assert.equal(destroyCalls, 1);
});
