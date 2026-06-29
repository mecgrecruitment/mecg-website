import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Only allow internal absolute paths (open-redirect guard).
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "";
}

// Shared callback for email confirmation, OAuth, and password recovery.
// Exchanges the PKCE code for a session, then forwards to an explicit ?next
// (e.g. recovery → /auth/reset) or routes by member role.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth/login?error=Could+not+sign+you+in.", request.url)
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  if (next) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  const { data: role } = await supabase.rpc("current_member_role");
  return NextResponse.redirect(
    new URL(role ? "/internal" : "/apply/dashboard", request.url)
  );
}
