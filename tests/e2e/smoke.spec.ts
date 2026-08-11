import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/about",
  "/our-team",
  "/client-services",
  "/prospective-members",
  "/socials",
  "/contact",
  "/services",
  "/team",
  "/placement",
  "/recruitment",
  "/trek",
  "/portal",
  "/member-login",
];

test("public site and primary navigation are available", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/MECG/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Multifaceted.*Driven.*Inclusive/i })
  ).toBeVisible();
  if (testInfo.project.name === "mobile-webkit") {
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  } else {
    await expect(page.getByRole("link", { name: "Portal", exact: true })).toBeVisible();
  }
});

test("portal exposes applicant and member paths", async ({ page }) => {
  await page.goto("/portal");

  await expect(page.getByRole("heading", { level: 1, name: "Choose your path." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Apply \/ Create Account/ })).toHaveAttribute(
    "href",
    "/apply/create"
  );
  await expect(page.getByRole("link", { name: /Member Login/ })).toHaveAttribute(
    "href",
    "/member-login"
  );
});

test("all public routes render without HTTP or horizontal-overflow failures", async ({ page }) => {
  for (const route of publicRoutes) {
    const response = await page.goto(route);
    expect(response?.status(), `${route} returned an error`).toBeLessThan(400);
    await expect(page.locator("body"), `${route} rendered no content`).not.toBeEmpty();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `${route} overflows the viewport`).toBeLessThanOrEqual(1);
  }
});

test("authentication uses email and password without OAuth controls", async ({ page }) => {
  await page.goto("/auth/login");

  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await expect(page.getByText(/Google|OAuth/i)).toHaveCount(0);
});

test("signed-out visitors cannot open protected workspaces", async ({ page }) => {
  await page.goto("/internal");

  await expect(page).toHaveURL(/\/auth\/login\?next=%2Finternal$/);
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
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
