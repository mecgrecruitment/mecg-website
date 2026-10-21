import { expect, test, type Page } from "@playwright/test";

// The harness page waits 600 ms on the server, like a slow workspace read.
// Prefetching only runs in a production build, so these timings need `next start`.
test.skip(process.env.NAVIGATION_TIMING !== "1", "Set NAVIGATION_TIMING=1 against a production build.");

// A link joins the prefetch queue once it is seen on screen, which its viewport
// prefetch request proves. A person cannot point at a link sooner than that.
async function arrive(page: Page, step: number) {
  const seen = page.waitForRequest((request) => request.url().includes(`/navigation/${step + 1}`) && "next-router-prefetch" in request.headers());
  await page.goto(`/apply/test-harness/navigation/${step}`);
  await expect(page.getByRole("heading", { name: `Navigation step ${step}` })).toBeVisible();
  await seen;
}

async function msUntilHeading(page: Page, step: number, click: () => Promise<void>) {
  const started = Date.now();
  await click();
  await expect(page.getByRole("heading", { name: `Navigation step ${step}` })).toBeVisible({ timeout: 5_000 });
  return Date.now() - started;
}

test("a workspace link the pointer rests on opens without waiting for the server", async ({ page, isMobile }) => {
  test.skip(isMobile, "Hover intent is a pointer behaviour; touch is covered below.");
  await arrive(page, 1);
  const link = page.getByRole("link", { name: "Workspace link to step 2" });
  // The hover fetch is the full page: an RSC request without the partial-prefetch header.
  const prefetched = page.waitForRequest((request) => request.url().includes("/navigation/2") && request.headers().rsc === "1" && !("next-router-prefetch" in request.headers()));
  await link.hover();
  await prefetched;
  // The pointer rests as long as the server takes; the streamed body never reports done to Playwright.
  await page.waitForTimeout(800);
  const elapsed = await msUntilHeading(page, 2, () => link.click());
  console.log(`hovered workspace link: ${elapsed} ms`);
  expect(elapsed).toBeLessThan(250);
});

test("a plain link still waits for the server, which is what the workspace link removes", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop comparison only.");
  await arrive(page, 1);
  const link = page.getByRole("link", { name: "Plain link to step 3" });
  await link.hover();
  await page.waitForTimeout(800);
  const elapsed = await msUntilHeading(page, 3, () => link.click());
  console.log(`hovered plain link: ${elapsed} ms`);
  expect(elapsed).toBeGreaterThan(500);
});

test("a tapped workspace link starts loading on touch and shows progress until it lands", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Touch only.");
  await arrive(page, 1);
  const link = page.getByRole("link", { name: "Workspace link to step 2" });
  const progress = page.waitForFunction(() => document.documentElement.hasAttribute("data-navigating"));
  const elapsed = await msUntilHeading(page, 2, () => link.tap());
  await progress;
  console.log(`tapped workspace link: ${elapsed} ms`);
  await expect.poll(() => page.evaluate(() => document.documentElement.hasAttribute("data-navigating"))).toBe(false);
});

test("opening the phone menu loads its pages, so a tapped menu link opens at once", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The menu collapses only on narrow screens.");
  await arrive(page, 1);
  const prefetched = page.waitForRequest((request) => request.url().includes("/navigation/11") && request.headers().rsc === "1" && !("next-router-prefetch" in request.headers()));
  await page.getByRole("button", { name: "Menu" }).tap();
  await prefetched;
  await page.waitForTimeout(800);
  const elapsed = await msUntilHeading(page, 11, () => page.getByRole("link", { name: "Sidebar step 11" }).tap());
  console.log(`tapped menu link: ${elapsed} ms`);
  expect(elapsed).toBeLessThan(250);
});
