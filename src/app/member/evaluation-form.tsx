"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SCORE_ANCHORS } from "@/lib/rubrics";

type Criterion = {
  id: string;
  name: string;
  description: string;
  weight: number;
  required: boolean;
};

const RATING_OPTIONS = [1, 2, 3, 4, 5, "NO"] as const;

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (criteria.some((criterion) => !scores[criterion.id])) {
      setError("Choose a rating for every criterion");
      return;
    }
    setPending(true);
    setError("");
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
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
      {criteria.map((criterion) => {
        const noteRequired = ["1", "2", "5"].includes(scores[criterion.id]);
        return (
          <fieldset key={criterion.id} className="rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
            <legend className="px-1 font-semibold">
              {criterion.name} · {criterion.weight}%{criterion.required ? " · required" : ""}
            </legend>
            <p className="mb-3 text-sm text-mecg-navy/55">{criterion.description}</p>
            <p className="text-sm font-medium">Rating</p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {RATING_OPTIONS.map((option) => {
                const value = String(option);
                const selected = scores[criterion.id] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setScores((current) => ({ ...current, [criterion.id]: value }))}
                    className={`min-h-11 rounded-xl text-sm font-semibold transition-[background-color,color,box-shadow,scale] duration-150 ease-out active:scale-[0.96] ${
                      selected
                        ? "bg-mecg-navy text-white"
                        : "text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(7,13,31,0.28)]"
                    }`}
                    title={typeof option === "number" ? SCORE_ANCHORS[option] : "Not observed"}
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
              className="mt-2 min-h-20 w-full rounded-xl bg-mecg-navy/[0.035] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
              value={notes[criterion.id] ?? ""}
              onChange={(event) => setNotes((current) => ({ ...current, [criterion.id]: event.target.value }))}
              required={noteRequired}
            />
          </fieldset>
        );
      })}
      <label className="font-medium" htmlFor={`evidence-${assignmentId}`}>Overall observable evidence</label>
      <textarea
        id={`evidence-${assignmentId}`}
        className="min-h-24 rounded-xl bg-mecg-navy/[0.035] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
        value={evidence}
        onChange={(event) => setEvidence(event.target.value)}
      />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={pending} className="button-primary disabled:opacity-50">
        {pending ? "Submitting…" : "Submit and lock evaluation"}
      </button>
    </form>
  );
}
