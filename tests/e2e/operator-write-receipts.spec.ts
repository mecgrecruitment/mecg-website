import { expect, test } from "@playwright/test";

for (const control of ["release", "rubric"] as const) {
  for (const failure of ["lost", "malformed", "headers-stalled", "body-stalled"] as const) {
    test(`${control}: ${failure} keeps an uncertain write locked and restores useful focus`, async ({ page }) => {
      await page.clock.install();
      const endpoint = control === "release" ? "/api/admin/decisions" : "/api/admin/rush";
      let finish = () => {};
      const gate = new Promise<void>((resolve) => { finish = resolve; });
      let writes = 0;
      if (failure === "body-stalled") {
        await page.addInitScript(({ endpoint }) => {
          const original = window.fetch.bind(window);
          window.fetch = async (input, init) => {
            if (String(input).endsWith(endpoint) && init?.method === "POST") {
              const response = new Response("", { status: 201 });
              response.json = () => new Promise(() => {});
              return response;
            }
            return original(input, init);
          };
        }, { endpoint });
      } else {
        await page.route(`**${endpoint}`, async (route) => {
          writes += 1;
          if (failure === "headers-stalled") await gate;
          if (failure === "malformed") await route.fulfill({ status: 201, json: { ok: true } });
          else await route.abort("connectionreset").catch(() => {});
        });
      }
      page.on("dialog", (dialog) => dialog.accept());
      await page.goto(control === "release" ? "/apply/test-harness/operator-writes" : "/apply/test-harness/rubric");
      await page.locator("[data-application-harness-ready=true]").waitFor({ state: "attached" });
      if (control === "rubric") await page.getByLabel("Name", { exact: true }).first().fill("My retained reasoning criterion");
      const trigger = page.getByRole("button", { name: control === "release" ? "Release outcome" : "Save scoring guide", exact: true });
      await trigger.focus(); await page.keyboard.press("Enter");
      if (failure === "headers-stalled") await expect.poll(() => writes).toBe(1);
      if (failure.includes("stalled")) {
        await expect(page.getByRole("button", { name: control === "release" ? "Releasing…" : "Saving…", exact: true })).toBeVisible();
        await page.clock.fastForward(15_001);
      }
      const result = page.getByLabel(control === "release" ? "Outcome release result" : "Scoring guide save result", { exact: true });
      await expect(result).toContainText(control === "release" ? "Release could not be confirmed" : "The save could not be confirmed");
      await page.clock.runFor(100);
      await expect(result).toBeFocused();
      await expect(trigger).toBeDisabled();
      if (failure !== "body-stalled") expect(writes).toBe(1);
      if (control === "rubric") {
        await expect(page.getByLabel("Name", { exact: true }).first()).toHaveValue("My retained reasoning criterion");
        await expect(page.getByLabel("Name", { exact: true }).first()).toBeEnabled();
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download private scoring guide copy" }).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe("scoring-guide-private-copy.json");
        const stream = await download.createReadStream();
        if (!stream) throw new Error("Private copy download unavailable");
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        expect(Buffer.concat(chunks).toString()).toContain("My retained reasoning criterion");
      }
      finish();
    });
  }
  test(`${control}: an operation-specific receipt confirms the write`, async ({ page }) => {
    const endpoint = control === "release" ? "/api/admin/decisions" : "/api/admin/rush";
    await page.route(`**${endpoint}`, (route) => route.fulfill({ status: 201, json: control === "release"
      ? { decisionId: "synthetic-decision", released: true, notified: false, queued: true }
      : { id: "legacy-text-rubric-id", roundId: "synthetic-rubric-round" } }));
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(control === "release" ? "/apply/test-harness/operator-writes" : "/apply/test-harness/rubric");
    await page.getByRole("button", { name: control === "release" ? "Release outcome" : "Save scoring guide", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: control === "release" ? "Outcome released to the applicant. Notification is queued." : "Scoring guide saved." })).toBeVisible();
  });
}

for (const control of ["release", "rubric"] as const) {
  test(`${control}: a receipt for another target cannot confirm this operation`, async ({ page }) => {
    const endpoint = control === "release" ? "/api/admin/decisions" : "/api/admin/rush";
    await page.route(`**${endpoint}`, (route) => route.fulfill({ json: control === "release"
      ? { decisionId: "different-decision", released: true, notified: true, queued: false }
      : { id: "actual-rubric", roundId: "different-round" } }));
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(control === "release" ? "/apply/test-harness/operator-writes" : "/apply/test-harness/rubric");
    const trigger = page.getByRole("button", { name: control === "release" ? "Release outcome" : "Save scoring guide", exact: true });
    await trigger.click();
    await expect(page.getByRole("status").filter({ hasText: "could not be confirmed" })).toBeVisible();
    await expect(trigger).toBeDisabled();
  });
  test(`${control}: a known rejection preserves the operator's choice for correction`, async ({ page }) => {
    const endpoint = control === "release" ? "/api/admin/decisions" : "/api/admin/rush";
    let writes = 0;
    await page.route(`**${endpoint}`, (route) => { writes += 1; return route.fulfill({ status: 400, json: { error: "Round rules need correction" } }); });
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(control === "release" ? "/apply/test-harness/operator-writes" : "/apply/test-harness/rubric");
    if (control === "rubric") await page.getByLabel("Name", { exact: true }).first().fill("Retained rejected wording");
    const trigger = page.getByRole("button", { name: control === "release" ? "Release outcome" : "Save scoring guide", exact: true });
    await trigger.click();
    await expect(page.getByRole("alert").filter({ hasText: "Round rules need correction" })).toHaveText("Round rules need correction");
    await expect(trigger).toBeEnabled();
    expect(writes).toBe(1);
    if (control === "rubric") await expect(page.getByLabel("Name", { exact: true }).first()).toHaveValue("Retained rejected wording");
  });
}
