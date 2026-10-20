import test from "node:test";
import assert from "node:assert/strict";
import { applicationEditAccess, editableApplicationNextAction, editableApplicationStatus } from "./application-status";
const draft = { revision: "10000000-0000-4000-8000-000000000001", name: "Synthetic applicant" };
const intake = { open: true, cycleId: "fall", needsInfo: false, draft };
const rows = [{ id: "app-1", cycle_id: "fall", status: "DRAFT" }];
test("editing access binds owned application identity to the active intake cycle and editable status", () => {
  assert.equal(applicationEditAccess({ applicationId: "app-1", intake, ownedApplications: rows }), "available");
  assert.equal(applicationEditAccess({ applicationId: "another", intake, ownedApplications: rows }), "unknown");
  assert.equal(applicationEditAccess({ applicationId: "app-1", intake: { ...intake, cycleId: "spring" }, ownedApplications: rows }), "unavailable");
  assert.equal(applicationEditAccess({ applicationId: "app-1", intake, ownedApplications: [{ ...rows[0], status: "SUBMITTED" }] }), "unavailable");
  assert.equal(applicationEditAccess({ applicationId: "app-1", intake: { ...intake, needsInfo: true }, ownedApplications: [{ ...rows[0], status: "NEEDS_INFO" }] }), "available");
});
test("closed intake and unknown lookup are distinct and never invent a deadline", () => {
  assert.equal(applicationEditAccess({ applicationId: "app-1", intake: { open: false, cycleId: null }, ownedApplications: rows }), "unavailable");
  for (const broken of [null, {}, { open: "true" }, { ...intake, draft: null }, { ...intake, draft: { name: "Unversioned" } }, { ...intake, needsInfo: true }]) assert.equal(applicationEditAccess({ applicationId: "app-1", intake: broken, ownedApplications: rows }), "unknown");
});
test("draft and requested changes produce plain pre-review states, while released outcomes retain authority", () => {
  const state = editableApplicationStatus({ display_status: "DRAFT", released_outcome: null });
  assert.ok(state); assert.match(state.label, /Not submitted/); assert.equal(editableApplicationNextAction(state, "available").href, "/apply");
  assert.equal(editableApplicationNextAction(state, "unavailable").label, "Contact recruitment team");
  assert.match(editableApplicationNextAction(state, "unknown").detail, /could not verify/);
  const changes = editableApplicationStatus({ display_status: "NEEDS_INFO", released_outcome: null }); assert.ok(changes); assert.equal(editableApplicationNextAction(changes, "available").label, "Review and resubmit");
  assert.equal(editableApplicationStatus({ display_status: "SUBMITTED", released_outcome: null }), null);
  assert.equal(editableApplicationStatus({ display_status: "DRAFT", released_outcome: "OFFER" }), null);
});
