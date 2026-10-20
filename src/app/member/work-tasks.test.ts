import assert from "node:assert/strict";
import test from "node:test";
import { orderedWorkTasks, roundWorkOpen, taskDeadline } from "./work-tasks";
import { observationFailure } from "./event/observation-state";

test("published, expired and invalid-deadline rounds never invite writable grading", () => {
  const now = Date.parse("2026-10-17T12:00:00Z");
  assert.equal(roundWorkOpen({ status: "PUBLISHED", closes_at: null }, now), false);
  assert.equal(roundWorkOpen({ status: "ACTIVE", closes_at: "invalid" }, now), false);
  assert.equal(roundWorkOpen({ status: "ACTIVE", closes_at: "2026-10-16T12:00:00Z" }, now), false);
  assert.equal(roundWorkOpen({ status: "ACTIVE", closes_at: null }, now), true);
  assert.equal(roundWorkOpen({ status: "ACTIVE", closes_at: "2026-10-18T12:00:00Z" }, now), true);
});

test("actual deadlines come before undated work without fabricating urgency", () => {
  const tasks = [
    { href: "/event", label: "Event observations", detail: "Open", dueAt: taskDeadline(null) },
    { href: "/screening", label: "Application review", detail: "Due today", dueAt: taskDeadline("2026-10-17T18:00:00Z") },
    { href: "/evaluation", label: "Evaluation", detail: "Due tomorrow", dueAt: taskDeadline("2026-10-18T18:00:00Z") },
  ];
  assert.deepEqual(orderedWorkTasks(tasks).map((task) => task.href), ["/screening", "/evaluation", "/event"]);
  assert.equal(tasks[0].href, "/event");
  assert.equal(taskDeadline("invalid"), Infinity);
});

test("only an explicit closure response labels event observations closed", () => {
  assert.match(observationFailure({ code: "42501", message: "observations are closed" }).title, /window is closed/);
  assert.match(observationFailure({ code: "42501", message: "check in to this event first" }).title, /Check-in is required/);
  assert.match(observationFailure({ code: "42501", message: "observations unavailable" }).title, /unavailable/);
  assert.match(observationFailure({ message: "Failed to fetch" }).title, /could not be loaded/);
  assert.doesNotMatch(observationFailure({ message: "Failed to fetch" }).title, /closed/);
});
