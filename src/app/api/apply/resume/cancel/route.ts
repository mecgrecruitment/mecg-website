import { NextRequest, NextResponse } from "next/server";
import { authServiceUnavailableResponse, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  let user;
  try { user = await currentUser(); } catch { return authServiceUnavailableResponse(); }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = await readJsonBody(req, 2048);
  const body = !parsed.error && parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
    ? parsed.data as Record<string, unknown>
    : null;
  const documentId = typeof body?.documentId === "string" ? body.documentId : "";
  if (!/^[0-9a-f-]{36}$/.test(documentId)) {
    return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: path, error } = await screeningRpc<string>(supabase, "reject_resume_upload", {
    target_document_id: documentId,
    rejection: "upload cancelled",
  });
  if (error || !path) return NextResponse.json({ error: "Could not cancel upload" }, { status: 409 });
  const { error: removeError } = await supabase.storage.from("resumes").remove([path]);
  if (removeError) console.error("cancelled resume cleanup failed", removeError);
  return NextResponse.json({ ok: true });
}
