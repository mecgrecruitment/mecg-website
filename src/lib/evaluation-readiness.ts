import type { CriterionInput } from "./evaluation";

type Criterion = CriterionInput & { name: string };
type Blocker = { field: "rating" | "note"; criterionId: string; message: string };

/** Submission guidance only; the assignment's RPC remains authoritative. */
export function evaluationReadiness({
  criteria,
  scores,
  notes,
  minimumObservedCriteria,
}: {
  criteria: Criterion[];
  scores: Record<string, string>;
  notes: Record<string, string>;
  minimumObservedCriteria: number;
}) {
  const observed = criteria.filter((criterion) => /^[1-5]$/.test(scores[criterion.id] ?? ""));
  const observedIds = new Set(observed.map((criterion) => criterion.id));
  const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  const observedWeight = observed.reduce((sum, criterion) => sum + criterion.weight, 0);
  const coverage = totalWeight > 0 ? observedWeight / totalWeight : 0;
  const unanswered = criteria.filter((criterion) => !observedIds.has(criterion.id) && scores[criterion.id] !== "NO");
  const missingRequired = criteria.filter((criterion) => criterion.required && !observedIds.has(criterion.id));
  const missingNotes = observed.filter((criterion) => ["1", "2", "5"].includes(scores[criterion.id]) && !notes[criterion.id]?.trim());
  const checks = [
    { label: "Every criterion rated or marked not observed", met: unanswered.length === 0 },
    { label: "Required criteria observed", met: missingRequired.length === 0 },
    { label: `At least ${minimumObservedCriteria} criteria observed`, met: observed.length >= minimumObservedCriteria },
    { label: "At least 75% of rubric weight observed", met: coverage >= 0.75 },
    { label: "Evidence notes added for ratings 1, 2, and 5", met: missingNotes.length === 0 },
  ];
  const blockers: Blocker[] = [
    ...unanswered.map((criterion): Blocker => ({ field: "rating", criterionId: criterion.id, message: `Choose a rating or not observed for ${criterion.name}.` })),
    ...missingRequired.filter((criterion) => scores[criterion.id] === "NO").map((criterion): Blocker => ({ field: "rating", criterionId: criterion.id, message: `${criterion.name} is required and cannot be marked not observed.` })),
  ];
  const firstUnobserved = criteria.find((criterion) => !observedIds.has(criterion.id));
  if (firstUnobserved && observed.length < minimumObservedCriteria) {
    blockers.push({ field: "rating", criterionId: firstUnobserved.id, message: `Observe at least ${minimumObservedCriteria} criteria before submitting an evaluation.` });
  }
  if (firstUnobserved && coverage < 0.75) {
    blockers.push({ field: "rating", criterionId: firstUnobserved.id, message: "Observe at least 75% of the scoring guide weight before submitting an evaluation." });
  }
  blockers.push(...missingNotes.map((criterion): Blocker => ({ field: "note", criterionId: criterion.id, message: `Add an evidence note for ${criterion.name}.` })));
  return { ready: criteria.length > 0 && checks.every((check) => check.met), observedCount: observed.length, coverage, checks, blockers };
}
