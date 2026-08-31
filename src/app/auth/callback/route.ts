import { NextRequest, NextResponse } from "next/server";
import { destinationForUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      if (requestedNext === "/reset-password") {
        return NextResponse.redirect(new URL("/reset-password", request.url));
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
