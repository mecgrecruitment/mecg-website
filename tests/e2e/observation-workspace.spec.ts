import { expect, test } from "@playwright/test";

test("event search preserves an unfinished note and a successful save permits later editing", async ({ page }) => {
  const writes: unknown[] = [];
  await page.route("**/api/member/impressions", route => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({ json: { id: "synthetic-observation" } });
  });
  await page.goto("/apply/test-harness/observations");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  const ada = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Ada Example" }) });
  const note = ada.getByRole("textbox", { name: "Factual note" });
  await note.fill("Asked a clarifying question.");
  const search = page.getByRole("searchbox", { name: "Find an applicant you spoke with" });
  await search.fill("Bo");
  await expect(ada).toBeHidden();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(note).toHaveValue("Asked a clarifying question.");
  await ada.getByRole("button", { name: "Save observation", exact: true }).click();
  await expect(ada.getByRole("status")).toHaveText("Observation saved.");
  await expect(note).toBeEnabled();
  await note.fill("Asked a clarifying question and checked the assumption.");
  await expect(ada.getByRole("status")).toHaveCount(0);
  await ada.getByRole("button", { name: "Save observation", exact: true }).click();
  await expect(ada.getByRole("status")).toHaveText("Observation saved.");
  expect(writes).toHaveLength(2);
  expect(writes[1]).toMatchObject({ applicationId: "synthetic-ada", note: "Asked a clarifying question and checked the assumption." });
});
