import { expect, test, type Page } from "@playwright/test";
const revision = "22222222-2222-4222-8222-222222222222";
const nextRevision = "33333333-3333-4333-8333-333333333333";
const quality = { valid: false, coverage: 0, observedCount: 0, criteriaCount: 2, minimumObserved: 2, missingRequired: ["Team Collaboration"] };
const savedAt = "2026-10-16T20:00:00Z";
type Write = { roundId: string; applicationId: string; note: string; scores: Record<string, number | null>; mutationId: string; expectedRevision: string | null };
async function open(page: Page) {
  await page.goto("/apply/test-harness/group-case");
  await page.locator("[data-application-harness-ready=true]").waitFor({ state: "attached" });
  await page.getByRole("button", { name: /Synthetic Applicant/ }).click();
  return page.getByLabel("Note for Synthetic Applicant");
}
for (const stall of ["headers", "body"] as const) {
  test(`a ${stall} timeout retains exact pending mutation while newer edits wait`, async ({ page }) => {
    await page.clock.install();
    const bodies: Write[] = [];
    let finish = () => {};
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    if (stall === "body") await page.addInitScript(() => {
      const original = window.fetch.bind(window);
      let first = true;
      window.fetch = async (input, init) => {
        if (String(input).includes("/api/member/group-case/ratings") && first) {
          first = false;
          const response = new Response("", { status: 200 }); response.json = () => new Promise(() => {});
          return response;
        }
        return original(input, init);
      };
    });
    await page.route("**/api/member/group-case/ratings", async (route) => {
      const body: Write = route.request().postDataJSON(); bodies.push(body);
      if (stall === "headers" && bodies.length === 1) { await gate; await route.abort().catch(() => {}); return; }
      await route.fulfill({ json: { ...body, kind: "saved", revision: bodies.length > (stall === "headers" ? 2 : 1) ? nextRevision : revision, savedAt, quality } });
    });
    const note = await open(page);
    await note.fill("Earlier pending note"); await note.press("Tab");
    await expect(page.getByText("Saving…", { exact: true })).toBeVisible();
    await note.fill("Newer local observation");
    await page.clock.fastForward(15_001);
    await expect(page.getByText(/Save could not be confirmed/).first()).toBeVisible();
    await expect(note).toHaveValue("Newer local observation");
    await page.clock.resume();
    const beforeRetry = bodies.length;
    await page.getByRole("button", { name: "Retry save", exact: true }).click();
    await expect(page.getByText("Evidence saved · review incomplete", { exact: true })).toBeVisible();
    expect(bodies.length).toBe(beforeRetry + 2);
    const retried = bodies[stall === "headers" ? 1 : 0];
    const newer = bodies.at(-1)!;
    if (stall === "headers") expect(retried).toEqual(bodies[0]);
    expect(retried.note).toBe("Earlier pending note");
    expect(retried.expectedRevision).toBeNull();
    expect(newer.note).toBe("Newer local observation");
    expect(newer.mutationId).not.toBe(retried.mutationId);
    expect(newer.expectedRevision).toBe(revision);
    finish();
  });
}
for (const choice of ["local", "server"] as const) {
  test(`a conflict preserves both private copies and requires explicit ${choice} choice`, async ({ page }, testInfo) => {
    const bodies: Write[] = [];
    await page.route("**/api/member/group-case/ratings", async (route) => {
      const body: Write = route.request().postDataJSON(); bodies.push(body);
      await route.fulfill(bodies.length === 1 ? { status: 409, json: { kind: "conflict", snapshot: { applicationId: body.applicationId, revision, note: "Other tab saved note", scores: { collaboration: 4, presentation: null }, savedAt, quality } } }
        : { json: { ...body, kind: "saved", revision: nextRevision, savedAt, quality } });
    });
    const note = await open(page);
    await note.fill("My local note"); await note.press("Tab");
    const heading = page.getByRole("heading", { name: "Choose which observations to keep" });
    await expect(heading).toBeVisible();
    await expect(note).toBeDisabled();
    await expect(page.getByRole("paragraph").filter({ hasText: /^My local note$/ })).toBeVisible();
    await expect(page.getByText("Other tab saved note", { exact: true })).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`conflict-${choice}-current.png`), fullPage: true });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download observations" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    if (!stream) throw new Error("Private evidence copy unavailable");
    const chunks = []; for await (const chunk of stream) chunks.push(chunk);
    const copy = Buffer.concat(chunks).toString();
    expect(copy).toContain("My local note"); expect(copy).toContain("Other tab saved note");
    await page.getByRole("button", { name: choice === "local" ? "Keep this page’s observations" : "Use current server copy" }).click();
    await expect(heading).toHaveCount(0);
    await expect(note).toBeEnabled();
    if (choice === "local") {
      await expect.poll(() => bodies.length).toBe(2);
      expect(bodies[1].note).toBe("My local note"); expect(bodies[1].expectedRevision).toBe(revision);
      expect(bodies[1].mutationId).not.toBe(bodies[0].mutationId);
    } else { await expect(note).toHaveValue("Other tab saved note"); expect(bodies).toHaveLength(1); }
  });
}
test("a stale mutation receipt cannot acknowledge this page's pending evidence", async ({ page }) => {
  await page.route("**/api/member/group-case/ratings", async (route) => {
    await route.fulfill({ json: { ...route.request().postDataJSON(), mutationId: "99999999-9999-4999-8999-999999999999", kind: "saved", revision, savedAt, quality } });
  });
  const note = await open(page); await note.fill("Retain this evidence"); await note.press("Tab");
  await expect(page.getByText(/Save could not be confirmed/).first()).toBeVisible();
  await expect(note).toHaveValue("Retain this evidence");
  await expect(page.getByText("Evidence saved · review incomplete", { exact: true })).toHaveCount(0);
});

test("clearing all local observations after an unknown first save still permits exact pending retry", async ({ page }) => {
  const bodies: Write[] = [];
  await page.route("**/api/member/group-case/ratings", async (route) => {
    const body: Write = route.request().postDataJSON(); bodies.push(body);
    if (bodies.length === 1) { await route.abort("connectionreset"); return; }
    await route.fulfill({ json: { ...body, kind: "saved", revision: bodies.length === 2 ? revision : nextRevision, savedAt, quality } });
  });
  const note = await open(page);
  await note.fill("Earlier observation with unknown acknowledgement"); await note.press("Tab");
  await expect(page.getByText(/Save could not be confirmed/).first()).toBeVisible();
  await note.fill(""); await note.press("Tab");
  const retry = page.getByRole("button", { name: "Retry save", exact: true });
  await expect(retry).toBeEnabled(); await retry.click();
  await expect.poll(() => bodies.length).toBe(3);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies[2].note).toBe(""); expect(bodies[2].expectedRevision).toBe(revision);
  expect(bodies[2].scores).toEqual({ collaboration: null, presentation: null });
  await expect(note).toHaveValue("");
  await expect(page.getByText("Evidence saved · review incomplete", { exact: true })).toBeVisible();
});

test("a note receipt arriving between star pointer-down and pointer-up preserves the rating click", async ({ page }) => {
  const bodies: Write[] = [];
  let finish = () => {};
  const gate = new Promise<void>((resolve) => { finish = resolve; });
  await page.route("**/api/member/group-case/ratings", async (route) => {
    const body: Write = route.request().postDataJSON(); bodies.push(body);
    if (bodies.length === 1) await gate;
    await route.fulfill({ json: { ...body, kind: "saved", revision, savedAt, quality } });
  });
  const note = await open(page); await note.fill("Note immediately before rating");
  const star = page.getByRole("group", { name: "Synthetic Applicant, Team Collaboration", exact: true }).getByRole("button").nth(3);
  await star.scrollIntoViewIfNeeded();
  const box = await star.boundingBox(); if (!box) throw new Error("Rating target unavailable");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => bodies.length).toBe(1);
  finish();
  await expect(page.getByText("Evidence saved · review incomplete", { exact: true })).toBeVisible();
  await page.mouse.up();
  await expect.poll(() => bodies.some((body) => body.scores.collaboration === 4)).toBe(true);
});
