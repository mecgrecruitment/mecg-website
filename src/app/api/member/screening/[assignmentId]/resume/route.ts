import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data: path, error } = await screeningRpc<string>(supabase, "authorize_screening_resume", {
    target_assignment_id: assignmentId,
  });
  if (error || !path) {
    if (error) console.error("screening resume access denied", error);
    return NextResponse.json({ error: error?.code === "P0002" ? "Not found" : "Forbidden" }, { status: error?.code === "P0002" ? 404 : 403 });
  }
  const { data: signed, error: signedError } = await supabase.storage.from("resumes").createSignedUrl(path, 300);
  if (signedError || !signed?.signedUrl) {
    console.error("screening resume signed url failed", signedError);
    return NextResponse.json({ error: "The resume is temporarily unavailable" }, { status: 502 });
  }
  const response = NextResponse.redirect(signed.signedUrl);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
