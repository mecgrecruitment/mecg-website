import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const cycleId = typeof body?.cycleId === "string" ? body.cycleId : "";
  if (!cycleId || !hasPermission(user.memberships, cycleId, "MANAGE_CYCLE")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = await createClient();
  let data: unknown;
  let error: { code?: string; message: string } | null = null;

  if (body.action === "ADD_USER") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = ["MEMBER", "BOARD", "PANEL"].includes(body.role) ? body.role as "MEMBER" | "BOARD" | "PANEL" : "MEMBER";
    if (!email || !name || password.length < 8 || password.length > 1024) return NextResponse.json({ error: "Valid name, email, and an 8-character password are required" }, { status: 400 });
    const admin = createAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } });
    if (createError || !created.user) return NextResponse.json({ error: createError?.message ?? "Could not create user" }, { status: 409 });
    ({ data, error } = await supabase.rpc("grant_membership", { target_user_id: created.user.id, target_cycle_id: cycleId, target_role: role }));
    if (error) await admin.auth.admin.deleteUser(created.user.id);
  } else if (body.action === "ADD_APPLICANT") {
    ({ data, error } = await supabase.rpc("add_applicant", { target_cycle_id: cycleId, applicant_name: String(body.name ?? ""), applicant_contact: String(body.contact ?? "") }));
  } else if (body.action === "ASSIGN") {
    ({ data, error } = await supabase.rpc("assign_evaluator", { target_cycle_id: cycleId, target_round_id: String(body.roundId ?? ""), target_application_id: String(body.applicationId ?? ""), target_evaluator_id: String(body.evaluatorId ?? "") }));
  } else if (body.action === "SET_ROUND_STATUS") {
    ({ data, error } = await supabase.rpc("set_round_status", { target_round_id: String(body.roundId ?? ""), next_status: body.status }));
  } else if (body.action === "SET_CYCLE_STATUS") {
    ({ data, error } = await supabase.rpc("set_cycle_status", { target_cycle_id: cycleId, next_status: body.status }));
  } else return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : error.code === "55000" || error.code === "23505" ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json(data === undefined || data === null ? { ok: true } : { id: data }, { status: 201 });
}
