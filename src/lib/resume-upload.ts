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
  phaseTimeouts?: Partial<Record<ResumeUploadPhase, number>>;
};

type ResumeUploadPhase = "start" | "upload" | "finalize" | "attach" | "cancel";

class RetryableFinalizeError extends Error {}

const DEFAULT_PHASE_TIMEOUTS: Record<ResumeUploadPhase, number> = {
  start: 15_000,
  upload: 60_000,
  finalize: 30_000,
  attach: 15_000,
  cancel: 5_000,
};

const PHASE_TIMEOUT_MESSAGES: Record<ResumeUploadPhase, string> = {
  start: "Starting the resume upload took too long. Please try again.",
  upload: "Uploading your resume took too long. Check your connection and try again.",
  finalize: "Checking your resume took too long. Please try again.",
  attach: "Updating your resume took too long. Please try again.",
  cancel: "Cancelling the resume upload took too long.",
};

export function isAcceptableResumeFile(file: File) {
  return file.name.toLowerCase().endsWith(".pdf")
    && (file.type === "application/pdf" || file.type === "")
    && file.size > 0
    && file.size <= 10 * 1024 * 1024;
}

async function runPhase<T>(
  phase: ResumeUploadPhase,
  timeout: number,
  operation: (signal: AbortSignal) => Promise<T>,
) {
  const signal = AbortSignal.timeout(timeout);
  try {
    return await operation(signal);
  } catch (error) {
    if (signal.aborted) throw new Error(PHASE_TIMEOUT_MESSAGES[phase]);
    throw error;
  }
}

async function responseBody(response: Response) {
  return response.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

function responseError(body: Record<string, unknown> | null, fallback: string) {
  return typeof body?.error === "string" ? body.error : fallback;
}

export async function uploadResumeFile(
  file: File,
  { attach = false, fetcher = fetch, phaseTimeouts = {} }: ResumeUploadOptions = {},
): Promise<ResumeUploadResult> {
  let documentId = "";
  let finalized = false;
  const timeout = { ...DEFAULT_PHASE_TIMEOUTS, ...phaseTimeouts };

  try {
    const { response: startResponse, body: started } = await runPhase("start", timeout.start, async (signal) => {
      const response = await fetcher("/api/apply/resume/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, size: file.size }),
        signal,
      });
      return { response, body: await responseBody(response) };
    });
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
    const uploadResponse = await runPhase("upload", timeout.upload, (signal) => fetcher(started.uploadUrl as string, {
      method: "PUT",
      headers: { "x-upsert": "false" },
      body: uploadBody,
      signal,
    }));
    if (!uploadResponse.ok) {
      throw new Error("We could not upload your resume. Please try again.");
    }

    let finalizeResponse: Response | null = null;
    let result: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const finalizedAttempt = await runPhase("finalize", timeout.finalize, async (signal) => {
          const response = await fetcher("/api/apply/resume/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId }),
            signal,
          });
          return { response, body: await responseBody(response) };
        });
        finalizeResponse = finalizedAttempt.response;
        result = finalizedAttempt.body;
        if (finalizeResponse.ok || finalizeResponse.status < 500) break;
      } catch (error) {
        if (attempt === 1) throw new RetryableFinalizeError(error instanceof Error ? error.message : PHASE_TIMEOUT_MESSAGES.finalize);
      }
    }
    if (!finalizeResponse || finalizeResponse.status >= 500) {
      throw new RetryableFinalizeError(responseError(result, "We could not verify your resume. Please try again."));
    }
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
      const { response: attachResponse, body: attached } = await runPhase("attach", timeout.attach, async (signal) => {
        const response = await fetcher("/api/apply/resume/attach", { method: "POST", signal });
        return { response, body: await responseBody(response) };
      });
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
    if (documentId && !finalized && !(error instanceof RetryableFinalizeError)) {
      await runPhase("cancel", timeout.cancel, (signal) => fetcher("/api/apply/resume/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
        signal,
      })).catch(() => undefined);
    }
    throw error;
  }
}
