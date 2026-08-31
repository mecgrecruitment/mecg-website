"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SCORE_ANCHORS } from "@/lib/rubrics";

type Criterion = { id: string; name: string; description: string; weight: number; required: boolean };

export default function ScreeningReviewForm({ assignmentId, criteria }: { assignmentId: string; criteria: Criterion[] }) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [recusalReason, setRecusalReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function act(payload: Record<string, unknown>) {
    setPending(true);
    setError("");
    const response = await fetch("/api/member/screening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignmentId, ...payload }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) { setError(body?.error ?? "Request failed"); setPending(false); return; }
    router.replace("/member/screening");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={(event) => { event.preventDefault(); void act({ action: "SUBMIT", evidence, recommendation, ratings: criteria.map((criterion) => ({ criterionId: criterion.id, score: Number(scores[criterion.id]), note: notes[criterion.id] ?? "" })) }); }} className="space-y-5">
        {criteria.map((criterion) => (
          <fieldset key={criterion.id} className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
            <legend className="px-2 font-semibold">{criterion.name} · {criterion.weight}%</legend>
            <p className="text-sm text-mecg-navy/55">{criterion.description}</p>
            <label className="mt-4 block text-sm font-medium">
              Rating
              <select required value={scores[criterion.id] ?? ""} onChange={(event) => setScores((current) => ({ ...current, [criterion.id]: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl bg-mecg-navy/[0.035] px-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]">
                <option value="">Choose</option>
                {[1,2,3,4,5].map((score) => <option key={score} value={score}>{score} · {SCORE_ANCHORS[score]}</option>)}
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium">
              Evidence note
              <textarea value={notes[criterion.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [criterion.id]: event.target.value }))} className="mt-2 min-h-20 w-full rounded-xl bg-mecg-navy/[0.035] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]" />
            </label>
          </fieldset>
        ))}
        <label className="block font-medium">
          Overall evidence
          <textarea required minLength={20} maxLength={6000} value={evidence} onChange={(event) => setEvidence(event.target.value)} className="mt-2 min-h-28 w-full rounded-xl bg-mecg-navy/[0.035] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]" />
        </label>
        <label className="block font-medium">
          Recommendation
          <select required value={recommendation} onChange={(event) => setRecommendation(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl bg-mecg-navy/[0.035] px-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]">
            <option value="">Choose</option>
            <option value="ADVANCE">Advance</option>
            <option value="HOLD">Hold for structured review</option>
            <option value="DECLINE">Do not advance</option>
          </select>
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={pending} className="button-primary">Submit and lock review</button>
      </form>
      <section className="rounded-2xl bg-amber-50 p-5">
        <h2 className="font-semibold text-amber-950">Recognize this applicant?</h2>
        <p className="mt-1 text-sm text-amber-900/75">Recuse without naming who you think the applicant is. The system will assign a replacement.</p>
        <textarea
          value={recusalReason}
          onChange={(event) => setRecusalReason(event.target.value)}
          placeholder="Brief reason, such as prior close relationship or identity revealed in the response"
          className="mt-3 min-h-20 w-full rounded-xl bg-white px-3 py-2 shadow-[inset_0_0_0_1px_rgba(180,83,9,0.25)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
        />
        <button type="button" disabled={pending || recusalReason.trim().length < 5} onClick={() => void act({ action: "RECUSE", reason: recusalReason })} className="button-secondary mt-3">Recuse from packet</button>
      </section>
    </div>
  );
}
