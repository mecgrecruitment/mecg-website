import assert from "node:assert/strict";
import test from "node:test";
import { clonedCycleDestination, switchedWorkspaceHref, withWorkspaceCycle, workspaceCycleSelection } from "./workspace-cycle-url";

test("cohort links preserve query, encoded return target and hash while canonicalizing old alias", () => {
  const href = withWorkspaceCycle("/admin?cycle=old&filter=NEEDS_INFO&returnTo=%2Fmember%3Fround%3DGROUP_CASE#applicants", "draft-cycle");
  const url = new URL(href, "https://workspace.invalid");
  assert.equal(url.searchParams.get("cycleId"), "draft-cycle");
  assert.equal(url.searchParams.has("cycle"), false);
  assert.equal(url.searchParams.get("filter"), "NEEDS_INFO");
  assert.equal(url.searchParams.get("returnTo"), "/member?round=GROUP_CASE");
  assert.equal(url.hash, "#applicants");
  assert.equal(withWorkspaceCycle("/api/admin/export?cycleId=one", "two"), "/api/admin/export?cycleId=one");
});

test("cohort switches retain ordinary filters/hash and leave cohort-bound entity ids behind", () => {
  assert.equal(switchedWorkspaceHref("/admin/rounds/old-round?filter=pending&assignment=old#attention", "draft-cycle"), "/admin/rounds?filter=pending&cycleId=draft-cycle#attention");
  assert.equal(switchedWorkspaceHref("/admin/settings?section=dates#window", "draft-cycle"), "/admin/settings?section=dates&cycleId=draft-cycle#window");
  assert.equal(switchedWorkspaceHref("/member/calibration/old-round?return=%2Fmember#rubric", "draft-cycle"), "/member?cycleId=draft-cycle#rubric");
});

test("explicit cohort aliases agree or fail closed", () => {
  assert.deepEqual(workspaceCycleSelection(new URLSearchParams()), { kind: "default" });
  assert.deepEqual(workspaceCycleSelection(new URLSearchParams("cycle=old-cycle")), { kind: "selected", cycleId: "old-cycle" });
  assert.deepEqual(workspaceCycleSelection(new URLSearchParams("cycle=old-cycle&cycleId=old-cycle")), { kind: "selected", cycleId: "old-cycle" });
  for (const query of ["cycle=old-cycle&cycleId=other", "cycleId=one&cycleId=two", "cycleId=", "cycleId=%20one", `cycleId=${"x".repeat(241)}`]) assert.deepEqual(workspaceCycleSelection(new URLSearchParams(query)), { kind: "invalid" });
});

test("clone navigation requires an actual returned cohort id", () => {
  assert.equal(clonedCycleDestination({ id: "draft-cycle" }), "/admin/settings?cycleId=draft-cycle");
  for (const receipt of [null, { ok: true }, { id: "" }, { id: 12 }, { id: " draft " }]) assert.equal(clonedCycleDestination(receipt), null);
});
