"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";
import { parseEvaluationDraftPayload } from "@/app/api/member/evaluations/evaluation-draft-payload";
import { clearEvaluationDraft, readEvaluationDraft, writeEvaluationDraft } from "@/lib/evaluation-draft-recovery";
import { SCORE_ANCHORS } from "@/lib/rubrics";
import { authorizedFetch, retryOnNetworkError } from "@/lib/client-fetch";

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

type DraftSaveState =
  | { kind: "loading"; message: string }
  | { kind: "idle"; message: string }
  | { kind: "saving"; message: string }
  | { kind: "saved"; message: string }
  | { kind: "error"; message: string };

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
  const [saved, setSaved] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftLoadFailed, setDraftLoadFailed] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>({ kind: "loading", message: "Loading your saved draft…" });
  const [retryNonce, setRetryNonce] = useState(0);
  const criterionRefs = useRef<Record<string, HTMLFieldSetElement | null>>({});
  const noteRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const lastSavedSignature = useRef<string | null>(null);
  const latestSignature = useRef("");
  const scoredCount = criteria.filter((criterion) => scores[criterion.id]).length;
  const draftPayload = useMemo(() => ({
    ratings: criteria.map((criterion) => ({
      criterionId: criterion.id,
      score: scores[criterion.id] ?? "",
      note: notes[criterion.id] ?? "",
    })),
    evidence,
  }), [criteria, evidence, notes, scores]);
  const draftSignature = useMemo(() => JSON.stringify(draftPayload), [draftPayload]);

  useEffect(() => {
    latestSignature.current = draftSignature;
  }, [draftSignature]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadDraft() {
      const localDraft = readEvaluationDraft({ storage: window.sessionStorage, assignmentId, criteria });
      setDraftReady(false);
      setDraftLoadFailed(false);
      setDraftSaveState({ kind: "loading", message: "Loading your saved draft…" });
      try {
        const response = await authorizedFetch(`/api/member/evaluations/${assignmentId}/draft`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? "Could not load evaluation draft");

        const serverDraft = body?.draft == null ? null : parseEvaluationDraftPayload(body.draft);
        const expectedIds = new Set(criteria.map((criterion) => criterion.id));
        const validServerDraft = serverDraft
          && serverDraft.ratings.length === criteria.length
          && serverDraft.ratings.every((rating) => expectedIds.has(rating.criterionId));
        if (body?.draft != null && !validServerDraft) throw new Error("Your saved draft no longer matches this rubric.");

        const recovered = validServerDraft
          ? {
              scores: Object.fromEntries(serverDraft.ratings.map((rating) => [rating.criterionId, rating.score])),
              notes: Object.fromEntries(serverDraft.ratings.filter((rating) => rating.note).map((rating) => [rating.criterionId, rating.note])),
              evidence: serverDraft.evidence,
            }
          : localDraft;

        const nextScores = Object.fromEntries(criteria.map((criterion) => [criterion.id, ""]));
        const nextNotes: Record<string, string> = {};
        for (const criterion of criteria) {
          nextScores[criterion.id] = recovered?.scores[criterion.id] ?? "";
          if (recovered?.notes[criterion.id]) nextNotes[criterion.id] = recovered.notes[criterion.id];
        }
        const nextPayload = {
          ratings: criteria.map((criterion) => ({
            criterionId: criterion.id,
            score: nextScores[criterion.id],
            note: nextNotes[criterion.id] ?? "",
          })),
          evidence: recovered?.evidence ?? "",
        };
        // A local-only draft should be promoted to the server immediately when
        // the server is reachable. Untouched blank forms do not need a row.
        lastSavedSignature.current = localDraft && !validServerDraft
          ? null
          : JSON.stringify(nextPayload);
        setScores(nextScores);
        setNotes(nextNotes);
        setEvidence(nextPayload.evidence);
        setDraftReady(true);
        setDraftSaveState(validServerDraft
          ? { kind: "saved", message: "Draft restored from the server. Changes save automatically." }
          : localDraft
            ? { kind: "idle", message: "Draft recovered on this device. Syncing it across devices…" }
          : { kind: "idle", message: "Changes save automatically across devices." });
      } catch (loadError) {
        if (controller.signal.aborted) return;
        // Draft recovery is a convenience. A temporary save outage must not
        // prevent the evaluator from completing and locking their work.
        if (localDraft) {
          const localPayload = {
            ratings: criteria.map((criterion) => ({
              criterionId: criterion.id,
              score: localDraft.scores[criterion.id] ?? "",
              note: localDraft.notes[criterion.id] ?? "",
            })),
            evidence: localDraft.evidence,
          };
          setScores(localDraft.scores);
          setNotes(localDraft.notes);
          setEvidence(localDraft.evidence);
          lastSavedSignature.current = JSON.stringify(localPayload);
        } else {
          lastSavedSignature.current = latestSignature.current;
        }
        setDraftReady(true);
        setDraftLoadFailed(true);
        setDraftSaveState({
          kind: "error",
          message: `${loadError instanceof Error ? loadError.message : "Could not load evaluation draft"} ${
            localDraft
              ? "A browser backup was restored; you can keep working."
              : "You can keep working and this browser will retain a backup."
          }`,
        });
      }
    }
    void loadDraft();
    return () => controller.abort();
  }, [assignmentId, criteria]);

  useEffect(() => {
    if (!draftReady || saved) return;
    writeEvaluationDraft({
      storage: window.sessionStorage,
      assignmentId,
      criteria,
      draft: { scores, notes, evidence },
    });
  }, [assignmentId, criteria, draftReady, evidence, notes, saved, scores]);

  useEffect(() => {
    if (!draftReady || pending || saved || draftSignature === lastSavedSignature.current) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setDraftSaveState({ kind: "saving", message: "Saving draft…" });
      setDraftLoadFailed(false);
      try {
        const response = await retryOnNetworkError(() => authorizedFetch(`/api/member/evaluations/${assignmentId}/draft`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftPayload),
          signal: controller.signal,
        }), { stillWanted: () => !controller.signal.aborted });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? "Could not save evaluation draft");
        lastSavedSignature.current = draftSignature;
        if (latestSignature.current === draftSignature) {
          setDraftSaveState({ kind: "saved", message: "Draft saved across devices." });
        }
      } catch (saveError) {
        if (controller.signal.aborted) return;
        setDraftSaveState({
          kind: "error",
          message: `${saveError instanceof Error ? saveError.message : "Could not save evaluation draft"} Your browser backup is current; retry to sync across devices.`,
        });
      }
    }, 700);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [assignmentId, draftPayload, draftReady, draftSignature, pending, retryNonce, saved]);

  function markDraftChanged() {
    setReviewing(false);
    setDraftSaveState({ kind: "idle", message: "Unsaved changes. Saving shortly…" });
  }

  function selectScore(criterionId: string, value: string) {
    setScores((current) => ({ ...current, [criterionId]: value }));
    markDraftChanged();
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
      setError("Observe at least 75% of the scoring guide weight before submitting an evaluation.");
      if (firstUnobserved) criterionRefs.current[firstUnobserved.id]?.focus();
      return;
    }
    const missingNote = criteria.find((criterion) => ["1", "2", "5"].includes(scores[criterion.id]) && !notes[criterion.id]?.trim());
    if (missingNote) {
      setError(`Add an evidence note for ${missingNote.name}.`);
      noteRefs.current[missingNote.id]?.focus();
      return;
    }

    if (!reviewing) {
      setReviewing(true);
      return;
    }

    setPending(true);
    setError("");
    try {
      const response = await retryOnNetworkError(() => authorizedFetch(`/api/member/evaluations/${assignmentId}`, {
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
      }));
      const body = await response.json().catch(() => null);
      // 409 means the first submit landed before the connection dropped; treat it as done.
      if (!response.ok && response.status !== 409) {
        setError(body?.error ?? "Could not submit evaluation");
        setPending(false);
        return;
      }
      clearEvaluationDraft(window.sessionStorage, assignmentId);
      setSaved(true);
      window.setTimeout(() => router.refresh(), 220);
    } catch {
      setError("Could not submit evaluation. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
      <div
        className={`rounded-xl px-4 py-3 text-sm ${draftSaveState.kind === "error" ? "bg-red-50 text-red-900" : "bg-mecg-navy/[0.045] text-mecg-navy/70"}`}
        role={draftSaveState.kind === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        <span>{draftSaveState.message}</span>
        {draftSaveState.kind === "error" && (
          <button
            type="button"
            className="ml-2 min-h-11 font-semibold underline underline-offset-2"
            onClick={() => {
              if (!draftReady || draftLoadFailed) window.location.reload();
              else setRetryNonce((current) => current + 1);
            }}
          >
            Retry
          </button>
        )}
      </div>
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
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-labelledby={`rating-label-${assignmentId}-${criterion.id}`}>
              {RATING_OPTIONS.map((option) => {
                const value = String(option);
                const selected = scores[criterion.id] === value;
                const label = value === "NO" ? "Not observed" : `Score ${value}: ${SCORE_ANCHORS[Number(value)]}`;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    aria-label={label}
                    disabled={pending || !draftReady}
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
            {scores[criterion.id] && scores[criterion.id] !== "NO" && (
              <p className="mt-2 text-xs text-mecg-navy/65">{SCORE_ANCHORS[Number(scores[criterion.id])]}</p>
            )}
            <label className="mt-3 block text-sm font-medium" htmlFor={`note-${assignmentId}-${criterion.id}`}>
              Evidence note{noteRequired && <span className="ml-1.5 rounded-full bg-mecg-orange/[0.16] px-2 py-0.5 text-[13px] font-semibold text-mecg-orange-ink">Required</span>}
            </label>
            <textarea
              id={`note-${assignmentId}-${criterion.id}`}
              ref={(node) => { noteRefs.current[criterion.id] = node; }}
              className="mt-2 min-h-20 w-full rounded-xl bg-mecg-navy/[0.035] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)]"
              value={note}
              onChange={(event) => {
                setNotes((current) => ({ ...current, [criterion.id]: event.target.value }));
                markDraftChanged();
              }}
              maxLength={MAX_NOTE_LENGTH}
              disabled={pending || !draftReady}
              aria-describedby={`note-count-${assignmentId}-${criterion.id}`}
            />
            <p id={`note-count-${assignmentId}-${criterion.id}`} className="mt-1 text-right text-xs tabular-nums text-mecg-navy/60">{note.length} / {MAX_NOTE_LENGTH}</p>
          </fieldset>
        );
      })}
      <label className="font-medium" htmlFor={`evidence-${assignmentId}`}>Overall observable evidence (optional)</label>
      <textarea
        id={`evidence-${assignmentId}`}
        className="min-h-24 rounded-xl bg-mecg-navy/[0.035] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)]"
        value={evidence}
        onChange={(event) => {
          setEvidence(event.target.value);
          markDraftChanged();
        }}
        maxLength={MAX_EVIDENCE_LENGTH}
        disabled={pending || !draftReady}
        aria-describedby={`evidence-count-${assignmentId}`}
      />
      <p id={`evidence-count-${assignmentId}`} className="-mt-3 text-right text-xs tabular-nums text-mecg-navy/60">{evidence.length} / {MAX_EVIDENCE_LENGTH}</p>
      <OperationNotice kind="error">{error}</OperationNotice>
      {reviewing && !saved && (
        <section className="rounded-2xl bg-mecg-navy/[0.045] p-4" aria-labelledby={`review-${assignmentId}`}>
          <h3 id={`review-${assignmentId}`} className="font-semibold text-mecg-navy">Review before locking</h3>
          <p className="mt-1 text-sm text-mecg-navy/65">Confirm every rating and evidence note. Submission is final.</p>
          <dl className="mt-3 divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
            {criteria.map((criterion) => (
              <div key={criterion.id} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                <div>
                  <dt className="font-medium text-mecg-navy">{criterion.name}</dt>
                  {notes[criterion.id]?.trim() && <dd className="mt-0.5 text-xs text-mecg-navy/60">{notes[criterion.id]}</dd>}
                </div>
                <dd className="shrink-0 font-semibold text-mecg-navy">{scores[criterion.id] === "NO" ? "Not observed" : `${scores[criterion.id]} / 5`}</dd>
              </div>
            ))}
          </dl>
          <button type="button" className="button-secondary mt-3 text-sm" onClick={() => setReviewing(false)}>Keep editing</button>
        </section>
      )}
      {saved && <p className="submission-confirmed rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900" role="status">Evaluation submitted and locked.</p>}
      <button type="submit" disabled={pending || !draftReady} className={`button-primary disabled:opacity-50 ${saved ? "is-success" : ""}`}>
        {saved ? "✓ Submitted" : pending ? "Submitting…" : reviewing ? "Confirm and lock evaluation" : "Review evaluation"}
      </button>
    </form>
  );
}
