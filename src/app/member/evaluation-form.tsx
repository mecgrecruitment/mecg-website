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
      {criteria.map((criterion) => (
        <fieldset key={criterion.id} className="rounded-lg border p-4">
          <legend className="px-1 font-medium">
            {criterion.name} · {criterion.weight}%{criterion.required ? " · required" : ""}
          </legend>
          <p className="mb-3 text-sm text-gray-600">{criterion.description}</p>
          <label className="text-sm font-medium" htmlFor={`score-${assignmentId}-${criterion.id}`}>Rating</label>
          <select
            id={`score-${assignmentId}-${criterion.id}`}
            required
            className="mt-1 w-full rounded border px-3 py-2"
            value={scores[criterion.id]}
            onChange={(event) => setScores((current) => ({ ...current, [criterion.id]: event.target.value }))}
          >
            <option value="">Choose a rating</option>
            {[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score} · {SCORE_ANCHORS[score]}</option>)}
            <option value="NO">N/O · Not observed</option>
          </select>
          <label className="mt-3 block text-sm font-medium" htmlFor={`note-${assignmentId}-${criterion.id}`}>
            Evidence note{["1", "2", "5"].includes(scores[criterion.id]) ? " · required" : ""}
          </label>
          <textarea
            id={`note-${assignmentId}-${criterion.id}`}
            className="mt-1 min-h-20 w-full rounded border px-3 py-2"
            value={notes[criterion.id] ?? ""}
            onChange={(event) => setNotes((current) => ({ ...current, [criterion.id]: event.target.value }))}
            required={["1", "2", "5"].includes(scores[criterion.id])}
          />
        </fieldset>
      ))}
      <label className="font-medium" htmlFor={`evidence-${assignmentId}`}>Overall observable evidence</label>
      <textarea
        id={`evidence-${assignmentId}`}
        className="min-h-24 rounded border px-3 py-2"
        value={evidence}
        onChange={(event) => setEvidence(event.target.value)}
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button disabled={pending} className="rounded bg-slate-950 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Submitting…" : "Submit and lock evaluation"}
      </button>
    </form>
  );
}
