import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import type { NextFetchEvent } from "next/server";
import { hasClerkConfiguration } from "@/lib/env";


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

function isProtectedPage(pathname: string) {
  return ["/admin", "/member", "/applicant"]
    .some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function handleProxy(
  session: () => Promise<{ userId: string | null }>,
  request: NextRequest,
) {
  if (isPublicRoute(request)) return NextResponse.next();
  const pathname = request.nextUrl.pathname;
  if (!isProtectedApi(pathname) && !isProtectedPage(pathname)) {
    return NextResponse.next();
  }
  const { userId } = await session();
  if (userId) return NextResponse.next();
  if (isProtectedApi(pathname)) {
    // __client_uat is Clerk's own marker that a session exists in this browser.
    // Set but rejected means the short-lived session cookie expired (a phone
    // that slept); absent means nobody is signed in. Telling them apart in the
    // log is the difference between a one-line grep and an evening of guessing.
    const clientUat = request.cookies.get("__client_uat")?.value;
    console.warn(`api 401 ${pathname} ${clientUat && clientUat !== "0" ? "stale-session" : "no-session"}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export function handleUnconfiguredProxy(request: NextRequest) {
  return handleProxy(async () => ({ userId: null }), request);
}

const configuredProxy = clerkMiddleware(handleProxy);

// Every route falls on one side of a line: it never reads the session, so it
// must not depend on Clerk being reachable and the public site keeps serving
// through a Clerk outage; or it reads the session and has to run
// clerkMiddleware, because auth() throws "Clerk can't detect usage of
// clerkMiddleware()" without it. The default is to run it, so adding a handler
// that calls auth() cannot break the way /api/interest and /api/events/[id]/ics
// did.
//
// Listing a route below is an assertion that its handler never touches the
// session -- not that skipping Clerk is convenient there. Adding one without
// reading the handler first is exactly how the original bug shipped.
const isSessionFreeRoute = createRouteMatcher([
  "/",
  "/home",
  "/contact",
  "/join",
  "/team",
  "/work(.*)",
  "/api/contact",
  "/api/health",
  "/api/interest",
]);

export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isSessionFreeRoute(request)) return NextResponse.next();
  if (!hasClerkConfiguration()) return handleUnconfiguredProxy(request);
  return configuredProxy(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)(?:$|\\?)).*)",
    "/(api|trpc)(.*)",
  ],
};
