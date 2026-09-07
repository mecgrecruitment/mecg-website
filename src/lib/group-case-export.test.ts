import assert from "node:assert/strict";
import test from "node:test";
import { buildGroupCaseCsv, buildGroupCaseXlsx, parseGroupCaseBackup } from "./group-case-export";

const backup = {
  fileId: "file-1",
  cycleId: "cycle-1",
  cycleName: "Fall 2026",
  roundId: "round-1",
  roundName: "Group Case",
  rubricVersion: 1,
  exportedAt: "2026-09-06T18:00:00Z",
  criteria: [{ id: "criterion-1", key: "judgment", name: "Judgment", weight: 20, required: false, position: 0 }],
  rows: [{
    groupId: null,
    groupName: "Unassigned group",
    assignmentId: null,
    evaluatorId: null,
    evaluatorName: "Unassigned judge",
    applicationId: "application-1",
    applicantName: "Alex, Student",
    status: "UNASSIGNED",
  }],
};

test("Group Case backup validation rejects unsafe or duplicate criterion keys", () => {
  assert.equal(parseGroupCaseBackup({ ...backup, criteria: [{ ...backup.criteria[0], key: "=formula" }] }), null);
  assert.equal(parseGroupCaseBackup({ ...backup, criteria: [backup.criteria[0], backup.criteria[0]] }), null);
});

test("Group Case CSV includes blank rating cells and Excel-safe text", () => {
  const parsed = parseGroupCaseBackup(backup);
  assert.ok(parsed);
  const csv = buildGroupCaseCsv(parsed);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /judgment_20pct_rating,evidence,flags,status/);
  assert.match(csv, /"Alex, Student",,,,UNASSIGNED/);
  assert.doesNotMatch(csv, /undefined|null/);
});

test("Group Case workbook is a valid ZIP-shaped XLSX containing the five recovery sheets", () => {
  const parsed = parseGroupCaseBackup(backup);
  assert.ok(parsed);
  const workbook = buildGroupCaseXlsx(parsed);
  assert.deepEqual(Array.from(workbook.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
  const raw = new TextDecoder().decode(workbook);
  for (const sheet of ["START_HERE", "GROUPS", "SCORES", "RUBRIC", "CHANGE_LOG"]) assert.match(raw, new RegExp(sheet));
  assert.match(raw, /dataValidations/);
  assert.match(raw, /1,2,3,4,5,N\/O/);
});
