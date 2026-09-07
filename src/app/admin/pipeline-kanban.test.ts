import assert from "node:assert/strict";
import test from "node:test";
import {
  KANBAN_TRACK_CLASS_NAME,
  canMoveApplication,
  kanbanDropStatuses,
  moveApplicationInBoard,
} from "./pipeline-kanban.ts";

test("Kanban removes the single-column template before desktop column flow", () => {
  assert.match(KANBAN_TRACK_CLASS_NAME, /sm:grid-cols-none/);
  assert.match(KANBAN_TRACK_CLASS_NAME, /sm:grid-flow-col/);
});

test("Kanban destinations contain the current and legal active stages", () => {
  assert.deepEqual(kanbanDropStatuses("SUBMITTED"), ["SUBMITTED", "NEEDS_INFO", "ELIGIBLE"]);
  assert.deepEqual(kanbanDropStatuses("INVITED"), ["INVITED", "IN_PROCESS"]);
  assert.deepEqual(kanbanDropStatuses("FINAL_REVIEW"), ["FINAL_REVIEW"]);
});

test("Kanban moves reject the source, skipped stages, and decided stages", () => {
  assert.equal(canMoveApplication("SUBMITTED", "SUBMITTED"), false);
  assert.equal(canMoveApplication("SUBMITTED", "ELIGIBLE"), true);
  assert.equal(canMoveApplication("SUBMITTED", "IN_PROCESS"), false);
  assert.equal(canMoveApplication("FINAL_REVIEW", "OFFERED"), false);
});

test("optimistic moves change only the selected application", () => {
  const applications = [
    { id: "one", status: "SUBMITTED" as const, name: "Alexis" },
    { id: "two", status: "ELIGIBLE" as const, name: "Ayesha" },
  ];

  const moved = moveApplicationInBoard(applications, "one", "NEEDS_INFO");

  assert.deepEqual(moved, [
    { id: "one", status: "NEEDS_INFO", name: "Alexis" },
    applications[1],
  ]);
  assert.equal(applications[0].status, "SUBMITTED");
});
