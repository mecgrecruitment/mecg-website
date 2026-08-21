import { NextRequest, NextResponse } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const { response, user } = await refreshSupabaseSession(req);
  if (pathname === "/admin/login" || pathname === "/api/admin/login") return response;
  if (user) return response;

  const isApi =
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/member") ||
    pathname.startsWith("/api/account");
  if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.redirect(new URL("/admin/login", req.url));
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/member/:path*",
    "/api/admin/:path*",
    "/api/member/:path*",
    "/api/account/:path*",
  ],
};
