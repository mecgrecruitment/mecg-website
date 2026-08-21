import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const applicationId = typeof body?.applicationId === "string" ? body.applicationId : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const supabase = await createClient();
  const { error } = await supabase.rpc("declare_conflict", { target_application_id: applicationId, conflict_reason: reason });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
