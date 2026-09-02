import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data: path, error } = await screeningRpc<string>(supabase, "authorize_resume_access", {
    target_application_id: id,
  });
  if (error || !path) {
    if (error) console.error("resume access denied", error);
    return NextResponse.json({ error: error?.code === "P0002" ? "Not found" : "Forbidden" }, { status: error?.code === "P0002" ? 404 : 403 });
  }
  const { data: signed, error: signedError } = await supabase.storage.from("resumes").createSignedUrl(path, 300);
  if (signedError || !signed?.signedUrl) {
    console.error("resume signed url failed", signedError);
    return NextResponse.json({ error: "The resume is temporarily unavailable" }, { status: 502 });
  }
  const response = NextResponse.redirect(signed.signedUrl);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
