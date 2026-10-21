import { expect, test, type Locator, type Page } from "@playwright/test";

// Deliberately use only sequential native keyboard input for application controls.
// API/auth/navigation boundaries remain intercepted local fixtures, not hosted proof.
async function tabTo(page: Page, target: Locator, reverse = false) {
  for (let index = 0; index < 80; index += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      await expect(target).toBeVisible();
      await expect(target).toBeInViewport();
      return;
    }
    await page.keyboard.press(reverse ? "Shift+Tab" : "Tab");
  }
  throw new Error(`Keyboard could not reach ${await target.getAttribute("id") ?? await target.textContent()}`);
}

async function enter(page: Page, target: Locator) {
  await tabTo(page, target);
  await page.keyboard.press("Enter");
}

async function replaceText(page: Page, target: Locator, value: string) {
  await tabTo(page, target);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  if (value) await page.keyboard.type(value);
}

test("native keyboard traverses validation, revision recovery, materials and consent before confirmed navigation", async ({ page }) => {
  let conflictAllowed = false;
  let conflictSent = false;
  const drafts: { expectedRevision: string; draft: { name: string; classYear: string; answers: Record<string, string> } }[] = [];
  await page.route("**/api/apply/draft", async (route) => {
    const request = route.request().postDataJSON();
    drafts.push(request);
    if (conflictAllowed && !conflictSent) {
      conflictSent = true;
      return route.fulfill({ status: 409, json: { kind: "conflict", draft: { ...request.draft, name: "Ada Saved Keyboard", answers: { motivation: "An answer saved on another device." }, revision: "20000000-0000-4000-8000-000000000001" } } });
    }
    return route.fulfill({ json: { kind: "saved", revision: "30000000-0000-4000-8000-000000000001" } });
  });
  let submission: { name: string; consent: boolean; answers: Record<string, string> } | null = null;
  await page.route("**/api/apply", (route) => {
    submission = route.request().postDataJSON();
    return route.fulfill({ json: { applicationId: "e2e" } });
  });
  // The actual dashboard is verified separately by its SSR fixtures. This document
  // marks the navigation boundary explicitly rather than pretending to authenticate.
  await page.route("**/applicant?submitted=**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Local navigation boundary</title><main><h1>Local applicant navigation boundary</h1></main>" }));
  await page.goto("/apply/test-harness");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  const fullName = page.getByLabel(/^Full name/);
  const next = page.getByRole("button", { name: "Continue", exact: true });
  await replaceText(page, fullName, "");
  await enter(page, next);
  await expect(fullName).toBeFocused();
  await expect(fullName).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#name-error")).toBeVisible();
  conflictAllowed = true;
  await page.keyboard.type("Ada Local Keyboard");
  await expect(page.getByRole("heading", { name: "Your saved draft changed elsewhere" })).toBeFocused();
  const nameChoices = page.getByRole("group", { name: "Full name", exact: true });
  const browserName = nameChoices.getByRole("radio", { name: "Use browser answers", exact: true });
  await tabTo(page, browserName);
  await page.keyboard.press("ArrowLeft");
  await expect(nameChoices.getByRole("radio", { name: "Use saved draft", exact: true })).toBeChecked();
  await page.keyboard.press("ArrowRight");
  await expect(browserName).toBeChecked();
  const answerChoices = page.getByRole("group", { name: "Why MECG?", exact: true });
  await tabTo(page, answerChoices.getByRole("radio", { name: "Use browser answers", exact: true }));
  await page.keyboard.press("ArrowLeft");
  await expect(answerChoices.getByRole("radio", { name: "Use saved draft", exact: true })).toBeChecked();
  await enter(page, page.getByRole("button", { name: "Continue with combined answers", exact: true }));
  await expect(page.getByRole("heading", { name: "Start with the basics." })).toBeFocused();
  await expect(fullName).toHaveValue("Ada Local Keyboard");
  const year = page.getByLabel(/^Year/);
  await tabTo(page, year);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Tab");
  await expect(year).toHaveValue("SOPHOMORE");
  await tabTo(page, year, true);
  await expect(year).toBeFocused();
  await enter(page, next);
  await expect(page.getByRole("heading", { name: "Tell us how you think." })).toBeFocused();
  const answer = page.getByLabel("Why MECG?", { exact: false });
  await expect(answer).toHaveValue("An answer saved on another device.");
  await replaceText(page, answer, "I tested assumptions with teammates and revised our recommendation after reviewing contradictory evidence.");
  await enter(page, next);
  await expect(page.getByRole("heading", { name: "Add your materials." })).toBeFocused();
  await replaceText(page, page.getByLabel(/^LinkedIn profile/), "https://linkedin.com/in/synthetic-keyboard");
  await replaceText(page, page.getByLabel(/^Scheduling or access needs/), "Please provide accessible recruitment materials.");
  await enter(page, next);
  await expect(page.getByRole("heading", { name: "Review before you submit." })).toBeFocused();
  const consent = page.getByRole("checkbox");
  await enter(page, page.getByRole("button", { name: "Submit application", exact: true }));
  await expect(consent).toBeFocused();
  await expect(consent).toHaveAccessibleDescription("Check this box to confirm you reviewed your application before submitting.");
  expect(submission).toBeNull();
  await page.keyboard.press("Space");
  await expect(consent).not.toHaveAttribute("aria-invalid", "true");
  await expect(consent).toBeChecked();
  await enter(page, page.getByRole("button", { name: "Submit application", exact: true }));
  await expect(page).toHaveURL(/\/applicant\?submitted=e2e$/);
  expect(submission).toMatchObject({ name: "Ada Local Keyboard", consent: true });
  expect(drafts.some((request) => request.expectedRevision === "20000000-0000-4000-8000-000000000001")).toBe(true);
  expect(await page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"))).toBeNull();
});
