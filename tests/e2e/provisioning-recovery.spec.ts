import { expect, test } from "@playwright/test";
const endpoint = "**/api/admin/provisioning/*/resolve";
test("cancelled incident resolution makes no request", async ({ page }) => {
  let writes = 0;
  await page.route(endpoint, async (route) => { writes++; await route.fulfill({ json: { resolved: true } }); });
  await page.goto("/apply/test-harness/provisioning");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  page.once("dialog", async (dialog) => { expect(dialog.message()).toContain("does not repair or delete an account"); await dialog.dismiss(); });
  await page.getByRole("button", { name: "Mark resolved" }).click();
  await expect(page.getByRole("button", { name: "Mark resolved" })).toBeEnabled();
  expect(writes).toBe(0);
});
test("an explicit resolution receipt confirms the incident exactly once", async ({ page }) => {
  let writes = 0;
  await page.route(endpoint, async (route) => { writes++; await route.fulfill({ json: { resolved: true } }); });
  await page.goto("/apply/test-harness/provisioning");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  page.once("dialog", async (dialog) => { await dialog.accept(); });
  await page.getByRole("button", { name: "Mark resolved" }).click();
  await expect(page.getByRole("button", { name: "Resolution recorded" })).toBeDisabled();
  expect(writes).toBe(1);
});
for (const outcome of ["lost response", "invalid receipt"] as const) {
  test(`${outcome} requires reconciliation and preserves retry`, async ({ page }) => {
    await page.route(endpoint, async (route) => {
      if (outcome === "lost response") await route.abort("connectionreset");
      else await route.fulfill({ json: { ok: true } });
    });
    await page.goto("/apply/test-harness/provisioning");
    await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
    page.once("dialog", async (dialog) => { await dialog.accept(); });
    await page.getByRole("button", { name: "Mark resolved" }).click();
    await expect(page.getByText(/Resolution could not be confirmed/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark resolved" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Resolution recorded" })).not.toBeVisible();
  });
}

test("stalled incident resolution restores an explicit unknown-outcome recovery", async ({ page }) => {
  await page.clock.install();
  let finish = () => {};
  const gate = new Promise<void>((resolve) => { finish = resolve; });
  let requested = false;
  await page.route(endpoint, async (route) => { requested = true; await gate; await route.abort().catch(() => {}); });
  await page.goto("/apply/test-harness/provisioning");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Mark resolved" }).click();
  await expect.poll(() => requested).toBe(true);
  await expect(page.getByRole("button", { name: "Recording resolution…" })).toBeDisabled();
  await page.clock.fastForward(15_001);
  await expect(page.getByText(/Resolution could not be confirmed/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark resolved" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Resolution recorded" })).not.toBeVisible();
  finish();
});
