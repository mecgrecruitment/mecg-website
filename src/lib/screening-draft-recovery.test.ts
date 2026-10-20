import test from "node:test";
import assert from "node:assert/strict";
import { readScreeningBackup, writeScreeningBackup } from "./screening-draft-recovery";
const draft = { ratings: [{ criterionId: "analysis", score: "2", note: "" }], evidence: "Retained local observations", recommendation: "HOLD" };
const now = 1_000_000_000;
test("screening backup round trips exactly and excludes another assignment, rubric or expired data", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  assert.equal(writeScreeningBackup({ storage, assignmentId: "a", draft, now }), true);
  assert.deepEqual(readScreeningBackup({ storage, assignmentId: "a", criterionIds: ["analysis"], now }), draft);
  assert.equal(readScreeningBackup({ storage, assignmentId: "b", criterionIds: ["analysis"], now }), null);
  assert.equal(readScreeningBackup({ storage, assignmentId: "a", criterionIds: ["changed-rubric"], now }), null);
  assert.equal(readScreeningBackup({ storage, assignmentId: "a", criterionIds: ["analysis"], now: now + 86_400_001 }), null);
  assert.equal(readScreeningBackup({ storage, assignmentId: "a", criterionIds: ["analysis"], now: now - 1 }), null);
});
test("blocked and quota-limited backup storage cannot claim private observations are protected", () => {
  const storage = { getItem: () => { throw new DOMException("Blocked", "SecurityError"); }, setItem: () => { throw new DOMException("Full", "QuotaExceededError"); }, removeItem: () => {} };
  assert.equal(writeScreeningBackup({ storage, assignmentId: "a", draft, now }), false);
  assert.equal(readScreeningBackup({ storage, assignmentId: "a", criterionIds: ["analysis"], now }), null);
});
