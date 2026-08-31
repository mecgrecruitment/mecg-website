import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < 8 || newPassword.length > 1024) {
    return NextResponse.json({ error: "New password must be between 8 and 1024 characters" }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "New password must be different" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    console.error("password change failed", verifyError);
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    console.error("password change failed", error);
    return NextResponse.json({ error: "Password could not be updated" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
