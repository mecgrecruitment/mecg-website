import { createHash } from "node:crypto";

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
export const MAX_RESUME_PAGES = 20;

export type PdfValidationResult =
  | { ok: true; byteSize: number; pageCount: number; sha256: string }
  | { ok: false; message: string };

const ACTIVE_CONTENT_MARKERS = [
  /\/JavaScript\b/i,
  /\/JS\b/i,
  /\/Launch\b/i,
  /\/EmbeddedFile\b/i,
  /\/RichMedia\b/i,
];

export function validateResumePdf(bytes: Uint8Array): PdfValidationResult {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_RESUME_BYTES) {
    return { ok: false, message: "The PDF must be smaller than 10 MB." };
  }

  const header = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.byteLength, 1024)));
  if (!header.includes("%PDF-")) {
    return { ok: false, message: "The uploaded file is not a valid PDF." };
  }

  const tail = new TextDecoder("latin1").decode(bytes.subarray(Math.max(0, bytes.byteLength - 4096)));
  if (!tail.includes("%%EOF")) {
    return { ok: false, message: "The PDF appears to be incomplete or corrupted." };
  }

  const source = new TextDecoder("latin1").decode(bytes);
  if (/\/Encrypt\b/i.test(source)) {
    return { ok: false, message: "Password-protected PDFs are not supported." };
  }
  if (ACTIVE_CONTENT_MARKERS.some((marker) => marker.test(source))) {
    return { ok: false, message: "PDFs containing scripts or embedded files are not supported." };
  }

  const detectedPages = source.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  if (detectedPages > MAX_RESUME_PAGES) {
    return { ok: false, message: `The PDF must be ${MAX_RESUME_PAGES} pages or fewer.` };
  }

  return {
    ok: true,
    byteSize: bytes.byteLength,
    pageCount: Math.max(1, detectedPages),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
