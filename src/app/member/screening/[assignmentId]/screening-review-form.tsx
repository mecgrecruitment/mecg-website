"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";
import { SCORE_ANCHORS } from "@/lib/rubrics";
import { parseScreeningDraft } from "../screening-draft";
import { screeningRecommendationWarning, screeningReviewBlocker } from "../screening-review-readiness";

type Criterion = { id: string; key: string; name: string; description: string; weight: number; required: boolean };

const SCORE_OPTIONS = [1, 2, 3, 4, 5] as const;
const MAX_NOTE_LENGTH = 2000;
const MIN_EVIDENCE_LENGTH = 20;
const MAX_EVIDENCE_LENGTH = 6000;
type DraftSaveState = "loading" | "idle" | "saving" | "saved" | "error";

export default function ScreeningReviewForm({ assignmentId, criteria }: { assignmentId: string; criteria: Criterion[] }) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, string>>(Object.fromEntries(criteria.map((criterion) => [criterion.id, ""])));
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [recusalReason, setRecusalReason] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [confirmingRecusal, setConfirmingRecusal] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftLoadFailed, setDraftLoadFailed] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>("loading");
  const [draftSaveError, setDraftSaveError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const criterionRefs = useRef<Record<string, HTMLFieldSetElement | null>>({});
  const noteRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const evidenceRef = useRef<HTMLTextAreaElement>(null);
  const recommendationRef = useRef<HTMLSelectElement>(null);
  const lastSavedSignature = useRef<string | null>(null);
  const latestSignature = useRef("");
  const scoredCount = criteria.filter((criterion) => scores[criterion.id]).length;
  const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  const draftPayload = useMemo(() => ({
    ratings: criteria.map((criterion) => ({
      criterionId: criterion.id,
      score: scores[criterion.id] ?? "",
      note: notes[criterion.id] ?? "",
    })),
    evidence,
    recommendation,
  }), [criteria, evidence, notes, recommendation, scores]);
  const draftSignature = useMemo(() => JSON.stringify(draftPayload), [draftPayload]);

  useEffect(() => {
    latestSignature.current = draftSignature;
  }, [draftSignature]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadDraft() {
      setDraftReady(false);
      setDraftLoadFailed(false);
      setDraftSaveState("loading");
      setDraftSaveError("");
      try {
        const response = await fetch(`/api/member/screening/draft?assignmentId=${encodeURIComponent(assignmentId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? "Could not load your private draft");
        const draft = body?.draft == null ? null : parseScreeningDraft(body.draft);
        const expectedIds = new Set(criteria.map((criterion) => criterion.id));
        if (draft && (draft.ratings.length !== criteria.length || !draft.ratings.every((rating) => expectedIds.has(rating.criterionId)))) {
          throw new Error("Your saved draft no longer matches this scoring guide.");
        }
        const nextScores = Object.fromEntries(criteria.map((criterion) => [criterion.id, ""]));
        const nextNotes: Record<string, string> = {};
        for (const rating of draft?.ratings ?? []) {
          nextScores[rating.criterionId] = rating.score;
          if (rating.note) nextNotes[rating.criterionId] = rating.note;
        }
        const nextPayload = {
          ratings: criteria.map((criterion) => ({
            criterionId: criterion.id,
            score: nextScores[criterion.id],
            note: nextNotes[criterion.id] ?? "",
          })),
          evidence: draft?.evidence ?? "",
          recommendation: draft?.recommendation ?? "",
        };
        lastSavedSignature.current = JSON.stringify(nextPayload);
        setScores(nextScores);
        setNotes(nextNotes);
        setEvidence(nextPayload.evidence);
        setRecommendation(nextPayload.recommendation);
        setDraftReady(true);
        setDraftSaveState(draft ? "saved" : "idle");
      } catch (loadError) {
        if (controller.signal.aborted) return;
        lastSavedSignature.current = latestSignature.current;
        setDraftReady(true);
        setDraftLoadFailed(true);
        setDraftSaveState("error");
        setDraftSaveError(loadError instanceof Error ? loadError.message : "Could not load your private draft");
      }
    }
    void loadDraft();
    return () => controller.abort();
  }, [assignmentId, criteria]);

  useEffect(() => {
    if (!draftReady || pending || draftSignature === lastSavedSignature.current) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setDraftSaveState("saving");
      setDraftLoadFailed(false);
      setDraftSaveError("");
      try {
        const response = await fetch(`/api/member/screening/draft?assignmentId=${encodeURIComponent(assignmentId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftPayload),
          signal: controller.signal,
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? "Could not save your private draft");
        lastSavedSignature.current = draftSignature;
        if (latestSignature.current === draftSignature) setDraftSaveState("saved");
      } catch (saveError) {
        if (controller.signal.aborted) return;
        setDraftSaveState("error");
        setDraftSaveError(saveError instanceof Error ? saveError.message : "Could not save your private draft");
      }
    }, 700);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [assignmentId, draftPayload, draftReady, draftSignature, pending, retryNonce]);

  function markDraftChanged() {
    setReviewing(false);
    setDraftSaveState("idle");
    setDraftSaveError("");
  }

  async function act(payload: Record<string, unknown>) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/member/screening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignmentId, ...payload }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Request failed");
        setPending(false);
        return;
      }
      const nextAssignmentId = payload.action === "SUBMIT" && typeof body?.nextAssignmentId === "string"
        ? body.nextAssignmentId
        : null;
      router.replace(nextAssignmentId ? `/member/screening/${nextAssignmentId}` : "/member/screening");
      router.refresh();
    } catch {
      setError("Request failed. Check your connection and try again.");
      setPending(false);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const blocker = screeningReviewBlocker(criteria, { scores, notes, evidence, recommendation }, MIN_EVIDENCE_LENGTH);
    if (blocker) {
      setReviewing(false);
      setError(blocker.message);
      if (blocker.field === "score") criterionRefs.current[blocker.criterionId]?.focus();
      if (blocker.field === "note") noteRefs.current[blocker.criterionId]?.focus();
      if (blocker.field === "evidence") evidenceRef.current?.focus();
      if (blocker.field === "recommendation") recommendationRef.current?.focus();
      return;
    }
    if (!reviewing) {
      setReviewing(true);
      setError("");
      return;
    }
    void act({ action: "SUBMIT", evidence, recommendation, ratings: criteria.map((criterion) => ({ criterionId: criterion.id, score: Number(scores[criterion.id]), note: notes[criterion.id] ?? "" })) });
  }

  const recommendationWarning = screeningRecommendationWarning(scores, recommendation);

  return (
    <div className="space-y-8">
      <details className="rounded-2xl bg-mecg-orange/[0.08] p-4" onToggle={(event) => { if (!(event.currentTarget as HTMLDetailsElement).open) setConfirmingRecusal(false); }}>
        <summary className="min-h-11 cursor-pointer list-none content-center font-semibold text-mecg-orange-ink">Recognize this applicant? Step back</summary>
        <p className="mt-2 text-sm text-mecg-navy/70">Do not name the applicant. A confirmed recusal removes this application from your queue and deletes its private draft only when replacement coverage is available.</p>
        <label className="mt-3 block text-sm font-medium text-mecg-orange-ink" htmlFor="screening-recusal-reason">Reason for recusal</label>
        <textarea
          id="screening-recusal-reason"
          value={recusalReason}
          maxLength={1000}
          disabled={pending || !draftReady}
          onChange={(event) => { setRecusalReason(event.target.value); setConfirmingRecusal(false); }}
          placeholder="Brief reason, such as a prior close relationship or an identity revealed in the response"
          className="mt-2 min-h-20 w-full rounded-xl bg-white px-3 py-2 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
        />
        <p className="mt-1 text-right text-xs tabular-nums text-mecg-navy/60">{recusalReason.length} / 1000</p>
        {confirmingRecusal ? (
          <div className="mt-3 rounded-xl bg-white p-3">
            <p className="text-sm font-medium">This permanently removes the application and its draft from your queue.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={() => void act({ action: "RECUSE", reason: recusalReason })} className="button-primary">{pending ? "Stepping back…" : "Confirm recusal"}</button>
              <button type="button" disabled={pending} onClick={() => setConfirmingRecusal(false)} className="button-secondary">Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" disabled={pending || !draftReady || recusalReason.trim().length < 5} onClick={() => setConfirmingRecusal(true)} className="button-secondary mt-3">Review recusal</button>
        )}
      </details>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div
          className={`rounded-xl px-4 py-3 text-sm ${draftSaveState === "error" ? "bg-red-50 text-red-900" : "bg-mecg-navy/[0.045] text-mecg-navy/70"}`}
          role={draftSaveState === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {draftSaveState === "loading" && "Loading your private draft…"}
          {draftSaveState === "idle" && "Unsaved changes save automatically."}
          {draftSaveState === "saving" && "Saving private draft…"}
          {draftSaveState === "saved" && "Private draft saved."}
          {draftSaveState === "error" && <><span>{draftSaveError} You can keep scoring and submit when ready.</span><button type="button" className="ml-2 min-h-11 font-semibold underline underline-offset-2" onClick={() => { if (draftLoadFailed) window.location.reload(); else setRetryNonce((current) => current + 1); }}>Retry</button></>}
        </div>
        <p className="rounded-xl bg-mecg-blue/[0.08] px-4 py-3 text-sm text-mecg-navy" aria-live="polite">
          {scoredCount} of {criteria.length} criteria scored. Add overall evidence and a recommendation before submitting.
        </p>
        {criteria.map((criterion, index) => {
          const note = notes[criterion.id] ?? "";
          const isResume = criterion.key.startsWith("resume_");
          const startsGroup = index === 0 || criteria[index - 1].key.startsWith("resume_") !== isResume;
          return (
            <Fragment key={criterion.id}>
            {startsGroup && <p className="text-xs font-semibold uppercase tracking-[0.1em] text-mecg-orange-ink">{isResume ? "Resume" : "Essays"}</p>}
            <fieldset
              ref={(node) => { criterionRefs.current[criterion.id] = node; }}
              tabIndex={-1}
              className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]"
            >
              <legend className="px-2 font-semibold">{criterion.name} · {totalWeight ? Math.round((criterion.weight / totalWeight) * 100) : 0}%</legend>
              <p className="text-sm text-mecg-navy/55">{criterion.description}</p>
              <div className="mt-4 text-sm font-medium" id={`screening-rating-label-${criterion.id}`}>Rating</div>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-labelledby={`screening-rating-label-${criterion.id}`}>
                {SCORE_OPTIONS.map((score) => {
                  const selected = scores[criterion.id] === String(score);
                  const label = `Score ${score}: ${SCORE_ANCHORS[score]}`;
                  return (
                    <label key={score} title={label} className={`relative min-h-11 cursor-pointer rounded-xl text-center text-sm font-semibold transition-[background-color,color,box-shadow,scale] duration-150 ease-out active:scale-[0.96] ${
                        selected
                          ? "bg-mecg-navy text-white"
                          : "text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(7,13,31,0.28)]"
                      }`}>
                      <input
                        type="radio"
                        name={`screening-rating-${criterion.id}`}
                        value={score}
                        checked={selected}
                        aria-label={label}
                        disabled={pending || !draftReady}
                        onChange={() => { setScores((current) => ({ ...current, [criterion.id]: String(score) })); markDraftChanged(); setError(""); }}
                        className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-mecg-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed"
                      />
                      <span className="relative inline-flex min-h-11 items-center justify-center">{score}</span>
                    </label>
                  );
                })}
              </div>
              {scores[criterion.id] && <p className="mt-2 text-xs text-mecg-navy/65">{SCORE_ANCHORS[Number(scores[criterion.id])]}</p>}
              <label className="mt-4 block text-sm font-medium" htmlFor={`screening-note-${criterion.id}`}>Evidence note {(["1", "2", "5"].includes(scores[criterion.id])) ? "(required for this rating)" : "(optional)"}</label>
              <textarea
                id={`screening-note-${criterion.id}`}
                ref={(node) => { noteRefs.current[criterion.id] = node; }}
                value={note}
                maxLength={MAX_NOTE_LENGTH}
                disabled={pending || !draftReady}
                onChange={(event) => { setNotes((current) => ({ ...current, [criterion.id]: event.target.value })); markDraftChanged(); }}
                aria-describedby={`screening-note-count-${criterion.id}`}
                className="mt-2 min-h-20 w-full rounded-xl bg-mecg-navy/[0.035] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
              />
              <p id={`screening-note-count-${criterion.id}`} className="mt-1 text-right text-xs tabular-nums text-mecg-navy/60">{note.length} / {MAX_NOTE_LENGTH}</p>
            </fieldset>
            </Fragment>
          );
        })}
        <label className="block font-medium" htmlFor="screening-evidence">
          Recommendation rationale and overall evidence
          <textarea
            id="screening-evidence"
            ref={evidenceRef}
            minLength={MIN_EVIDENCE_LENGTH}
            maxLength={MAX_EVIDENCE_LENGTH}
            value={evidence}
            disabled={pending || !draftReady}
            onChange={(event) => { setEvidence(event.target.value); markDraftChanged(); }}
            aria-describedby="screening-evidence-help"
            className="mt-2 min-h-28 w-full rounded-xl bg-mecg-navy/[0.035] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
          />
        </label>
        <p id="screening-evidence-help" className="-mt-3 text-right text-xs tabular-nums text-mecg-navy/60">{evidence.length} / {MAX_EVIDENCE_LENGTH} characters · at least {MIN_EVIDENCE_LENGTH} required</p>
        <label className="block font-medium" htmlFor="screening-recommendation">
          Recommendation
          <select id="screening-recommendation" ref={recommendationRef} required value={recommendation} disabled={pending || !draftReady} onChange={(event) => { setRecommendation(event.target.value); markDraftChanged(); setError(""); }} className="select-control mt-2">
            <option value="">Choose a recommendation</option>
            <option value="ADVANCE">Advance</option>
            <option value="HOLD">Hold for structured review</option>
            <option value="DECLINE">Do not advance</option>
          </select>
        </label>
        {recommendationWarning && <OperationNotice kind="info">Consistency check: {recommendationWarning}</OperationNotice>}
        {reviewing && (
          <section className="rounded-2xl bg-mecg-navy p-5 text-white" aria-labelledby="screening-review-summary">
            <h2 id="screening-review-summary" className="font-semibold">Review before locking</h2>
            <dl className="mt-3 space-y-3 text-sm">
              {criteria.map((criterion) => <div key={criterion.id}><dt className="font-semibold">{criterion.name}: {scores[criterion.id]} — {SCORE_ANCHORS[Number(scores[criterion.id])]}</dt><dd className="mt-1 text-white/70">{notes[criterion.id]?.trim() || "No criterion note"}</dd></div>)}
              <div><dt className="font-semibold">Recommendation</dt><dd className="mt-1 text-white/70">{recommendation === "ADVANCE" ? "Advance" : recommendation === "DECLINE" ? "Do not advance" : "Hold for structured review"}</dd></div>
              <div><dt className="font-semibold">Rationale</dt><dd className="mt-1 whitespace-pre-wrap text-white/70">{evidence.trim()}</dd></div>
            </dl>
          </section>
        )}
        <OperationNotice kind="error">{error}</OperationNotice>
        <p className="text-sm leading-6 text-mecg-navy/60">The final submit locks this review permanently, then opens your next unread application when one remains.</p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending || !draftReady} className="button-primary">{pending ? "Submitting…" : reviewing ? "Submit locked review" : "Review before submitting"}</button>
          {reviewing && <button type="button" disabled={pending} className="button-secondary" onClick={() => setReviewing(false)}>Keep editing</button>}
        </div>
      </form>
    </div>
  );
}
