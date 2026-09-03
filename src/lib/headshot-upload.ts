"use client";

// Photos come off phones at 3-8 MB, and the route caps a headshot at 1 MB, so
// the browser does the shrinking: center square, 512px, WebP. The messages here
// are shown to the applicant verbatim, which is why the decode failure names the
// fix (an iPhone HEIC only decodes inside Safari).
const HEADSHOT_SIZE = 512;

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
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    // A browser without WebP encoding silently hands back a PNG; the route only
    // accepts image/webp, so catch that here instead of at the upload.
    if (!blob || blob.type !== "image/webp") throw new Error("We could not process that image. Try a different photo.");
    return new File([blob], "headshot.webp", { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}

/** Takes the output of resizeHeadshot, so a caller that also wants the resized
 *  file for a preview does not decode the source twice. */
export async function uploadHeadshot(resized: File): Promise<void> {
  const body = new FormData();
  body.append("headshot", resized);
  const response = await fetch("/api/apply/headshot", { method: "POST", body });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as Record<string, unknown> | null;
    throw new Error(typeof result?.error === "string" ? result.error : "We could not upload your photo. Please try again.");
  }
}
