import { expect, test, type Page } from "@playwright/test";
const inquiry = { name: "Synthetic client", email: "client@example.invalid", subject: "A semester project", message: "We need to understand our customer research options." };
async function fillInquiry(page: Page) {
  await page.goto("/contact#message");
  await page.getByLabel("Name", { exact: true }).fill(inquiry.name);
  await page.getByLabel("Email", { exact: true }).fill(inquiry.email);
  await page.getByLabel("Subject", { exact: true }).fill(inquiry.subject);
  await page.getByLabel("Message", { exact: true }).fill(inquiry.message);
}
test("sending locks the submitted version until its delayed acknowledgement", async ({ page }) => {
  let complete: () => void = () => {};
  const pending = new Promise<void>((resolve) => { complete = resolve; });
  const requests: unknown[] = [];
  await page.route("**/api/contact", async (route) => { requests.push(route.request().postDataJSON()); await pending; await route.fulfill({ json: { ok: true } }); });
  await fillInquiry(page);
  await page.getByRole("button", { name: "Send message" }).click();
  for (const label of ["Name", "Email", "Subject", "Message"]) await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sending…" })).toBeDisabled();
  expect(requests).toEqual([{ ...inquiry, website: "", requestId: expect.stringMatching(/^[0-9a-f-]{36}$/) }]);
  complete();
  await expect(page.getByRole("status")).toContainText("Your message was sent");
  await expect(page.getByLabel("Message", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("");
});
for (const outcome of ["rejected", "lost", "malformed"] as const) {
  test(`${outcome} inquiry acknowledgement preserves answers and restores editing`, async ({ page }) => {
    await page.route("**/api/contact", async (route) => {
      if (outcome === "lost") await route.abort("connectionreset");
      else await route.fulfill(outcome === "rejected" ? { status: 502, json: { error: "Delivery unavailable" } } : { json: { delivered: true } });
    });
    await fillInquiry(page);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("alert").filter({ hasText: outcome === "rejected" ? "Delivery unavailable" : "Delivery could not be confirmed" })).toBeVisible();
    await expect(page.getByLabel("Message", { exact: true })).toHaveValue(inquiry.message);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(inquiry.name);
    await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
    await expect(page.getByLabel("Message", { exact: true })).toBeEnabled();
    if (outcome !== "rejected") await expect(page.getByRole("alert").filter({ hasText: "Delivery could not be confirmed" })).toContainText("Delivery could not be confirmed");
  });
}
test("the inquiry form is usable through keyboard focus and native submission", async ({ page }) => {
  await page.route("**/api/contact", (route) => route.fulfill({ json: { ok: true } }));
  await page.goto("/contact");
  for (let count = 0; count < 24 && !await page.getByLabel("Name", { exact: true }).evaluate((element) => element === document.activeElement); count++) await page.keyboard.press("Tab");
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await page.keyboard.type(inquiry.name);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await page.keyboard.type(inquiry.email);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Subject", { exact: true })).toBeFocused();
  await page.keyboard.type(inquiry.subject);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Message", { exact: true })).toBeFocused();
  await page.keyboard.type(inquiry.message);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Send message" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Your message was sent");
});

test("a stalled inquiry times out without losing its written message", async ({ page }) => {
  await page.clock.install();
  let finish: () => void = () => {};
  const gate = new Promise<void>((resolve) => { finish = resolve; });
  let requested = false;
  await page.route("**/api/contact", async (route) => { requested = true; await gate; await route.abort().catch(() => {}); });
  await fillInquiry(page);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect.poll(() => requested).toBe(true);
  await page.clock.fastForward(15_001);
  await expect(page.getByRole("alert").filter({ hasText: "Delivery could not be confirmed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(inquiry.message);
  finish();
});

test("whitespace validation identifies and focuses the field while preserving the inquiry", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/contact", (route) => { requests += 1; return route.fulfill({ json: { ok: true } }); });
  await fillInquiry(page);
  await page.getByLabel("Name", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Name", { exact: true })).toHaveAccessibleDescription("Enter your name, up to 100 characters.");
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(inquiry.message);
  expect(requests).toBe(0);
  await page.getByLabel("Name", { exact: true }).fill(inquiry.name);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText("Your message was sent");
});

test("server field errors unlock, associate and focus the invalid control", async ({ page }) => {
  await page.route("**/api/contact", (route) => route.fulfill({ status: 400, json: { error: "Check the highlighted fields and try again.", fields: { subject: "Use a single-line subject." } } }));
  await fillInquiry(page);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByLabel("Subject", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveAccessibleDescription("Use a single-line subject.");
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(inquiry.message);
});

test("an unchanged uncertain retry reuses its delivery key; editing starts a new intent", async ({ page }) => {
  const requests: { requestId: string }[] = [];
  await page.route("**/api/contact", async (route) => { requests.push(route.request().postDataJSON()); await route.abort("connectionreset"); });
  await fillInquiry(page);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Delivery could not be confirmed" })).toBeVisible();
  }
  expect(requests[0].requestId).toBe(requests[1].requestId);
  await page.getByLabel("Subject", { exact: true }).fill("A different project");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Delivery could not be confirmed" })).toBeVisible();
  expect(requests).toHaveLength(3);
  expect(requests[2].requestId).not.toBe(requests[0].requestId);
});
