import assert from "node:assert/strict";
import test from "node:test";
import { parseContent, parseReview, pendingReview, safeLink, parseRecords } from "./model";
const opportunity = { title: "Synthetic Co", track: "Client", stage: "Research", problem: "Example problem", source: "https://example.com", nextAction: "Verify fit" };
test("pipeline separates tracks, requires evidence for advancement and rejects injected review fields", () => {
  assert.equal(parseContent("pipeline", opportunity).ok, true);
  assert.equal(parseContent("pipeline", { ...opportunity, track: "Both" }).ok, false);
  assert.equal(parseContent("pipeline", { ...opportunity, stage: "Agreed" }).ok, false);
  assert.equal(parseContent("pipeline", { ...opportunity, verification: "Verified" }).ok, false);
  assert.equal(parseContent("pipeline", { ...opportunity, nextDate: "2026-02-30" }).ok, false);
});
test("links cannot execute scripts or include embedded credentials", () => {
  for (const link of ["javascript:alert(1)", "http://example.com", "https://user:secret@example.com"]) assert.equal(safeLink(link), false);
  assert.equal(safeLink("https://docs.google.com/document/d/synthetic/edit"), true);
});
test("sharing clearance needs independent verification, source and exact scope", () => {
  assert.equal(parseReview({ ...pendingReview, sharing: "Cleared for specified use" }), null);
  assert.equal(parseReview({ ...pendingReview, verification: "Verified", note: "Checked output", sharing: "Cleared for specified use", source: "https://example.com/permission", scope: "Anonymous internal discussion only" })?.scope, "Anonymous internal discussion only");
});
test("persisted records are parsed and malformed records fail closed", () => {
  assert.equal(parseRecords([{ id: "x", kind: "pipeline", owner_id: "member", owner_name: "Synthetic member", revision: 1, content: opportunity, review: pendingReview, updated_at: "2026-11-12" }])[0]?.content.title, "Synthetic Co");
  assert.throws(() => parseRecords([{ id: "x", kind: "pipeline", content: opportunity }]));
});
