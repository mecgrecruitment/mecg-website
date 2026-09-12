import test from "node:test";
import assert from "node:assert/strict";
import { canVoteInStage, currentHashStage, hashOutcome } from "./hash-tally.ts";

test("a tally below quorum is pending no matter how the votes lean", () => {
  assert.equal(hashOutcome(5, 4, 0, 4), "PENDING");
  assert.equal(hashOutcome(5, 0, 4, 4), "PENDING");
  assert.equal(hashOutcome(1, 0, 0, 0), "PENDING");
});

test("a tally exactly at quorum counts", () => {
  assert.equal(hashOutcome(5, 3, 2, 5), "OFFER");
  assert.equal(hashOutcome(5, 2, 3, 5), "REJECT");
});

test("a tie rejects, because membership needs a majority", () => {
  assert.equal(hashOutcome(4, 2, 2, 4), "REJECT");
});

test("a yes majority offers, and unsure votes count toward quorum only", () => {
  assert.equal(hashOutcome(5, 14, 3, 18), "OFFER");
  assert.equal(hashOutcome(5, 3, 2, 10), "OFFER");
});

test("an all-unsure tally at quorum rejects", () => {
  assert.equal(hashOutcome(5, 0, 0, 5), "REJECT");
});

test("an open stage wins, decision lock means the final vote, anything else is closed", () => {
  assert.equal(currentHashStage({ hash_stage: "SPEED_DATING", status: "IN_PROCESS" }), "SPEED_DATING");
  assert.equal(currentHashStage({ hash_stage: null, status: "DECISION_LOCK" }), "FINAL");
  assert.equal(currentHashStage({ hash_stage: "GROUP_CASE", status: "DECISION_LOCK" }), "FINAL");
  assert.equal(currentHashStage({ hash_stage: null, status: "IN_PROCESS" }), null);
});

test("the application hash is a board and committee vote; later stages open to every member", () => {
  assert.equal(canVoteInStage("MEMBER", "APPLICATION"), false);
  assert.equal(canVoteInStage("RECRUITMENT_COMMITTEE", "APPLICATION"), true);
  assert.equal(canVoteInStage("MEMBER", "SPEED_DATING"), true);
});
