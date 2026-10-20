import { readFile } from "node:fs/promises";
import { expect, test, type Route } from "@playwright/test";

const assignmentId = "synthetic-evaluation";
const revision = "10000000-0000-4000-8000-000000000001";
const updatedAt = "2026-10-16T20:00:00Z";
function draftReceipt(route: Route) {
  if (route.request().method() === "GET") return { assignmentId, revision: null, draft: null };
  const payload = route.request().postDataJSON();
  return { kind: "saved", assignmentId, revision, mutationId: payload.mutationId, draft: { ratings: payload.ratings, evidence: payload.evidence, updatedAt } };
}

for (const storageFailure of ["access", "quota"] as const) {
  test(`${storageFailure} failure never promises a local evaluation backup; a private copy can be downloaded`, async ({ page }) => {
    await page.addInitScript((failure) => {
      if (failure === "access") Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } });
      else Storage.prototype.setItem = () => { throw new DOMException("Storage full", "QuotaExceededError"); };
    }, storageFailure);
    await page.route("**/api/member/evaluations/synthetic-evaluation/draft", (route) => route.fulfill({ status: 503, json: { error: "Draft service unavailable" } }));
    await page.goto("/apply/test-harness/evaluation");
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await page.getByLabel("Overall observable evidence (optional)").fill("Synthetic observation that must survive an unavailable save.");
    await expect(page.getByText(/These changes are only in this open page/)).toBeVisible();
    await expect(page.getByText(/Your changes have not synced across devices/)).toBeVisible();
    await expect(page.getByText(/Browser backup is current/)).toHaveCount(0);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download draft copy" }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).not.toBeNull();
    const exported = JSON.parse(await readFile(path!, "utf8"));
    expect(exported.assignmentId).toBe("synthetic-evaluation");
    expect(exported.evidence).toBe("Synthetic observation that must survive an unavailable save.");
    expect(exported.ratings).toHaveLength(2);
  });
}

test("a confirmed server save is distinguished from unavailable browser storage", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } }); });
  await page.route("**/api/member/evaluations/synthetic-evaluation/draft", (route) => route.fulfill({ json: draftReceipt(route) }));
  await page.goto("/apply/test-harness/evaluation");
  await page.getByLabel("Overall observable evidence (optional)").fill("A confirmed synthetic server copy.");
  await expect(page.getByText("Draft saved across devices.")).toBeVisible();
  await expect(page.getByText("Browser backup is unavailable. This version is saved on the server.")).toBeVisible();
  await expect(page.getByText(/Browser backup is current/)).toHaveCount(0);
});

test("a malformed successful draft receipt never confirms a server backup", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } }); });
  await page.route("**/api/member/evaluations/synthetic-evaluation/draft", (route) => route.fulfill({ json: route.request().method() === "GET" ? { assignmentId, revision: null, draft: null } : {} }));
  await page.goto("/apply/test-harness/evaluation");
  await page.getByLabel("Overall observable evidence (optional)").fill("Unconfirmed synthetic server copy.");
  await expect(page.getByText(/The server save could not be confirmed/)).toBeVisible();
  await expect(page.getByText(/These changes are only in this open page/)).toBeVisible();
  await expect(page.getByText("Draft saved across devices.")).toHaveCount(0);
});

test("review keyboard focus visits the summary and returns to editing before final locking", async ({ page }) => {
  let locks = 0;
  await page.route("**/api/member/evaluations/synthetic-evaluation", (route) => { locks += 1; return route.fulfill({ json: { assignmentId, id: "synthetic-locked-evaluation" } }); });
  await page.route("**/api/member/evaluations/synthetic-evaluation/draft", (route) => route.fulfill({ json: draftReceipt(route) }));
  await page.goto("/apply/test-harness/evaluation");
  const scoreLabels = page.locator("label").filter({ has: page.getByRole("radio", { name: /^Score 3:/ }) });
  await scoreLabels.nth(0).click();
  await scoreLabels.nth(1).click();
  await page.getByRole("button", { name: "Review evaluation", exact: true }).focus();
  await page.keyboard.press("Enter");
  const review = page.getByRole("heading", { name: "Review before locking" });
  await expect(review).toBeFocused();
  await page.keyboard.press("Enter");
  expect(locks).toBe(0);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Keep editing" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Review evaluation", exact: true })).toBeFocused();
  await expect(review).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(review).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Confirm and lock evaluation" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Evaluation submitted and locked.", { exact: true })).toBeVisible();
  expect(locks).toBe(1);
});

test("retry during a failed initial lookup preserves memory-only edits without reloading", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => { Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } }); });
  let navigations = 0;
  page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) navigations += 1; });
  await page.route("**/api/member/evaluations/synthetic-evaluation/draft", (route) => { return route.fulfill({ status: 503, json: { error: "Draft service unavailable" } }); });
  await page.goto("/apply/test-harness/evaluation");
  const evidence = page.getByLabel("Overall observable evidence (optional)");
  await expect(evidence).toBeEnabled();
  const beforeRetry = navigations;
  await evidence.fill("Memory-only evidence before the autosave timer.");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(evidence).toHaveValue("Memory-only evidence before the autosave timer.");
  await page.clock.fastForward(701);
  await expect(page.getByText(/Your changes have not synced across devices/)).toBeVisible();
  expect(navigations).toBe(beforeRetry);
  await expect(evidence).toHaveValue("Memory-only evidence before the autosave timer.");
});

for (const choice of ["browser", "server"] as const) {
  test(`a newer browser evaluation is preserved against an older server copy until choosing ${choice}`, async ({ page }) => {
    let allowSave = false;
    const writes: { evidence: string }[] = [];
    await page.route("**/api/member/evaluations/synthetic-evaluation/draft", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { assignmentId, revision, draft: { updatedAt, ratings: [
        { criterionId: "analysis", score: "3", note: "Server analysis note." },
        { criterionId: "clarity", score: "3", note: "" },
      ], evidence: "Older server evidence A." } } });
      writes.push(route.request().postDataJSON());
      return route.fulfill(allowSave ? { json: draftReceipt(route) } : { status: 503, json: { error: "Save unavailable" } });
    });
    await page.goto("/apply/test-harness/evaluation");
    const evidence = page.getByLabel("Overall observable evidence (optional)");
    await expect(evidence).toHaveValue("Older server evidence A.");
    await evidence.fill("Newer browser evidence B, not yet synced.");
    await expect(page.getByText(/Your changes have not synced across devices/)).toBeVisible();
    await expect(page.getByText(/Browser backup is current/)).toBeVisible();
    await page.reload();
    const conflict = page.getByRole("heading", { name: "Choose which evaluation draft to keep" });
    await expect(conflict).toBeFocused();
    await expect(page.getByText("Newer browser evidence B, not yet synced.", { exact: true })).toBeVisible();
    await expect(page.getByText("Older server evidence A.", { exact: true })).toBeVisible();
    await expect(evidence).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem("mecg:evaluation-draft:v1:synthetic-evaluation"))).toContain("Newer browser evidence B");
    const writesBeforeChoice = writes.length;
    allowSave = true;
    await page.getByRole("button", { name: choice === "browser" ? "Recover browser draft" : "Use server draft", exact: true }).click();
    await expect(evidence).toBeEnabled();
    await expect(evidence).toHaveValue(choice === "browser" ? "Newer browser evidence B, not yet synced." : "Older server evidence A.");
    if (choice === "browser") {
      await expect(page.getByText("Draft saved across devices.")).toBeVisible();
      expect(writes.at(-1)?.evidence).toBe("Newer browser evidence B, not yet synced.");
    } else expect(writes.length).toBe(writesBeforeChoice);
    await expect(conflict).toHaveCount(0);
  });
}

for (const stalled of ["load", "save", "lock"] as const) {
  test(`a stalled evaluation ${stalled} has a bounded wait and preserves recovery`, async ({ page }) => {
    await page.clock.install();
    let finish: () => void = () => {};
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    let requested = false;
    await page.route("**/api/member/evaluations/synthetic-evaluation{,/draft}", async (route) => {
      const method = route.request().method();
      const isTarget = stalled === "load" ? method === "GET" : stalled === "save" ? method === "PUT" : method === "POST";
      if (isTarget) { requested = true; await gate; await route.abort().catch(() => {}); return; }
      await route.fulfill({ json: draftReceipt(route) });
    });
    await page.goto("/apply/test-harness/evaluation");
    const evidence = page.getByLabel("Overall observable evidence (optional)");
    if (stalled !== "load") {
      await evidence.fill("Synthetic evidence preserved through a stalled request.");
      await expect(page.getByText(/Browser backup is current/)).toBeVisible();
      if (stalled === "save") await page.clock.fastForward(701);
      else {
        const scoreLabels = page.locator("label").filter({ has: page.getByRole("radio", { name: /^Score 3:/ }) });
        await scoreLabels.nth(0).click(); await scoreLabels.nth(1).click();
        await page.getByRole("button", { name: "Review evaluation", exact: true }).click();
        await page.getByRole("button", { name: "Confirm and lock evaluation" }).click();
      }
    }
    await expect.poll(() => requested).toBe(true);
    await page.clock.fastForward(15_001);
    if (stalled === "load") {
      await expect(evidence).toBeEnabled();
      await expect(page.getByText(/The request took too long/)).toBeVisible();
    } else {
      await expect(evidence).toHaveValue("Synthetic evidence preserved through a stalled request.");
      await expect(page.getByText(stalled === "save" ? /Your changes have not synced across devices/ : /Submission could not be confirmed/)).toBeVisible();
      expect(await page.evaluate(() => sessionStorage.getItem("mecg:evaluation-draft:v1:synthetic-evaluation"))).toContain("Synthetic evidence preserved");
      if (stalled === "lock") await expect(page.getByRole("button", { name: "Confirm and lock evaluation" })).toBeEnabled();
    }
    finish();
  });
}
