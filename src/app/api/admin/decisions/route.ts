import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const supabase = await createClient();
  let data: unknown;
  let error: { code?: string; message: string } | null = null;
  if (body?.action === "CREATE") ({ data, error } = await supabase.rpc("create_decision", { target_cycle_id: String(body.cycleId ?? ""), target_application_id: String(body.applicationId ?? ""), target_outcome: body.outcome, decision_reason: String(body.reason ?? "") }));
  else if (body?.action === "APPROVE") ({ data, error } = await supabase.rpc("approve_decision", { target_decision_id: String(body.decisionId ?? "") }));
  else if (body?.action === "RELEASE") ({ data, error } = await supabase.rpc("release_decision", { target_decision_id: String(body.decisionId ?? "") }));
  else if (body?.action === "PREVIEW") ({ data, error } = await supabase.rpc("set_decision_preview", { target_decision_id: String(body.decisionId ?? ""), preview_text: String(body.preview ?? "") }));
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : error.code === "55000" || error.code === "23505" ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json(data ?? { ok: true }, { status: body.action === "CREATE" ? 201 : 200 });
}
