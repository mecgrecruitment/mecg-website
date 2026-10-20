import { expect, test } from "@playwright/test";

test("blocked evidence identifies each round, counts and a safe authorized repair destination", async ({ page }, testInfo) => {
  await page.goto("/apply/test-harness/release-evidence");
  await expect(page.getByRole("heading", { name: "Evidence requirements are not met", exact: true })).toBeVisible();
  const closed = page.getByRole("region", { name: "Group Case — synthetic closed round", exact: true });
  await expect(closed).toContainText("1 valid, locked independent evaluation");
  await expect(closed).toContainText("Grading is closed but sufficient valid evidence is missing");
  await expect(closed).toContainText("Evidence-based reasoning");
  await expect(closed).toContainText("Board-approved remediation process");
  const target = closed.getByRole("link", { name: "Open Group Case — synthetic closed round workspace", exact: true });
  await expect(target).toHaveAttribute("href", "/admin/rounds/synthetic-closed-round?cycleId=synthetic-older-cycle");
  await target.focus();
  await expect(target).toBeFocused();
  const active = page.getByRole("region", { name: "Speed Dating — synthetic active round", exact: true });
  await expect(active).toContainText("2 valid, locked independent evaluations");
  await expect(active).toContainText("must be frozen or finalized");
  await expect(page.getByRole("button", { name: /Release|Reopen|Freeze/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("specific-round-diagnostics.png"), fullPage: true });
});

test("complete evidence does not promise release, approval or notification", async ({ page }) => {
  await page.goto("/apply/test-harness/release-evidence?scenario=ready");
  await expect(page.getByRole("heading", { name: "Evidence requirements are met", exact: true })).toBeVisible();
  await expect(page.getByText("This round meets the evidence requirement.", { exact: true })).toHaveCount(2);
  await expect(page.getByText(/Recusals, approvals, permissions and the complete reviewed cohort are checked again/)).toBeVisible();
  await expect(page.getByRole("main").getByRole("button")).toHaveCount(0);
});

test("blocked release review links directly to the matching applicant evidence and selected cohort", async ({ page }) => {
  await page.route("**/api/admin/decisions", (route) => route.fulfill({ json: { items: [{ decisionId: "synthetic-decision", applicationId: "synthetic-app", outcome: "OFFER", reasonCode: "EVIDENCE_NOT_READY" }], applicantLabels: { "synthetic-app": "Applicant ABC123" } } }));
  await page.goto("/apply/test-harness/release");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  await page.getByRole("button", { name: "Review 1 locked outcome", exact: true }).click();
  const link = page.getByRole("link", { name: "Inspect missing evidence for Applicant ABC123", exact: true });
  await expect(link).toHaveAttribute("href", "/admin/applications/synthetic-app/release-evidence?cycleId=synthetic-release-cycle");
  await link.focus();
  await expect(link).toBeFocused();
  await expect(page.getByRole("button", { name: "Release 0 eligible outcomes", exact: true })).toBeDisabled();
});
