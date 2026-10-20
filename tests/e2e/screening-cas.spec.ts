import { expect, test, type Page, type Route } from "@playwright/test";
import { readFile } from "node:fs/promises";
const assignmentId = "synthetic-screening";
const firstRevision = "10000000-0000-4000-8000-000000000001";
const nextRevision = "20000000-0000-4000-8000-000000000002";
const updatedAt = "2026-10-16T20:00:00Z";
type DraftRequest = { ratings: { criterionId: string; score: string; note: string }[]; evidence: string; recommendation: string; expectedRevision: string | null; mutationId: string };
function receipt(request: DraftRequest, revision = firstRevision) { return { kind: "saved", assignmentId, revision, mutationId: request.mutationId, draft: { ratings: request.ratings, evidence: request.evidence, recommendation: request.recommendation, updatedAt } }; }
const serverDraft = { ratings: [{ criterionId: "analysis", score: "2", note: "Server analysis" }, { criterionId: "clarity", score: "3", note: "" }], evidence: "Other-device private observations", recommendation: "HOLD", updatedAt };
const evidence = (page: Page) => page.locator("#screening-evidence");
const comparison = (page: Page) => page.getByRole("region", { name: "Choose which private review to keep" });
const saved = (page: Page) => page.getByText("Private draft saved across devices.", { exact: true });
async function showScorer(page: Page) {
  await expect(page.locator("[data-application-harness-ready='true']")).toHaveCount(1);
  const tab = page.getByRole("button", { name: "Your review", exact: true });
  if (await tab.isVisible()) await tab.click();
  await expect(evidence(page)).toBeEnabled();
}
async function open(page: Page, write: (route: Route, request: DraftRequest) => Promise<void>) {
  await page.route("**/api/member/screening/draft?assignmentId=synthetic-screening", (route) => route.request().method() === "GET" ? route.fulfill({ json: { assignmentId, revision: null, draft: null } }) : write(route, route.request().postDataJSON()));
  await page.goto("/apply/test-harness/screening"); await showScorer(page);
}
async function ready(page: Page) {
  // Rating 2 intentionally needs no note; the canonical policy requires notes
  // for 1 and 5, while partial draft writes permit every unfilled field.
  const labels = page.locator("label").filter({ has: page.getByRole("radio", { name: /^Score 2:/ }) });
  await labels.nth(0).click(); await labels.nth(1).click();
  await evidence(page).fill("Specific private evidence from the written response.");
  await page.locator("#screening-recommendation").selectOption("HOLD");
}
async function confirmSubmit(page: Page) {
  await page.getByRole("button", { name: "Review before submitting", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review before locking" })).toBeFocused();
  await page.getByRole("button", { name: "Submit locked review", exact: true }).click();
}
async function confirmRecusal(page: Page) {
  await page.locator("summary").filter({ hasText: "Recognize this applicant? Step back" }).click();
  await page.getByLabel("Reason for recusal").fill("Prior close relationship");
  await page.getByRole("button", { name: "Review recusal", exact: true }).click();
  await page.getByRole("button", { name: "Confirm recusal", exact: true }).click();
}

test("screening serializes an earlier pending save before draining newer observations", async ({ page }) => {
  await page.clock.install();
  const writes: DraftRequest[] = []; let release = () => {}; const gate = new Promise<void>((resolve) => { release = resolve; });
  await open(page, async (route, request) => { writes.push(request); const index = writes.length; if (index === 1) await gate; await route.fulfill({ json: receipt(request, index === 1 ? firstRevision : nextRevision) }); });
  await evidence(page).fill("Earlier observation A"); await page.clock.fastForward(701); await expect.poll(() => writes.length).toBe(1);
  await evidence(page).fill("Newer observation B"); await page.clock.fastForward(701); expect(writes).toHaveLength(1);
  release(); await expect.poll(() => writes.length).toBe(2); await expect(saved(page)).toBeVisible();
  expect(writes[1]?.expectedRevision).toBe(firstRevision); expect(writes[1]?.evidence).toBe("Newer observation B"); expect(writes[1]?.mutationId).not.toBe(writes[0]?.mutationId);
  await expect(evidence(page)).toHaveValue("Newer observation B");
});

for (const outcome of ["lost", "body-timeout"] as const) {
  test(`screening ${outcome} draft receipt retries the exact committed request before newer edits`, async ({ page }) => {
    if (outcome === "body-timeout") await page.clock.install();
    const writes: DraftRequest[] = [];
    await open(page, (route, request) => { writes.push(request); if (outcome === "lost" && writes.length === 1) return route.abort("failed"); return route.fulfill({ json: receipt(request, writes.length < 3 ? firstRevision : nextRevision) }); });
    if (outcome === "body-timeout") await page.evaluate(() => { const original = window.fetch; let stalled = false; window.fetch = async (...args) => { const response = await original(...args); if (!stalled && args[1]?.method === "PUT") { stalled = true; response.json = () => new Promise<never>(() => {}); } return response; }; });
    await evidence(page).fill("Unconfirmed earlier observations");
    if (outcome === "body-timeout") { await page.clock.fastForward(701); await expect.poll(() => writes.length).toBe(1); await page.clock.fastForward(15_001); }
    await expect(page.getByText(/Retry confirms the exact earlier request/)).toBeVisible();
    await evidence(page).fill("Newer observations retained"); await page.getByRole("button", { name: "Retry draft save", exact: true }).click();
    await expect.poll(() => writes.length).toBe(3); expect(writes[1]).toEqual(writes[0]); expect(writes[2]?.expectedRevision).toBe(firstRevision); expect(writes[2]?.evidence).toBe("Newer observations retained");
    await expect(evidence(page)).toHaveValue("Newer observations retained"); await expect(saved(page)).toBeVisible();
  });
}

for (const choice of ["local", "server"] as const) {
  test(`screening conflict lets the reviewer export both private copies then choose ${choice}`, async ({ page }, testInfo) => {
    const writes: DraftRequest[] = [];
    await open(page, (route, request) => { writes.push(request); return route.fulfill(writes.length === 1 ? { status: 409, json: { kind: "conflict", snapshot: { assignmentId, revision: firstRevision, draft: serverDraft } } } : { json: receipt(request, nextRevision) }); });
    await evidence(page).fill("This page’s observations");
    await expect(page.getByRole("heading", { name: "Choose which private review to keep" })).toBeFocused();
    await expect(comparison(page).getByText("This page’s observations", { exact: true })).toBeVisible(); await expect(comparison(page).getByText(serverDraft.evidence, { exact: true })).toBeVisible();
    for (const source of ["this page", "server"]) { const download = page.waitForEvent("download"); await page.getByRole("button", { name: `Download ${source} copy`, exact: true }).click(); const file = await download; expect(file.suggestedFilename()).toBe("mecg-private-screening-review.json"); const path = await file.path(); if (!path) throw new Error("Private review export must create a downloadable file"); const content = await readFile(path, "utf8"); expect(content).toContain(source === "this page" ? "This page’s observations" : serverDraft.evidence); expect(content).toContain(assignmentId); }
    expect(writes).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (testInfo.project.name.startsWith("mobile") && choice === "local") { await page.evaluate(() => window.scrollTo(0, 0)); await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0); await page.screenshot({ path: testInfo.outputPath(`recovery-${testInfo.project.name}.png`), fullPage: true }); }
    await page.getByRole("button", { name: choice === "local" ? "Keep this page’s review" : "Use current server review", exact: true }).click();
    await expect(page.locator("fieldset[tabindex='-1']").first()).toBeFocused(); await expect(evidence(page)).toHaveValue(choice === "local" ? "This page’s observations" : serverDraft.evidence);
    if (choice === "local") { await expect.poll(() => writes.length).toBe(2); expect(writes[1]?.expectedRevision).toBe(firstRevision); }
    else { await page.waitForTimeout(800); expect(writes).toHaveLength(1); }
  });
}

for (const mode of ["blocked", "quota"] as const) {
  test(`screening ${mode} session backup never claims observations are protected before a server receipt`, async ({ page }) => {
    await page.addInitScript((mode) => { if (mode === "blocked") Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } }); else { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (this === window.sessionStorage) throw new DOMException("Full", "QuotaExceededError"); return original.call(this, key, value); }; } }, mode);
    await open(page, (route) => route.abort("failed")); await evidence(page).fill("Private local observations with no backup");
    await expect(page.getByText(/Browser backup is unavailable. These changes are only in this open page/)).toBeVisible();
    await expect(page.getByText(/Browser backup is current/)).toHaveCount(0);
    const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Download private review copy" }).click(); await download;
    await expect(evidence(page)).toHaveValue("Private local observations with no backup");
  });
}

test("screening recovers exact session observations after reload without assuming a server save", async ({ page }) => {
  await open(page, (route) => route.abort("failed")); await evidence(page).fill("Session observations survive a reload");
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("mecg:screening-draft:synthetic-screening"))).toContain("Session observations survive a reload");
  await page.reload(); await showScorer(page); await expect(evidence(page)).toHaveValue("Session observations survive a reload");
  await expect(page.getByText(/Retry confirms the exact earlier request/)).toBeVisible();
});

test("initial revision failure permits private scoring and recusal but sends no save or final submit", async ({ page }) => {
  const actions: { action: string }[] = []; let writes = 0;
  await page.route("**/api/member/screening/draft?assignmentId=synthetic-screening", (route) => { if (route.request().method() === "PUT") writes += 1; return route.fulfill({ json: { assignmentId, draft: null } }); });
  await page.route("**/api/member/screening", (route) => { actions.push(route.request().postDataJSON()); return route.fulfill({ status: 409, json: { error: "No eligible replacement reviewer" } }); });
  await page.goto("/apply/test-harness/screening"); await showScorer(page); await ready(page); await confirmSubmit(page);
  await expect(page.getByText(/Confirm the latest saved draft/)).toBeVisible(); expect(writes).toBe(0); expect(actions).toHaveLength(0);
  await confirmRecusal(page); await expect(page.getByText("No eligible replacement reviewer", { exact: true })).toBeVisible(); expect(actions.map(({ action }) => action)).toEqual(["RECUSE"]); expect(writes).toBe(0);
});

test("final screening submit waits for the latest receipt and forwards its revision", async ({ page }) => {
  const writes: DraftRequest[] = []; const actions: { expectedDraftRevision: string; evidence: string }[] = [];
  let release = () => {}; const gate = new Promise<void>((resolve) => { release = resolve; });
  await open(page, async (route, request) => { writes.push(request); const index = writes.length; await gate; await route.fulfill({ json: receipt(request, index === 1 ? firstRevision : nextRevision) }); });
  await page.route("**/api/member/screening", (route) => { actions.push(route.request().postDataJSON()); return route.fulfill({ status: 409, json: { error: "Review refused for a fixture policy check" } }); });
  await evidence(page).fill("Earlier incomplete observations"); await expect.poll(() => writes.length).toBe(1);
  await ready(page); await confirmSubmit(page); expect(actions).toHaveLength(0);
  release(); await expect.poll(() => actions.length).toBe(1); expect(writes).toHaveLength(2); expect(writes[1]?.expectedRevision).toBe(firstRevision); expect(actions[0]?.expectedDraftRevision).toBe(nextRevision); expect(actions[0]?.evidence).toBe("Specific private evidence from the written response.");
  await expect(page.getByText("Review refused for a fixture policy check", { exact: true })).toBeVisible();
});

test("final screening CAS conflict retains both versions and never claims a successful lock", async ({ page }) => {
  let actions = 0;
  await open(page, (route, request) => route.fulfill({ json: receipt(request) }));
  await page.route("**/api/member/screening", (route) => { actions += 1; return route.fulfill({ status: 409, json: { kind: "conflict", snapshot: { assignmentId, revision: nextRevision, draft: serverDraft } } }); });
  await ready(page); await confirmSubmit(page); await expect(page.getByRole("heading", { name: "Choose which private review to keep" })).toBeFocused();
  await expect(comparison(page).getByText("Specific private evidence from the written response.", { exact: true })).toBeVisible(); await expect(comparison(page).getByText(serverDraft.evidence, { exact: true })).toBeVisible(); expect(actions).toBe(1);
  await expect(page).toHaveURL(/\/apply\/test-harness\/screening$/);
});

for (const action of ["SUBMIT", "RECUSE"] as const) for (const outcome of ["malformed", "lost"] as const) {
  test(`unknown screening ${action} ${outcome} outcome preserves private data and blocks blind retry`, async ({ page }) => {
    let actions = 0;
    await open(page, (route, request) => route.fulfill({ json: receipt(request) }));
    await page.route("**/api/member/screening", (route) => { actions += 1; return outcome === "lost" ? route.abort("failed") : route.fulfill({ json: { assignmentId, score: 25 } }); });
    await ready(page); if (action === "SUBMIT") await confirmSubmit(page); else await confirmRecusal(page);
    const warning = page.getByRole("alert").filter({ hasText: "This review action could not be confirmed" }); await expect(warning).toBeFocused();
    await expect(evidence(page)).toHaveValue("Specific private evidence from the written response."); await expect(evidence(page)).toBeDisabled();
    await expect(page.getByRole("link", { name: "Check screening queue (new tab)" })).toHaveAttribute("target", "_blank");
    await expect(page.getByRole("button", { name: "Reload current assignment" })).toBeVisible();
    await expect(page).toHaveURL(/\/apply\/test-harness\/screening$/); await page.waitForTimeout(800); expect(actions).toBe(1);
    expect(await page.evaluate(() => sessionStorage.getItem("mecg:screening-draft:synthetic-screening"))).toContain("Specific private evidence from the written response.");
    await expect(page.getByRole("button", { name: "Download private review copy" })).toBeEnabled();
  });
}

test("failed replacement coverage retains screening observations and permits another deliberate recusal", async ({ page }) => {
  let actions = 0;
  await open(page, (route, request) => route.fulfill({ json: receipt(request) }));
  await page.route("**/api/member/screening", (route) => { actions += 1; return route.fulfill({ status: 409, json: { error: "No eligible replacement reviewer exists for this packet" } }); });
  await evidence(page).fill("Private observations retained after recusal refusal"); await confirmRecusal(page);
  await expect(page.getByText("No eligible replacement reviewer exists for this packet", { exact: true })).toBeVisible();
  await expect(evidence(page)).toHaveValue("Private observations retained after recusal refusal"); await expect(evidence(page)).toBeEnabled(); await expect(page.getByRole("button", { name: "Confirm recusal", exact: true })).toBeEnabled();
  expect(actions).toBe(1);
});

test("screening full error feedback below ratings preserves native pointer-up choice and rating geometry", async ({ page }) => {
  let requested = false; let release = () => {}; const gate = new Promise<void>((resolve) => { release = resolve; });
  await open(page, async (route) => { requested = true; await gate; await route.fulfill({ status: 503, json: { error: "Save unavailable" } }); });
  await evidence(page).fill("Observations that start an in-flight draft request"); await expect.poll(() => requested).toBe(true);
  const radio = page.getByRole("radio", { name: /^Score 3:/ }).first(); const label = page.locator("label").filter({ has: radio }).first(); await label.scrollIntoViewIfNeeded();
  const before = await label.boundingBox(); if (!before) throw new Error("The rating needs a visible native hit target"); expect(before.height).toBeGreaterThanOrEqual(44);
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2); await page.mouse.down(); release();
  await expect(page.getByText(/Retry confirms the exact earlier request/)).toBeAttached();
  const after = await label.boundingBox(); if (!after) throw new Error("The rating target must remain mounted"); expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1); expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  await page.mouse.up(); await expect(radio).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const hasServerCopy of [false, true]) {
  test(`retrying an unavailable initial revision retains memory-only edits${hasServerCopy ? " and compares a server copy" : " before saving"}`, async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } }));
    let outage = true; const writes: DraftRequest[] = [];
    await page.route("**/api/member/screening/draft?assignmentId=synthetic-screening", (route) => {
      if (route.request().method() === "GET") { return route.fulfill(outage ? { status: 503, json: { error: "Snapshot temporarily unavailable" } } : { json: { assignmentId, revision: hasServerCopy ? firstRevision : null, draft: hasServerCopy ? serverDraft : null } }); }
      const request: DraftRequest = route.request().postDataJSON(); writes.push(request); return route.fulfill({ json: receipt(request, nextRevision) });
    });
    await page.goto("/apply/test-harness/screening"); await showScorer(page); await evidence(page).fill("Memory-only observations during initial outage");
    await expect(page.getByText(/Snapshot temporarily unavailable/)).toBeVisible(); outage = false; await page.getByRole("button", { name: "Retry draft save", exact: true }).click();
    if (hasServerCopy) { await expect(page.getByRole("heading", { name: "Choose which private review to keep" })).toBeFocused(); await expect(comparison(page).getByText("Memory-only observations during initial outage", { exact: true })).toBeVisible(); await expect(comparison(page).getByText(serverDraft.evidence, { exact: true })).toBeVisible(); expect(writes).toHaveLength(0); }
    else { await expect(evidence(page)).toHaveValue("Memory-only observations during initial outage"); await expect.poll(() => writes.length).toBe(1); expect(writes[0]?.evidence).toBe("Memory-only observations during initial outage"); }
  });
}

test("a hidden old-rubric draft revision protects the first deliberate replacement", async ({ page }) => {
  const writes: DraftRequest[] = [];
  await page.route("**/api/member/screening/draft?assignmentId=synthetic-screening", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { assignmentId, revision: firstRevision, draft: null } });
    const request: DraftRequest = route.request().postDataJSON(); writes.push(request); return route.fulfill({ json: receipt(request, nextRevision) });
  });
  await page.goto("/apply/test-harness/screening"); await showScorer(page); await expect(evidence(page)).toHaveValue(""); await evidence(page).fill("New observations for the current scoring guide");
  await expect(saved(page)).toBeVisible(); expect(writes).toHaveLength(1); expect(writes[0]?.expectedRevision).toBe(firstRevision);
});

test("a bound receipt with different content remains unknown and retries the exact local observations", async ({ page }) => {
  const writes: DraftRequest[] = [];
  await open(page, (route, request) => {
    writes.push(request); const confirmed = receipt(request, writes.length < 3 ? firstRevision : nextRevision);
    return route.fulfill({ json: writes.length === 1 ? { ...confirmed, draft: { ...confirmed.draft, evidence: "Different observations in a malformed receipt" } } : confirmed });
  });
  await evidence(page).fill("Exact local observations to confirm");
  await expect(page.getByText(/Retry confirms the exact earlier request/)).toBeVisible(); await expect(saved(page)).toHaveCount(0); await expect(evidence(page)).toHaveValue("Exact local observations to confirm");
  await evidence(page).fill("Newer local observations retained"); await page.getByRole("button", { name: "Retry draft save", exact: true }).click();
  await expect.poll(() => writes.length).toBe(3); expect(writes[1]).toEqual(writes[0]); expect(writes[2]?.expectedRevision).toBe(firstRevision); expect(writes[2]?.evidence).toBe("Newer local observations retained");
  await expect(saved(page)).toBeVisible(); await expect(evidence(page)).toHaveValue("Newer local observations retained");
});

test("mobile recovery reveals an initially hidden local/server comparison without replacing the application", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ assignmentId, draft }) => sessionStorage.setItem(`mecg:screening-draft:${assignmentId}`, JSON.stringify({ version: 1, assignmentId, savedAt: Date.now(), draft })), { assignmentId, draft: { ...serverDraft, evidence: "Local session observations recovered while reading" } });
  let release = () => {}; const gate = new Promise<void>((resolve) => { release = resolve; }); let writes = 0; let gets = 0;
  await page.route("**/api/member/screening/draft?assignmentId=synthetic-screening", async (route) => {
    if (route.request().method() !== "GET") { writes += 1; return route.abort("failed"); }
    gets += 1; await gate; await route.fulfill({ json: { assignmentId, revision: firstRevision, draft: serverDraft } });
  });
  await page.goto("/apply/test-harness/screening"); await expect(page.locator("[data-application-harness-ready='true']")).toHaveCount(1); await expect.poll(() => gets).toBeGreaterThan(0);
  const toggle = page.getByRole("button", { name: "Your review", exact: true });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  release(); await expect(page.getByRole("heading", { name: "Choose which private review to keep" })).toBeFocused();
  await expect(comparison(page).getByText("Local session observations recovered while reading", { exact: true })).toBeVisible(); await expect(comparison(page).getByText(serverDraft.evidence, { exact: true })).toBeVisible(); expect(writes).toBe(0);
  await page.getByRole("button", { name: "Return to reading", exact: true }).first().click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { name: "Synthetic written response" })).toBeVisible();
  await page.waitForTimeout(800); await expect(toggle).toHaveAttribute("aria-expanded", "false"); expect(writes).toBe(0);
});

test("mobile review disclosure preserves reading, draft and keyboard focus without a write", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); let writes = 0;
  await page.route("**/api/member/screening/draft?assignmentId=synthetic-screening", (route) => {
    if (route.request().method() !== "GET") writes += 1;
    return route.fulfill({ json: { assignmentId, revision: null, draft: null } });
  });
  await page.goto("/apply/test-harness/screening"); await expect(page.locator("[data-application-harness-ready='true']")).toHaveCount(1);
  const toggle = page.getByRole("button", { name: "Your review", exact: true });
  const rail = page.getByRole("complementary", { name: "Your private review", includeHidden: true });
  expect(await toggle.getAttribute("aria-controls")).toBe(await rail.getAttribute("id"));
  await toggle.focus(); await toggle.press("Enter"); await expect(rail).toBeVisible(); await expect(rail).toBeFocused();
  await expect.poll(async () => (await rail.boundingBox())?.y ?? 9999).toBeLessThan(300);
  await expect(page.getByRole("heading", { name: "Synthetic written response" })).toBeVisible();
  await page.getByRole("button", { name: "Return to reading", exact: true }).last().click();
  await expect(toggle).toBeFocused(); await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.waitForTimeout(800); expect(writes).toBe(0);
});

for (const outcome of ["draft-conflict", "final-unknown"] as const) {
  test(`mobile ${outcome} arriving while reading reveals and focuses visible recovery`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); let requested = false; let actions = 0;
    let release = () => {}; const gate = new Promise<void>((resolve) => { release = resolve; });
    await open(page, async (route, request) => {
      if (outcome === "draft-conflict") { requested = true; await gate; return route.fulfill({ status: 409, json: { kind: "conflict", snapshot: { assignmentId, revision: firstRevision, draft: serverDraft } } }); }
      return route.fulfill({ json: receipt(request) });
    });
    await page.route("**/api/member/screening", async (route) => { requested = true; actions += 1; await gate; await route.fulfill({ json: { assignmentId, score: 25 } }); });
    if (outcome === "draft-conflict") await evidence(page).fill("New observations before returning to the response");
    else { await ready(page); await confirmSubmit(page); }
    await expect.poll(() => requested).toBe(true);
    await page.getByRole("button", { name: "Return to reading", exact: true }).first().click();
    const toggle = page.getByRole("button", { name: "Your review", exact: true });
    await expect(toggle).toHaveAttribute("aria-expanded", "false"); release();
    await expect(page.getByRole("button", { name: "Return to reading", exact: true }).first()).toHaveAttribute("aria-expanded", "true");
    if (outcome === "draft-conflict") { await expect(page.getByRole("heading", { name: "Choose which private review to keep" })).toBeFocused(); expect(actions).toBe(0); }
    else { await expect(page.getByRole("alert").filter({ hasText: "This review action could not be confirmed" })).toBeFocused(); expect(actions).toBe(1); }
    await page.getByRole("button", { name: "Return to reading", exact: true }).first().click(); await page.waitForTimeout(800); await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
}
