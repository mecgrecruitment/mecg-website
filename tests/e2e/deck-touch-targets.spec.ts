import { expect, test } from "@playwright/test";

for (const width of [320, 390]) {
  test(`discussion controls retain 44px targets without overflow at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/admin/hash/live?cycleId=synthetic-deck-cycle", (route) => route.fulfill({ json: { tally: [] } }));
    await page.route("**/api/admin/rush", (route) => route.fulfill({ json: { id: "synthetic-deck-0" } }));
    await page.goto("/apply/test-harness/deck");
    await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
    for (const name of ["By score", "A to Z", "Revisits (0)", "Present to members", "Presentation motion", "Previous", "Revisit (U)", "Next"]) {
      const box = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect.soft(box?.height, `${name} height`).toBeGreaterThanOrEqual(44);
      expect.soft(box?.width, `${name} width`).toBeGreaterThanOrEqual(44);
    }
    const exit = await page.getByRole("link", { name: "Exit", exact: true }).boundingBox();
    expect.soft(exit?.height, "Exit height").toBeGreaterThanOrEqual(44);
    expect.soft(exit?.width, "Exit width").toBeGreaterThanOrEqual(44);
    const search = page.getByRole("searchbox", { name: "Jump to a name" });
    expect.soft((await search.boundingBox())?.height, "Search height").toBeGreaterThanOrEqual(44);
    await search.fill("Ada");
    const result = await page.getByRole("button", { name: "Ada Example", exact: true }).boundingBox();
    expect.soft(result?.height, "Search result height").toBeGreaterThanOrEqual(44);
    expect.soft(result?.width, "Search result width").toBeGreaterThanOrEqual(44);
    await search.press("Escape");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`deck-${width}.png`), fullPage: true });
  });
}

for (const viewport of [{ width: 320, height: 900 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`discussion identity keeps the ready voting action accessible at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    let applied = 0;
    await page.route("**/headshot", (route) => route.abort());
    await page.route("**/api/admin/hash/live?cycleId=synthetic-deck-cycle", (route) => route.fulfill({ json: { tally: [0, 1].map((index) => ({ applicationId: `synthetic-deck-${index}`, yes: 2, no: 0, unsure: 0, total: 2, quorum: 2, outcome: "ADVANCED" })) } }));
    await page.route("**/api/admin/rush", (route) => {
      if (route.request().postDataJSON().action === "APPLY_STAGE_HASH") applied += 1;
      return route.fulfill({ json: { id: "IN_PROCESS" } });
    });
    await page.goto("/apply/test-harness/deck");
    await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
    await expect(page.getByText("ZE", { exact: true })).toBeVisible();
    const heading = page.getByRole("heading", { name: "Zoe Example", exact: true });
    const reveal = page.getByRole("button", { name: "Reveal and apply result", exact: true });
    await expect(reveal).toBeEnabled();
    if (viewport.width < 640) {
      await expect(heading).toBeInViewport();
      await expect(reveal).toBeInViewport({ ratio: 1 });
    } else {
      expect((await page.getByText("ZE", { exact: true }).boundingBox())?.width).toBe(224);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    expect(applied).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`deck-ready-${viewport.width}.png`), fullPage: true });
  });
}
