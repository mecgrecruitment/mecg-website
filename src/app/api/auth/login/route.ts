import { NextRequest, NextResponse } from "next/server";
import { destinationForUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || email.length > 254 || !password || password.length > 1024) {
    return NextResponse.json({ code: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const code = error?.message.toLowerCase().includes("email not confirmed")
      ? "EMAIL_NOT_CONFIRMED"
      : "INVALID_CREDENTIALS";
    return NextResponse.json({ code }, { status: 401 });
  }

  try {
    const destination = await destinationForUser(supabase, data.user.id);
    return NextResponse.json({ destination });
  } catch {
    await supabase.auth.signOut();
    return NextResponse.json({ code: "ROUTING_UNAVAILABLE" }, { status: 503 });
  }
}
