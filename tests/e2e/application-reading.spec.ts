import { expect, test } from "@playwright/test";

test("Board evidence stays available and decision input survives section toggles", async ({ page }) => {
  await page.goto("/apply/test-harness/reading");
  await expect(page.locator("[data-application-harness-ready='true']")).toHaveCount(1);
  const application = page.getByRole("region", { name: "Application responses" });
  const rationale = page.getByRole("textbox", { name: "Decision rationale" });
  await rationale.fill("Observations retained while consulting the original application.");
  await page.getByText("Decision & approvals", { exact: true }).click();
  await expect(rationale).toBeHidden();
  await expect(application).toBeVisible();
  await page.getByText("Activity history", { exact: true }).click();
  await expect(page.getByText("Fictional application submitted.", { exact: true })).toBeVisible();
  await page.getByText("Decision & approvals", { exact: true }).click();
  await expect(rationale).toHaveValue("Observations retained while consulting the original application.");
  await page.getByRole("link", { name: "Resume", exact: true }).click();
  await page.locator("#resume summary").click();
  await expect(page.getByText("No resume attached to this fictional application.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
