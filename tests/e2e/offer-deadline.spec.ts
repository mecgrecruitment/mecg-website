import { expect, test } from "@playwright/test";

const deadline = "2030-09-11T20:00:00.000Z";
test("pending deadline locks its captured date and success names the confirmed value", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let finish = () => {};
  const gate = new Promise<void>((resolve) => { finish = resolve; });
  let sent: unknown;
  await page.route("**/api/admin/decisions", async (route) => {
    sent = route.request().postDataJSON();
    await gate;
    await route.fulfill({ json: { kind: "deadline-set", applicationId: "synthetic-offer", expiresAt: deadline } });
  });
  await page.goto("/apply/test-harness/offer-deadline");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  const input = page.getByLabel("Offer deadline (Detroit time)");
  await input.fill("2030-09-11T16:00");
  await page.getByRole("button", { name: "Save deadline", exact: true }).click();
  await expect.poll(() => sent).toEqual({ action: "SET_DEADLINE", applicationId: "synthetic-offer", expiresAt: deadline });
  await expect(input).toBeDisabled();
  await page.keyboard.press("ArrowUp");
  await expect(input).toHaveValue("2030-09-11T16:00");
  finish();
  const result = page.getByLabel("Offer deadline save result", { exact: true });
  await expect(result).toContainText(/Deadline saved:.*2030/);
  await expect(result).toBeFocused();
  await expect(input).toBeEnabled();
  expect((await input.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("deadline-confirmed-mobile.png"), fullPage: true });
  await input.fill("2030-09-12T16:00");
  await expect(result).not.toContainText("Deadline saved:");
  await expect(page.getByText("Changes not saved.", { exact: true })).toBeVisible();
});

for (const failure of ["lost", "malformed", "wrong-application", "wrong-date", "headers-stalled", "body-stalled"] as const) {
  test(`deadline ${failure} preserves the proposal and locks another write pending readback`, async ({ page }, testInfo) => {
    if (failure === "malformed") await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.install();
    let writes = 0;
    let finish = () => {};
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    if (failure === "body-stalled") {
      await page.addInitScript(() => {
        const original = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          if (String(input).endsWith("/api/admin/decisions") && init?.method === "POST") {
            const response = new Response("", { status: 200 });
            response.json = () => new Promise(() => {});
            return response;
          }
          return original(input, init);
        };
      });
    } else {
      await page.route("**/api/admin/decisions", async (route) => {
        writes += 1;
        if (failure === "headers-stalled") await gate;
        if (failure === "lost" || failure === "headers-stalled") return route.abort("connectionreset").catch(() => {});
        return route.fulfill({ json: failure === "malformed" ? { ok: true } : { kind: "deadline-set", applicationId: failure === "wrong-application" ? "another-offer" : "synthetic-offer", expiresAt: failure === "wrong-date" ? "2030-09-12T20:00:00.000Z" : deadline } });
      });
    }
    await page.goto("/apply/test-harness/offer-deadline");
    await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
    const input = page.getByLabel("Offer deadline (Detroit time)");
    await input.fill("2030-09-11T16:00");
    await page.getByRole("button", { name: "Save deadline", exact: true }).click();
    if (failure.includes("stalled")) {
      await expect(page.getByRole("button", { name: "Saving…", exact: true })).toBeVisible();
      await page.clock.fastForward(15_001);
    }
    const result = page.getByLabel("Offer deadline save result", { exact: true });
    await expect(result).toContainText("The deadline save could not be confirmed");
    await expect(result).toContainText(/Proposed value:.*2030/);
    await page.clock.runFor(100);
    await expect(result).toBeFocused();
    await expect(input).toHaveValue("2030-09-11T16:00");
    await expect(input).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save deadline", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Reload current offer deadline", exact: true })).toBeEnabled();
    await expect(result).not.toContainText("Deadline saved:");
    await expect(page.getByText("Changes not saved.", { exact: true })).toHaveCount(0);
    if (failure !== "body-stalled") expect(writes).toBe(1);
    if (failure === "malformed") {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await page.screenshot({ path: testInfo.outputPath("deadline-unknown-mobile.png"), fullPage: true });
    }
    finish();
  });
}

test("clearing a deadline requires an explicit matching null receipt", async ({ page }) => {
  let captured: unknown;
  await page.route("**/api/admin/decisions", (route) => {
    captured = route.request().postDataJSON();
    return route.fulfill({ json: { kind: "deadline-set", applicationId: "synthetic-offer", expiresAt: null } });
  });
  await page.goto("/apply/test-harness/offer-deadline");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  await page.getByRole("button", { name: "Clear deadline", exact: true }).click();
  await expect(page.getByLabel("Offer deadline save result", { exact: true })).toContainText("Deadline cleared. This offer has no deadline.");
  expect(captured).toEqual({ action: "SET_DEADLINE", applicationId: "synthetic-offer", expiresAt: "" });
  await expect(page.getByLabel("Offer deadline (Detroit time)")).toHaveValue("");
});

test("a definite refusal keeps the proposed date editable for correction", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/admin/decisions", (route) => {
    writes += 1;
    return route.fulfill(writes === 1 ? { status: 409, json: { error: "Offer already answered" } } : { json: { kind: "deadline-set", applicationId: "synthetic-offer", expiresAt: deadline } });
  });
  await page.goto("/apply/test-harness/offer-deadline");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  const input = page.getByLabel("Offer deadline (Detroit time)");
  await input.fill("2030-09-11T16:00");
  const save = page.getByRole("button", { name: "Save deadline", exact: true });
  await save.click();
  await expect(page.getByLabel("Offer deadline save result", { exact: true })).toContainText("Offer already answered");
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue("2030-09-11T16:00");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByLabel("Offer deadline save result", { exact: true })).toContainText("Deadline saved:");
  expect(writes).toBe(2);
});

test("a nonexistent Detroit time is a correctable local error without a write", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/admin/decisions", (route) => { writes += 1; return route.fulfill({ json: {} }); });
  await page.goto("/apply/test-harness/offer-deadline");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  const input = page.getByLabel("Offer deadline (Detroit time)");
  await input.fill("2030-03-10T02:30");
  const save = page.getByRole("button", { name: "Save deadline", exact: true });
  await save.click();
  const result = page.getByLabel("Offer deadline save result", { exact: true });
  await expect(result).toContainText("does not exist because of daylight saving time");
  await expect(result).toBeFocused();
  await expect(input).toBeEnabled();
  await expect(save).toBeEnabled();
  expect(writes).toBe(0);
});
