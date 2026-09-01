"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";
import { SCORE_ANCHORS } from "@/lib/rubrics";

type Criterion = {
  id: string;
  name: string;
  description: string;
  weight: number;
  required: boolean;
};

const RATING_OPTIONS = [1, 2, 3, 4, 5, "NO"] as const;
const MAX_NOTE_LENGTH = 2000;
const MAX_EVIDENCE_LENGTH = 4000;

export default function EvaluationForm({
  assignmentId,
  criteria,
}: {
  assignmentId: string;
  criteria: Criterion[];
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, string>>(Object.fromEntries(criteria.map((criterion) => [criterion.id, ""])));
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const criterionRefs = useRef<Record<string, HTMLFieldSetElement | null>>({});
  const noteRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const scoredCount = criteria.filter((criterion) => scores[criterion.id]).length;

  function selectScore(criterionId: string, value: string) {
    setScores((current) => ({ ...current, [criterionId]: value }));
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missingScore = criteria.find((criterion) => !scores[criterion.id]);
    if (missingScore) {
      setError(`Choose a rating for ${missingScore.name}.`);
      criterionRefs.current[missingScore.id]?.focus();
      return;
    }
    const unobservedRequired = criteria.find((criterion) => criterion.required && scores[criterion.id] === "NO");
    if (unobservedRequired) {
      setError(`${unobservedRequired.name} is required and cannot be marked not observed.`);
      criterionRefs.current[unobservedRequired.id]?.focus();
      return;
    }
    const observedWeight = criteria.filter((criterion) => scores[criterion.id] !== "NO").reduce((total, criterion) => total + criterion.weight, 0);
    const totalWeight = criteria.reduce((total, criterion) => total + criterion.weight, 0);
    if (totalWeight > 0 && observedWeight / totalWeight < 0.75) {
      const firstUnobserved = criteria.find((criterion) => scores[criterion.id] === "NO");
      setError("Observe at least 75% of the rubric weight before submitting an evaluation.");
      if (firstUnobserved) criterionRefs.current[firstUnobserved.id]?.focus();
      return;
    }
    const missingNote = criteria.find((criterion) => ["1", "2", "5"].includes(scores[criterion.id]) && !notes[criterion.id]?.trim());
    if (missingNote) {
      setError(`Add an evidence note for ${missingNote.name}.`);
      noteRefs.current[missingNote.id]?.focus();
      return;
    }

    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/member/evaluations/${assignmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidence,
          ratings: criteria.map((criterion) => ({
            criterionId: criterion.id,
            score: scores[criterion.id] === "NO" ? null : Number(scores[criterion.id]),
            note: notes[criterion.id] ?? "",
          })),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Could not submit evaluation");
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not submit evaluation. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
      <p className="rounded-xl bg-mecg-blue/[0.08] px-4 py-3 text-sm text-mecg-navy" aria-live="polite">
        {scoredCount} of {criteria.length} criteria scored. Scores of 1, 2, and 5 need an evidence note.
      </p>
      {criteria.map((criterion) => {
        const noteRequired = ["1", "2", "5"].includes(scores[criterion.id]);
        const note = notes[criterion.id] ?? "";
        return (
          <fieldset
            key={criterion.id}
            ref={(node) => { criterionRefs.current[criterion.id] = node; }}
            tabIndex={-1}
            className="rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]"
          >
            <legend className="px-1 font-semibold">
              {criterion.name} · {criterion.weight}%{criterion.required ? " · required" : ""}
            </legend>
            <p className="mb-3 text-sm text-mecg-navy/55">{criterion.description}</p>
            <div className="text-sm font-medium" id={`rating-label-${assignmentId}-${criterion.id}`}>Rating</div>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-labelledby={`rating-label-${assignmentId}-${criterion.id}`}>
              {RATING_OPTIONS.map((option) => {
                const value = String(option);
                const selected = scores[criterion.id] === value;
                const label = value === "NO" ? "Not observed" : `Score ${value}: ${SCORE_ANCHORS[Number(value)]}`;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={label}
                    disabled={pending}
                    onClick={() => selectScore(criterion.id, value)}
                    className={`min-h-11 rounded-xl text-sm font-semibold transition-[background-color,color,box-shadow,scale] duration-150 ease-out active:scale-[0.96] ${
                      selected
                        ? "bg-mecg-navy text-white"
                        : "text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(7,13,31,0.28)]"
                    }`}
                    title={label}
                  >
                    {value === "NO" ? "N/O" : value}
                  </button>
                );
              })}
            </div>
            <label className="mt-3 block text-sm font-medium" htmlFor={`note-${assignmentId}-${criterion.id}`}>
              Evidence note{noteRequired && <span className="ml-1.5 rounded-full bg-mecg-orange/[0.16] px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-mecg-orange-ink">Required</span>}
            </label>
            <textarea
              id={`note-${assignmentId}-${criterion.id}`}
              ref={(node) => { noteRefs.current[criterion.id] = node; }}
              className="mt-2 min-h-20 w-full rounded-xl bg-mecg-navy/[0.035] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
              value={note}
              onChange={(event) => setNotes((current) => ({ ...current, [criterion.id]: event.target.value }))}
              maxLength={MAX_NOTE_LENGTH}
              disabled={pending}
              aria-describedby={`note-count-${assignmentId}-${criterion.id}`}
            />
            <p id={`note-count-${assignmentId}-${criterion.id}`} className="mt-1 text-right text-xs tabular-nums text-mecg-navy/45">{note.length} / {MAX_NOTE_LENGTH}</p>
          </fieldset>
        );
      })}
      <label className="font-medium" htmlFor={`evidence-${assignmentId}`}>Overall observable evidence (optional)</label>
      <textarea
        id={`evidence-${assignmentId}`}
        className="min-h-24 rounded-xl bg-mecg-navy/[0.035] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
        value={evidence}
        onChange={(event) => setEvidence(event.target.value)}
        maxLength={MAX_EVIDENCE_LENGTH}
        disabled={pending}
        aria-describedby={`evidence-count-${assignmentId}`}
      />
      <p id={`evidence-count-${assignmentId}`} className="-mt-3 text-right text-xs tabular-nums text-mecg-navy/45">{evidence.length} / {MAX_EVIDENCE_LENGTH}</p>
      <OperationNotice kind="error">{error}</OperationNotice>
      <button disabled={pending} className="button-primary disabled:opacity-50">
        {pending ? "Submitting…" : "Submit and lock evaluation"}
      </button>
    </form>
  );
}
