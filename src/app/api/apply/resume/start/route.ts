import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { MAX_RESUME_BYTES } from "@/lib/pdf-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 4 * 1024;

type UploadTarget = { documentId: string; path: string };

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in before uploading" }, { status: 401 });

  const parsed = await readJsonBody(req, MAX_REQUEST_BYTES);
  if (parsed.error) return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  const body = parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
    ? parsed.data as Record<string, unknown>
    : null;
  const filename = typeof body?.filename === "string" ? body.filename.trim() : "";
  const size = typeof body?.size === "number" ? body.size : 0;
  if (!filename || filename.length > 255 || !filename.toLowerCase().endsWith(".pdf") || !Number.isInteger(size) || size < 1 || size > MAX_RESUME_BYTES) {
    return NextResponse.json({ error: "Choose a PDF smaller than 10 MB" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await checkRateLimit(`resume-upload:${user.id}:${ip}`))) {
    return NextResponse.json({ error: "Too many resume uploads. Wait a few minutes and try again." }, { status: 429 });
  }

  const supabase = await createClient();
  const { data, error } = await screeningRpc<UploadTarget>(supabase, "begin_resume_upload", {
    upload_filename: filename,
    upload_size: size,
  });
  if (error || !data || typeof data.documentId !== "string" || typeof data.path !== "string") {
    if (error) console.error("begin_resume_upload failed", error);
    const mapped = error ? mapRpcError(error, "Could not start resume upload") : { body: { error: "Could not start resume upload" }, status: 500 };
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json(data, { status: 201 });
}
