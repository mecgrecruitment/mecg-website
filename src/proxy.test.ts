import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
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
    shouldBypassClerk,
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

  for (const pathname of ["/home", "/work/sample", "/this-route-does-not-exist", "/api/contact"]) {
    assert.equal(shouldBypassClerk(request(pathname)), true, pathname);
  }
  for (const pathname of ["/login", "/apply", "/admin", "/member", "/api/member/profile", "/api/auth/login"]) {
    assert.equal(shouldBypassClerk(request(pathname)), false, pathname);
  }
  assert.equal(shouldBypassClerk(request("/__clerk/npm/@clerk/clerk-js/dist/clerk.browser.js")), false);
  assert.deepEqual(clerkMiddlewareOptions, {
    frontendApiProxy: { enabled: true, path: "/__clerk" },
  });

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
