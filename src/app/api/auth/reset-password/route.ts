import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { recoverySessionState } from "@/lib/recovery-session";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 8 || password.length > 1024) {
    return NextResponse.json({ code: "INVALID_PASSWORD" }, { status: 400 });
  }

  if (!(await checkRateLimit(`reset-password:${clientIp(request)}`))) {
    return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ code: "RECOVERY_SESSION_REQUIRED" }, { status: 401 });

  // Being signed in is not enough: this route sets a password without knowing
  // the old one, so it must only accept the session minted by a recovery link.
  // Otherwise a stolen sb-<ref>-auth-token cookie is permanent account takeover,
  // and this route becomes a bypass of the current-password re-verification
  // that /api/account/password enforces. getUser() above proves the token is
  // authentic; the claim below proves where it came from.
  const { data: sessionData } = await supabase.auth.getSession();
  const state = recoverySessionState(sessionData.session?.access_token);
  if (state === "not-recovery") {
    return NextResponse.json({ code: "RECOVERY_SESSION_REQUIRED" }, { status: 401 });
  }
  if (state === "unknown") {
    console.error("reset_password: access token carried no usable amr claim, allowing the reset unverified", {
      userId: userData.user.id,
    });
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("reset_password failed", error);
    return NextResponse.json({ code: "RESET_FAILED" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
