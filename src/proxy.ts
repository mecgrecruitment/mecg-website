import { NextRequest, NextResponse } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname === "/login" ||
    pathname === "/admin/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/admin/login" ||
    pathname === "/auth/callback" ||
    pathname === "/apply"
  ) return NextResponse.next();

  const { response, user } = await refreshSupabaseSession(req);
  if (user) return response;

  const isApi =
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/member") ||
    pathname.startsWith("/api/account") ||
    pathname.startsWith("/api/applicant") ||
    pathname.startsWith("/api/apply");
  if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/member/:path*",
    "/applicant/:path*",
    "/login",
    "/apply",
    "/auth/callback",
    "/api/auth/:path*",
    "/api/admin/:path*",
    "/api/member/:path*",
    "/api/account/:path*",
    "/api/applicant/:path*",
    "/api/apply/:path*",
  ],
};
