import assert from "node:assert/strict";
import test from "node:test";
import { advancementReceipt, canSelectForAdvancement, snapshotAdvancement } from "./pipeline-selection.ts";
import { PIPELINE_STATUSES } from "@/lib/workflow";

test("advancement selection preserves the existing enrollment statuses", () => {
  assert.deepEqual(PIPELINE_STATUSES.filter(canSelectForAdvancement), ["ELIGIBLE", "INVITED", "GROUP_CASE", "IN_PROCESS"]);
});

test("cross-filter review includes A and B and identifies hidden A", () => {
  const applications = [
    { id: "a", name: "Alex", status: "ELIGIBLE" as const },
    { id: "b", name: "Blair", status: "ELIGIBLE" as const },
    { id: "c", name: "Casey", status: "ELIGIBLE" as const },
  ];
  const selected = new Set(["a", "b"]);
  const visible = new Set(["b", "c"]);
  const review = snapshotAdvancement(applications, selected, visible);
  assert.deepEqual(review, [
    { id: "a", name: "Alex", hidden: true },
    { id: "b", name: "Blair", hidden: false },
  ]);
  // Subsequent filters, selections and server refreshes do not change review.
  visible.add("a");
  selected.clear();
  applications[0].name = "Changed after review";
  assert.deepEqual(review.map(({ id, name, hidden }) => ({ id, name, hidden })), [
    { id: "a", name: "Alex", hidden: true },
    { id: "b", name: "Blair", hidden: false },
  ]);
  assert.deepEqual(snapshotAdvancement(applications, selected, visible), []);
});

test("source removal is not presented as a reviewable applicant", () => {
  assert.deepEqual(snapshotAdvancement([], new Set(["removed"]), new Set()), []);
});


test("advancement receipts report actual counts and reject malformed or mismatched cohorts", () => {
  const receipt = { id: { roundId: "speed-round", selectedApplications: 2, newAssignments: 0, notificationsEnqueued: 0 } };
  assert.deepEqual(advancementReceipt(receipt, 2), { newAssignments: 0, notificationsEnqueued: 0 });
  for (const body of [{}, { id: {} }, { id: { ...receipt.id, selectedApplications: 1 } }, { id: { ...receipt.id, newAssignments: -1 } }, { id: { ...receipt.id, notificationsEnqueued: 1.5 } }]) assert.equal(advancementReceipt(body, 2), null);
});
