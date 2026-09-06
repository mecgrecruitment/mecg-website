import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import { hasClerkConfiguration } from "./lib/env.ts";

function request(pathname: string) {
  return new NextRequest("http://localhost" + pathname);
}

test("Clerk proxy preserves public, protected-page, protected-API, and signed-in behavior", async (t) => {
  let clerkMiddlewareOptions: unknown;
  t.mock.module("@clerk/nextjs/server", {
    namedExports: {
      clerkMiddleware: (handler: unknown, options: unknown) => {
        clerkMiddlewareOptions = options;
        return handler;
      },
      createRouteMatcher: (patterns: string[]) => (req: NextRequest) => patterns.some((pattern) => {
        const wildcard = pattern.endsWith("(.*)");
        const prefix = wildcard ? pattern.slice(0, -4) : pattern;
        return wildcard ? req.nextUrl.pathname.startsWith(prefix) : req.nextUrl.pathname === prefix;
      }),
    },
  });
  const proxyModule = "./proxy.ts?case=clerk";
  const {
    handleProxy,
    handleUnconfiguredProxy,
  } = await import(proxyModule) as typeof import("./proxy.ts");
  const signedOut = async () => ({ userId: null });
  const signedIn = async () => ({ userId: "user_clerk" });

  for (const pathname of ["/home", "/login", "/apply", "/api/auth/login", "/api/webhooks/clerk"]) {
    const response = await handleProxy(signedOut, request(pathname));
    assert.equal(response.headers.get("x-middleware-next"), "1", pathname);
  }

  const pageResponse = await handleProxy(signedOut, request("/admin"));
  assert.equal(pageResponse.status, 307);
  assert.equal(pageResponse.headers.get("location"), "http://localhost/login");

  for (const pathname of ["/api/member/profile", "/api/applicant/buddy", "/api/apply/resume/start"]) {
    const response = await handleProxy(signedOut, request(pathname));
    assert.equal(response.status, 401, pathname);
    assert.deepEqual(await response.json(), { error: "Unauthorized" }, pathname);
  }

  const signedInResponse = await handleProxy(signedIn, request("/member"));
  assert.equal(signedInResponse.headers.get("x-middleware-next"), "1");

  const unknownResponse = await handleProxy(signedOut, request("/this-route-does-not-exist"));
  assert.equal(unknownResponse.headers.get("x-middleware-next"), "1");

  // Check-in is public and its handlers call currentUser(). Those are
  // independent: check-in is absent from the session-free list, so
  // clerkMiddleware runs and the session is readable, and handleProxy still
  // lets check-in through without a redirect.
  for (const pathname of ["/checkin/some-token", "/api/checkin/some-token"]) {
    const response = await handleProxy(signedOut, request(pathname));
    assert.equal(response.headers.get("x-middleware-next"), "1", pathname);
  }

  // Both build a Supabase client, which calls auth(). Skipping clerkMiddleware
  // made GET /api/events/<uuid>/ics 500 in production before the handler ran a
  // single line; they are public and must pass straight through.
  for (const pathname of ["/api/interest", "/api/events/abc/ics"]) {
    const response = await handleProxy(signedOut, request(pathname));
    assert.equal(response.headers.get("x-middleware-next"), "1", pathname);
  }
  // Clerk's production instance serves from clerk.mecgmichigan.com directly;
  // passing no options is what keeps the SDK off the retired /__clerk proxy.
  assert.equal(clerkMiddlewareOptions, undefined);

  assert.equal(hasClerkConfiguration({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test", CLERK_SECRET_KEY: "sk_test" }), true);
  assert.equal(hasClerkConfiguration({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test", CLERK_SECRET_KEY: undefined }), false);

  const unconfiguredPublicResponse = await handleUnconfiguredProxy(request("/home"));
  assert.equal(unconfiguredPublicResponse.headers.get("x-middleware-next"), "1");

  const unconfiguredProtectedResponse = await handleUnconfiguredProxy(request("/member"));
  assert.equal(unconfiguredProtectedResponse.status, 307);
  assert.equal(unconfiguredProtectedResponse.headers.get("location"), "http://localhost/login");

  const unconfiguredApiResponse = await handleUnconfiguredProxy(request("/api/member/profile"));
  assert.equal(unconfiguredApiResponse.status, 401);
});

// The mocked createRouteMatcher above only fakes route matchers, so exercise
// config.matcher directly. Next anchors it against the pathname.
test("the proxy matcher skips static assets without skipping dotted app routes", async (t) => {
  // Only config is under test, so the Clerk stubs can be inert.
  t.mock.module("@clerk/nextjs/server", {
    namedExports: {
      clerkMiddleware: (handler: unknown) => handler,
      createRouteMatcher: () => () => false,
    },
  });
  const matcherModule = "./proxy.ts?case=matcher";
  const { config } = await import(matcherModule) as typeof import("./proxy.ts");
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  // An extension mid-path used to exclude the whole route from the proxy, so a
  // protected page under a dotted segment ran with no auth check at all.
  for (const pathname of ["/admin/rounds/abc.png/edit", "/work/report.v2/details", "/home", "/api/interest"]) {
    assert.equal(matcher.test(pathname), true, pathname);
  }

  for (const pathname of ["/logo.png", "/fonts/x.woff2", "/_next/static/chunk.js"]) {
    assert.equal(matcher.test(pathname), false, pathname);
  }

  // Known ceiling: a path ENDING in a known extension is still treated as a
  // static asset, so /admin/rounds/abc.png would skip the proxy. No route takes
  // an id that ends in one today; tightening it means listing asset prefixes.
  assert.equal(matcher.test("/admin/rounds/abc.png"), false);
});

// A Clerk outage must not take the marketing site down, so proxy() bypasses
// clerkMiddleware for routes whose handlers never read the session, and runs it
// for everything else. /api/events/[id]/ics is the route that 500'd in
// production when the bypass was the other way around, and this is the only
// place that stays asserted: an end-to-end check is impossible in CI, where
// Clerk points at an unreachable host and running the middleware means hanging.
test("proxy bypasses Clerk only for routes that never read the session", async (t) => {
  t.mock.module("@clerk/nextjs/server", {
    namedExports: {
      clerkMiddleware: () => () => new NextResponse(null, { headers: { "x-clerk-ran": "1" } }),
      createRouteMatcher: (patterns: string[]) => (req: NextRequest) => patterns.some((pattern) => {
        const wildcard = pattern.endsWith("(.*)");
        const prefix = wildcard ? pattern.slice(0, -4) : pattern;
        return wildcard ? req.nextUrl.pathname.startsWith(prefix) : req.nextUrl.pathname === prefix;
      }),
    },
  });
  const previous = {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  };
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test";
  process.env.CLERK_SECRET_KEY = "sk_test";
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  const proxyModule = "./proxy.ts?case=session-free";
  const { proxy } = await import(proxyModule) as typeof import("./proxy.ts");
  const event = {} as Parameters<typeof proxy>[1];

  for (const pathname of ["/", "/home", "/api/interest"]) {
    const response = await proxy(request(pathname), event);
    assert.ok(response, pathname);
    assert.equal(response.headers.get("x-clerk-ran"), null, pathname);
    assert.equal(response.headers.get("x-middleware-next"), "1", pathname);
  }

  for (const pathname of ["/api/events/abc/ics", "/apply", "/checkin/tok", "/admin", "/api/member/profile"]) {
    const response = await proxy(request(pathname), event);
    assert.ok(response, pathname);
    assert.equal(response.headers.get("x-clerk-ran"), "1", pathname);
  }
});
