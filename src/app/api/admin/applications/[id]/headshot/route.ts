import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { screeningRpc } from "@/lib/screening-rpc";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Unlike the resume route this streams the bytes instead of redirecting to a
// signed URL: an <img> pointed at Supabase would need that origin in the CSP
// img-src, and it would leave a signed URL to an applicant's face in the DOM
// and in browser history. Same-origin bytes need neither.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data: path, error } = await screeningRpc<string>(supabase, "authorize_headshot_access", {
    target_application_id: id,
  });
  if (error || typeof path !== "string" || !path) {
    if (error) console.error("headshot access denied", error);
    return NextResponse.json({ error: error?.code === "P0002" ? "Not found" : "Forbidden" }, { status: error?.code === "P0002" ? 404 : 403 });
  }
  // The bucket has no storage.objects policies, so only the service-role client
  // can read it.
  const { data: blob, error: downloadError } = await createAdminClient().storage.from("candidate-photos").download(path);
  if (downloadError || !blob) {
    console.error("headshot download failed", downloadError);
    return NextResponse.json({ error: "The photo is temporarily unavailable" }, { status: 502 });
  }
  return new NextResponse(blob, {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store" },
  });
}
