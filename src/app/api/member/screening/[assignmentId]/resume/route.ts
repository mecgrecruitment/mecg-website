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
  // Proxy the bytes rather than redirecting so the storage URL never reaches the reader's browser history.
  const upstream = await fetch(signed.signedUrl, { cache: "no-store" }).catch((cause: unknown) => {
    console.error("screening resume fetch failed", cause);
    return null;
  });
  if (!upstream?.ok) {
    if (upstream) console.error("screening resume fetch failed", upstream.status);
    return NextResponse.json({ error: "The resume is temporarily unavailable" }, { status: 502 });
  }
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="resume.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
