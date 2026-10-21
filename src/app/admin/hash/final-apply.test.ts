import assert from "node:assert/strict";
import test from "node:test";
import { applyFinalPlan, finalApplyChangeMessage, finalApplyConfirmMessage, finalApplyPlan, type FinalApplyRow } from "./final-apply";

const tally = (yes: number, no: number, unsure = 0, quorum = 5) => ({ quorum, yes_count: yes, no_count: no, total_votes: yes + no + unsure });
const row = (id: string, overrides: Partial<FinalApplyRow> = {}): FinalApplyRow => ({ id, displayName: id.toUpperCase(), tally: tally(3, 2), ready: true, hasDecision: false, declaredConflict: false, ...overrides });

test("the plan holds only ready, undecided applicants whose vote reached quorum", () => {
  const plan = finalApplyPlan([
    row("offer"),
    row("reject", { tally: tally(2, 3) }),
    row("unsure-heavy", { tally: tally(2, 0, 3) }),
    row("below-quorum", { tally: tally(3, 0) }),
    row("no-votes", { tally: undefined }),
    row("blocked", { ready: false }),
    row("already-decided", { hasDecision: true }),
  ]);
  assert.equal(plan.conflictSkipped, 0);
  assert.deepEqual(plan.items, [
    { id: "offer", displayName: "OFFER", outcome: "OFFER" },
    { id: "reject", displayName: "REJECT", outcome: "REJECT" },
    { id: "unsure-heavy", displayName: "UNSURE-HEAVY", outcome: "REJECT" },
  ]);
});

test("the confirm names how many offers and no offers it will lock", () => {
  const plan = finalApplyPlan([row("a"), row("b"), row("c", { tally: tally(0, 5) })]);
  assert.match(finalApplyConfirmMessage(plan), /^Apply 3 decided votes\? 2 offers, 1 no offer\./);
  assert.match(finalApplyConfirmMessage({ items: plan.items.slice(0, 1), conflictSkipped: 0 }), /^Apply 1 decided vote\? 1 offer, 0 no offers\. Each/);
});

test("applying keeps going past a failure and reports who failed and why", async () => {
  const { items } = finalApplyPlan([row("a"), row("b"), row("c")]);
  const calls: string[] = [];
  const progress: number[] = [];
  const result = await applyFinalPlan(items, async (id) => {
    calls.push(id);
    return id === "b" ? { ok: false, error: "conflict declared for this applicant" } : { ok: true, outcome: "OFFER" };
  }, (done) => progress.push(done));
  assert.deepEqual(calls, ["a", "b", "c"]);
  assert.deepEqual(progress, [1, 2, 3]);
  assert.deepEqual(result, { applied: 2, failures: [{ id: "b", displayName: "B", error: "conflict declared for this applicant" }], changes: [] });
});

test("applicants the caller declared a conflict on are left out and counted", () => {
  const plan = finalApplyPlan([
    row("mine"),
    row("recused", { declaredConflict: true }),
    row("recused-pending", { declaredConflict: true, tally: tally(1, 0) }),
    row("recused-decided", { declaredConflict: true, hasDecision: true }),
  ]);
  assert.deepEqual(plan.items.map((item) => item.id), ["mine"]);
  assert.equal(plan.conflictSkipped, 1);
  assert.match(finalApplyConfirmMessage(plan), /^Apply 1 decided vote\? 1 offer, 0 no offers\. 1 skipped: you declared a conflict\. Each/);
});

test("an outcome the server recomputed differently is reported by name", async () => {
  const { items } = finalApplyPlan([row("jordan", { displayName: "Jordan Lee" }), row("sam", { displayName: "Sam Park" }), row("ari")]);
  const applied: Record<string, string | null> = { jordan: "REJECT", sam: "WAITLIST", ari: null };
  const result = await applyFinalPlan(items, async (id) => ({ ok: true, outcome: applied[id] ?? null }));
  assert.equal(result.applied, 3);
  assert.deepEqual(result.changes.map(finalApplyChangeMessage), [
    "Jordan Lee: now No offer (changed since this page loaded)",
    "Sam Park: now Waitlist (changed since this page loaded)",
  ]);
});
