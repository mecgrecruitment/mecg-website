import { expect, test } from "@playwright/test";

test("opening calibration warns before leaving unconfirmed observations and cancel preserves them", async ({ page }) => {
  await page.route("**/api/member/group-case/ratings", (route) => route.abort("connectionreset"));
  await page.goto("/apply/test-harness/group-case");
  await page.locator("[data-application-harness-ready=true]").waitFor({ state: "attached" });
  await page.getByRole("button", { name: /Synthetic Applicant/ }).click();
  const note = page.getByLabel("Note for Synthetic Applicant");
  await note.fill("Preserve these unconfirmed observations");
  await note.press("Tab");
  await expect(page.getByText(/Save could not be confirmed/).first()).toBeVisible();

  const dialogPromise = page.waitForEvent("dialog");
  const opening = page.getByRole("link", { name: "Read the rubric", exact: true }).click();
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe("confirm");
  expect(dialog.message()).toContain("Leaving may lose changes");
  await dialog.dismiss();
  await opening;

  await expect(page).toHaveURL(/\/apply\/test-harness\/group-case$/);
  await expect(note).toHaveValue("Preserve these unconfirmed observations");
  await expect(page.getByRole("button", { name: "Download observations", exact: true })).toBeVisible();
});
