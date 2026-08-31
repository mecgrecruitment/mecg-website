import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

type ReadyResume = { path: string; filename: string };

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestedPath = req.nextUrl.searchParams.get("path");
  if (!requestedPath || requestedPath.length > 240) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await screeningRpc<ReadyResume>(supabase, "my_ready_resume", { target_path: requestedPath });
  if (error || !data?.path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: signed, error: signedError } = await supabase.storage.from("resumes").createSignedUrl(data.path, 300);
  if (signedError || !signed?.signedUrl) {
    console.error("applicant resume signed url failed", signedError);
    return NextResponse.json({ error: "Could not open resume" }, { status: 404 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
