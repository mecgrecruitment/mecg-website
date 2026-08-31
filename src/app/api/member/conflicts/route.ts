import { NextRequest, NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const applicationId = typeof body?.applicationId === "string" ? body.applicationId : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const supabase = await createClient();
  const { error } = await supabase.rpc("declare_conflict", { target_application_id: applicationId, conflict_reason: reason });
  if (error) {
    console.error("declare_conflict failed", error);
    const { body, status } = mapRpcError(error);
    return NextResponse.json(body, { status });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
