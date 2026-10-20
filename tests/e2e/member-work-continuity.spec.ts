import { expect, test } from "@playwright/test";

for (const state of ["FROZEN", "FINALIZED", "ARCHIVED", "expired"]) {
  test(`${state} Group Case retains readable evidence and disables editing`, async ({ page }) => {
    let writes = 0;
    await page.route("**/api/member/group-case/ratings", async (route) => { writes++; await route.fulfill({ status: 500, json: { error: "unexpected write" } }); });
    await page.goto(`/apply/test-harness/group-case?state=${state}`);
    await expect(page.getByText("This round is read-only.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: /Synthetic Applicant/ }).click();
    await expect(page.getByLabel("Note for Synthetic Applicant")).toBeDisabled();
    const stars = page.getByRole("group", { name: "Synthetic Applicant, Team Collaboration", exact: true }).getByRole("button");
    await expect(stars).toHaveCount(5);
    for (const star of await stars.all()) await expect(star).toBeDisabled();
    await page.getByPlaceholder(/Search/).fill("Synthetic");
    await expect(page.getByRole("button", { name: /Synthetic Applicant/ })).toBeVisible();
    expect(writes).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
