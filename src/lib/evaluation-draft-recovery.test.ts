import assert from "node:assert/strict";
import test from "node:test";
import {
  EVALUATION_DRAFT_MAX_AGE_MS,
  EVALUATION_DRAFT_MAX_BYTES,
  clearEvaluationDraft,
  evaluationRubricIdentity,
  readEvaluationDraft,
  writeEvaluationDraft,
  type EvaluationDraftCriterion,
} from "./evaluation-draft-recovery";

const criteria: EvaluationDraftCriterion[] = [
  { id: "judgment", name: "Judgment", description: "Uses evidence", weight: 60, required: true },
  { id: "teamwork", name: "Teamwork", description: "Works with others", weight: 40, required: false },
];

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function validRaw(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: 1,
    assignmentId: "assignment-1",
    rubricIdentity: evaluationRubricIdentity(criteria),
    savedAt: 1_000,
    ratings: [
      { criterionId: "judgment", score: "5", note: "Strong supporting example" },
      { criterionId: "teamwork", score: "NO", note: "" },
    ],
    evidence: "Observed throughout the exercise.",
    ...overrides,
  });
}

function seed(storage: MemoryStorage, raw: string) {
  storage.setItem("mecg:evaluation-draft:v1:assignment-1", raw);
}

test("round-trips scores, criterion notes, and overall evidence", () => {
  const storage = new MemoryStorage();
  assert.equal(writeEvaluationDraft({
    storage,
    assignmentId: "assignment-1",
    criteria,
    now: 1_000,
    draft: {
      scores: { judgment: "5", teamwork: "NO" },
      notes: { judgment: "Strong supporting example" },
      evidence: "Observed throughout the exercise.",
    },
  }), true);
  assert.deepEqual(readEvaluationDraft({ storage, assignmentId: "assignment-1", criteria, now: 2_000 }), {
    scores: { judgment: "5", teamwork: "NO" },
    notes: { judgment: "Strong supporting example" },
    evidence: "Observed throughout the exercise.",
  });
});

test("rejects malformed, stale, future-dated, wrong-assignment, and wrong-rubric snapshots", () => {
  const invalidSnapshots = [
    "not json",
    validRaw({ savedAt: 1_000 - EVALUATION_DRAFT_MAX_AGE_MS - 1 }),
    validRaw({ savedAt: 2_001 }),
    validRaw({ assignmentId: "assignment-2" }),
    validRaw({ rubricIdentity: "different-rubric" }),
  ];
  for (const raw of invalidSnapshots) {
    const storage = new MemoryStorage();
    seed(storage, raw);
    assert.equal(readEvaluationDraft({ storage, assignmentId: "assignment-1", criteria, now: 2_000 }), null);
    assert.equal(storage.values.size, 0, "invalid snapshots are removed");
  }
});

test("rejects duplicate, unknown, missing, and invalid criterion values", () => {
  const invalidRatings = [
    [
      { criterionId: "judgment", score: "5", note: "a" },
      { criterionId: "judgment", score: "4", note: "b" },
    ],
    [
      { criterionId: "judgment", score: "5", note: "a" },
      { criterionId: "unknown", score: "4", note: "b" },
    ],
    [{ criterionId: "judgment", score: "5", note: "a" }],
    [
      { criterionId: "judgment", score: "6", note: "a" },
      { criterionId: "teamwork", score: "4", note: "b" },
    ],
  ];
  for (const ratings of invalidRatings) {
    const storage = new MemoryStorage();
    seed(storage, validRaw({ ratings }));
    assert.equal(readEvaluationDraft({ storage, assignmentId: "assignment-1", criteria, now: 2_000 }), null);
  }
});

test("rejects oversized snapshots and overlong fields", () => {
  const snapshots = [
    `${" ".repeat(EVALUATION_DRAFT_MAX_BYTES)}${validRaw()}`,
    validRaw({ evidence: "e".repeat(4001) }),
    validRaw({ ratings: [
      { criterionId: "judgment", score: "5", note: "n".repeat(2001) },
      { criterionId: "teamwork", score: "4", note: "" },
    ] }),
  ];
  for (const raw of snapshots) {
    const storage = new MemoryStorage();
    seed(storage, raw);
    assert.equal(readEvaluationDraft({ storage, assignmentId: "assignment-1", criteria, now: 2_000 }), null);
  }
});

test("clear removes a stored draft", () => {
  const storage = new MemoryStorage();
  seed(storage, validRaw());
  clearEvaluationDraft(storage, "assignment-1");
  assert.equal(storage.values.size, 0);
});
