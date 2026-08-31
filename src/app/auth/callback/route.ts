import { NextRequest, NextResponse } from "next/server";
import { destinationForUser } from "@/lib/auth";
import { RECOVERY_COOKIE, RECOVERY_COOKIE_PATH, RECOVERY_TTL_SECONDS, issueRecoveryMarker } from "@/lib/recovery-marker";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      if (requestedNext === "/reset-password") {
        // This is the only point in the app that can attest a recovery link was
        // just exchanged, so it is where the reset route's proof is minted.
        const recovery = NextResponse.redirect(new URL("/reset-password", request.url));
        recovery.cookies.set(RECOVERY_COOKIE, issueRecoveryMarker(data.user.id), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: RECOVERY_COOKIE_PATH,
          maxAge: RECOVERY_TTL_SECONDS,
        });
        return recovery;
      }
      try {
        const destination = await destinationForUser(supabase, data.user.id);
        return NextResponse.redirect(new URL(destination, request.url));
      } catch (routingError) {
        console.error("auth callback routing failed", routingError);
        return NextResponse.redirect(new URL("/login?error=routing", request.url));
      }
    }
  }
  return NextResponse.redirect(new URL("/login?error=callback", request.url));
}
