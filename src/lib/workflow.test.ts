import test from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionCycle,
  canTransitionRound,
  hasExactCriterionSet,
  normalizePersonInput,
} from "./workflow.ts";

test("cycle transitions move forward one state and allow idempotent writes", () => {
  assert.equal(canTransitionCycle("DRAFT", "OPEN"), true);
  assert.equal(canTransitionCycle("OPEN", "OPEN"), true);
  assert.equal(canTransitionCycle("OPEN", "CLOSED"), false);
  assert.equal(canTransitionCycle("CLOSED", "OPEN"), false);
});

test("round transitions cannot skip or reopen states", () => {
  assert.equal(canTransitionRound("PUBLISHED", "ACTIVE"), true);
  assert.equal(canTransitionRound("ACTIVE", "FINALIZED"), false);
  assert.equal(canTransitionRound("FROZEN", "ACTIVE"), false);
});

test("criterion submission requires each expected criterion exactly once", () => {
  assert.equal(hasExactCriterionSet(["a", "b"], ["a", "b"]), true);
  assert.equal(hasExactCriterionSet(["a", "b"], ["a", "a"]), false);
  assert.equal(hasExactCriterionSet(["a", "b"], ["a"]), false);
});

test("person input is normalized and bounded", () => {
  assert.deepEqual(normalizePersonInput("  Ada  ", " ADA@EXAMPLE.COM "), {
    name: "Ada",
    contact: "ada@example.com",
  });
  assert.equal(normalizePersonInput("", "ada@example.com"), null);
  assert.equal(normalizePersonInput("A".repeat(121), "ada@example.com"), null);
});
