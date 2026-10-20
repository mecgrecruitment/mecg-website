import { expect, test, type Page, type Route } from "@playwright/test";
const assignmentId = "synthetic-evaluation";
const firstRevision = "10000000-0000-4000-8000-000000000001";
const nextRevision = "20000000-0000-4000-8000-000000000002";
const updatedAt = "2026-10-16T20:00:00Z";
type DraftRequest = { ratings: { criterionId: string; score: string; note: string }[]; evidence: string; expectedRevision: string | null; mutationId: string };
function receipt(request: DraftRequest, revision = firstRevision) { return { kind: "saved", assignmentId, revision, mutationId: request.mutationId, draft: { ratings: request.ratings, evidence: request.evidence, updatedAt } }; }
const serverDraft = { ratings: [{ criterionId: "analysis", score: "3", note: "Server-specific analysis" }, { criterionId: "clarity", score: "3", note: "" }], evidence: "Other-device evidence", updatedAt };
async function open(page: Page, write: (route: Route, request: DraftRequest) => Promise<void>) {
  await page.route("**/api/member/evaluations/synthetic-evaluation/draft", (route) => route.request().method() === "GET" ? route.fulfill({ json: { assignmentId, revision: null, draft: null } }) : write(route, route.request().postDataJSON()));
  await page.goto("/apply/test-harness/evaluation");
  await expect(page.getByLabel("Overall observable evidence (optional)")).toBeEnabled();
}
async function makeReady(page: Page) {
  const labels = page.locator("label").filter({ has: page.getByRole("radio", { name: /^Score 3:/ }) });
  await labels.nth(0).click(); await labels.nth(1).click();
}

test("a delayed earlier save drains newer edits under its confirmed revision without reverting text", async ({ page }) => {
  await page.clock.install();
  const requests: DraftRequest[] = [];
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await open(page, async (route, request) => { requests.push(request); if (requests.length === 1) await gate; await route.fulfill({ json: receipt(request, requests.length === 1 ? firstRevision : nextRevision) }); });
  const evidence = page.getByLabel("Overall observable evidence (optional)");
  await evidence.fill("Earlier edit A"); await page.clock.fastForward(701);
  await expect.poll(() => requests.length).toBe(1);
  await evidence.fill("Newer edit B"); await page.clock.fastForward(701);
  expect(requests).toHaveLength(1);
  release();
  await expect.poll(() => requests.length).toBe(2);
  await expect(page.getByText("Draft saved across devices.")).toBeVisible();
  expect(requests[1]?.expectedRevision).toBe(firstRevision);
  expect(requests[1]?.evidence).toBe("Newer edit B");
  expect(requests[1]?.mutationId).not.toBe(requests[0]?.mutationId);
  await expect(evidence).toHaveValue("Newer edit B");
});

test("unknown save replays the identical request before sending newer edits", async ({ page }) => {
  const requests: DraftRequest[] = [];
  await open(page, async (route, request) => { requests.push(request); if (requests.length === 1) return route.abort("failed"); await route.fulfill({ json: receipt(request, requests.length === 2 ? firstRevision : nextRevision) }); });
  const evidence = page.getByLabel("Overall observable evidence (optional)");
  await evidence.fill("Unconfirmed A");
  await expect(page.getByText(/Retry confirms the exact earlier request/)).toBeVisible();
  await evidence.fill("Newer B retained");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[2]?.expectedRevision).toBe(firstRevision);
  expect(requests[2]?.evidence).toBe("Newer B retained");
  await expect(page.getByText("Draft saved across devices.")).toBeVisible();
  await expect(evidence).toHaveValue("Newer B retained");
});

for (const choice of ["local", "server"] as const) {
  test(`a save conflict preserves both versions and explicitly chooses ${choice}`, async ({ page }) => {
    const requests: DraftRequest[] = [];
    await open(page, async (route, request) => { requests.push(request); await route.fulfill(requests.length === 1 ? { status: 409, json: { kind: "conflict", snapshot: { assignmentId, revision: firstRevision, draft: serverDraft } } } : { json: receipt(request, nextRevision) }); });
    await page.getByLabel("Overall observable evidence (optional)").fill("This page evidence");
    const heading = page.getByRole("heading", { name: "Choose which evaluation draft to keep" });
    await expect(heading).toBeFocused();
    await expect(page.getByText("This page evidence", { exact: true })).toBeVisible();
    await expect(page.getByText("Other-device evidence", { exact: true })).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download browser copy", exact: true }).click();
    await download;
    expect(requests).toHaveLength(1);
    await page.getByRole("button", { name: choice === "local" ? "Recover browser draft" : "Use server draft", exact: true }).click();
    await expect(page.getByLabel("Overall observable evidence (optional)")).toHaveValue(choice === "local" ? "This page evidence" : "Other-device evidence");
    await expect(page.locator("fieldset[tabindex='-1']").first()).toBeFocused();
    if (choice === "local") { await expect.poll(() => requests.length).toBe(2); expect(requests[1]?.expectedRevision).toBe(firstRevision); }
    else { await page.waitForTimeout(800); expect(requests).toHaveLength(1); }
  });
}

test("final locking waits for the latest draft receipt and sends its revision", async ({ page }) => {
  const writes: DraftRequest[] = []; const locks: { expectedDraftRevision: string }[] = [];
  let release = () => {}; const gate = new Promise<void>((resolve) => { release = resolve; });
  await open(page, async (route, request) => { writes.push(request); await gate; await route.fulfill({ json: receipt(request) }); });
  await page.route("**/api/member/evaluations/synthetic-evaluation", (route) => { locks.push(route.request().postDataJSON()); return route.fulfill({ json: { assignmentId, id: "locked-evaluation" } }); });
  await makeReady(page);
  await page.getByRole("button", { name: "Review evaluation", exact: true }).click();
  await page.getByRole("button", { name: "Confirm and lock evaluation" }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(locks).toHaveLength(0);
  release();
  await expect(page.getByText("Evaluation submitted and locked.", { exact: true })).toBeVisible();
  expect(locks).toHaveLength(1); expect(locks[0]?.expectedDraftRevision).toBe(firstRevision);
});

test("another-device draft change between review and lock opens an explicit conflict", async ({ page }) => {
  let locks = 0;
  await open(page, (route, request) => route.fulfill({ json: receipt(request) }));
  await page.route("**/api/member/evaluations/synthetic-evaluation", (route) => { locks += 1; return route.fulfill({ status: 409, json: { kind: "conflict", snapshot: { assignmentId, revision: nextRevision, draft: serverDraft } } }); });
  await makeReady(page);
  await page.getByLabel("Overall observable evidence (optional)").fill("Reviewed local evidence");
  await page.getByRole("button", { name: "Review evaluation", exact: true }).click();
  await page.getByRole("button", { name: "Confirm and lock evaluation" }).click();
  await expect(page.getByRole("heading", { name: "Choose which evaluation draft to keep" })).toBeFocused();
  await expect(page.getByText("Reviewed local evidence", { exact: true })).toBeVisible();
  await expect(page.getByText("Other-device evidence", { exact: true })).toBeVisible();
  await expect(page.getByText("Evaluation submitted and locked.", { exact: true })).toHaveCount(0);
  expect(locks).toBe(1);
});

test("unavailable initial revision allows private editing but refuses final locking", async ({ page }) => {
  let locks = 0; let writes = 0;
  await page.route("**/api/member/evaluations/synthetic-evaluation/draft", (route) => { if (route.request().method() === "PUT") writes += 1; return route.fulfill({ status: 503, json: { error: "Snapshot unavailable" } }); });
  await page.route("**/api/member/evaluations/synthetic-evaluation", (route) => { locks += 1; return route.fulfill({ json: { assignmentId, id: "must-not-lock" } }); });
  await page.goto("/apply/test-harness/evaluation");
  await makeReady(page);
  await page.getByRole("button", { name: "Review evaluation", exact: true }).click();
  await page.getByRole("button", { name: "Confirm and lock evaluation" }).click();
  await expect(page.getByText(/Confirm the latest draft save/)).toBeVisible();
  expect(writes).toBe(0); expect(locks).toBe(0);
  await expect(page.getByRole("button", { name: "Download draft copy" })).toBeVisible();
});

test("a stalled successful JSON body times out and retries the exact committed request before newer edits", async ({ page }) => {
  await page.clock.install();
  const requests: DraftRequest[] = [];
  await open(page, (route, request) => { requests.push(request); return route.fulfill({ json: receipt(request, requests.length < 3 ? firstRevision : nextRevision) }); });
  await page.evaluate(() => {
    const original = window.fetch;
    let stalled = false;
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (!stalled && args[1]?.method === "PUT") { stalled = true; response.json = () => new Promise<never>(() => {}); }
      return response;
    };
  });
  const evidence = page.getByLabel("Overall observable evidence (optional)");
  await evidence.fill("Committed earlier copy");
  await page.clock.fastForward(701);
  await expect.poll(() => requests.length).toBe(1);
  await page.clock.fastForward(15_001);
  await expect(page.getByText(/Retry confirms the exact earlier request/)).toBeVisible();
  await evidence.fill("Newer observations retained");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[2]?.expectedRevision).toBe(firstRevision);
  expect(requests[2]?.evidence).toBe("Newer observations retained");
  await expect(evidence).toHaveValue("Newer observations retained");
  await expect(page.getByText("Draft saved across devices.")).toBeVisible();
});

test("a save error arriving between pointer down and up does not steal a native rating choice", async ({ page }) => {
  let requested = false; let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await open(page, async (route) => { requested = true; await gate; await route.fulfill({ status: 503, json: { error: "Save unavailable" } }); });
  await page.getByLabel("Overall observable evidence (optional)").fill("Observation that starts the in-flight save");
  await expect.poll(() => requested).toBe(true);
  const radio = page.getByRole("radio", { name: /^Score 3:/ }).first();
  const label = page.locator("label").filter({ has: page.getByRole("radio", { name: /^Score 3:/ }) }).first();
  await label.scrollIntoViewIfNeeded();
  const box = await label.boundingBox();
  if (!box) throw new Error("The rating label must have a visible hit area");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  release();
  await expect(page.getByText(/Retry confirms the exact earlier request/)).toBeVisible();
  await page.mouse.up();
  await expect(radio).toBeChecked();
});

for (const outcome of ["malformed", "closed-conflict"] as const) {
  test(`unknown final ${outcome} receipt keeps observations and directs authoritative verification`, async ({ page }) => {
    await open(page, (route, request) => route.fulfill({ json: receipt(request) }));
    await page.route("**/api/member/evaluations/synthetic-evaluation", (route) => route.fulfill(outcome === "malformed" ? { json: { id: "unbound-receipt" } } : { status: 409, json: { error: "Already submitted" } }));
    await makeReady(page);
    await page.getByLabel("Overall observable evidence (optional)").fill("Private final observations retained");
    await page.getByRole("button", { name: "Review evaluation", exact: true }).click();
    await page.getByRole("button", { name: "Confirm and lock evaluation" }).click();
    await expect(page.getByText(/this evaluation may already be locked/)).toBeVisible();
    await expect(page.getByText("Evaluation submitted and locked.", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Overall observable evidence (optional)")).toHaveValue("Private final observations retained");
    expect(await page.evaluate(() => sessionStorage.getItem("mecg:evaluation-draft:v1:synthetic-evaluation"))).toContain("Private final observations retained");
  });
}
