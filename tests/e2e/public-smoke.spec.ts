import { expect, test } from "@playwright/test";

test("the public entry point redirects to a usable home page", async ({ page }) => {
  const externalFontRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "font" && !new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) {
      externalFontRequests.push(request.url());
    }
  });

  await page.goto("/");

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { level: 1, name: "Michigan Engineering Consulting Group" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "MECG home" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: /Discuss a project/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "MECG at a glance" })).toBeAttached();
  await expect(page.getByText("70+", { exact: true })).toBeVisible();
  expect(externalFontRequests).toEqual([]);
});

test("public navigation reaches the contact workflow", async ({ page }) => {
  await page.goto("/home");

  await page.getByRole("contentinfo").getByRole("link", { name: "Contact Us", exact: true }).click();

  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByRole("heading", { level: 1, name: "Contact Us" })).toBeVisible();
  await expect(page.getByRole("button", { name: /send/i })).toBeVisible();
});

test("responses keep the expected browser security boundaries", async ({ request }) => {
  const response = await request.get("/home");

  expect(response.ok()).toBeTruthy();
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain("font-src 'self'");
  expect(response.headers()["content-security-policy"]).not.toContain("upgrade-insecure-requests");
});

test("public API routes reach their handlers instead of throwing in the proxy", async ({ request }) => {
  // Not a stricter assertion because CI points NEXT_PUBLIC_SUPABASE_URL at
  // https://ci.invalid, so the RPC fails and the handler correctly answers 503.
  // The regression guarded here is the 500 thrown before any handler logic ran,
  // from createClient's auth() call throwing "Clerk can't detect usage of
  // clerkMiddleware()".
  //
  // This job runs with Clerk unconfigured, so what it proves is that the
  // unconfigured path reaches the handler. Whether the configured proxy routes
  // the same request to clerkMiddleware is asserted in src/proxy.test.ts,
  // which can mock it; there is no reachable Clerk instance here to assert it
  // against.
  const ics = await request.get("/api/events/00000000-0000-0000-0000-000000000000/ics");
  expect(ics.status()).not.toBe(500);

  // Body validation runs before Supabase is touched, so this one is exact.
  const interest = await request.post("/api/interest", { data: {} });
  expect(interest.status()).toBe(400);
});

test("unknown routes use the MECG recovery page", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "This page does not exist." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to public site", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Account access" })).toBeVisible();
});
