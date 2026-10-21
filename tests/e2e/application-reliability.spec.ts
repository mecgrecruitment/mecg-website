import { expect, test, type Page } from "@playwright/test";

async function openHarness(page: Page, path = "/apply/test-harness") {
  await page.goto(path);
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
}

test("applicant can advance through failed autosave and reconcile an interrupted submit", async ({ page }) => {
  await page.route("**/api/apply/draft", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily unavailable" }) });
  });
  await page.route("**/api/apply", async (route) => {
    await route.abort("connectionreset");
  });
  let statusReads = 0;
  await page.route("**/api/apply/status?**", async (route) => {
    statusReads += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ application: { applicationId: "e2e", cycleId: "e2e-cycle", status: statusReads >= 3 ? "SUBMITTED" : "DRAFT", submitted: statusReads >= 3 } }),
    });
  });
  await page.route("**/applicant**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Submitted</title><h1>Submitted</h1>" });
  });

  await openHarness(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Tell us how you think." })).toBeVisible();
  await expect(page.locator('[role="alert"]:visible').filter({ hasText: "could not save" })).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Add your materials." })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Review before you submit." })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit application" }).click();

  await expect(page).toHaveURL(/\/applicant\?submitted=e2e$/);
  expect(statusReads).toBe(3);
});


test("step navigation acknowledges the save without waiting for another autosave", async ({ page }) => {
  let saveCount = 0;
  let releaseSave: (() => void) | undefined;
  const responseGate = new Promise<void>((resolve) => { releaseSave = resolve; });
  await page.route("**/api/apply/draft", async (route) => {
    saveCount += 1;
    await responseGate;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ kind: "saved", revision: "20000000-0000-4000-8000-000000000001" }) });
  });
  await openHarness(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tell us how you think." })).toBeFocused();
  await expect.poll(() => saveCount).toBe(1);
  releaseSave?.();
  // The acknowledgement must clear recovery immediately, rather than a later request hiding it.
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"))).toBeNull();
  await expect(page.getByText(/^Saved to your account at |^Saved$/).filter({ visible: true })).toBeVisible();
});

test("storage-disabled applicants can edit and submit without a recovery crash", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } });
  });
  await page.route("**/api/apply/draft", (route) => route.fulfill({ status: 503, body: "{}" }));
  await page.route("**/api/apply", (route) => route.fulfill({ status: 200, json: { applicationId: "e2e" } }));
  await page.route("**/applicant**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Submitted</h1>" }));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openHarness(page);
  await page.getByLabel("Full name").fill("Ada Updated");
  await expect(page.getByText("Tab recovery is unavailable.", { exact: false })).toBeVisible();
  for (let index = 0; index < 3; index += 1) await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit application", exact: true }).click();
  await expect(page).toHaveURL(/\/applicant\?submitted=e2e$/);
  expect(errors).toEqual([]);
});

for (const confirmed of [false, true]) {
  test(`malformed submit acknowledgement ${confirmed ? "reconciles the same-cycle receipt" : "keeps recovery when only an older-cycle submission exists"}`, async ({ page }) => {
    await page.route("**/api/apply/draft", (route) => route.fulfill({ status: 503, body: "{}" }));
    await page.route("**/api/apply", (route) => route.fulfill({ status: 200, json: {} }));
    const checkedCycles: string[] = [];
    await page.route("**/api/apply/status?**", (route) => {
      checkedCycles.push(new URL(route.request().url()).searchParams.get("cycleId") ?? "");
      return route.fulfill({ json: { application: { applicationId: "e2e", cycleId: confirmed ? "e2e-cycle" : "older-cycle", submitted: true, status: "SUBMITTED" } } });
    });
    await page.route("**/applicant**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Submitted</h1>" }));
    await openHarness(page);
    await page.getByLabel("Full name").fill("Ada Receipt Recovery");
    for (let index = 0; index < 3; index += 1) await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Submit application", exact: true }).click();
    if (confirmed) {
      await expect(page).toHaveURL(/\/applicant\?submitted=e2e$/);
      expect(await page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"))).toBeNull();
    } else {
      // Four bounded status reads plus backoff can take up to 13 seconds.
      await expect(page.getByRole("alert").filter({ hasText: "could not confirm whether your application was received" })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("button", { name: "Submit application", exact: true })).toBeEnabled();
      expect(await page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"))).toContain("Ada Receipt Recovery");
      await expect(page).toHaveURL(/\/apply\/test-harness/);
    }
    expect(checkedCycles.length).toBeGreaterThan(0);
    expect(checkedCycles.every((cycle) => cycle === "e2e-cycle")).toBe(true);
  });
}

test("a server acknowledgement failure with unavailable status reads preserves recovery and explains safe retry", async ({ page }) => {
  await page.route("**/api/apply/draft", (route) => route.fulfill({ status: 503, body: "{}" }));
  await page.route("**/api/apply", (route) => route.fulfill({ status: 503, json: { error: "Service unavailable" } }));
  await page.route("**/api/apply/status?**", (route) => route.fulfill({ status: 503, body: "{}" }));
  await openHarness(page);
  await page.getByLabel("Full name").fill("Ada Unknown Receipt");
  for (let index = 0; index < 3; index += 1) await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit application", exact: true }).click();
  const alert = page.getByRole("alert").filter({ hasText: "could not confirm whether your application was received" });
  await expect(alert).toBeVisible({ timeout: 20_000 });
  await expect(alert).toContainText("duplicate submissions are prevented");
  await expect(page.getByRole("button", { name: "Submit application", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"))).toContain("Ada Unknown Receipt");
});

test("submission locks review edits and recovers controls after a server rejection", async ({ page }) => {
  let releaseSubmit: (() => void) | undefined;
  const responseGate = new Promise<void>((resolve) => { releaseSubmit = resolve; });
  let submissions = 0;
  await page.route("**/api/apply/draft", (route) => route.fulfill({ status: 200, body: JSON.stringify({ kind: "saved", revision: "20000000-0000-4000-8000-000000000001" }) }));
  await page.route("**/api/apply", async (route) => {
    submissions += 1;
    await responseGate;
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Please review your application." }) });
  });
  await openHarness(page);
  for (let index = 0; index < 3; index += 1) await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit application", exact: true }).click();
  await expect(page.getByRole("checkbox")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeDisabled();
  for (const edit of await page.getByRole("button", { name: /^Edit/ }).all()) await expect(edit).toBeDisabled();
  releaseSubmit?.();
  await expect(page.locator("#submit-error")).toContainText("Please review your application.");
  await expect(page.getByRole("checkbox")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeEnabled();
  expect(submissions).toBe(1);
});

test("unsynced answers survive reload and sync automatically on reconnect", async ({ page }) => {
  let canSave = false;
  await page.route("**/api/apply/draft", (route) => route.fulfill({ status: canSave ? 200 : 503, body: JSON.stringify({ kind: "saved", revision: "20000000-0000-4000-8000-000000000001" }) }));
  await openHarness(page);
  await page.getByLabel("Full name").fill("Ada Recovered");
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"))).toContain("Ada Recovered");
  // Accept the unsaved-changes prompt to exercise the scoped recovery copy.
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  await expect(page.getByRole("heading", { name: "Choose which answers to continue with" })).toBeFocused();
  await page.getByRole("button", { name: "Recover browser answers", exact: true }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Ada Recovered");
  await expect(page.getByRole("status").filter({ hasText: "Restored your unsynced answers" })).toBeVisible();
  await expect(page.locator('[role="alert"]:visible').filter({ hasText: "could not save" })).toBeVisible();
  canSave = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"))).toBeNull();
});


test("a newly uploaded photo stays ready when returning from review", async ({ page }) => {
  await page.route("**/api/apply/draft", (route) => route.fulfill({ status: 200, body: JSON.stringify({ kind: "saved", revision: "20000000-0000-4000-8000-000000000001" }) }));
  await page.route("**/api/apply/headshot", (route) => route.fulfill({ status: 200, body: "{}" }));
  await openHarness(page, "/apply/test-harness?headshot=required");
  for (let index = 0; index < 2; index += 1) await page.getByRole("button", { name: "Continue", exact: true }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator("#headshot").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(page.getByText("Photo uploaded", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review before you submit." })).toBeVisible();
  await page.getByRole("button", { name: "Edit materials and access" }).click();
  await expect(page.getByText("Replace your photo", { exact: true })).toBeVisible();
  await expect(page.locator("#headshot")).not.toHaveAttribute("required");
  await page.getByRole("button", { name: "Save and return to review", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review before you submit." })).toBeVisible();
});


for (const choice of ["Keep saved draft", "Recover browser answers"]) {
  test(`stale browser recovery preserves both copies until choosing ${choice}`, async ({ page }) => {
    const saves: { name: string; answers: Record<string, string> }[] = [];
    let allowSave = false;
    await page.route("**/api/apply/draft", async (route) => {
      saves.push(route.request().postDataJSON().draft);
      await route.fulfill({ status: allowSave ? 200 : 503, body: JSON.stringify({ kind: "saved", revision: "20000000-0000-4000-8000-000000000001" }) });
    });
    await openHarness(page);
    await page.getByLabel("Full name").fill("Ada Browser");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Why MECG?", { exact: false }).fill("Older unsynced browser answer.");
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"))).toContain("Older unsynced browser answer.");
    const snapshot = await page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"));
    const savedStep = await page.evaluate(() => sessionStorage.getItem("mecg.application-step-recovery.v1"));
    page.on("dialog", (dialog) => dialog.accept());
    await openHarness(page, "/apply/test-harness?draft=newer");
    const heading = page.getByRole("heading", { name: "Choose which answers to continue with" });
    await expect(heading).toBeFocused();
    await expect(page.getByLabel("Full name")).toHaveCount(0);
    await page.getByText("Compare answers before choosing", { exact: true }).click();
    for (const text of ["Ada Browser", "Ada Saved", "Older unsynced browser answer.", "Newer answer saved on another device."]) {
      await expect(page.getByText(text, { exact: true })).toBeVisible();
    }
    const requestsBeforeChoice = saves.length;
    allowSave = true;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    // Wait beyond the autosave debounce: even reconnect must leave both copies untouched.
    await page.waitForTimeout(1800);
    expect(saves).toHaveLength(requestsBeforeChoice);
    expect(await page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"))).toBe(snapshot);
    expect(await page.evaluate(() => sessionStorage.getItem("mecg.application-step-recovery.v1"))).toBe(savedStep);
    // A second reload must still offer both copies.
    await page.reload();
    await expect(heading).toBeFocused();
    await page.getByRole("button", { name: choice, exact: true }).click();
    if (choice === "Keep saved draft") {
      await expect(page.getByLabel("Full name")).toHaveValue("Ada Saved");
      await expect.poll(() => page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"))).toBeNull();
      await page.waitForTimeout(1800);
      expect(saves).toHaveLength(requestsBeforeChoice);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByLabel("Why MECG?", { exact: false })).toHaveValue("Newer answer saved on another device.");
    } else {
      await expect(page.getByLabel("Why MECG?", { exact: false })).toHaveValue("Older unsynced browser answer.");
      await expect.poll(() => saves.length).toBeGreaterThan(requestsBeforeChoice);
      expect(saves.at(-1)).toMatchObject({ name: "Ada Browser", answers: { motivation: "Older unsynced browser answer." } });
      await expect.poll(() => page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"))).toBeNull();
    }
  });
}

test("HTTP 500 after a committed submission reconciles status and clears recovery", async ({ page }) => {
  let submissions = 0;
  let statusReads = 0;
  await page.route("**/api/apply/draft", (route) => route.fulfill({ status: 503, body: "{}" }));
  await page.route("**/api/apply", async (route) => {
    submissions += 1;
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "An unexpected error occurred." }) });
  });
  await page.route("**/api/apply/status?**", async (route) => {
    statusReads += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ application: { applicationId: "e2e", cycleId: "e2e-cycle", status: "SUBMITTED", submitted: true } }) });
  });
  await page.route("**/applicant**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Submitted</h1>" }));
  await openHarness(page);
  for (let index = 0; index < 3; index += 1) await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"))).not.toBeNull();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit application", exact: true }).click();
  await expect(page).toHaveURL(/\/applicant\?submitted=e2e$/);
  expect(submissions).toBe(1);
  expect(statusReads).toBe(1);
  expect(await page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"))).toBeNull();
});

for (const choice of ["Keep this page’s answers", "Use the saved copy"]) {
  test(`server revision conflict pauses work and preserves both copies before ${choice}`, async ({ page }) => {
    const requests: { draft: { name: string }; expectedRevision: string | null; mutationId: string }[] = [];
    let serverDraft: unknown;
    await page.route("**/api/apply/draft", async (route) => {
      const body = route.request().postDataJSON();
      requests.push(body);
      if (requests.length === 1) {
        serverDraft = { ...body.draft, name: "Ada Other Device", revision: "30000000-0000-4000-8000-000000000001" };
        return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ kind: "conflict", draft: serverDraft }) });
      }
      await route.fulfill({ status: 200, body: JSON.stringify({ kind: "saved", revision: "40000000-0000-4000-8000-000000000001" }) });
    });
    await openHarness(page);
    await page.getByLabel("Full name").fill("Ada This Page");
    const heading = page.getByRole("heading", { name: "Your saved draft changed elsewhere" });
    await expect(heading).toBeFocused();
    await expect(page.getByText("Ada This Page", { exact: true })).toBeVisible();
    await expect(page.getByText("Ada Other Device", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.waitForTimeout(1800);
    expect(requests).toHaveLength(1);
    expect(await page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"))).toContain("Ada This Page");
    await page.getByRole("button", { name: choice, exact: true }).click();
    await expect(page.getByLabel("Full name")).toHaveValue(choice === "Use the saved copy" ? "Ada Other Device" : "Ada This Page");
    if (choice === "Keep this page’s answers") {
      await expect.poll(() => requests.length).toBe(2);
      expect(requests[1]?.expectedRevision).toBe("30000000-0000-4000-8000-000000000001");
      expect(requests[1]?.draft.name).toBe("Ada This Page");
    } else {
      await page.waitForTimeout(1800);
      expect(requests).toHaveLength(1);
    }
  });
}

test("uncertain save retries its exact mutation before sending newer edits", async ({ page }) => {
  const requests: { draft: { name: string }; expectedRevision: string; mutationId: string }[] = [];
  await page.route("**/api/apply/draft", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (requests.length === 1) return route.abort("connectionreset");
    await route.fulfill({ status: 200, body: JSON.stringify({ kind: "saved", revision: requests.length === 2 ? "30000000-0000-4000-8000-000000000001" : "40000000-0000-4000-8000-000000000001" }) });
  });
  await openHarness(page);
  await page.getByLabel("Full name").fill("Ada First Mutation");
  await expect(page.getByRole("alert").filter({ hasText: "Failed to fetch" }).or(page.getByRole("alert").filter({ hasText: "could not save" }))).toBeVisible();
  await page.getByLabel("Full name").fill("Ada Newer Edit");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => requests.length).toBeGreaterThanOrEqual(3);
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[2]?.expectedRevision).toBe("30000000-0000-4000-8000-000000000001");
  expect(requests[2]?.draft.name).toBe("Ada Newer Edit");
});

test("stale submission shows the same explicit recovery instead of submitting or losing answers", async ({ page }) => {
  await page.route("**/api/apply/draft", (route) => route.fulfill({ status: 200, body: JSON.stringify({ kind: "saved", revision: "20000000-0000-4000-8000-000000000001" }) }));
  let submitBody: { expectedRevision: string; name: string } | undefined;
  await page.route("**/api/apply", async (route) => {
    submitBody = route.request().postDataJSON();
    const draft = { ...route.request().postDataJSON() };
    delete draft.consent; delete draft.expectedRevision; delete draft.cycleId;
    await route.fulfill({ status: 409, body: JSON.stringify({ kind: "conflict", draft: { ...draft, name: "Ada Other Device", revision: "30000000-0000-4000-8000-000000000001" } }) });
  });
  await openHarness(page);
  for (let index = 0; index < 3; index += 1) await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit application", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your saved draft changed elsewhere" })).toBeFocused();
  expect(submitBody?.expectedRevision).toBeTruthy();
  await expect(page.getByText("Ada Applicant", { exact: true })).toBeVisible();
  await expect(page.getByText("Ada Other Device", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Use the saved copy", exact: true }).click();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
});

test("a corrected edit can replace a definitively rejected draft request", async ({ page }) => {
  const names: string[] = [];
  await page.route("**/api/apply/draft", async (route) => {
    names.push(route.request().postDataJSON().draft.name);
    await route.fulfill({ status: names.length === 1 ? 400 : 200, body: names.length === 1 ? JSON.stringify({ error: "invalid draft" }) : JSON.stringify({ kind: "saved", revision: "40000000-0000-4000-8000-000000000001" }) });
  });
  await openHarness(page);
  await page.getByLabel("Full name").fill("Ada Rejected");
  await expect(page.getByRole("alert").filter({ hasText: "could not save" })).toBeVisible();
  await page.getByLabel("Full name").fill("Ada Corrected");
  await expect.poll(() => names.at(-1)).toBe("Ada Corrected");
  expect(names).toEqual(["Ada Rejected", "Ada Corrected"]);
  await expect(page.getByText(/^Saved to your account at |^Saved$/).filter({ visible: true })).toBeVisible();
});

test("a conflict response preserves edits typed while the save was in flight", async ({ page }) => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let started = false;
  await page.route("**/api/apply/draft", async (route) => {
    const body = route.request().postDataJSON();
    started = true;
    await gate;
    await route.fulfill({ status: 409, body: JSON.stringify({ kind: "conflict", draft: { ...body.draft, name: "Ada Remote", revision: "30000000-0000-4000-8000-000000000001" } }) });
  });
  await openHarness(page);
  await page.getByLabel("Full name").fill("Ada Request Snapshot");
  await expect.poll(() => started).toBe(true);
  await page.getByLabel("Full name").fill("Ada Latest Keystrokes");
  release?.();
  await expect(page.getByRole("heading", { name: "Your saved draft changed elsewhere" })).toBeFocused();
  await expect(page.getByText("Ada Latest Keystrokes", { exact: true })).toBeVisible();
  await expect(page.getByText("Ada Request Snapshot", { exact: true })).toHaveCount(0);
});

test("a success response without a revision cannot clear browser recovery", async ({ page }) => {
  await page.route("**/api/apply/draft", (route) => route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }));
  await openHarness(page);
  await page.getByLabel("Full name").fill("Ada Unconfirmed");
  await expect(page.getByRole("alert").filter({ hasText: "could not save" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("mecg.application-draft-recovery.v1"))).toContain("Ada Unconfirmed");
  await expect(page.getByText(/^Saved to your account at |^Saved$/).filter({ visible: true })).toHaveCount(0);
});
