import { NextRequest, NextResponse } from "next/server";
import { destinationForUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || email.length > 254 || !password || password.length > 1024) {
    return NextResponse.json({ code: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const supabase = await createClient();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const [ipOk, emailOk] = await Promise.all([
    checkRateLimit(`login:${ip}`),
    checkRateLimit(`login-email:${email}`),
  ]);
  if (!ipOk || !emailOk) {
    return NextResponse.json({ error: "Too many requests, try again later" }, { status: 429 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    console.error("login failed", error);
    const code = error?.message.toLowerCase().includes("email not confirmed")
      ? "EMAIL_NOT_CONFIRMED"
      : "INVALID_CREDENTIALS";
    return NextResponse.json({ code }, { status: 401 });
  }

  try {
    const destination = await destinationForUser(supabase, data.user.id);
    return NextResponse.json({ destination });
  } catch (error) {
    console.error("login destination lookup failed", error);
    await supabase.auth.signOut();
    return NextResponse.json({ code: "ROUTING_UNAVAILABLE" }, { status: 503 });
  }
}
