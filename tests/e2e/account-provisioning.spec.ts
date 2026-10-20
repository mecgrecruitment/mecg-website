import { expect, test } from "@playwright/test";

for (const action of ["ADD_USER", "ADD_EXISTING_USER"] as const) {
  for (const outcome of ["lost", "malformed", "stalled"] as const) {
    test(`${action} ${outcome} acknowledgement preserves details and offers cycle-scoped reconciliation`, async ({ page }) => {
      if (outcome === "stalled") await page.clock.install();
      let finish = () => {};
      const gate = new Promise<void>((resolve) => { finish = resolve; });
      let writes = 0;
      await page.route("**/api/admin/rush", async (route) => {
        expect(route.request().postDataJSON()).toMatchObject({ action, cycleId: "synthetic-owner-cycle" });
        writes += 1; // The fixture represents commit before acknowledgement loss.
        if (outcome === "stalled") await gate;
        if (outcome === "malformed") await route.fulfill({ status: 201, json: {} });
        else await route.abort("connectionreset").catch(() => {});
      });
      await page.goto("/apply/test-harness/people");
      await page.getByRole("tab", { name: "Access", exact: true }).click();
      await page.getByRole("button", { name: "Add person", exact: true }).click();
      const form = page.locator("form").filter({ has: page.getByRole("heading", { name: action === "ADD_USER" ? "Create a new account" : "Add an existing account", exact: true }) });
      if (action === "ADD_USER") {
        await form.getByLabel("Full name", { exact: true }).fill("Synthetic Owner Test");
        await form.getByLabel("Temporary password", { exact: true }).fill("Synthetic-temp-pass-11");
      }
      await form.getByLabel("Email", { exact: true }).fill("person@example.invalid");
      await expect(form.getByLabel("Role", { exact: true })).toBeVisible();
      await form.getByRole("button", { name: action === "ADD_USER" ? "Create account" : "Add to cycle", exact: true }).click();
      await expect.poll(() => writes).toBe(1);
      if (outcome === "stalled") {
        await expect(form.getByLabel("Email", { exact: true })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Close", exact: true })).toBeDisabled();
        await page.clock.fastForward(15_001);
      }
      await expect(page.getByRole("alert").filter({ hasText: "Account setup could not be confirmed" })).toBeVisible();
      await expect(form.getByLabel("Email", { exact: true })).toHaveValue("person@example.invalid");
      await expect(form.getByLabel("Email", { exact: true })).toBeEnabled();
      if (action === "ADD_USER") await expect(form.getByLabel("Temporary password", { exact: true })).toHaveValue("Synthetic-temp-pass-11");
      await expect(page.getByRole("link", { name: /Open account recovery/ })).toHaveAttribute("href", "/admin/provisioning?cycleId=synthetic-owner-cycle");
      await expect(page.getByRole("link", { name: /Check cycle access/ })).toHaveAttribute("href", "/admin/people?cycleId=synthetic-owner-cycle");
      await expect(page.getByRole("link", { name: /Check Clerk account/ })).toHaveAttribute("target", "_blank");
      expect(writes).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      finish();
    });
  }
}

test("People tabs use associated panels and keyboard navigation without discarding account details", async ({ page }) => {
  await page.goto("/apply/test-harness/people");
  const directory = page.getByRole("tab", { name: /Directory/ });
  await directory.focus(); await page.keyboard.press("End");
  const access = page.getByRole("tab", { name: "Access", exact: true });
  await expect(access).toBeFocused();
  await expect(access).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Access", exact: true })).toBeVisible();
  await page.keyboard.press("Home"); await expect(directory).toBeFocused();
  await page.keyboard.press("ArrowLeft"); await expect(access).toBeFocused();
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  const form = page.locator("form").filter({ has: page.getByRole("heading", { name: "Create a new account", exact: true }) });
  await form.getByLabel("Full name", { exact: true }).fill("Retained synthetic person");
  await access.focus(); await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Onboarding/ })).toBeFocused();
  await page.keyboard.press("ArrowRight"); await expect(access).toBeFocused();
  await expect(form.getByLabel("Full name", { exact: true })).toHaveValue("Retained synthetic person");
  await expect(directory).toHaveAttribute("tabindex", "-1");
  await expect(access).toHaveAttribute("tabindex", "0");
});

test("only a verified account receipt resets the form and announces access confirmation", async ({ page }) => {
  await page.route("**/api/admin/rush", (route) => route.fulfill({ status: 201, json: { id: "synthetic-membership" } }));
  await page.goto("/apply/test-harness/people");
  await page.getByRole("tab", { name: "Access", exact: true }).click();
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  const form = page.locator("form").filter({ has: page.getByRole("heading", { name: "Add an existing account", exact: true }) });
  await form.getByLabel("Email", { exact: true }).fill("person@example.invalid");
  await form.getByRole("button", { name: "Add to cycle", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Account access confirmed" })).toBeVisible();
  await expect(form.getByLabel("Email", { exact: true })).toHaveValue("");
});
