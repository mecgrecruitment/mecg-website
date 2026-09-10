import { NextRequest } from "next/server";
import { mapRpcError, rateLimitRouteResponse, readJsonBody, requestReference, routeJsonResponse } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { MAX_RESUME_BYTES } from "@/lib/pdf-validation";
import { checkRateLimitStatus, clientIp } from "@/lib/rate-limit";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 4 * 1024;

type UploadTarget = { documentId: string; path: string };

export async function POST(req: NextRequest) {
  const startedAt = performance.now();
  const requestId = requestReference(req);
  const respond = (body: Record<string, unknown>, status: number, code?: string) =>
    routeJsonResponse("application.resume.start", requestId, startedAt, body, status, { code });
  let user;
  try { user = await currentUser(); } catch { return respond({ error: "Sign-in services are temporarily unavailable. Try again shortly." }, 503, "AUTH_SERVICE_UNAVAILABLE"); }
  if (!user) return respond({ error: "Sign in before uploading" }, 401, "AUTH_REQUIRED");

  const parsed = await readJsonBody(req, MAX_REQUEST_BYTES);
  if (parsed.error) return respond({ error: "Invalid upload request" }, 400, "INVALID_UPLOAD");
  const body = parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
    ? parsed.data as Record<string, unknown>
    : null;
  const filename = typeof body?.filename === "string" ? body.filename.trim() : "";
  const size = typeof body?.size === "number" ? body.size : 0;
  if (!filename || filename.length > 255 || !filename.toLowerCase().endsWith(".pdf") || !Number.isInteger(size) || size < 1 || size > MAX_RESUME_BYTES) {
    return respond({ error: "Choose a PDF smaller than 10 MB" }, 400, "INVALID_FILE");
  }

  const ip = clientIp(req);
  const limit = await checkRateLimitStatus(`resume-upload:${user.id}:${ip}`);
  if (limit !== "allowed") return rateLimitRouteResponse(
    "application.resume.start",
    requestId,
    startedAt,
    limit,
    "Too many resume uploads. Wait a few minutes and try again.",
    300,
  );

  const supabase = await createClient();
  const { data, error } = await screeningRpc<UploadTarget>(supabase, "begin_resume_upload", {
    upload_filename: filename,
    upload_size: size,
  });
  if (error || !data || typeof data.documentId !== "string" || typeof data.path !== "string") {
    if (error) console.error("begin_resume_upload failed", error);
    const mapped = error ? mapRpcError(error, "Could not start resume upload") : { body: { error: "Could not start resume upload" }, status: 500 };
    return respond(mapped.body, mapped.status, "UPLOAD_START_FAILED");
  }

  // `data.path` came from begin_resume_upload, never from the request body, so the
  // browser cannot steer this to another user's object. The browser never sees a
  // session token for storage: it PUTs straight to this pre-authorized signed URL,
  // which is what lets the auth cookie be httpOnly (see cookie-options.ts).
  const { data: signed, error: signedError } = await supabase.storage.from("resumes").createSignedUploadUrl(data.path);
  if (signedError || !signed?.signedUrl) {
    console.error("resume signed upload url failed", signedError);
    const { error: rejectionError } = await screeningRpc<string>(supabase, "reject_resume_upload", {
      target_document_id: data.documentId,
      rejection: "signed upload url creation failed",
    });
    if (rejectionError) console.error("resume signed upload url compensation failed", rejectionError);
    return respond({ error: "Could not start resume upload" }, 500, "SIGNED_UPLOAD_FAILED");
  }

  return respond({ documentId: data.documentId, uploadUrl: signed.signedUrl }, 201);
}
