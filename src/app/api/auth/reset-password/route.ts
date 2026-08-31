import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 8 || password.length > 1024) {
    return NextResponse.json({ code: "INVALID_PASSWORD" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ code: "RECOVERY_SESSION_REQUIRED" }, { status: 401 });
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("reset_password failed", error);
    return NextResponse.json({ code: "RESET_FAILED" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
