import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { PDF_VALIDATION_TIMEOUT_MS, validateResumePdf } from "@/lib/pdf-validation";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 2 * 1024;

type PendingUpload = { documentId: string; path: string; declaredSize: number; filename: string };
type ReadyUpload = {
  documentId: string;
  path: string;
  filename: string;
  size: number;
  pageCount: number;
  supersededPaths?: string[];
};

async function rejectUpload(supabase: Awaited<ReturnType<typeof createClient>>, documentId: string, path: string, message: string) {
  const { data: rejectedPath, error } = await screeningRpc<string>(supabase, "reject_resume_upload", {
    target_document_id: documentId,
    rejection: message,
  });
  if (error || rejectedPath !== path) {
    console.error("reject_resume_upload failed", error ?? new Error("Rejected path did not match pending upload"));
    return;
  }
  const { error: removeError } = await supabase.storage.from("resumes").remove([rejectedPath]);
  if (removeError) console.error("rejected resume cleanup failed", removeError);
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in before uploading" }, { status: 401 });
  const parsed = await readJsonBody(req, MAX_REQUEST_BYTES);
  if (parsed.error) return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  const body = parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
    ? parsed.data as Record<string, unknown>
    : null;
  const documentId = typeof body?.documentId === "string" ? body.documentId : "";
  if (!/^[0-9a-f-]{36}$/.test(documentId)) {
    return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  }

  if (!(await checkRateLimit(`resume-finalize:${user.id}:${clientIp(req)}`))) {
    return NextResponse.json({ error: "Too many resume uploads. Wait a few minutes and try again." }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: pending, error: pendingError } = await screeningRpc<PendingUpload>(supabase, "pending_resume_upload", {
    target_document_id: documentId,
  });
  if (pendingError || !pending?.path) {
    if (pendingError) console.error("pending_resume_upload failed", pendingError);
    return NextResponse.json({ error: "The upload expired. Choose the file again." }, { status: 409 });
  }

  const { data: blob, error: downloadError } = await supabase.storage.from("resumes").download(pending.path);
  if (downloadError || !blob) {
    if (downloadError) console.error("resume verification download failed", downloadError);
    return NextResponse.json({ error: "The upload did not finish. Try again." }, { status: 409 });
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const validation = await validateResumePdf(bytes, { timeoutMs: PDF_VALIDATION_TIMEOUT_MS });
  if (!validation.ok) {
    await rejectUpload(supabase, documentId, pending.path, validation.message);
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }
  if (validation.byteSize !== pending.declaredSize) {
    const message = "The uploaded file size did not match the selected file. Choose it again.";
    await rejectUpload(supabase, documentId, pending.path, message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data, error } = await screeningRpc<ReadyUpload>(createAdminClient(), "finalize_resume_upload", {
    target_document_id: documentId,
    actual_size: validation.byteSize,
    content_sha256: validation.sha256,
    detected_page_count: validation.pageCount,
  });
  if (error || !data?.path) {
    if (error) console.error("finalize_resume_upload failed", error);
    const mapped = error ? mapRpcError(error, "Could not verify resume upload") : { body: { error: "Could not verify resume upload" }, status: 500 };
    return NextResponse.json(mapped.body, { status: mapped.status });
  }

  const supersededPaths = Array.isArray(data.supersededPaths)
    ? data.supersededPaths.filter((path): path is string => typeof path === "string" && path.length > 0)
    : [];
  if (supersededPaths.length > 0) {
    const { error: cleanupError } = await supabase.storage.from("resumes").remove(supersededPaths);
    if (cleanupError) console.error("superseded resume cleanup failed", cleanupError);
  }

  return NextResponse.json({
    documentId: data.documentId,
    path: data.path,
    filename: data.filename,
    size: data.size,
    pageCount: data.pageCount,
  });
}
