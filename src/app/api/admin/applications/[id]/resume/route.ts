import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data: application, error } = await supabase
    .from("applications")
    .select("id,cycle_id,resume_storage_path")
    .eq("id", id)
    .maybeSingle();
  if (error || !application?.resume_storage_path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hasPermission(user.memberships, application.cycle_id, "MANAGE_CYCLE") && !hasPermission(user.memberships, application.cycle_id, "HASH_PANEL_ACCESS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data: conflict } = await supabase.from("conflict_declarations").select("id").eq("application_id", id).eq("declarer_id", user.id).maybeSingle();
  if (conflict) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data: signed, error: signedError } = await supabase.storage.from("resumes").createSignedUrl(application.resume_storage_path, 3600);
  if (signedError || !signed?.signedUrl) return NextResponse.json({ error: "Could not open resume" }, { status: 404 });
  return NextResponse.redirect(signed.signedUrl);
}
