import { expect, test } from "@playwright/test";

const harness = "/apply/test-harness/usability";
async function open(page: import("@playwright/test").Page) {
  await page.goto(harness);
  await expect(page.locator("[data-application-harness-ready='true']")).toHaveCount(1);
}

test("conflict review names the applicant, preserves cancellation and acknowledges a delayed success", async ({ page }) => {
  const writes: unknown[] = [];
  await page.route("**/api/member/conflicts", async route => {
    writes.push(route.request().postDataJSON());
    await new Promise(resolve => setTimeout(resolve, 100));
    await route.fulfill({ status: 201, json: { ok: true } });
  });
  await open(page);
  await page.getByRole("combobox", { name: "Applicant", exact: true }).selectOption("sample-app");
  await page.getByLabel("Relationship or conflict reason", { exact: true }).fill("Prior close relationship");
  await page.getByRole("button", { name: "Review conflict", exact: true }).click();
  await expect(page.getByText("Declare a conflict for Sample Applicant?", { exact: true })).toBeFocused();
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review conflict", exact: true })).toBeFocused();
  await expect(page.getByLabel("Relationship or conflict reason", { exact: true })).toHaveValue("Prior close relationship");
  await page.getByRole("button", { name: "Review conflict", exact: true }).click();
  await page.getByRole("button", { name: "Confirm conflict", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Conflict declared." })).toBeVisible();
  expect(writes).toEqual([{ applicationId: "sample-app", reason: "Prior close relationship" }]);
  await expect(page.locator(".operation-notice[role=alert]")).toHaveCount(0);
  await expect(page.getByLabel("Relationship or conflict reason", { exact: true })).toHaveValue("");
});

test("member chat publishing acknowledges success after the response and resets the form", async ({ page }) => {
  const writes: { cycleId: string; startsAt: string; endsAt: string }[] = [];
  await page.route("**/api/member/buddy", async route => {
    writes.push(route.request().postDataJSON());
    await new Promise(resolve => setTimeout(resolve, 100));
    await route.fulfill({ json: { ok: true } });
  });
  await open(page);
  await page.getByLabel(/^Start time/).fill("2030-11-01T14:00");
  await page.getByRole("button", { name: "Publish slot", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your 20-minute slot is published." })).toBeVisible();
  const payload = writes[0];
  expect(payload?.cycleId).toBe("sample-a");
  expect(new Date(payload?.endsAt ?? "").getTime() - new Date(payload?.startsAt ?? "").getTime()).toBe(20 * 60 * 1000);
  await expect(page.getByLabel(/^Start time/)).toHaveValue("");
  await expect(page.locator(".operation-notice[role=alert]")).toHaveCount(0);
});

for (const action of ["conflict", "slot"] as const) for (const outcome of ["malformed", "lost"] as const) {
  test(`${action} ${outcome} acknowledgement preserves input and blocks duplicate submission`, async ({ page }) => {
    let writes = 0;
    await page.route(`**/api/member/${action === "conflict" ? "conflicts" : "buddy"}`, route => { writes += 1; return outcome === "lost" ? route.abort("failed") : route.fulfill({ json: {} }); });
    await open(page);
    if (action === "conflict") {
      await page.getByRole("combobox", { name: "Applicant", exact: true }).selectOption("sample-app");
      await page.getByLabel("Relationship or conflict reason", { exact: true }).fill("Prior close relationship");
      await page.getByRole("button", { name: "Review conflict", exact: true }).click();
      await page.getByRole("button", { name: "Confirm conflict", exact: true }).click();
      await expect(page.getByLabel("Relationship or conflict reason", { exact: true })).toHaveValue("Prior close relationship");
      await expect(page.getByRole("button", { name: "Review conflict", exact: true })).toBeDisabled();
    } else {
      await page.getByLabel(/^Start time/).fill("2030-11-01T14:00");
      await page.getByRole("button", { name: "Publish slot", exact: true }).click();
      await expect(page.getByLabel(/^Start time/)).toHaveValue("2030-11-01T14:00");
      await expect(page.getByRole("button", { name: "Publish slot", exact: true })).toBeDisabled();
    }
    await expect(page.getByRole("alert").filter({ hasText: /could not be confirmed/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Reload to check/ })).toBeVisible();
    expect(writes).toBe(1);
  });
}

test("profile fields cannot drift from the pending save", async ({ page }) => {
  let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/member/profile", async route => { await gate; await route.fulfill({ json: { ok: true } }); });
  await open(page);
  await page.getByLabel("Display name", { exact: true }).fill("Updated Member");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByLabel("Display name", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Short bio", { exact: true })).toBeDisabled();
  release();
  await expect(page.getByText("Profile saved.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Display name", { exact: true })).toBeEnabled();
});

test("mobile cohort changes close navigation and Escape returns focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await menu.click();
  await page.getByRole("combobox", { name: "Cohort", exact: true }).focus();
  // Model the committed query update without leaving this gated synthetic route.
  // The cohort suite separately exercises the real switcher's authorized URLs.
  await page.evaluate(() => window.history.pushState(null, "", "?cycleId=sample-b"));
  await expect.poll(() => new URL(page.url()).searchParams.get("cycleId")).toBe("sample-b");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
  await menu.click(); await expect(page.getByRole("button", { name: "Close menu", exact: true })).toHaveAttribute("aria-expanded", "true"); await page.keyboard.press("Escape");
  await expect(menu).toBeFocused(); await expect(menu).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("selected section scrolls the strip without moving the page", async ({ page }) => {
  await open(page);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  const selected = page.getByRole("link", { name: "Section 12", exact: true });
  const navigation = page.getByRole("navigation", { name: "Sample section navigation", exact: true });
  const link = await selected.boundingBox(); const strip = await navigation.boundingBox();
  expect(link).not.toBeNull(); expect(strip).not.toBeNull();
  expect(link?.x).toBeGreaterThanOrEqual(strip?.x ?? 0);
  expect((link?.x ?? 0) + (link?.width ?? 0)).toBeLessThanOrEqual((strip?.x ?? 0) + (strip?.width ?? 0) + 1);
});


test("an unconfirmed profile save keeps changes available for a deliberate retry", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/member/profile", route => { attempts += 1; return route.fulfill({ json: attempts === 1 ? {} : { ok: true } }); });
  await open(page);
  await page.getByLabel("Display name", { exact: true }).fill("Unsaved sample name");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "profile save could not be confirmed" })).toBeVisible();
  await expect(page.getByText("Profile saved.", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Unsaved sample name");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Profile saved.", { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});

test("shared navigation and applicant refresh provide 44px touch targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  for (const target of [menu, page.getByRole("link", { name: "MECG home", exact: true }), page.getByRole("button", { name: "Check now", exact: true })]) {
    expect((await target.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  expect((await menu.boundingBox())?.width).toBeGreaterThanOrEqual(44);
  await menu.click();
  expect((await page.getByRole("link", { name: "Back to public site", exact: true }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
});
