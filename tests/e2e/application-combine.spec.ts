import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

async function open(page: Page, path = "/apply/test-harness") {
  await page.goto(path);
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
}

test("stale browser recovery exports both copies and combines selected answers without an early write", async ({ page }, testInfo) => {
  let allowSave = false;
  const savedDrafts: { name: string; answers: Record<string, string> }[] = [];
  await page.route("**/api/apply/draft", async (route) => {
    if (allowSave) savedDrafts.push(route.request().postDataJSON().draft);
    await route.fulfill({ status: allowSave ? 200 : 503, json: { kind: "saved", revision: "20000000-0000-4000-8000-000000000001" } });
  });
  await open(page);
  await page.getByLabel(/^Full name/).fill("Ada Browser");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const localEssay = "Useful browser response. ".repeat(45);
  await page.getByLabel("Why MECG?", { exact: false }).fill(localEssay);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"))).toContain(localEssay);
  page.on("dialog", (dialog) => dialog.accept());
  await open(page, "/apply/test-harness?draft=newer");
  await expect(page.getByRole("heading", { name: "Choose which answers to continue with" })).toBeFocused();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download both copies", exact: true }).click();
  const download = await downloadEvent;
  const path = await download.path();
  if (!path) throw new Error("Expected private local download");
  const exported = JSON.parse(await readFile(path, "utf8"));
  expect(exported.saved.answers.name).toBe("Ada Saved");
  expect(exported.browser.answers.name).toBe("Ada Browser");
  expect(exported.browser.answers.answers.motivation).toBe(localEssay);
  await page.getByText("Compare answers before choosing", { exact: true }).click();
  await page.getByRole("group", { name: "Full name", exact: true }).getByLabel("Use saved draft", { exact: true }).check();
  await expect(page.getByRole("group", { name: "Why MECG?", exact: true }).getByLabel("Use browser answers", { exact: true })).toBeChecked();
  expect(savedDrafts).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mixed-application-copies.png"), fullPage: true });
  allowSave = true;
  await page.getByRole("button", { name: "Continue with combined answers", exact: true }).click();
  await expect(page.getByLabel("Why MECG?", { exact: false })).toHaveValue(localEssay);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel(/^Full name/)).toHaveValue("Ada Saved");
  await expect.poll(() => savedDrafts.some((draft) => draft.name === "Ada Saved" && draft.answers.motivation === localEssay)).toBe(true);
});

test("a revision conflict combines each chosen field and retries against the reviewed server revision", async ({ page }) => {
  let conflictSent = false;
  const requests: { expectedRevision: string; draft: { name: string; answers: Record<string, string>; consent?: boolean } }[] = [];
  await page.route("**/api/apply/draft", async (route) => {
    const request = route.request().postDataJSON();
    requests.push(request);
    if (!conflictSent) {
      conflictSent = true;
      return route.fulfill({ status: 409, json: { kind: "conflict", draft: { ...request.draft, revision: "20000000-0000-4000-8000-000000000001", name: "Ada Saved Elsewhere", answers: { motivation: "Other-device response to retain." } } } });
    }
    return route.fulfill({ json: { kind: "saved", revision: "30000000-0000-4000-8000-000000000001" } });
  });
  await open(page);
  await page.getByLabel(/^Full name/).fill("Ada Browser Current");
  await expect(page.getByRole("heading", { name: "Your saved draft changed elsewhere" })).toBeFocused();
  await page.getByRole("group", { name: "Why MECG?", exact: true }).getByLabel("Use saved draft", { exact: true }).check();
  await page.getByRole("button", { name: "Continue with combined answers", exact: true }).click();
  await expect(page.getByLabel(/^Full name/)).toHaveValue("Ada Browser Current");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Why MECG?", { exact: false })).toHaveValue("Other-device response to retain.");
  await expect.poll(() => requests.length).toBeGreaterThan(1);
  const combined = requests.at(-1);
  expect(combined?.expectedRevision).toBe("20000000-0000-4000-8000-000000000001");
  expect(combined?.draft.name).toBe("Ada Browser Current");
  expect(combined?.draft.answers.motivation).toBe("Other-device response to retain.");
  expect(combined?.draft.consent).toBe(false);
});
