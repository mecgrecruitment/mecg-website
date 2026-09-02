"use client";

export type ResumeUploadResult = {
  documentId: string;
  path: string;
  filename: string;
  size: number;
  pageCount: number;
};

type ResumeUploadOptions = {
  attach?: boolean;
  fetcher?: typeof fetch;
};

async function responseBody(response: Response) {
  return response.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

function responseError(body: Record<string, unknown> | null, fallback: string) {
  return typeof body?.error === "string" ? body.error : fallback;
}

export async function uploadResumeFile(
  file: File,
  { attach = false, fetcher = fetch }: ResumeUploadOptions = {},
): Promise<ResumeUploadResult> {
  let documentId = "";
  let finalized = false;

  try {
    const startResponse = await fetcher("/api/apply/resume/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, size: file.size }),
    });
    const started = await responseBody(startResponse);
    if (
      !startResponse.ok
      || typeof started?.documentId !== "string"
      || typeof started.uploadUrl !== "string"
    ) {
      throw new Error(responseError(started, "We could not start the resume upload."));
    }
    documentId = started.documentId;

    // Supabase's uploadToSignedUrl uses multipart form data for Blob and File
    // bodies. Match that request shape without exposing a browser auth token.
    const uploadBody = new FormData();
    uploadBody.append("cacheControl", "3600");
    uploadBody.append("", file);
    const uploadResponse = await fetcher(started.uploadUrl, {
      method: "PUT",
      headers: { "x-upsert": "false" },
      body: uploadBody,
    });
    if (!uploadResponse.ok) {
      throw new Error("We could not upload your resume. Please try again.");
    }

    const finalizeResponse = await fetcher("/api/apply/resume/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    const result = await responseBody(finalizeResponse);
    if (
      !finalizeResponse.ok
      || typeof result?.documentId !== "string"
      || typeof result.path !== "string"
      || typeof result.filename !== "string"
      || typeof result.size !== "number"
      || typeof result.pageCount !== "number"
    ) {
      throw new Error(responseError(result, "We could not verify your resume. Please try again."));
    }
    finalized = true;

    if (attach) {
      const attachResponse = await fetcher("/api/apply/resume/attach", { method: "POST" });
      const attached = await responseBody(attachResponse);
      if (!attachResponse.ok) {
        throw new Error(responseError(attached, "We could not update your resume."));
      }
    }

    return {
      documentId: result.documentId,
      path: result.path,
      filename: result.filename,
      size: result.size,
      pageCount: result.pageCount,
    };
  } catch (error) {
    if (documentId && !finalized) {
      await fetcher("/api/apply/resume/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      }).catch(() => undefined);
    }
    throw error;
  }
}
