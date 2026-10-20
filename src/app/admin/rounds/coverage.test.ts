import assert from "node:assert/strict";
import test from "node:test";
import { isInRoundCohort } from "@/lib/round-cohort";
import { roundStaffingSummary } from "./coverage";

import { applications, groupAssignments, speedAssignments } from "./coverage-fixture";

test("Group Case overview uses its active-stage cohort and excludes recused/missed staffing", () => {
  assert.deepEqual(roundStaffingSummary({ roundKind: "GROUP_CASE", applications, assignments: groupAssignments }), {
    cohortSize: 3, staffedTwice: 2, assignedForms: 4, submittedForms: 3,
  });
});

test("Speed Dating retains progressed applicants without including earlier application stages", () => {
  assert.deepEqual(roundStaffingSummary({ roundKind: "SPEED_DATING", applications, assignments: speedAssignments }), {
    cohortSize: 4, staffedTwice: 2, assignedForms: 5, submittedForms: 2,
  });
});

test("unknown/recused/missed records never inflate usable staffing", () => {
  assert.deepEqual(roundStaffingSummary({ roundKind: "GROUP_CASE", applications: [{ id: "one", status: "GROUP_CASE" }], assignments: ["RECUSED", "MISSED", "UNKNOWN"].map((status) => ({ application_id: "one", status })) }), {
    cohortSize: 1, staffedTwice: 0, assignedForms: 0, submittedForms: 0,
  });
});

test("empty cohorts stay empty even when historical assignments exist", () => {
  assert.deepEqual(roundStaffingSummary({ roundKind: "GROUP_CASE", applications: [], assignments: groupAssignments }), {
    cohortSize: 0, staffedTwice: 0, assignedForms: 0, submittedForms: 0,
  });
});

test("the shared cohort predicate preserves existing round-workspace terminal filtering", () => {
  for (const status of ["DRAFT", "WITHDRAWN", "REJECTED", "WAITLISTED", "OFFERED"]) {
    for (const round of ["SPEED_DATING", "GROUP_CASE", "OTHER"]) assert.equal(isInRoundCohort(round, status), false);
  }
  assert.equal(isInRoundCohort("OTHER", "SUBMITTED"), true);
  assert.equal(isInRoundCohort("GROUP_CASE", "INVITED"), false);
});
