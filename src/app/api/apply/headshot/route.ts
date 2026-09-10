import { NextRequest } from "next/server";
import { mapRpcError, rateLimitRouteResponse, requestReference, routeJsonResponse } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { checkRateLimitStatus, clientIp } from "@/lib/rate-limit";
import { screeningRpc } from "@/lib/screening-rpc";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_HEADSHOT_BYTES = 1024 * 1024;
// Headroom over the file limit for the multipart envelope, checked against the
// declared length so an oversized body is refused before it is buffered.
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const INVALID_FILE = "Choose a photo smaller than 1 MB";

// The browser prefers WebP and falls back to JPEG where WebP encoding is
// missing, so both arrive here. The declared MIME type is client-controlled and
// proves nothing; these are the real container signatures.
// WebP: "RIFF" <4 length bytes> "WEBP". JPEG: FF D8 FF.
const ENCODINGS = {
  "image/webp": { extension: "webp", matches: (b: Uint8Array) =>
    b.byteLength >= 12
    && String.fromCharCode(...b.subarray(0, 4)) === "RIFF"
    && String.fromCharCode(...b.subarray(8, 12)) === "WEBP" },
  "image/jpeg": { extension: "jpg", matches: (b: Uint8Array) =>
    b.byteLength >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
} as const;

function encodingFor(type: string): (typeof ENCODINGS)[keyof typeof ENCODINGS] | null {
  return (ENCODINGS as Record<string, (typeof ENCODINGS)[keyof typeof ENCODINGS]>)[type] ?? null;
}

export async function POST(req: NextRequest) {
  const startedAt = performance.now();
  const requestId = requestReference(req);
  const respond = (body: Record<string, unknown>, status: number, code?: string) =>
    routeJsonResponse("application.headshot.upload", requestId, startedAt, body, status, { code });
  let user;
  try { user = await currentUser(); } catch { return respond({ error: "Sign-in services are temporarily unavailable. Try again shortly." }, 503, "AUTH_SERVICE_UNAVAILABLE"); }
  if (!user) return respond({ error: "Sign in before uploading" }, 401, "AUTH_REQUIRED");

  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return respond({ error: INVALID_FILE }, 413, "PAYLOAD_TOO_LARGE");
  }

  // Before the body is buffered, not after: a request that trips the limit
  // should not first cost a megabyte of memory to parse.
  const limit = await checkRateLimitStatus(`headshot-upload:${user.id}:${clientIp(req)}`);
  if (limit !== "allowed") return rateLimitRouteResponse(
    "application.headshot.upload",
    requestId,
    startedAt,
    limit,
    "Too many photo uploads. Wait a few minutes and try again.",
  );

  const form = await req.formData().catch(() => null);
  const file = form?.get("headshot");
  const encoding = file instanceof File ? encodingFor(file.type) : null;
  if (!(file instanceof File) || !encoding || file.size < 1 || file.size > MAX_HEADSHOT_BYTES) {
    return respond({ error: INVALID_FILE }, 400, "INVALID_FILE");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!encoding.matches(bytes)) return respond({ error: INVALID_FILE }, 400, "INVALID_FILE");

  const supabase = await createClient();
  const { data: target, error } = await screeningRpc<{ path: string }>(supabase, "begin_headshot_upload", { upload_extension: encoding.extension });
  if (error || typeof target?.path !== "string") {
    if (error) console.error("begin_headshot_upload failed", error);
    const mapped = error ? mapRpcError(error, "Could not start photo upload") : { body: { error: "Could not start photo upload" }, status: 500 };
    return respond(mapped.body, mapped.status, "UPLOAD_START_FAILED");
  }

  // candidate-photos carries no storage.objects policies, so the caller's own
  // client cannot write it and the service-role client is the only writer.
  // `target.path` comes from the RPC, never the request, so the browser cannot
  // steer the upload at another applicant's object.
  const storage = createAdminClient().storage.from("candidate-photos");
  const { error: uploadError } = await storage.upload(target.path, bytes, { contentType: file.type });
  if (uploadError) {
    console.error("headshot upload failed", uploadError);
    return respond({ error: "Could not save the photo. Try again." }, 502, "STORAGE_UPLOAD_FAILED");
  }

  const { data: attached, error: attachError } = await screeningRpc<{ previousPath: string | null }>(supabase, "attach_headshot", {
    target_path: target.path,
  });
  if (attachError || !attached) {
    if (attachError) console.error("attach_headshot failed", attachError);
    // Only a classified rejection proves the attach did not commit. A transport
    // failure (timeout, reset) resolves with no code and the write may well have
    // landed, so deleting here would strand a row pointing at a missing object
    // that a screening packet then blocks the applicant from replacing. An
    // orphaned object is the cheaper mistake.
    if (!attachError || attachError.code) {
      const { error: cleanupError } = await storage.remove([target.path]);
      if (cleanupError) console.error("orphaned headshot cleanup failed", cleanupError);
    }
    const mapped = attachError ? mapRpcError(attachError, "Could not save the photo") : { body: { error: "Could not save the photo" }, status: 500 };
    return respond(mapped.body, mapped.status, "ATTACH_FAILED");
  }

  if (typeof attached.previousPath === "string" && attached.previousPath.length > 0) {
    const { error: removeError } = await storage.remove([attached.previousPath]);
    if (removeError) console.error("superseded headshot cleanup failed", removeError);
  }

  return respond({ ok: true }, 201);
}
