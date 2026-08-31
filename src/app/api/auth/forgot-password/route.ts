import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp, emailBucket } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !email.includes("@")) {
    return NextResponse.json({ code: "INVALID_EMAIL" }, { status: 400 });
  }

  const supabase = await createClient();
  const ip = clientIp(request);
  const [ipOk, emailOk] = await Promise.all([
    checkRateLimit(`forgot-password:${ip}`),
    checkRateLimit(emailBucket("forgot-password-email", email)),
  ]);
  if (!ipOk || !emailOk) {
    return NextResponse.json({ error: "Too many requests, try again later" }, { status: 429 });
  }
  const callbackUrl = new URL("/auth/callback?next=/reset-password", request.nextUrl.origin).toString();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl });
  if (error?.status === 429) {
    console.error("forgot_password failed", error);
    return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 });
  }
  return NextResponse.json({ ok: true });
}
