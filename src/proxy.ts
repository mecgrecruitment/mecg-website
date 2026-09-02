import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/home",
  "/contact",
  "/join",
  "/team",
  "/work(.*)",
  "/checkin(.*)",
  "/login(.*)",
  "/admin/login",
  "/sign-up(.*)",
  "/apply(.*)",
  "/forgot-password",
  "/reset-password",
  "/auth/callback(.*)",
  "/api/auth(.*)",
  "/api/admin/login",
  "/api/webhooks/clerk",
  "/api/checkin(.*)",
  "/api/contact",
  "/api/events(.*)",
  "/api/health",
  "/api/interest",
  "/api/maintenance(.*)",
]);

function isProtectedApi(pathname: string) {
  return ["/api/admin", "/api/member", "/api/account", "/api/applicant", "/api/apply"]
    .some((prefix) => pathname.startsWith(prefix));
}

export async function handleProxy(
  session: () => Promise<{ userId: string | null }>,
  request: NextRequest,
) {
  if (isPublicRoute(request)) return NextResponse.next();
  const { userId } = await session();
  if (userId) return NextResponse.next();
  if (isProtectedApi(request.nextUrl.pathname)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const proxy = clerkMiddleware(handleProxy);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
