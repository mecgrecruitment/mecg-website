import { expect, test } from "@playwright/test";

for (const path of ["/home", "/work", "/team", "/join", "/contact"]) {
  test(`${path} has one public heading, indexable metadata, and fits the viewport`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://mecgmichigan.com${path}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("mobile menu supports Escape and returns focus to its trigger", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 600 });
  await page.goto("/home");
  const trigger = page.getByRole("button", { name: "Menu", exact: true });
  await trigger.click();
  const menu = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "Client Services", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await menu.getByRole("link", { name: "Client Services", exact: true }).click();
  await expect(page).toHaveURL(/\/work$/);
  await expect(menu).toHaveCount(0);
});

test("students can find preparation materials and evaluation criteria", async ({ page }) => {
  await page.goto("/join");
  await expect(page.getByRole("heading", { name: "Have your materials ready" })).toBeVisible();
  await expect(page.getByText("Clear communication", { exact: true })).toBeVisible();
  await page.getByText("How do I prepare?", { exact: true }).click();
  await page.getByRole("link", { name: "See our evaluation criteria" }).click();
  await expect(page).toHaveURL(/#how-we-evaluate$/);
});

test("clients can inspect engagement terms and receive an inquiry confirmation", async ({ page }) => {
  await page.goto("/work");
  await page.getByText("What does pro bono mean?", { exact: true }).click();
  await expect(page.getByText(/MECG does not charge a consulting fee/)).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Discuss a project" }).first().click();
  await expect(page).toHaveURL(/\/contact#message$/);
  await expect(page.getByRole("heading", { name: "What happens next" })).toBeVisible();
  await page.route("**/api/contact", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }));
  await page.getByLabel("Name", { exact: true }).fill("Synthetic client");
  await page.getByLabel("Email", { exact: true }).fill("client@example.com");
  await page.getByLabel("Subject", { exact: true }).fill("A semester project");
  await page.getByLabel("Message", { exact: true }).fill("We would like to understand our customer research options.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText("Your message was sent");
});

test("the engagement steps connect each station to its handoff", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/home");
  const disclosure = page.getByRole("button", { name: "Explore the four steps", exact: true });
  if (await disclosure.isVisible()) {
    await expect(disclosure).toHaveAttribute("aria-expanded", "false");
    await disclosure.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Close the engagement bench" })).toHaveAttribute("aria-expanded", "true");
  }
  const stations = page.getByRole("group", { name: "Engagement stations" });
  const handoff = stations.getByRole("button", { name: "04 Recommend and hand off" });
  await handoff.click();
  await expect(handoff).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("figure", { name: "Explore the four steps of a MECG engagement" }).locator("figcaption > div:visible")).toContainText("A decision brief, supporting files, and implementation plan.");
  await stations.getByRole("button", { name: "01 Explore fit" }).click();
  await expect(page.getByRole("figure", { name: "Explore the four steps of a MECG engagement" }).locator("figcaption > div:visible")).toContainText("A shared view of whether MECG is the right team.");
  await expect(page.locator(".home-step-content")).toHaveCSS("animation-name", "none");
});

test("a chosen project question carries its area into the contact form", async ({ page }) => {
  await page.goto("/home");
  const areas = page.getByRole("group", { name: "Explore a project area" });
  const data = areas.getByRole("button", { name: "Data Analytics", exact: true });
  await data.focus();
  await page.keyboard.press("Enter");
  await expect(data).toHaveAttribute("aria-pressed", "true");
  await expect(areas.getByRole("button", { name: "Strategy", exact: true })).toHaveAttribute("aria-pressed", "false");
  const approach = page.getByRole("region", { name: "Project approach" });
  await expect(approach.getByRole("heading")).toHaveText("What is our data telling us?");
  await approach.getByRole("link", { name: "Discuss this question" }).click();
  await expect(page).toHaveURL(/\/contact\?subject=Data%20Analytics%20project%20inquiry&question=What%20is%20our%20data%20telling%20us%3F#message$/);
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue("Data Analytics project inquiry");
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("Example question we started from: What is our data telling us?\n\n");
  await page.getByLabel("Subject", { exact: true }).fill("A more specific question");
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue("A more specific question");
});

test("the homepage leads with the PwC photo, then client evidence, then the project questions", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("MECG Pro bono consulting, led by Michigan students.");
  await expect(page.locator(".home-hero").getByRole("img", { name: "MECG members visiting PwC in Chicago" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Chapter photographs" })).toHaveCount(0);
  await expect(page.locator(".home-community").getByRole("img", { name: "MECG members together by the Chicago River" })).toBeVisible();
  const sections = await page.locator("main > section").evaluateAll(elements => elements.map(element => element.getAttribute("aria-labelledby")));
  expect(sections.indexOf("home-title")).toBeLessThan(sections.indexOf("partners-title"));
  expect(sections.indexOf("partners-title")).toBeLessThan(sections.indexOf("questions-title"));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
