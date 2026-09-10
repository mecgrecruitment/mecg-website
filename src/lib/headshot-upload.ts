"use client";

// Photos come off phones at 3-8 MB, and the route caps a headshot at 1 MB, so
// the browser does the shrinking: center square, 512px, WebP. The messages here
// are shown to the applicant verbatim, which is why the decode failure names the
// fix (an iPhone HEIC only decodes inside Safari).
const HEADSHOT_SIZE = 512;
const HEADSHOT_UPLOAD_TIMEOUT_MS = 30_000;

export async function resizeHeadshot(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Couldn't read that image. Save it as a JPG or PNG and try again.");
  }
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = HEADSHOT_SIZE;
    canvas.height = HEADSHOT_SIZE;
    const context = canvas.getContext("2d");
    if (!context || !side) throw new Error("We could not process that image. Try a different photo.");
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, HEADSHOT_SIZE, HEADSHOT_SIZE);
    // A browser that cannot encode WebP ignores the type and hands back a PNG.
    // The photo is required to submit, so treating that as failure would lock
    // those applicants out of the application entirely. JPEG encoding is
    // universal, so fall back to it and accept the slightly larger file.
    const encode = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.82));
    let blob = await encode("image/webp");
    if (blob?.type !== "image/webp") blob = await encode("image/jpeg");
    if (!blob || (blob.type !== "image/webp" && blob.type !== "image/jpeg")) {
      throw new Error("We could not process that image. Try a different photo.");
    }
    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `headshot.${extension}`, { type: blob.type });
  } finally {
    bitmap.close();
  }
}

/** Takes the output of resizeHeadshot, so a caller that also wants the resized
 *  file for a preview does not decode the source twice. */
export async function uploadHeadshot(
  resized: File,
  { fetcher = fetch, timeoutMs = HEADSHOT_UPLOAD_TIMEOUT_MS }: { fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<void> {
  const body = new FormData();
  body.append("headshot", resized);
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetcher("/api/apply/headshot", { method: "POST", body, signal });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as Record<string, unknown> | null;
      throw new Error(typeof result?.error === "string" ? result.error : "We could not upload your photo. Please try again.");
    }
  } catch (error) {
    if (signal.aborted) {
      throw new Error("Uploading your photo took too long. Check your connection and try again.");
    }
    throw error;
  }
}
