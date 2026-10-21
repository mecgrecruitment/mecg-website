"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";
import type { EvaluationDraftPayload } from "@/app/api/member/evaluations/evaluation-draft-payload";
import { parseEvaluationDraftSnapshot, parseEvaluationDraftWriteResult, type EvaluationDraftSnapshot, type EvaluationDraftWrite } from "@/lib/evaluation-draft-write";
import { clearEvaluationDraft, readEvaluationDraft, writeEvaluationDraft, type EvaluationDraft } from "@/lib/evaluation-draft-recovery";
import { evaluationSubmissionResult } from "@/lib/evaluation-submission";
import { evaluationReadiness } from "@/lib/evaluation-readiness";
import { SCORE_ANCHORS } from "@/lib/rubrics";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";

type Criterion = {
  id: string;
  name: string;
  description: string;
  weight: number;
  required: boolean;
};

function payloadForDraft(draft: EvaluationDraft, criteria: Criterion[]) {
  return { ratings: criteria.map((criterion) => ({ criterionId: criterion.id, score: draft.scores[criterion.id] ?? "", note: draft.notes[criterion.id] ?? "" })), evidence: draft.evidence };
}

const RATING_OPTIONS = [1, 2, 3, 4, 5, "NO"] as const;
const MAX_NOTE_LENGTH = 2000;
const EVALUATION_REQUEST_TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
const MAX_EVIDENCE_LENGTH = 4000;

function browserDraftStorage() {
  try { return window.sessionStorage; } catch { return null; }
}

type DraftSaveState =
  | { kind: "loading"; message: string }
  | { kind: "idle"; message: string }
  | { kind: "saving"; message: string }
  | { kind: "saved"; message: string }
  | { kind: "error"; message: string };

function EvaluationEditor({
  assignmentId,
  criteria,
  minimumObservedCriteria,
}: {
  assignmentId: string;
  criteria: Criterion[];
  minimumObservedCriteria: number;
}) {
  const router = useRouter();
  const criteriaSignature = JSON.stringify(criteria);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [scores, setScores] = useState<Record<string, string>>(Object.fromEntries(criteria.map((criterion) => [criterion.id, ""])));
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftConflict, setDraftConflict] = useState<{ local: EvaluationDraft; server: EvaluationDraft } | null>(null);
  const conflictHeadingRef = useRef<HTMLHeadingElement>(null);
  const resolvingConflict = useRef(false);
  const [draftLoadFailed, setDraftLoadFailed] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>({ kind: "loading", message: "Loading your saved draft…" });
  const [localBackupSignature, setLocalBackupSignature] = useState<string | null>(null);
  const [backupChecked, setBackupChecked] = useState(false);
  const [serverSavedSignature, setServerSavedSignature] = useState<string | null>(null);
  const [loadNonce, setLoadNonce] = useState(0);
  const revision = useRef<string | null>(null);
  const revisionKnown = useRef(false);
  const inflightSave = useRef<Promise<void> | null>(null);
  const unconfirmedWrite = useRef<EvaluationDraftWrite | null>(null);
  const conflictActive = useRef(false);
  const recoveryLocal = useRef<EvaluationDraft | null>(null);
  const activeAssignment = useRef(assignmentId);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const reviewButtonRef = useRef<HTMLButtonElement>(null);
  const criterionRefs = useRef<Record<string, HTMLFieldSetElement | null>>({});
  const noteRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const lastSavedSignature = useRef<string | null>(null);
  const latestSignature = useRef("");
  const readiness = evaluationReadiness({ criteria, scores, notes, minimumObservedCriteria });
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
    if (draftConflict) conflictHeadingRef.current?.focus();
    else if (resolvingConflict.current) {
      resolvingConflict.current = false;
      criterionRefs.current[criteria[0]?.id]?.focus();
    }
  }, [draftConflict, criteria]);

  useEffect(() => {
    if (reviewing) reviewHeadingRef.current?.focus();
  }, [reviewing]);

  const latestPayload = useRef(draftPayload);
  useLayoutEffect(() => {
    latestSignature.current = draftSignature;
    latestPayload.current = draftPayload;
    activeAssignment.current = assignmentId;
  }, [assignmentId, draftPayload, draftSignature]);

  function copyFromPayload(payload: EvaluationDraftPayload | null): EvaluationDraft {
    return { scores: Object.fromEntries(criteria.map(({ id }) => [id, payload?.ratings.find((rating) => rating.criterionId === id)?.score ?? ""])),
      notes: Object.fromEntries((payload?.ratings ?? []).filter((rating) => rating.note).map((rating) => [rating.criterionId, rating.note])), evidence: payload?.evidence ?? "" };
  }
  function matchesRubric(snapshot: EvaluationDraftSnapshot) {
    return snapshot.assignmentId === assignmentId && (!snapshot.draft || (snapshot.draft.ratings.length === criteria.length && snapshot.draft.ratings.every((rating) => criteria.some(({ id }) => id === rating.criterionId))));
  }

  useEffect(() => {
    const controller = new AbortController();
    async function loadDraft() {
      const storage = browserDraftStorage();
      const localDraft = recoveryLocal.current ?? (storage ? readEvaluationDraft({ storage, assignmentId, criteria }) : null);
      revisionKnown.current = false;
      setDraftReady(false);
      setDraftLoadFailed(false);
      setDraftSaveState({ kind: "loading", message: "Loading your saved draft…" });
      try {
        const { response, body: result } = await fetchJsonWithTimeout(`/api/member/evaluations/${assignmentId}/draft`, { cache: "no-store" }, EVALUATION_REQUEST_TIMEOUT_MS,
          (input, init) => authorizedFetch(input, { ...init, signal: AbortSignal.any([controller.signal, ...(init?.signal ? [init.signal] : [])]) }));
        if (controller.signal.aborted) return;
        const body = isRecord(result) ? result : null;
        if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "Could not load evaluation draft");

        const snapshot = parseEvaluationDraftSnapshot(result);
        if (!snapshot || !matchesRubric(snapshot)) throw new Error("Your saved draft could not be verified against this rubric.");
        revision.current = snapshot.revision;
        revisionKnown.current = true;
        unconfirmedWrite.current = null;
        recoveryLocal.current = null;
        const validServerDraft = snapshot.draft !== null;
        const serverCopy = snapshot.draft ? copyFromPayload(snapshot.draft) : null;
        if (localDraft && serverCopy && JSON.stringify(payloadForDraft(localDraft, criteria)) !== JSON.stringify(payloadForDraft(serverCopy, criteria))) {
          conflictActive.current = true;
          lastSavedSignature.current = JSON.stringify(payloadForDraft(serverCopy, criteria));
          setDraftConflict({ local: localDraft, server: serverCopy });
          setDraftSaveState({ kind: "idle", message: "Two saved copies differ. Choose a copy before editing or syncing." });
          return;
        }
        const recovered = serverCopy ?? localDraft;

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
        setServerSavedSignature(validServerDraft ? JSON.stringify(nextPayload) : null);
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
        // Editing and private backups remain available during an outage, but
        // no write may proceed until the authoritative revision is known.
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
              : "You can keep working. Check the backup status below before leaving this page."
          } Your changes have not synced across devices. Retry loading the saved draft before saving or submitting.`,
        });
      }
    }
    void loadDraft();
    return () => controller.abort();
  // The explicit reload nonce preserves memory-only edits for comparison.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, criteriaSignature, loadNonce]);

  useEffect(() => {
    if (!draftReady || saved) return;
    const storage = browserDraftStorage();
    const persisted = storage ? writeEvaluationDraft({
      storage, assignmentId, criteria, draft: { scores, notes, evidence },
    }) : false;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLocalBackupSignature(persisted ? draftSignature : null);
      setBackupChecked(true);
    });
    return () => { cancelled = true; };
  }, [assignmentId, criteria, draftReady, draftSignature, evidence, notes, saved, scores]);

  const saveCurrentDraft = useCallback(async function drain(retry = false): Promise<boolean> {
    const active = inflightSave.current;
    if (active) { await active; return drain(); }
    if (!mounted.current || activeAssignment.current !== assignmentId || !revisionKnown.current || conflictActive.current) return false;
    const previous = unconfirmedWrite.current;
    if (previous && !retry) return false;
    const current = latestPayload.current;
    if (!previous && JSON.stringify(current) === lastSavedSignature.current) return true;
    const request = previous ?? { ...current, expectedRevision: revision.current, mutationId: crypto.randomUUID() };
    unconfirmedWrite.current = request;
    let finish = () => {};
    inflightSave.current = new Promise<void>((resolve) => { finish = resolve; });
    setDraftSaveState({ kind: "saving", message: "Saving draft…" });
    try {
      const { response, body } = await fetchJsonWithTimeout(`/api/member/evaluations/${assignmentId}/draft`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
      }, EVALUATION_REQUEST_TIMEOUT_MS, authorizedFetch);
      if (!mounted.current || activeAssignment.current !== assignmentId) return false;
      const result = parseEvaluationDraftWriteResult(body);
      if (response.status === 409 && result?.kind === "conflict" && matchesRubric(result.snapshot)) {
        const snapshot = result.snapshot;
        revision.current = snapshot.revision;
        unconfirmedWrite.current = null;
        conflictActive.current = true;
        const local = copyFromPayload(latestPayload.current);
        setDraftConflict({ local, server: copyFromPayload(snapshot.draft) });
        lastSavedSignature.current = JSON.stringify(payloadForDraft(copyFromPayload(snapshot.draft), criteria));
        setDraftReady(false); setReviewing(false);
        setDraftSaveState({ kind: "idle", message: "Saved observations changed elsewhere. Compare both copies before continuing." });
        return false;
      }
      if (!response.ok && response.status < 500 && response.status !== 408) {
        unconfirmedWrite.current = null;
        const detail = isRecord(body) && typeof body.error === "string" ? body.error : "This draft was refused.";
        setDraftSaveState({ kind: "error", message: `${detail} Your changes have not synced across devices. Keep your private copy before retrying.` });
        return false;
      }
      if (!response.ok || result?.kind !== "saved" || result.assignmentId !== assignmentId || result.mutationId !== request.mutationId || !matchesRubric(result)) throw new Error("The server save could not be confirmed.");
      revision.current = result.revision;
      const signature = JSON.stringify({ ratings: result.draft.ratings, evidence: result.draft.evidence });
      lastSavedSignature.current = signature;
      setServerSavedSignature(signature);
      unconfirmedWrite.current = null;
      if (latestSignature.current === JSON.stringify({ ratings: request.ratings, evidence: request.evidence })) {
        setDraftSaveState({ kind: "saved", message: "Draft saved across devices." });
      } else void drain();
      return true;
    } catch {
      if (mounted.current && activeAssignment.current === assignmentId) setDraftSaveState({ kind: "error", message: "The server save could not be confirmed. It may already be saved. Your changes have not synced across devices. Retry confirms the exact earlier request before syncing newer edits; download a private copy before leaving." });
      return false;
    } finally { inflightSave.current = null; finish(); }
  // Parsing closes over the current assignment's rubric; changes remount/load it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, criteriaSignature]);

  useEffect(() => {
    if (!draftReady || pending || saved || draftConflict || draftLoadFailed || draftSignature === lastSavedSignature.current) return;
    const timer = window.setTimeout(() => { void saveCurrentDraft(); }, 700);
    // Editing cancels a queued timer, never a request that may already commit.
    return () => window.clearTimeout(timer);
  }, [draftReady, pending, saved, draftConflict, draftLoadFailed, draftSignature, saveCurrentDraft]);

  function markDraftChanged() {
    setReviewing(false);
    if (revisionKnown.current && !unconfirmedWrite.current) setDraftSaveState({ kind: "idle", message: "Unsaved changes. Saving shortly…" });
  }

  function selectScore(criterionId: string, value: string) {
    setScores((current) => ({ ...current, [criterionId]: value }));
    markDraftChanged();
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || saved || !draftReady || conflictActive.current) return;
    const blocker = readiness.blockers[0];
    if (!readiness.ready) {
      setError(blocker?.message ?? "The Board must configure the rubric before grading can begin.");
      if (blocker?.field === "note") noteRefs.current[blocker.criterionId]?.focus();
      else if (blocker) criterionRefs.current[blocker.criterionId]?.focus();
      return;
    }

    if (!reviewing) {
      setReviewing(true);
      return;
    }

    setPending(true);
    setError("");
    try {
      if (!revisionKnown.current || !(await saveCurrentDraft()) || conflictActive.current || unconfirmedWrite.current || latestSignature.current !== lastSavedSignature.current) {
        setError("Confirm the latest draft save and resolve any differing copies before locking this evaluation. Your observations remain here.");
        setPending(false);
        return;
      }
      const { response, body } = await fetchJsonWithTimeout(`/api/member/evaluations/${assignmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidence,
          expectedDraftRevision: revision.current,
          ratings: criteria.map((criterion) => ({
            criterionId: criterion.id,
            score: scores[criterion.id] === "NO" ? null : Number(scores[criterion.id]),
            note: notes[criterion.id] ?? "",
          })),
        }),
      }, EVALUATION_REQUEST_TIMEOUT_MS, authorizedFetch);
      const conflictResult = parseEvaluationDraftWriteResult(body);
      if (response.status === 409 && conflictResult?.kind === "conflict" && matchesRubric(conflictResult.snapshot)) {
        revision.current = conflictResult.snapshot.revision;
        conflictActive.current = true;
        setDraftConflict({ local: copyFromPayload(latestPayload.current), server: copyFromPayload(conflictResult.snapshot.draft) });
        lastSavedSignature.current = JSON.stringify(payloadForDraft(copyFromPayload(conflictResult.snapshot.draft), criteria));
        setDraftReady(false); setReviewing(false); setPending(false);
        setDraftSaveState({ kind: "idle", message: "Saved observations changed before locking. Compare both copies before continuing." });
        return;
      }
      const submission = evaluationSubmissionResult(response.status, isRecord(body) && body.assignmentId === assignmentId ? body : null);
      if (submission.kind === "unconfirmed") {
        setError(submission.message);
        setPending(false);
        return;
      }
      const storage = browserDraftStorage();
      if (storage) clearEvaluationDraft(storage, assignmentId);
      setSaved(true);
      window.setTimeout(() => router.refresh(), 220);
    } catch {
      setError("Submission could not be confirmed. Your draft is still here. Check My work before retrying; the evaluation may already be locked.");
      setPending(false);
    }
  }

  function exportDraft(draft: EvaluationDraft = { scores, notes, evidence }) {
    const blob = new Blob([JSON.stringify({ assignmentId, exportedAt: new Date().toISOString(), ...payloadForDraft(draft, criteria) }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mecg-evaluation-draft.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function chooseDraft(source: "local" | "server") {
    if (!draftConflict) return;
    const selected = draftConflict[source];
    lastSavedSignature.current = JSON.stringify(payloadForDraft(draftConflict.server, criteria));
    setServerSavedSignature(lastSavedSignature.current);
    setScores(selected.scores); setNotes(selected.notes); setEvidence(selected.evidence);
    resolvingConflict.current = true;
    conflictActive.current = false;
    setDraftConflict(null); setDraftReady(true); setDraftLoadFailed(false);
    setDraftSaveState(source === "server" ? { kind: "saved", message: "Server draft selected." } : { kind: "idle", message: "Browser draft recovered. Syncing across devices…" });
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
      {draftConflict && (
        <section aria-labelledby={`conflict-${assignmentId}`} className="rounded-xl border border-warning-edge bg-warning-wash p-4 text-warning">
          <h2 ref={conflictHeadingRef} tabIndex={-1} id={`conflict-${assignmentId}`} className="text-lg font-semibold">Choose which evaluation draft to keep</h2>
          <p className="mt-2 text-sm leading-6">The browser and server copies differ. Neither has been overwritten. Compare them and download either copy before choosing. Using the server replaces the browser backup; recovering the browser copy syncs it to the server.</p>
          <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
            {(["local", "server"] as const).map((source) => {
              const draft = draftConflict[source];
              return <article key={source} className="min-w-0 rounded-xl border border-warning-edge p-3">
                <h3 className="font-semibold">{source === "local" ? "Browser copy" : "Server copy"}</h3>
                <dl className="mt-3 space-y-3 text-sm">{criteria.map((criterion) => <div key={criterion.id}><dt className="font-medium">{criterion.name}: {draft.scores[criterion.id] || "Unrated"}</dt><dd className="whitespace-pre-wrap break-words">{draft.notes[criterion.id] || "No note"}</dd></div>)}</dl>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm">{draft.evidence || "No overall evidence"}</p>
                <button type="button" onClick={() => exportDraft(draft)} className="mt-3 min-h-11 font-semibold underline">Download {source === "local" ? "browser" : "server"} copy</button>
                <button type="button" onClick={() => chooseDraft(source)} className="button-primary mt-3 w-full">{source === "local" ? "Recover browser draft" : "Use server draft"}</button>
              </article>;
            })}
          </div>
        </section>
      )}
      <p aria-hidden="true" className="min-h-6 text-sm text-muted">{draftSaveState.kind === "loading" ? "Loading saved draft…" : draftSaveState.kind === "saving" ? "Saving…" : draftSaveState.kind === "error" ? "Draft save needs attention." : draftSaveState.kind === "saved" ? "Draft up to date." : "Draft workspace ready."}</p>
      {!draftConflict && <fieldset disabled={pending || saved || !draftReady} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
      <div className="rounded-xl border border-line px-4 py-3 text-sm text-mecg-navy">
        <p className="font-semibold" role="status">{readiness.ready ? "Ready to review" : `${readiness.observedCount} of ${criteria.length} criteria observed`}</p>
        <ul className="mt-2 space-y-1 text-muted">
          {readiness.checks.map((check) => (
            <li key={check.label}><span className="font-medium text-mecg-navy">{check.met ? "Met" : "Needed"}:</span> {check.label}</li>
          ))}
        </ul>
      </div>
      {criteria.map((criterion) => {
        const noteRequired = ["1", "2", "5"].includes(scores[criterion.id]);
        const note = notes[criterion.id] ?? "";
        return (
          <fieldset
            key={criterion.id}
            ref={(node) => { criterionRefs.current[criterion.id] = node; }}
            tabIndex={-1}
            className="rounded-xl border border-line p-4"
          >
            <legend className="px-1 font-semibold">
              {criterion.name} · {criterion.weight}%{criterion.required ? " · required" : ""}
            </legend>
            <p className="mb-3 text-sm text-muted">{criterion.description}</p>
            <div className="text-sm font-medium" id={`rating-label-${assignmentId}-${criterion.id}`}>Rating</div>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-labelledby={`rating-label-${assignmentId}-${criterion.id}`} aria-describedby={`rating-anchor-${assignmentId}-${criterion.id}`}>
              {RATING_OPTIONS.map((option) => {
                const value = String(option);
                const selected = scores[criterion.id] === value;
                const label = value === "NO" ? "Not observed" : `Score ${value}: ${SCORE_ANCHORS[Number(value)]}`;
                return (
                  <label key={value} className="relative cursor-pointer">
                    <input
                      type="radio"
                      name={`rating-${assignmentId}-${criterion.id}`}
                      value={value}
                      checked={selected}
                      aria-label={label}
                      disabled={pending || saved || !draftReady}
                      onChange={() => selectScore(criterion.id, value)}
                      className="peer sr-only"
                    />
                    <span className={`flex min-h-11 items-center justify-center rounded-sm border text-sm font-semibold transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-mecg-navy peer-disabled:cursor-not-allowed peer-disabled:opacity-50 ${
                      selected ? "border-mecg-navy bg-mecg-navy text-white underline underline-offset-4" : "border-line-strong text-mecg-navy hover:bg-wash"
                    }`} title={label}>
                      {value === "NO" ? "N/O" : value}
                    </span>
                  </label>
                );
              })}
            </div>
            <p id={`rating-anchor-${assignmentId}-${criterion.id}`} className="mt-2 text-xs text-muted" aria-live="polite">
              {scores[criterion.id] === "NO"
                ? criterion.required ? "This criterion is required. An observed rating is needed to submit." : "Not observed is excluded from the score. At least 75% of rubric weight must be observed."
                : SCORE_ANCHORS[Number(scores[criterion.id])] ?? "Choose the rating that matches the behavior you observed."}
            </p>
            <label className="mt-3 block text-sm font-medium" htmlFor={`note-${assignmentId}-${criterion.id}`}>
              Evidence note{noteRequired && <span className="ml-1.5 rounded-full bg-mecg-orange/15 px-2 py-0.5 text-[13px] font-semibold text-mecg-orange-ink">Required</span>}
            </label>
            <textarea
              id={`note-${assignmentId}-${criterion.id}`}
              ref={(node) => { noteRefs.current[criterion.id] = node; }}
              className="mt-2 min-h-20 w-full rounded-xl bg-wash px-4 py-3 inset-ring inset-ring-line-strong outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)]"
              value={note}
              onChange={(event) => {
                setNotes((current) => ({ ...current, [criterion.id]: event.target.value }));
                markDraftChanged();
              }}
              aria-required={noteRequired}
              maxLength={MAX_NOTE_LENGTH}
              disabled={pending || saved || !draftReady}
              aria-describedby={`note-count-${assignmentId}-${criterion.id}`}
            />
            <p id={`note-count-${assignmentId}-${criterion.id}`} className="mt-1 text-right text-xs tabular-nums text-muted">{note.length} / {MAX_NOTE_LENGTH}</p>
          </fieldset>
        );
      })}
      <label className="font-medium" htmlFor={`evidence-${assignmentId}`}>Overall observable evidence (optional)</label>
      <textarea
        id={`evidence-${assignmentId}`}
        className="min-h-24 rounded-xl bg-wash px-4 py-3 inset-ring inset-ring-line-strong outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)]"
        value={evidence}
        onChange={(event) => {
          setEvidence(event.target.value);
          markDraftChanged();
        }}
        maxLength={MAX_EVIDENCE_LENGTH}
        disabled={pending || saved || !draftReady}
        aria-describedby={`evidence-count-${assignmentId}`}
      />
      <p id={`evidence-count-${assignmentId}`} className="-mt-3 text-right text-xs tabular-nums text-muted">{evidence.length} / {MAX_EVIDENCE_LENGTH}</p>
      <OperationNotice kind="error">{error}</OperationNotice>
      {reviewing && !saved && (
        <section className="rounded-xl bg-wash p-4" aria-labelledby={`review-${assignmentId}`}>
          <h3 ref={reviewHeadingRef} tabIndex={-1} id={`review-${assignmentId}`} className="font-semibold text-mecg-navy">Review before locking</h3>
          <p className="mt-1 text-sm text-muted">Confirm every rating and evidence note. Submission is final.</p>
          <dl className="mt-3 divide-y divide-line border-y border-line">
            {criteria.map((criterion) => (
              <div key={criterion.id} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                <div>
                  <dt className="font-medium text-mecg-navy">{criterion.name}</dt>
                  {notes[criterion.id]?.trim() && <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted">{notes[criterion.id]}</dd>}
                </div>
                <dd className="shrink-0 font-semibold text-mecg-navy">{scores[criterion.id] === "NO" ? "Not observed" : `${scores[criterion.id]} / 5`}</dd>
              </div>
            ))}
          </dl>
          {evidence.trim() && <div className="mt-3 text-sm text-mecg-navy"><p className="font-medium">Overall evidence</p><p className="mt-1 whitespace-pre-wrap break-words text-muted">{evidence}</p></div>}
          <button type="button" className="button-secondary mt-3 text-sm" onClick={() => { setReviewing(false); window.requestAnimationFrame(() => reviewButtonRef.current?.focus()); }}>Keep editing</button>
        </section>
      )}
      {saved && <p className="submission-confirmed rounded-xl bg-success-wash px-4 py-3 text-sm font-semibold text-success" role="status">Evaluation submitted and locked.</p>}
      <button ref={reviewButtonRef} type="submit" disabled={pending || saved || !draftReady} className={`button-primary disabled:opacity-50 ${saved ? "is-success" : ""}`}>
        {saved ? "✓ Submitted" : pending ? "Submitting…" : reviewing ? "Confirm and lock evaluation" : "Review evaluation"}
      </button>
      </fieldset>}
      <div
        className={`rounded-xl px-4 py-3 text-sm ${draftSaveState.kind === "error" ? "bg-danger-wash text-danger" : "bg-wash text-muted"}`}
        role={draftSaveState.kind === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        <span>{draftSaveState.message}</span>
        {draftSaveState.kind === "error" && (
          <button
            type="button"
            className="ml-2 min-h-11 font-semibold underline underline-offset-2"
            onClick={() => {
              if (draftLoadFailed || !revisionKnown.current) {
                recoveryLocal.current = copyFromPayload(latestPayload.current);
                setLoadNonce((current) => current + 1);
              } else void saveCurrentDraft(true);
            }}
          >
            Retry
          </button>
        )}
      </div>
      {draftReady && !saved && backupChecked && (
        <div className={`rounded-xl px-4 py-3 text-sm ${localBackupSignature === draftSignature ? "bg-wash text-muted" : "bg-warning-wash text-warning"}`} role={localBackupSignature === draftSignature ? "status" : "alert"}>
          <p>{localBackupSignature === draftSignature
            ? "Browser backup is current in this tab, for up to 24 hours."
            : serverSavedSignature === draftSignature && !draftLoadFailed
              ? "Browser backup is unavailable. This version is saved on the server."
              : "Browser backup is unavailable. These changes are only in this open page until the server confirms a save. Download a copy before retrying or leaving."}</p>
          <button type="button" onClick={() => exportDraft()} className="mt-2 min-h-11 font-semibold underline underline-offset-2">Download draft copy</button>
          <p className="mt-1 text-xs">The copy contains private evaluation notes. Keep it in an approved private location.</p>
        </div>
      )}
    </form>
  );
}

export default function EvaluationForm(props: Parameters<typeof EvaluationEditor>[0]) {
  return <EvaluationEditor key={props.assignmentId} {...props} />;
}
