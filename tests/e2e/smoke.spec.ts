import { expect, test } from "@playwright/test";

/** Canonical public marketing + portal routes (keep in sync with app/(external) + /portal). */
const publicRoutes = [
  "/",
  "/about",
  "/our-team",
  "/client-services",
  "/prospective-members",
  "/socials",
  "/contact",
  "/trek",
  "/placement",
  "/portal",
];

/** Keep in sync with PROTECTED_PREFIXES in src/lib/supabase/middleware.ts */
const protectedRoutes = [
  "/internal",
  "/internal/members",
  "/apply/dashboard",
  "/apply/application",
  "/apply/checkin",
];

/** Old public aliases → permanent redirects (next.config.ts). */
const canonicalRedirects = [
  { from: "/team", to: "/our-team" },
  { from: "/services", to: "/client-services" },
  { from: "/recruitment", to: "/prospective-members" },
];

test("public site and primary navigation are available", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/MECG/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Pro-bono.*Student-led.*Open to every major/i })
  ).toBeVisible();
  if (testInfo.project.name === "mobile-webkit") {
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  } else {
    await expect(page.getByRole("link", { name: "Log in", exact: true })).toBeVisible();
  }
});

test("legacy portal and member-login deep-link into unified auth", async ({ page }) => {
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/auth\/login\/?$/);
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();

  await page.goto("/member-login");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Finternal$/);
});

test("all public routes render without HTTP or horizontal-overflow failures", async ({ page }) => {
  for (const route of publicRoutes) {
    const response = await page.goto(route);
    expect(response?.status(), `${route} returned an error`).toBeLessThan(400);
    await expect(page.locator("body"), `${route} rendered no content`).not.toBeEmpty();

    // /portal redirects to /auth/login — skip overflow check on the redirect hop.
    if (route === "/portal") continue;

    const { overflow, offenders } = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      return {
        overflow: document.documentElement.scrollWidth - viewportWidth,
        offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${
                element.classList.length ? `.${Array.from(element.classList).join(".")}` : ""
              }`,
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            };
          })
          .filter(({ left, right }) => left < -1 || right > viewportWidth + 1)
          .slice(0, 8),
      };
    });
    expect(
      overflow,
      `${route} overflows the viewport; offenders: ${JSON.stringify(offenders)}`
    ).toBeLessThanOrEqual(1);
  }
});

test("legacy public aliases permanently redirect to canonical routes", async ({ page }) => {
  for (const { from, to } of canonicalRedirects) {
    const response = await page.goto(from, { waitUntil: "commit" });
    expect(response?.status(), `${from} should permanently redirect`).toBe(308);
    await expect(page).toHaveURL(new RegExp(`${to.replace("/", "\\/")}$`));
  }
});

test("authentication uses email and password without OAuth controls", async ({ page }) => {
  await page.goto("/auth/login");

  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await expect(page.getByText(/Google|OAuth/i)).toHaveCount(0);
});

test("account creation reaches email verification when Turnstile is not configured", async ({
  page,
}, testInfo) => {
  // Needs a reachable Auth API (local supabase or staged E2E_BASE_URL with real keys).
  test.skip(
    process.env.E2E_ALLOW_SIGNUP !== "1" && !process.env.E2E_BASE_URL,
    "Set E2E_ALLOW_SIGNUP=1 (local seeded Auth) or E2E_BASE_URL to exercise signup"
  );

  const email = `signup-${testInfo.project.name}-${Date.now()}@umich.edu`;
  await page.goto("/auth/signup");

  await page.getByLabel("Full name").fill("Signup Test");
  await page.getByLabel("UMich email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(`/auth/verify?email=${encodeURIComponent(email)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Check your inbox." })).toBeVisible();
});

test("public pages omit private hash details and individual email addresses", async ({ page }) => {
  await page.goto("/prospective-members");
  await expect(page.getByText(/App Hash|Group Hash/i)).toHaveCount(0);

  await page.goto("/our-team");
  const emailLinks = page.locator('a[href^="mailto:"]');
  await expect(emailLinks).toHaveCount(1);
  await expect(emailLinks).toHaveAttribute("href", "mailto:mecg-board@umich.edu");
});

test("signed-out visitors are redirected from every protected workspace", async ({ page }) => {
  for (const route of protectedRoutes) {
    await page.goto(route);
    await expect(page, `${route} should bounce to login`).toHaveURL((url) => {
      return (
        url.pathname === "/auth/login" && url.searchParams.get("next") === route
      );
    });
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  }
});

test("mobile navigation remains keyboard accessible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-webkit", "Mobile navigation coverage");
  await page.goto("/");

  const menuButton = page.getByRole("button", { name: "Open menu" });
  await menuButton.click();
  await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
  await expect(page.getByRole("link", { name: /About/ }).first()).toBeVisible();
});
