import assert from "node:assert/strict";
import test from "node:test";
import { canRefreshApplicantStatus, formatLastChecked } from "./status-refresh-state.ts";

test("status refresh runs only when the page can safely request it", () => {
  assert.equal(canRefreshApplicantStatus({ hidden: false, online: true, pendingActions: 0, refreshing: false }), true);

  assert.equal(canRefreshApplicantStatus({ hidden: true, online: true, pendingActions: 0, refreshing: false }), false);
  assert.equal(canRefreshApplicantStatus({ hidden: false, online: false, pendingActions: 0, refreshing: false }), false);
  assert.equal(canRefreshApplicantStatus({ hidden: false, online: true, pendingActions: 1, refreshing: false }), false);
  assert.equal(canRefreshApplicantStatus({ hidden: false, online: true, pendingActions: 0, refreshing: true }), false);
});

test("last-checked copy uses deterministic elapsed-minute boundaries", () => {
  const now = 1_800_000_000_000;
  assert.equal(formatLastChecked(now, now), "Last checked just now.");
  assert.equal(formatLastChecked(now - 59_999, now), "Last checked just now.");
  assert.equal(formatLastChecked(now - 60_000, now), "Last checked 1 minute ago.");
  assert.equal(formatLastChecked(now - 5 * 60_000, now), "Last checked 5 minutes ago.");
  assert.equal(formatLastChecked(now + 60_000, now), "Last checked just now.");
});
