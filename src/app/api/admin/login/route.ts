import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !password || password.length > 1024) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const [{ data: memberships }, { data: isApplicant }] = await Promise.all([
    supabase.from("memberships").select("role").eq("user_id", signIn.user.id).eq("active", true),
    supabase.rpc("is_applicant"),
  ]);
  const roles = new Set((memberships ?? []).map((membership) => membership.role));
  const destination = ["BOARD", "PANEL", "OWNER"].some((role) => roles.has(role as "BOARD" | "PANEL" | "OWNER"))
    ? "/admin"
    : roles.has("MEMBER") ? "/member" : isApplicant ? "/applicant" : "/apply";
  return NextResponse.json({ ok: true, destination });
}
