import { expect, test, type Page } from "@playwright/test";

const summary = { roundId: "synthetic-group-case", roundStatus: "ACTIVE", checkedAt: "2026-10-16T15:30:00Z", applicants: 3, applicantsReady: 1, applicantsIncomplete: 2, submittedEvaluations: 5, validEvaluations: 3, openAssignments: 2 };
async function openClose(page: Page) {
  await page.goto("/apply/test-harness/operations");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  await page.getByRole("combobox", { name: "Status for Group Case" }).selectOption("FROZEN");
  await page.getByRole("button", { name: "Close grading…", exact: true }).click();
  return page.getByRole("dialog");
}

test("closing waits for actual coverage and Escape restores focus without a write", async ({ page }) => {
  let releaseRead: () => void = () => {};
  const wait = new Promise<void>((resolve) => { releaseRead = resolve; });
  await page.route("**/api/admin/round-close?**", async (route) => { await wait; await route.fulfill({ json: summary }); });
  let writes = 0;
  await page.route("**/api/admin/rush", async (route) => { writes += 1; await route.fulfill({ json: {} }); });
  const dialog = await openClose(page);
  await expect(dialog.getByText("Loading current coverage…")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close grading and lock submissions" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Keep grading open" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Close grading…", exact: true })).toBeFocused();
  releaseRead();
  expect(writes).toBe(0);
});

test("coverage distinguishes partial submissions and only explicit confirmation closes", async ({ page }) => {
  const writes: unknown[] = [];
  await page.route("**/api/admin/round-close?**", async (route) => { await route.fulfill({ json: { ...summary, roundStatus: writes.length ? "FROZEN" : "ACTIVE" } }); });
  await page.route("**/api/admin/rush", async (route) => { writes.push(route.request().postDataJSON()); await route.fulfill({ json: { ok: true } }); });
  const dialog = await openClose(page);
  await expect(dialog.getByRole("row", { name: "Submitted evaluations 5", exact: true })).toBeVisible();
  await expect(dialog.getByRole("row", { name: "Valid independent evaluations 3", exact: true })).toBeVisible();
  await expect(dialog.getByRole("row", { name: "Still need valid evaluations 2", exact: true })).toBeVisible();
  await expect(dialog.getByText("Unfinished work remains.", { exact: false })).toBeVisible();
  expect(writes).toHaveLength(0);
  await dialog.getByRole("button", { name: "Close grading and lock submissions" }).click();
  await expect(dialog.getByRole("status")).toContainText("Grading is closed.");
  await dialog.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Group Case · Grading closed", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Review round results", exact: true })).toBeFocused();
  expect(writes).toEqual([{ cycleId: "synthetic-operator-cycle", action: "SET_ROUND_STATUS", roundId: summary.roundId, status: "FROZEN" }]);
});

test("unavailable coverage offers retry and never fabricates empty counts", async ({ page }) => {
  let reads = 0;
  await page.route("**/api/admin/round-close?**", async (route) => { reads += 1; await route.fulfill(reads === 1 ? { status: 503, json: { error: "unavailable" } } : { json: summary }); });
  const dialog = await openClose(page);
  await expect(dialog.getByRole("alert")).toContainText("Coverage is unavailable");
  await expect(dialog.getByRole("table")).not.toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close grading and lock submissions" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Retry coverage" }).click();
  await expect(dialog.getByRole("table")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close grading and lock submissions" })).toBeEnabled();
});

for (const [name, response] of [["malformed", { ...summary, applicants: null }], ["wrong round", { ...summary, roundId: "other-round" }], ["changed status", { ...summary, roundStatus: "FROZEN" }]] as const) {
  test(`${name} coverage cannot authorize closing`, async ({ page }) => {
    await page.route("**/api/admin/round-close?**", async (route) => { await route.fulfill({ json: response }); });
    const dialog = await openClose(page);
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByRole("table")).not.toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close grading and lock submissions" })).toBeDisabled();
  });
}

test("an empty cohort is explicit and refreshing replaces the counts", async ({ page }) => {
  let reads = 0;
  await page.route("**/api/admin/round-close?**", async (route) => { reads += 1; await route.fulfill({ json: reads === 1 ? { ...summary, applicants: 0, applicantsReady: 0, applicantsIncomplete: 0, submittedEvaluations: 0, validEvaluations: 0, openAssignments: 0 } : summary }); });
  const dialog = await openClose(page);
  await expect(dialog.getByText("No applicants are enrolled or assigned to this round.")).toBeVisible();
  await dialog.getByRole("button", { name: "Refresh coverage" }).click();
  await expect(dialog.getByRole("row", { name: "Applicants in this round 3", exact: true })).toBeVisible();
  await expect(dialog.getByText("No applicants are enrolled or assigned to this round.")).not.toBeVisible();
  const fits = await dialog.evaluate((element) => element.clientWidth >= element.scrollWidth && element.getBoundingClientRect().left >= 0 && element.getBoundingClientRect().right <= window.innerWidth);
  expect(fits).toBe(true);
});

test("operators without cycle-management permission are not offered a close control", async ({ page }) => {
  await page.goto("/apply/test-harness/operations?manage=no");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  await expect(page.getByRole("combobox", { name: "Status for Group Case" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: /Close grading/ })).not.toBeVisible();
});

test("network failure explains how to recover without closing grading", async ({ page }) => {
  await page.route("**/api/admin/round-close?**", async (route) => { await route.abort("connectionreset"); });
  const dialog = await openClose(page);
  await expect(dialog.getByRole("alert")).toContainText("Retry, or keep grading open and review the round.");
  await expect(dialog.getByRole("button", { name: "Close grading and lock submissions" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Keep grading open" }).click();
  await expect(dialog).not.toBeVisible();
});


test("committed freeze with dropped acknowledgement reconciles FROZEN without a repeat write", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/admin/round-close?**", async (route) => { await route.fulfill({ json: { ...summary, roundStatus: writes ? "FROZEN" : "ACTIVE" } }); });
  await page.route("**/api/admin/rush", async (route) => { writes += 1; await route.abort("connectionreset"); });
  const dialog = await openClose(page);
  await dialog.getByRole("button", { name: "Close grading and lock submissions" }).click();
  await expect(dialog.getByRole("status")).toContainText("Grading is closed.");
  await expect(dialog.getByRole("button", { name: "Keep grading open" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Close grading and lock submissions" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(page.getByRole("button", { name: "Grading closed", exact: true })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Group Case · Grading closed", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Review round results", exact: true })).toBeFocused();
  expect(writes).toBe(1);
});

for (const reconciliation of ["unavailable", "ACTIVE", "malformed", "wrong round"] as const) {
  test(`ambiguous close with ${reconciliation} reconciliation blocks repeat confirmation`, async ({ page }) => {
    let writes = 0;
    await page.route("**/api/admin/round-close?**", async (route) => {
      if (!writes) { await route.fulfill({ json: summary }); return; }
      if (reconciliation === "unavailable") { await route.fulfill({ status: 503, json: { error: "unavailable" } }); return; }
      await route.fulfill({ json: reconciliation === "malformed" ? { ...summary, applicants: null } : reconciliation === "wrong round" ? { ...summary, roundId: "other-round", roundStatus: "FROZEN" } : summary });
    });
    await page.route("**/api/admin/rush", async (route) => { writes += 1; await route.abort("connectionreset"); });
    const dialog = await openClose(page);
    await dialog.getByRole("button", { name: "Close grading and lock submissions" }).click();
    await expect(dialog.getByRole("status")).toContainText("The close outcome is unknown.");
    await expect(dialog.getByRole("button", { name: "Keep grading open" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Close grading and lock submissions" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Check round status", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("The close outcome is unknown.");
    await expect(dialog.getByRole("button", { name: "Check round status", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await page.getByRole("button", { name: "Check grading status…", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Close grading and lock submissions" })).toBeDisabled();
    expect(writes).toBe(1);
  });
}

test("explicit rejection and authoritative ACTIVE allow a fresh confirmation", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/admin/round-close?**", async (route) => { await route.fulfill({ json: { ...summary, roundStatus: writes > 1 ? "FROZEN" : "ACTIVE" } }); });
  await page.route("**/api/admin/rush", async (route) => {
    writes += 1;
    await route.fulfill(writes === 1 ? { status: 409, json: { error: "Round was updated" } } : { json: { ok: true } });
  });
  const dialog = await openClose(page);
  await dialog.getByRole("button", { name: "Close grading and lock submissions" }).click();
  await expect(dialog.getByRole("status")).toContainText("The close request was rejected");
  await expect(dialog.getByRole("button", { name: "Close grading and lock submissions" })).toBeEnabled();
  expect(writes).toBe(1);
  await dialog.getByRole("button", { name: "Close grading and lock submissions" }).click();
  await expect(dialog.getByRole("status")).toContainText("Grading is closed.");
  expect(writes).toBe(2);
});

test("server error after a write remains unknown even with ACTIVE read", async ({ page }) => {
  await page.route("**/api/admin/round-close?**", async (route) => { await route.fulfill({ json: summary }); });
  await page.route("**/api/admin/rush", async (route) => { await route.fulfill({ status: 503, json: { error: "Acknowledgement lost" } }); });
  const dialog = await openClose(page);
  await dialog.getByRole("button", { name: "Close grading and lock submissions" }).click();
  await expect(dialog.getByRole("status")).toContainText("The close outcome is unknown.");
  await expect(dialog.getByRole("button", { name: "Close grading and lock submissions" })).toBeDisabled();
});

test("a later authoritative FROZEN read resolves unknown without retrying the write", async ({ page }) => {
  let frozen = false;
  let writes = 0;
  await page.route("**/api/admin/round-close?**", async (route) => { await route.fulfill({ json: { ...summary, roundStatus: frozen ? "FROZEN" : "ACTIVE" } }); });
  await page.route("**/api/admin/rush", async (route) => { writes += 1; await route.abort("connectionreset"); });
  const dialog = await openClose(page);
  await dialog.getByRole("button", { name: "Close grading and lock submissions" }).click();
  await expect(dialog.getByRole("status")).toContainText("The close outcome is unknown.");
  frozen = true;
  await dialog.getByRole("button", { name: "Check round status", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Grading is closed.");
  await expect(dialog.getByRole("button", { name: "Close grading and lock submissions" })).toBeDisabled();
  expect(writes).toBe(1);
});

test("an unknown close survives page reload and only an authoritative closed read clears it", async ({ page }) => {
  let frozen = false;
  let writes = 0;
  await page.route("**/api/admin/round-close?**", (route) => route.fulfill({ json: { ...summary, roundStatus: frozen ? "FROZEN" : "ACTIVE" } }));
  await page.route("**/api/admin/rush", async (route) => { writes += 1; await route.abort("connectionreset"); });
  const dialog = await openClose(page);
  await dialog.getByRole("button", { name: "Close grading and lock submissions" }).click();
  await expect(dialog.getByRole("status")).toContainText("The close outcome is unknown.");
  await page.reload();
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  await page.getByRole("button", { name: "Check grading status…", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Close grading and lock submissions" })).toBeDisabled();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Keep grading open" })).toHaveCount(0);
  frozen = true;
  await page.getByRole("dialog").getByRole("button", { name: "Check round status", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("Grading is closed.");
  expect(writes).toBe(1);
  expect(await page.evaluate(() => sessionStorage.getItem("mecg:pending-round-close:synthetic-group-case"))).toBeNull();
});
