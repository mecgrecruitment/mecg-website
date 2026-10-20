import { expect, test } from "@playwright/test";

const quality = { valid: false, coverage: 0, observedCount: 0, criteriaCount: 2, minimumObserved: 2, missingRequired: ["Team Collaboration"] };
const revision = "22222222-2222-4222-8222-222222222222";
const savedAt = "2026-10-16T20:00:00Z";

test("observation-only notes autosave and blur-save without invented scores and display canonical blockers", async ({ page }, testInfo) => {
  const bodies: Array<{ scores: Record<string, number | null>; note: string }> = [];
  await page.route("**/api/member/group-case/ratings", async (route) => {
    const body = route.request().postDataJSON(); bodies.push(body);
    await route.fulfill({ json: { ...body, kind: "saved", revision, savedAt, quality } });
  });
  await page.goto("/apply/test-harness/group-case");
  await page.getByRole("button", { name: /Synthetic Applicant/ }).click();
  const note = page.getByLabel("Note for Synthetic Applicant");
  await note.fill("Observed listening without enough evidence to rate.");
  await expect(page.getByText("Evidence saved · review incomplete", { exact: true })).toBeVisible();
  expect(bodies[0].scores).toEqual({ collaboration: null, presentation: null });
  await expect(page.getByText(/0 of 2 minimum observations/)).toBeVisible();
  await expect(page.getByText(/required: Team Collaboration/)).toBeVisible();
  await expect(page.getByText(/0% weighted coverage; 75% needed/)).toBeVisible();
  await note.fill("A second observation flushed on blur.");
  await note.press("Tab");
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1].note).toBe("A second observation flushed on blur.");
  expect(bodies[1].scores).toEqual({ collaboration: null, presentation: null });
  await expect(page.getByText("Evidence saved · review incomplete", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("note-only-blockers.png"), fullPage: true });
});

test("failed note save keeps text and retry uses the same null scores", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/member/group-case/ratings", async (route) => {
    calls++;
    await route.fulfill(calls === 1 ? { status: 409, json: { error: "Round is unavailable" } } : { json: { ...route.request().postDataJSON(), kind: "saved", revision, savedAt, quality } });
  });
  await page.goto("/apply/test-harness/group-case");
  await page.getByRole("button", { name: /Synthetic Applicant/ }).click();
  await page.getByLabel("Note for Synthetic Applicant").fill("Keep this synthetic observation.");
  await expect(page.getByRole("paragraph").filter({ hasText: /^Round is unavailable$/ })).toBeVisible();
  await expect(page.getByText(/only in this open page/)).toBeVisible();
  await expect(page.getByLabel("Note for Synthetic Applicant")).toHaveValue("Keep this synthetic observation.");
  await page.getByRole("button", { name: "Retry save" }).click();
  await expect(page.getByText("Evidence saved · review incomplete", { exact: true })).toBeVisible();
  expect(calls).toBe(2);
});

for (const variant of ["legacy", "wrong-applicant", "malformed"] as const) {
  test(`${variant} receipt never claims a qualifying review`, async ({ page }) => {
    await page.route("**/api/member/group-case/ratings", async (route) => {
      const body = route.request().postDataJSON();
      await route.fulfill({ json: { ...body, kind: "saved", revision, savedAt, ...(variant === "wrong-applicant" ? { applicationId: "someone-else", quality } : variant === "malformed" ? { quality: { ...quality, valid: "true" } } : {}) } });
    });
    await page.goto("/apply/test-harness/group-case");
    await page.getByRole("button", { name: /Synthetic Applicant/ }).click();
    await page.getByLabel("Note for Synthetic Applicant").fill("Synthetic evidence.");
    await expect(page.getByRole("paragraph").filter({ hasText: /Save could not be confirmed/ })).toBeVisible();
    await expect(page.getByText("Your review meets the grading requirements.")).toHaveCount(0);
  });
}

test("server-valid partial criterion count is qualifying; clearing its final score preserves note-only evidence", async ({ page }, testInfo) => {
  const bodies: Array<{ scores: Record<string, number | null> }> = [];
  await page.route("**/api/member/group-case/ratings", async (route) => {
    const body = route.request().postDataJSON(); bodies.push(body);
    await route.fulfill({ json: { ...body, kind: "saved", revision, savedAt, quality: body.scores.collaboration ? { ...quality, valid: true, coverage: 0.75, minimumObserved: 1, observedCount: 1, missingRequired: [] } : quality } });
  });
  await page.goto("/apply/test-harness/group-case");
  await page.getByRole("button", { name: /Synthetic Applicant/ }).click();
  await page.getByLabel("Note for Synthetic Applicant").fill("Observed collaboration only.");
  await page.getByRole("group", { name: "Synthetic Applicant, Team Collaboration", exact: true }).getByRole("button").nth(3).click();
  await expect(page.getByText("Your review meets the grading requirements.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("saved-rating-current.png"), fullPage: true });
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByText(/does not yet count as a qualifying review/)).toBeVisible();
  expect(bodies.at(-1)?.scores).toEqual({ collaboration: null, presentation: null });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("an older save receipt cannot mark a newer note saved", async ({ page }) => {
  let releaseFirst = () => {};
  const firstMayComplete = new Promise<void>((resolve) => { releaseFirst = resolve; });
  let calls = 0;
  await page.route("**/api/member/group-case/ratings", async (route) => {
    const body = route.request().postDataJSON();
    calls++;
    if (calls === 1) await firstMayComplete;
    await route.fulfill({ json: { ...body, kind: "saved", revision, savedAt, quality } });
  });
  await page.goto("/apply/test-harness/group-case");
  await page.getByRole("button", { name: /Synthetic Applicant/ }).click();
  const note = page.getByLabel("Note for Synthetic Applicant");
  await note.fill("Earlier observation");
  await expect.poll(() => calls).toBe(1);
  await note.fill("Newer unsaved observation");
  releaseFirst();
  
  await expect(note).toHaveValue("Newer unsaved observation");
  await expect(page.getByText("Evidence saved · review incomplete", { exact: true })).toBeVisible();
  expect(calls).toBe(2);
  await note.fill("");
  await note.press("Tab");
  await expect.poll(() => calls).toBe(3);
  await expect(page.getByText("Evidence saved · review incomplete", { exact: true })).toBeVisible();
});
