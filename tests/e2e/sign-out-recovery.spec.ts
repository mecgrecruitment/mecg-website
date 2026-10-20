import { expect, test } from "@playwright/test";

test("rejected sign-out stays reachable, announces uncertainty and can retry", async ({ page }) => {
  await page.goto("/apply/test-harness/sign-out");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  await page.getByRole("button", { name: "Sign out", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "Sign-out could not be confirmed" })).toContainText("Sign-out could not be confirmed");
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeFocused();
  await expect(page.getByRole("region", { name: "Synthetic navigation" })).toBeVisible();
  await page.getByRole("combobox", { name: "Provider response" }).selectOption("success");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByText("Navigation closed after acknowledgement.")).toBeVisible();
});

test("unacknowledged sign-out restores retry after its deadline", async ({ page }) => {
  await page.clock.install();
  await page.goto("/apply/test-harness/sign-out");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  await page.getByRole("combobox", { name: "Provider response" }).selectOption("pending");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Signing out…" })).toBeDisabled();
  await page.clock.fastForward(15_001);
  await expect(page.getByRole("alert").filter({ hasText: "Sign-out could not be confirmed" })).toContainText("Sign-out could not be confirmed");
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled();
  await expect(page.getByRole("region", { name: "Synthetic navigation" })).toBeVisible();
});
