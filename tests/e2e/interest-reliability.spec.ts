import { expect, test, type Page } from "@playwright/test";

async function fillInterest(page: Page) {
  await page.goto("/apply/test-harness/interest");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  await page.getByRole("textbox", { name: "Full name", exact: true }).fill("Synthetic student");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("student@example.invalid");
}

for (const result of ["confirmed", "malformed", "rejected"] as const) {
  test(`interest signup ${result} receipt preserves truthful form state`, async ({ page }) => {
    await page.route("**/api/interest", (route) => route.fulfill(result === "confirmed" ? { json: { ok: true } } : result === "rejected" ? { status: 409, json: { error: "Recruitment is not open. Email the Board." } } : { json: { saved: true } }));
    await fillInterest(page);
    await page.getByRole("button", { name: "Join the interest list", exact: true }).click();
    if (result === "confirmed") {
      await expect(page.getByRole("status")).toContainText("You're on the list");
      await expect(page.getByRole("textbox", { name: "Full name", exact: true })).toHaveValue("");
    } else {
      await expect(page.getByRole("alert").filter({ hasText: result === "rejected" ? "Recruitment is not open" : "signup could not be confirmed" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Full name", exact: true })).toHaveValue("Synthetic student");
      await expect(page.getByRole("button", { name: "Join the interest list", exact: true })).toBeEnabled();
    }
  });
}

test("stalled interest signup unlocks with answers intact and an honest uncertainty message", async ({ page }) => {
  await page.clock.install();
  let finish = () => {};
  const gate = new Promise<void>((resolve) => { finish = resolve; });
  let requested = false;
  await page.route("**/api/interest", async (route) => { requested = true; await gate; await route.abort().catch(() => {}); });
  await fillInterest(page);
  await page.getByRole("button", { name: "Join the interest list", exact: true }).click();
  await expect.poll(() => requested).toBe(true);
  await expect(page.getByRole("textbox", { name: "Full name", exact: true })).toBeDisabled();
  await page.clock.fastForward(15_001);
  await expect(page.getByRole("alert").filter({ hasText: "signup could not be confirmed" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Full name", exact: true })).toHaveValue("Synthetic student");
  await expect(page.getByRole("button", { name: "Join the interest list", exact: true })).toBeEnabled();
  finish();
});
