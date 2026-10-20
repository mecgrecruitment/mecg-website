import { expect, test } from "@playwright/test";

for (const outcome of ["lost", "stalled"] as const) {
  test(`${outcome} release acknowledgement discards the old confirmation and requires a fresh review`, async ({ page }) => {
    if (outcome === "stalled") await page.clock.install();
    let finish = () => {};
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    let released = false;
    let writes = 0;
    await page.route("**/api/admin/decisions", async (route) => {
      if (route.request().postDataJSON().action === "RELEASE_PREFLIGHT") return route.fulfill({ json: { items: released ? [] : [{ decisionId: "synthetic-decision", applicationId: "synthetic-app", outcome: "OFFER", reasonCode: null }], applicantLabels: { "synthetic-app": "Applicant ABC123" } } });
      writes += 1;
      released = true; // Models the write committing before acknowledgement is lost.
      if (outcome === "stalled") await gate;
      await route.abort("connectionreset").catch(() => {});
    });
    await page.goto("/apply/test-harness/release");
    await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
    await page.getByRole("button", { name: "Review 1 locked outcome", exact: true }).click();
    await page.getByRole("button", { name: "Release 1 eligible outcome", exact: true }).click();
    await expect.poll(() => writes).toBe(1);
    if (outcome === "stalled") await page.clock.fastForward(15_001);
    await expect(page.getByRole("alert").filter({ hasText: "release result is unknown" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Confirm release cohort" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Release 1 eligible outcome", exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: "Review 1 locked outcome", exact: true }).click();
    await expect(page.getByText("0 locked outcomes: 0 eligible, 0 blocked.", { exact: false })).toBeVisible();
    expect(writes).toBe(1);
    finish();
  });
}
