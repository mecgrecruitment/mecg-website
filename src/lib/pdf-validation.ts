import { createHash } from "node:crypto";
import { AnnotationType, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
export const MAX_RESUME_PAGES = 20;
export const PDF_VALIDATION_TIMEOUT_MS = 15_000;
export const PDF_VALIDATION_TIMEOUT_MESSAGE = "The PDF took too long to check. Re-export it and try again.";

export type PdfValidationResult =
  | { ok: true; byteSize: number; pageCount: number; sha256: string }
  | { ok: false; message: string };

// These run over the raw bytes, compressed streams included, so a short marker
// matches by chance inside image data: /JS fired on 7.5% of benign 512 KB
// resumes with a photo and told the applicant their file contained scripts.
// Every marker here is long enough that a chance match is impossible in
// practice, and nothing is lost by dropping /JS: a JavaScript action dictionary
// always carries /S /JavaScript alongside it, and the parsed-document checks
// below (getJSActions, getOpenAction, getAttachments) are the authoritative
// pass anyway.
const ACTIVE_CONTENT_MARKERS = [
  /\/JavaScript\b/i,
  /\/Launch\b/i,
  /\/EmbeddedFile\b/i,
  /\/RichMedia\b/i,
];

const ACTIVE_ANNOTATION_TYPES = new Set([
  AnnotationType.FILEATTACHMENT,
  AnnotationType.MOVIE,
  AnnotationType.SOUND,
  AnnotationType.SCREEN,
  AnnotationType.RICHMEDIA,
  AnnotationType.THREED,
]);

class PdfValidationTimeoutError extends Error {
  constructor() {
    super(PDF_VALIDATION_TIMEOUT_MESSAGE);
    this.name = "PdfValidationTimeoutError";
  }
}

export async function validateResumePdf(
  bytes: Uint8Array,
  { timeoutMs = PDF_VALIDATION_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<PdfValidationResult> {
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

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const loadingTask = getDocument({
    data: bytes.slice(),
    disableFontFace: true,
    stopAtErrors: true,
    useSystemFonts: false,
    useWasm: false,
    useWorkerFetch: false,
    verbosity: 0,
  });
  let destroyPromise: Promise<void> | null = null;
  const destroyLoadingTask = () => {
    destroyPromise ??= loadingTask.destroy();
    return destroyPromise;
  };
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const parseTimedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new PdfValidationTimeoutError());
      // Destroying the task terminates its worker and prevents a hostile PDF
      // from continuing to consume resources after the request has timed out.
      void destroyLoadingTask().catch((error) => {
        console.error("pdf validation cancellation failed", error);
      });
    }, timeoutMs);
  });

  try {
    const document = await Promise.race([loadingTask.promise, parseTimedOut]);
    if (document.numPages < 1) {
      return { ok: false, message: "The PDF does not contain any pages." };
    }
    if (document.numPages > MAX_RESUME_PAGES) {
      return { ok: false, message: `The PDF must be ${MAX_RESUME_PAGES} pages or fewer.` };
    }

    const [attachments, documentActions, openAction, activeAnnotations] = await Promise.all([
      document.getAttachments(),
      document.getJSActions(),
      document.getOpenAction(),
      document.getAnnotationsByType(ACTIVE_ANNOTATION_TYPES, new Set()),
    ]);
    // Only "action" is hostile. pdf.js sets "dest" when the catalog OpenAction
    // is just an initial view (LaTeX hyperref, Word, Pages and Canva all emit
    // one), so treating any non-null Map as active rejected 21 real resumes.
    if (attachments?.size || documentActions?.size || openAction?.get("action") || activeAnnotations.length) {
      return { ok: false, message: "PDFs containing scripts, actions, or embedded files are not supported." };
    }

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      if ((await page.getJSActions())?.size) {
        return { ok: false, message: "PDFs containing scripts, actions, or embedded files are not supported." };
      }
      page.cleanup();
    }

    return { ok: true, byteSize: bytes.byteLength, pageCount: document.numPages, sha256 };
  } catch (error) {
    if (error instanceof PdfValidationTimeoutError) {
      return { ok: false, message: PDF_VALIDATION_TIMEOUT_MESSAGE };
    }
    if (error instanceof Error && error.name === "PasswordException") {
      return { ok: false, message: "Password-protected PDFs are not supported." };
    }
    // Never swallow this again. A bundling fault here (the pdfjs worker failing
    // to resolve) is indistinguishable from a genuinely corrupt upload without
    // the underlying error, and it silently rejected every resume in production.
    console.error("pdf validation failed", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: "The uploaded file is not a valid PDF." };
  } finally {
    clearTimeout(timeout);
    await destroyLoadingTask();
  }
}
