import { expect, test } from "@playwright/test";

test("applicant can advance through failed autosave and reconcile an interrupted submit", async ({ page }) => {
  await page.route("**/api/apply/draft", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily unavailable" }) });
  });
  await page.route("**/api/apply", async (route) => {
    await route.abort("connectionreset");
  });
  let statusReads = 0;
  await page.route("**/api/apply/status", async (route) => {
    statusReads += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ application: { applicationId: "e2e", status: statusReads >= 3 ? "SUBMITTED" : "DRAFT", submitted: statusReads >= 3 } }),
    });
  });
  await page.route("**/applicant**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Submitted</title><h1>Submitted</h1>" });
  });

  await page.goto("/apply/test-harness");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByRole("heading", { name: "Tell us how you think." })).toBeVisible();
  await expect(page.locator('[role="alert"]:visible').filter({ hasText: "could not save" })).toBeVisible();

  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByRole("heading", { name: "Add your materials." })).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByRole("heading", { name: "Review before you submit." })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit application" }).click();

  await expect(page).toHaveURL(/\/applicant\?submitted=1$/);
  expect(statusReads).toBe(3);
});
