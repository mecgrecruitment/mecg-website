import { expect, test } from "@playwright/test";

test("rubric errors explain every disabled-save condition at its field", async ({ page }) => {
  await page.goto("/apply/test-harness/rubric");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  const names = page.getByRole("textbox", { name: "Name", exact: true });
  const keys = page.getByRole("textbox", { name: "Key", exact: true });
  const weights = page.getByRole("spinbutton", { name: "Weight", exact: true });
  await names.first().fill("   ");
  await expect(names.first()).toHaveAttribute("aria-invalid", "true");
  await expect(names.first()).toHaveAccessibleDescription("Enter a name for this criterion.");
  await keys.last().fill("analysis");
  for (const key of await keys.all()) {
    await expect(key).toHaveAttribute("aria-invalid", "true");
    await expect(key).toHaveAccessibleDescription("Each criterion needs a different key.");
  }
  await weights.first().fill("1.5");
  await expect(weights.first()).toHaveAccessibleDescription("Enter a whole-number weight from 1 to 100.");
  await expect(page.getByRole("button", { name: "Save scoring guide", exact: true })).toBeDisabled();
  await expect(page.getByText("Fix the highlighted fields before saving the scoring guide.")).toBeVisible();
  await keys.last().fill("Bad key");
  await expect(keys.last()).toHaveAccessibleDescription("Use up to 80 lowercase letters, digits and underscores, starting with a letter.");
  await expect(keys.first()).toHaveAttribute("aria-invalid", "false");
  await names.first().fill("Analysis");
  await keys.last().fill("clarity");
  await weights.first().fill("50");
  await expect(page.getByRole("button", { name: "Save scoring guide", exact: true })).toBeEnabled();
});

test("saving freezes the exact rubric until a rejected write restores editing", async ({ page }) => {
  let finish = () => {};
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const writes: unknown[] = [];
  await page.route("**/api/admin/rush", async (route) => { writes.push(route.request().postDataJSON()); await pending; await route.fulfill({ status: 409, json: { error: "The round changed. Reload before saving." } }); });
  await page.goto("/apply/test-harness/rubric");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  await page.getByRole("button", { name: "Save scoring guide", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: "Name", exact: true }).first()).toBeDisabled();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(writes).toHaveLength(1);
  finish();
  await expect(page.getByRole("alert").filter({ hasText: "The round changed" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Name", exact: true }).first()).toBeEnabled();
  await expect(page.getByRole("textbox", { name: "Name", exact: true }).first()).toHaveValue("Analysis");
});
