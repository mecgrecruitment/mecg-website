import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import type { NextFetchEvent } from "next/server";
import { hasClerkConfiguration } from "@/lib/env";

export const CLERK_PROXY_PATH = "/__clerk";

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

const isClerkProxyRoute = createRouteMatcher([`${CLERK_PROXY_PATH}(.*)`]);

const isAuthDependentRoute = createRouteMatcher([
  "/login(.*)",
  "/sign-up(.*)",
  "/apply(.*)",
  "/forgot-password",
  "/reset-password",
  "/auth/callback(.*)",
  "/admin/login",
  "/api/auth(.*)",
  "/api/admin/login",
  "/api/webhooks/clerk",
]);

function isProtectedApi(pathname: string) {
  return ["/api/admin", "/api/member", "/api/account", "/api/applicant", "/api/apply"]
    .some((prefix) => pathname.startsWith(prefix));
}

function isProtectedPage(pathname: string) {
  return ["/admin", "/member", "/applicant"]
    .some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function shouldBypassClerk(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  return !isClerkProxyRoute(request)
    && !isAuthDependentRoute(request)
    && !isProtectedApi(pathname)
    && !isProtectedPage(pathname);
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export function handleUnconfiguredProxy(request: NextRequest) {
  return handleProxy(async () => ({ userId: null }), request);
}

const configuredProxy = clerkMiddleware(handleProxy, {
  frontendApiProxy: {
    enabled: true,
    path: CLERK_PROXY_PATH,
  },
});

export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (shouldBypassClerk(request)) return NextResponse.next();
  if (!hasClerkConfiguration()) return handleUnconfiguredProxy(request);
  return configuredProxy(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
