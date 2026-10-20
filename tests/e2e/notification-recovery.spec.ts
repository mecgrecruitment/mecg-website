import { expect, test } from "@playwright/test";

test("a mismatched retry receipt cannot claim success or send again; checking status only reads", async ({ page }) => {
  let sends = 0;
  let reads = 0;
  await page.route("**/api/admin/notifications**", route => {
    if (route.request().method() === "POST") {
      sends += 1;
      return route.fulfill({ json: { notificationId: "another-notification", status: "SENT" } });
    }
    reads += 1;
    return route.fulfill({ json: { notificationId: "synthetic-notification", status: "SENT" } });
  });
  await page.goto("/apply/test-harness/notification");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  await page.getByRole("button", { name: "Retry email", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("could not be confirmed");
  await expect(page.getByRole("button", { name: "Retry email", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Check email status" }).click();
  await expect(page.getByRole("status")).toContainText("Sent to email provider. Inbox delivery is not confirmed.");
  expect(sends).toBe(1);
  expect(reads).toBe(1);
});

test("an interrupted retry unlocks a read-only check after its deadline", async ({ page }) => {
  await page.clock.install();
  let sends = 0;
  await page.route("**/api/admin/notifications**", route => {
    if (route.request().method() === "POST") { sends += 1; return; }
    return route.fulfill({ json: { notificationId: "synthetic-notification", status: "FAILED" } });
  });
  await page.goto("/apply/test-harness/notification");
  await expect(page.locator('[data-application-harness-ready="true"]')).toBeAttached();
  await page.getByRole("button", { name: "Retry email", exact: true }).click();
  await expect(page.getByRole("button", { name: "Requesting retry…" })).toBeDisabled();
  await page.clock.fastForward(15_001);
  await page.getByRole("button", { name: "Check email status" }).click();
  await expect(page.getByRole("status")).toContainText("does not confirm whether the earlier retry has finished");
  await expect(page.getByRole("button", { name: "Retry email", exact: true })).toHaveCount(0);
  expect(sends).toBe(1);
});
