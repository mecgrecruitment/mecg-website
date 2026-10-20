import { expect, test } from "@playwright/test";

test("explicit synthetic draft survives navigation targets without losing filters or anchors", async ({ page }, testInfo) => {
  await page.goto("/apply/test-harness/cohort?cycleId=draft-cycle");
  await expect(page.getByRole("combobox", { name: "Cohort", exact: true })).toHaveValue("draft-cycle");
  await expect(page.getByRole("link", { name: "Recruitment", exact: true })).toHaveAttribute("href", "/admin?filter=pending&cycleId=draft-cycle#applicants");
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toHaveAttribute("href", "/admin/settings?section=dates&cycleId=draft-cycle#window");
  await expect(page.getByText(/Only one unfinished cycle is allowed/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("authorized-cohort-switcher.png"), fullPage: true });
});

test("cohort switch preserves the actual workspace URL query and hash", async ({ page }) => {
  await page.goto("/apply/test-harness/cohort?cycleId=live-cycle");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  // Native history is supported by the App Router. Keep the synthetic mounted
  // controls while modeling an authenticated settings URL, never a hosted page.
  await page.evaluate(() => window.history.replaceState(null, "", "/admin/settings?section=dates&cycleId=live-cycle#window"));
  await page.route("**/admin/settings?**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><h1>Synthetic selected workspace</h1>" }));
  await page.getByRole("combobox", { name: "Cohort", exact: true }).selectOption("draft-cycle");
  await expect.poll(() => new URL(page.url()).searchParams.get("cycleId")).toBe("draft-cycle");
  expect(new URL(page.url()).searchParams.get("section")).toBe("dates");
  expect(new URL(page.url()).hash).toBe("#window");
});

test("successful clone navigates to its returned cohort settings", async ({ page }) => {
  const requests: unknown[] = [];
  await page.route("**/api/admin/rush", async (route) => { requests.push(route.request().postDataJSON()); await route.fulfill({ status: 201, json: { id: "draft-cycle" } }); });
  await page.route("**/admin/settings?**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><h1>Synthetic cloned settings</h1>" }));
  await page.goto("/apply/test-harness/cohort?cycleId=old-cycle");
  await page.getByRole("textbox", { name: "New cycle name" }).fill("Synthetic next cohort");
  await page.getByRole("button", { name: "Clone this cycle", exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search).toBe("/admin/settings?cycleId=draft-cycle");
  expect(requests).toEqual([{ cycleId: "old-cycle", action: "CLONE_CYCLE", name: "Synthetic next cohort" }]);
});

test("an unconfirmed clone destination cannot navigate as though creation were acknowledged", async ({ page }) => {
  await page.route("**/api/admin/rush", (route) => route.fulfill({ status: 201, json: { ok: true } }));
  await page.goto("/apply/test-harness/cohort?cycleId=old-cycle");
  await page.getByRole("textbox", { name: "New cycle name" }).fill("Unconfirmed next cohort");
  await page.getByRole("button", { name: "Clone this cycle", exact: true }).click();
  await expect(page.getByText(/destination could not be confirmed/)).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/apply/test-harness/cohort");
});

for (const query of ["cycleId=foreign-cycle", "cycle=old-cycle&cycleId=draft-cycle"]) test(`synthetic unauthorized/conflicting selector ${query} fails closed`, async ({ page }) => {
  const response = await page.goto(`/apply/test-harness/cohort?${query}`);
  expect([200, 404]).toContain(response?.status());
  await expect(page.getByRole("heading", { name: "This page does not exist.", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clone this cycle", exact: true })).toHaveCount(0);
});


test("event creation targets the selected cohort and keeps its returned QR context", async ({ page }) => {
  let body: { cycleId?: string } | undefined;
  await page.route("**/api/admin/events", async (route) => { body = route.request().postDataJSON(); await route.fulfill({ status: 201, json: { id: "synthetic-event", checkinToken: "synthetic-token" } }); });
  await page.route("**/admin/events/synthetic-event?**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><h1>Synthetic cohort event</h1>" }));
  await page.goto("/apply/test-harness/cohort?cycleId=draft-cycle");
  await page.getByText("Synthetic event creation", { exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Synthetic cohort event");
  for (const [label, value] of [["Date", "2026-11-01T18:00"], ["Event ends at", "2026-11-01T20:00"], ["Check-in opens at", "2026-11-01T17:45"], ["Check-in closes at", "2026-11-01T18:30"]]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Create event", exact: true }).click();
  await expect.poll(() => body?.cycleId).toBe("draft-cycle");
  await expect.poll(() => new URL(page.url()).pathname).toBe("/admin/events/synthetic-event");
  expect(new URL(page.url()).searchParams.get("cycleId")).toBe("draft-cycle");
  expect(new URL(page.url()).searchParams.get("token")).toBe("synthetic-token");
});
