import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

function request(pathname: string) {
  return new NextRequest("http://localhost" + pathname);
}

test("Clerk proxy preserves public, protected-page, protected-API, and signed-in behavior", async (t) => {
  t.mock.module("@clerk/nextjs/server", {
    namedExports: {
      clerkMiddleware: (handler: unknown) => handler,
      createRouteMatcher: () => (req: NextRequest) =>
        ["/login", "/apply", "/api/auth/login", "/api/webhooks/clerk"].includes(req.nextUrl.pathname),
    },
  });
  const proxyModule = "./proxy.ts?case=clerk";
  const { handleProxy } = await import(proxyModule) as typeof import("./proxy.ts");
  const signedOut = async () => ({ userId: null });
  const signedIn = async () => ({ userId: "user_clerk" });

  for (const pathname of ["/login", "/apply", "/api/auth/login", "/api/webhooks/clerk"]) {
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
});
