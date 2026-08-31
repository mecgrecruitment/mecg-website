import { NextRequest, NextResponse } from "next/server";
import { destinationForUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (name.length < 2 || name.length > 120) {
    return NextResponse.json({ code: "INVALID_NAME" }, { status: 400 });
  }
  if (!email || email.length > 254 || !email.includes("@")) {
    return NextResponse.json({ code: "INVALID_EMAIL" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 1024) {
    return NextResponse.json({ code: "INVALID_PASSWORD" }, { status: 400 });
  }

  const supabase = await createClient();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await checkRateLimit(`signup:${ip}`))) {
    return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 });
  }
  const callbackUrl = new URL("/auth/callback?next=/apply", request.nextUrl.origin).toString();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: name },
      emailRedirectTo: callbackUrl,
    },
  });

  if (error) {
    console.error("signup failed", error);
    const status = error.status === 429 ? 429 : 400;
    return NextResponse.json(
      { code: status === 429 ? "RATE_LIMITED" : "SIGNUP_FAILED" },
      { status },
    );
  }

  if (!data.session || !data.user) {
    return NextResponse.json({ verificationRequired: true }, { status: 202 });
  }

  try {
    return NextResponse.json({ destination: await destinationForUser(supabase, data.user.id) }, { status: 201 });
  } catch (error) {
    console.error("signup destination lookup failed", error);
    return NextResponse.json({ code: "ROUTING_UNAVAILABLE" }, { status: 503 });
  }
}
