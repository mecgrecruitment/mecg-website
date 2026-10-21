import { expect, test, type Page } from "@playwright/test";

async function openDeck(page: Page, earlyImageFailure = false) {
  const writes: unknown[] = [];
  let releaseScripts = () => {};
  const scripts = new Promise<void>((resolve) => { releaseScripts = resolve; });
  const imageFailed = earlyImageFailure ? page.waitForEvent("requestfailed", (request) => request.url().endsWith("/headshot")) : null;
  if (earlyImageFailure) {
    await page.route("**/_next/static/**/*.js", async (route) => { await scripts; await route.continue(); });
    await page.route("**/headshot", (route) => route.abort());
  }
  await page.route("**/api/admin/hash/live?cycleId=synthetic-deck-cycle", (route) => route.fulfill({ json: { tally: [0, 1].map((index) => ({ applicationId: `synthetic-deck-${index}`, yes: 2, no: 0, unsure: 0, total: 2, quorum: 2, outcome: "ADVANCED" })) } }));
  await page.route("**/api/admin/rush", (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "APPLY_STAGE_HASH") writes.push(body);
    return route.fulfill({ json: { id: "IN_PROCESS" } });
  });
  await page.goto("/apply/test-harness/deck", { waitUntil: "commit" });
  if (imageFailed) { await imageFailed; releaseScripts(); }
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  await expect(page.getByRole("button", { name: "Reveal and apply result" })).toBeEnabled();
  return writes;
}

test("native review advancement focuses each new applicant and the completed view", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const writes = await openDeck(page);
  const reveal = page.getByRole("button", { name: "Reveal and apply result", exact: true });
  await reveal.focus();
  await page.keyboard.press("Enter");
  const advance = page.getByRole("button", { name: "Next unapplied applicant", exact: true });
  await expect(advance).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Ada Example", exact: true })).toBeFocused();
  expect(writes).toHaveLength(1);
  await page.keyboard.press("Tab");
  await expect(reveal).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(advance).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Ada Example", exact: true })).toBeFocused();
  await expect(page.getByText("Applied results are shown for every applicant in this view.", { exact: false })).toBeVisible();
  await expect(advance).toHaveCount(0);
  expect(writes).toHaveLength(2);
});

test("jumping focuses applicant context while keeping deliberate arrow navigation available", async ({ page }) => {
  const writes = await openDeck(page);
  const search = page.getByRole("searchbox", { name: "Jump to a name" });
  await search.fill("Ada");
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: "Ada Example", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("heading", { name: "Zoe Example", exact: true })).toBeFocused();
  expect(writes).toEqual([]);
});

test("only a tab presenting to members moves the phones", async ({ page }) => {
  await openDeck(page);
  const presented: string[] = [];
  await page.route("**/api/admin/rush", (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "SET_HASH_PRESENTING") presented.push(body.applicationId);
    return route.fulfill({ json: { id: true } });
  });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForTimeout(600);
  expect(presented).toEqual([]);
  const present = page.getByRole("button", { name: "Present to members", exact: true });
  await expect(present).toHaveAttribute("aria-pressed", "false");
  await present.click();
  await expect(present).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => presented).toEqual(["synthetic-deck-1"]);
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect.poll(() => presented).toEqual(["synthetic-deck-1", "synthetic-deck-0"]);
});

test("arrow keys keep paging after a deck button is clicked", async ({ page }) => {
  await openDeck(page);
  const next = page.getByRole("button", { name: "Next", exact: true });
  await next.click();
  await expect(page.getByRole("heading", { name: "Ada Example", exact: true })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("heading", { name: "Zoe Example", exact: true })).toBeVisible();
});

test("native sorting and revisit Enter never apply a result or advance the card", async ({ page }) => {
  const writes = await openDeck(page);
  for (const name of ["A to Z", "By score", "Revisit (U)"]) {
    await page.getByRole("button", { name, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Zoe Example" })).toBeVisible();
  }
  // Covers the old delayed reveal write, rather than inspecting immediately.
  await page.waitForTimeout(1400);
  expect(writes).toEqual([]);
  await expect(page.getByRole("button", { name: "Reveal and apply result" })).toBeEnabled();
});

test("headshot failure before hydration shows initials after handlers attach", async ({ page }) => {
  await openDeck(page, true);
  await expect(page.getByText("ZE", { exact: true })).toBeVisible();
  await expect(page.locator("img[src$='/headshot']")).toHaveCount(0);
});

test("Exit Enter activates only the link", async ({ page }) => {
  const writes = await openDeck(page);
  await page.getByRole("link", { name: "Exit", exact: true }).focus();
  await page.keyboard.press("Enter");
  // This unauthenticated local harness correctly reaches the sign-in boundary.
  await expect(page).toHaveURL(/\/login$/);
  await page.waitForTimeout(1400);
  expect(writes).toEqual([]);
});

test("reduced motion disables deck animations and explicit reveal skips decorative delay", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const writes = await openDeck(page);
  const animated = await page.locator(".deck-root, .deck-root *").evaluateAll((elements) => elements.filter((element) => getComputedStyle(element).animationName !== "none").length);
  expect(animated).toBe(0);
  await page.clock.install();
  const reveal = page.getByRole("button", { name: "Reveal and apply result" });
  await reveal.focus();
  await page.keyboard.press("Enter");
  // The clock remains frozen: an old 1200ms drumroll could not complete.
  await expect(page.getByRole("button", { name: "Next unapplied applicant" })).toBeVisible();
  expect(writes).toEqual([{ action: "APPLY_STAGE_HASH", cycleId: "synthetic-deck-cycle", applicationId: "synthetic-deck-0" }]);
  await expect(page.locator(".deck-confetti")).toHaveCount(0);
});

test("presenter can turn motion off for a shared display and keep it off after reload", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const writes = await openDeck(page);
  const motion = page.getByRole("button", { name: "Presentation motion", exact: true });
  await expect(motion).toHaveAttribute("aria-pressed", "true");
  await motion.focus();
  await page.keyboard.press("Enter");
  await expect(motion).toHaveAttribute("aria-pressed", "false");
  await expect(motion).toBeFocused();
  await expect(page.getByText("Off for this browser tab. Results appear without a reveal delay.")).toBeVisible();
  expect(writes).toEqual([]);
  await page.reload();
  await expect(motion).toHaveAttribute("aria-pressed", "false");
  const animated = await page.locator(".deck-root, .deck-root *").evaluateAll((elements) => elements.filter((element) => getComputedStyle(element).animationName !== "none" || getComputedStyle(element).transitionDuration !== "0s").length);
  expect(animated).toBe(0);
  await page.clock.install();
  await page.getByRole("button", { name: "Reveal and apply result" }).click();
  await expect(page.getByRole("button", { name: "Next unapplied applicant" })).toBeVisible();
  expect(writes).toEqual([{ action: "APPLY_STAGE_HASH", cycleId: "synthetic-deck-cycle", applicationId: "synthetic-deck-0" }]);
  await expect(page.locator(".deck-confetti")).toHaveCount(0);
});

test("device reduction overrides an enabled presentation preference, including live changes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openDeck(page);
  const motion = page.getByRole("button", { name: "Presentation motion", exact: true });
  await expect(motion).toHaveAttribute("aria-pressed", "true");
  await motion.click();
  await motion.click();
  await expect(motion).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(motion).toBeDisabled();
  await expect(motion).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Off — your device requests reduced motion.")).toBeVisible();
  await page.reload();
  await expect(motion).toBeDisabled();
  await expect(motion).toHaveAttribute("aria-pressed", "false");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(motion).toBeEnabled();
  await expect(motion).toHaveAttribute("aria-pressed", "true");
});

test("motion control works when browser-tab storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("Unavailable", "SecurityError"); } }));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openDeck(page);
  const motion = page.getByRole("button", { name: "Presentation motion", exact: true });
  await expect(motion).toHaveAttribute("aria-pressed", "true");
  await motion.click();
  await expect(motion).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".deck-root")).toHaveAttribute("data-motion", "off");
});

test("rejected result application announces recovery, holds this card, and supports a keyboard retry", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openDeck(page);
  let attempts = 0;
  await page.route("**/api/admin/rush", (route) => {
    if (route.request().postDataJSON().action !== "APPLY_STAGE_HASH") return route.fulfill({ json: { id: true } });
    attempts += 1;
    return attempts === 1 ? route.fulfill({ status: 409, json: { error: "Not enough votes yet." } }) : route.fulfill({ json: { id: "IN_PROCESS" } });
  });
  const reveal = page.getByRole("button", { name: "Reveal and apply result" });
  await reveal.focus();
  await page.keyboard.press("Enter");
  const error = page.locator("#deck-apply-error");
  await expect(error).toHaveAttribute("role", "alert");
  await expect(error).toContainText("Not enough votes yet.");
  await expect(error).toBeFocused();
  await expect(reveal).toHaveAttribute("aria-describedby", "deck-apply-error");
  await expect(page.getByRole("heading", { name: "Zoe Example" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next unapplied applicant" })).toHaveCount(0);
  expect(attempts).toBe(1);
  await page.getByRole("button", { name: "Retry applying result" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Next unapplied applicant" })).toBeVisible();
  expect(attempts).toBe(2);
  await expect(page.getByRole("heading", { name: "Zoe Example" })).toBeVisible();
});

for (const outcome of ["lost", "malformed", "stalled-body"] as const) {
  test(`unknown ${outcome} apply outcome is announced without stamping, advancing, or blind repetition`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openDeck(page);
    let attempts = 0;
    await page.route("**/api/admin/rush", async (route) => {
      if (route.request().postDataJSON().action !== "APPLY_STAGE_HASH") return route.fulfill({ json: { id: true } });
      attempts += 1;
      if (outcome === "lost") return route.abort("failed");
      if (outcome === "malformed") return route.fulfill({ json: { id: "ADVANCED" } });
      return route.fulfill({ json: { id: "IN_PROCESS" } });
    });
    // Resolve fetch headers while leaving JSON consumption pending. The full
    // operation deadline must release the UI even after headers arrived.
    if (outcome === "stalled-body") await page.evaluate(() => {
      const original = window.fetch;
      window.fetch = async (...args) => {
        const response = await original(...args);
        if (typeof args[1]?.body === "string" && JSON.parse(args[1].body).action === "APPLY_STAGE_HASH") response.json = () => new Promise<never>(() => {});
        return response;
      };
    });
    await page.clock.install();
    const reveal = page.getByRole("button", { name: "Reveal and apply result" });
    await reveal.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => attempts).toBe(1);
    if (outcome === "stalled-body") await page.clock.runFor(15_001);
    const error = page.locator("#deck-apply-error");
    await expect(error).toContainText("It may already be saved.");
    await expect(error).toBeFocused();
    await expect(reveal).toBeDisabled();
    await expect(page.getByRole("button", { name: "Retry applying result" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next unapplied applicant" })).toHaveCount(0);
    await expect(page.locator(".deck-stamp, .deck-confetti")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Zoe Example" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Check saved result in Hash (new tab)" })).toHaveAttribute("href", "/admin/hash?cycleId=synthetic-deck-cycle");
    await page.getByRole("button", { name: "Reload saved results" }).focus();
    await expect(page.getByRole("button", { name: "Reload saved results" })).toBeFocused();
    await page.clock.runFor(1_000);
    expect(attempts).toBe(1);
  });
}
