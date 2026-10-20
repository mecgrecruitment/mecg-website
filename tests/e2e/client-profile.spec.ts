import { expect, test } from "@playwright/test";

test("on a phone, an organization's details open directly under the tapped logo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/work");
  const buttons = page.getByRole("button", { name: /^View information about / });
  const count = await buttons.count();
  expect(count).toBeGreaterThan(2);
  for (const index of [0, Math.floor(count / 2), count - 1]) {
    const button = buttons.nth(index);
    const name = (await button.getAttribute("aria-label"))!.replace("View information about ", "");
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    const detail = page.locator("#selected-client-profile");
    await expect(detail.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(detail).toContainText("pending approval for public release");
    const tile = await button.boundingBox();
    const panel = await detail.boundingBox();
    expect(panel!.y - (tile!.y + tile!.height)).toBeLessThan(tile!.height + 4);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("desktop organization controls expose the selected profile", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/work");
  const button = page.getByRole("button", { name: "View information about General Motors" });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#selected-client-profile").getByRole("heading", { name: "General Motors", exact: true })).toBeVisible();
});
