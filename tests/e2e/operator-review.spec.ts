import { expect, test } from "@playwright/test";

test("a 500-outcome review filters the view, preserves the full cohort and restores keyboard focus", async ({ page }) => {
  const outcomes = ["OFFER", "WAITLIST", "REJECT", "PROCEDURAL_REVIEW"];
  const items = Array.from({ length: 500 }, (_, index) => ({ decisionId: `decision-${index}`, applicationId: `app-${index}`, outcome: outcomes[index % 4], reasonCode: index % 3 === 0 ? "EVIDENCE_NOT_READY" : null }));
  const applicantLabels = Object.fromEntries(items.map((item, index) => [item.applicationId, `Applicant ${index.toString(16).toUpperCase().padStart(6, "0")}`]));
  const snapshots: unknown[] = [];
  await page.route("**/api/admin/decisions", (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "RELEASE_PREFLIGHT") return route.fulfill({ json: { items, applicantLabels } });
    snapshots.push(body.snapshot);
    return route.fulfill({ json: { released: 333, skipped: 167, items, applicantLabels } });
  });
  await page.goto("/apply/test-harness/release?large=1");
  const trigger = page.getByRole("button", { name: "Review 500 locked outcomes", exact: true });
  await trigger.focus(); await page.keyboard.press("Enter");
  const review = page.getByRole("region", { name: "Confirm release cohort", exact: true });
  await expect(review).toBeFocused();
  await page.getByRole("searchbox", { name: "Applicant code" }).fill("Applicant 00000A");
  await expect(page.getByText("Showing 1 of 500 reviewed outcomes.", { exact: false })).toBeVisible();
  await page.getByLabel("Release eligibility", { exact: true }).selectOption("BLOCKED");
  await expect(page.getByText("No outcomes match these filters.", { exact: false })).toBeVisible();
  await page.getByRole("searchbox", { name: "Applicant code" }).fill("");
  await page.getByLabel("Outcome", { exact: true }).selectOption("OFFER");
  await expect(page.getByRole("region", { name: "Filtered reviewed outcomes", exact: true }).getByRole("listitem")).toHaveCount(42);
  await expect(page.getByRole("button", { name: "Release 333 eligible outcomes", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(trigger).toBeFocused();
  expect(snapshots).toHaveLength(0);
  await page.keyboard.press("Enter");
  await expect(review).toBeFocused();
  await expect(page.getByRole("searchbox", { name: "Applicant code" })).toHaveValue("");
  await page.getByLabel("Release eligibility", { exact: true }).selectOption("BLOCKED");
  await page.getByRole("button", { name: "Release 333 eligible outcomes", exact: true }).click();
  const result = page.getByRole("region", { name: "Batch release result", exact: true });
  await expect(result).toBeFocused();
  expect(snapshots).toEqual([items.map(({ decisionId, outcome, reasonCode }) => ({ decisionId, outcome, reasonCode }))]);
  await expect(result).toContainText("333 released · 167 skipped");
  await expect(result).toContainText("If a required round is already closed");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("advancement cancellation returns keyboard focus and confirmation focuses its receipt", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/admin/rush", (route) => { writes += 1; return route.fulfill({ status: 201, json: { id: { roundId: "synthetic-speed", selectedApplications: 1, newAssignments: 2, notificationsEnqueued: 1 } } }); });
  await page.goto("/apply/test-harness/pipeline");
  await page.getByRole("button", { name: "Select eligible shown", exact: true }).click();
  const trigger = page.getByRole("button", { name: "Review advancement", exact: true });
  await trigger.focus(); await page.keyboard.press("Enter");
  const review = page.getByRole("region", { name: "Review advancement to Speed Dating" });
  await expect(review).toBeFocused();
  await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Enter"); await expect(trigger).toBeFocused();
  expect(writes).toBe(0);
  await page.keyboard.press("Enter"); await expect(review).toBeFocused();
  await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Confirm 1 applicants to Speed Dating", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Advanced 1 applicant, created 2 assignments" })).toBeFocused();
  expect(writes).toBe(1);
});

for (const outcome of ["malformed", "lost", "stalled"] as const) {
  test(`${outcome} advancement receipt removes stale confirmation and reports uncertainty`, async ({ page }) => {
    if (outcome === "stalled") await page.clock.install();
    let finish = () => {};
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    let writes = 0;
    await page.route("**/api/admin/rush", async (route) => {
      writes += 1;
      if (outcome === "stalled") await gate;
      if (outcome === "malformed") await route.fulfill({ status: 201, json: {} });
      else await route.abort("connectionreset").catch(() => {});
    });
    await page.goto("/apply/test-harness/pipeline");
    await page.getByRole("button", { name: "Select eligible shown", exact: true }).click();
    await page.getByRole("button", { name: "Review advancement", exact: true }).click();
    await page.getByRole("button", { name: "Confirm 1 applicants to Speed Dating", exact: true }).click();
    await expect.poll(() => writes).toBe(1);
    if (outcome === "stalled") await page.clock.fastForward(15_001);
    await expect(page.getByRole("alert").filter({ hasText: "Advancement could not be confirmed" })).toBeFocused();
    await expect(page.getByRole("region", { name: "Review advancement to Speed Dating" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Review advancement", exact: true })).toBeDisabled();
    await expect(page.getByText(/Advanced 1 applicant, created/)).toHaveCount(0);
    finish();
  });
}
