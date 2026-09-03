import { NextRequest, NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { screeningRpc } from "@/lib/screening-rpc";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_HEADSHOT_BYTES = 1024 * 1024;
// Headroom over the file limit for the multipart envelope, checked against the
// declared length so an oversized body is refused before it is buffered.
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const INVALID_FILE = "Choose a WebP photo smaller than 1 MB";

// The multipart part's declared MIME type is client-controlled, so it proves
// nothing. A real WebP is a RIFF container: "RIFF" <4 length bytes> "WEBP".
function isWebp(bytes: Uint8Array) {
  if (bytes.byteLength < 12) return false;
  const tag = (start: number) => String.fromCharCode(...bytes.subarray(start, start + 4));
  return tag(0) === "RIFF" && tag(8) === "WEBP";
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in before uploading" }, { status: 401 });

  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: INVALID_FILE }, { status: 413 });
  }

  // Before the body is buffered, not after: a request that trips the limit
  // should not first cost a megabyte of memory to parse.
  if (!(await checkRateLimit(`headshot-upload:${user.id}:${clientIp(req)}`))) {
    return NextResponse.json({ error: "Too many photo uploads. Wait a few minutes and try again." }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("headshot");
  if (!(file instanceof File) || file.type !== "image/webp" || file.size < 1 || file.size > MAX_HEADSHOT_BYTES) {
    return NextResponse.json({ error: INVALID_FILE }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isWebp(bytes)) return NextResponse.json({ error: INVALID_FILE }, { status: 400 });

  const supabase = await createClient();
  const { data: target, error } = await screeningRpc<{ path: string }>(supabase, "begin_headshot_upload", {});
  if (error || typeof target?.path !== "string") {
    if (error) console.error("begin_headshot_upload failed", error);
    const mapped = error ? mapRpcError(error, "Could not start photo upload") : { body: { error: "Could not start photo upload" }, status: 500 };
    return NextResponse.json(mapped.body, { status: mapped.status });
  }

  // candidate-photos carries no storage.objects policies, so the caller's own
  // client cannot write it and the service-role client is the only writer.
  // `target.path` comes from the RPC, never the request, so the browser cannot
  // steer the upload at another applicant's object.
  const storage = createAdminClient().storage.from("candidate-photos");
  const { error: uploadError } = await storage.upload(target.path, bytes, { contentType: "image/webp" });
  if (uploadError) {
    console.error("headshot upload failed", uploadError);
    return NextResponse.json({ error: "Could not save the photo. Try again." }, { status: 502 });
  }

  const { data: attached, error: attachError } = await screeningRpc<{ previousPath: string | null }>(supabase, "attach_headshot", {
    target_path: target.path,
  });
  if (attachError || !attached) {
    if (attachError) console.error("attach_headshot failed", attachError);
    // Nothing references the object now, so drop it rather than orphan it.
    const { error: cleanupError } = await storage.remove([target.path]);
    if (cleanupError) console.error("orphaned headshot cleanup failed", cleanupError);
    const mapped = attachError ? mapRpcError(attachError, "Could not save the photo") : { body: { error: "Could not save the photo" }, status: 500 };
    return NextResponse.json(mapped.body, { status: mapped.status });
  }

  if (typeof attached.previousPath === "string" && attached.previousPath.length > 0) {
    const { error: removeError } = await storage.remove([attached.previousPath]);
    if (removeError) console.error("superseded headshot cleanup failed", removeError);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
