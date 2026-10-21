"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/workspace-link";
import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";
import { SCORE_ANCHORS } from "@/lib/rubrics";
import type { ScreeningDraft } from "../screening-draft";
import { screeningRecommendationWarning, screeningReviewBlocker } from "../screening-review-readiness";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import { parseScreeningActionResult, parseScreeningDraftSnapshot, parseScreeningDraftWriteResult, sameScreeningDraft, type ScreeningDraftSnapshot, type ScreeningDraftWrite } from "@/lib/screening-draft-write";
import { clearScreeningBackup, readScreeningBackup, writeScreeningBackup } from "@/lib/screening-draft-recovery";
import { useScreeningScoreView } from "./screening-reading-desk";

type Criterion = { id: string; key: string; name: string; description: string; weight: number; required: boolean };
type Props = { cycleId?: string; assignmentId: string; criteria: Criterion[] };
const SCORE_OPTIONS = [1, 2, 3, 4, 5] as const;
const MAX_NOTE_LENGTH = 2000;
const MIN_EVIDENCE_LENGTH = 20;
const MAX_EVIDENCE_LENGTH = 6000;
const REQUEST_TIMEOUT_MS = 15_000;
type DraftSaveState = "loading" | "idle" | "saving" | "saved" | "error";
function storage() { try { return window.sessionStorage; } catch { return null; } }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

function ScreeningEditor({ assignmentId, criteria, cycleId }: Props) {
  const router = useRouter();
  const scoreView = useScreeningScoreView();
  const revealScore = scoreView?.revealScore;
  const activeView = scoreView?.view;
  const recoveryFocus = useRef<"conflict" | "action" | null>(null);
  const criteriaSignature = JSON.stringify(criteria);
  const firstCriterionId = criteria[0]?.id;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [scores, setScores] = useState<Record<string, string>>(Object.fromEntries(criteria.map((criterion) => [criterion.id, ""])));
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [recusalReason, setRecusalReason] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [confirmingRecusal, setConfirmingRecusal] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [actionUnknown, setActionUnknown] = useState(false);
  const actionIntent = useRef<"SUBMIT" | "RECUSE" | null>(null);
  const uncertainAction = useRef(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftLoadFailed, setDraftLoadFailed] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>("loading");
  const [draftSaveError, setDraftSaveError] = useState("");
  const [loadNonce, setLoadNonce] = useState(0);
  const [draftConflict, setDraftConflict] = useState<{ local: ScreeningDraft; server: ScreeningDraft } | null>(null);
  const conflictActive = useRef(false);
  const conflictHeadingRef = useRef<HTMLHeadingElement>(null);
  const resolvingConflict = useRef(false);
  const recoveryLocal = useRef<ScreeningDraft | null>(null);
  const revision = useRef<string | null>(null);
  const revisionKnown = useRef(false);
  const inflightSave = useRef<Promise<void> | null>(null);
  const unconfirmedWrite = useRef<ScreeningDraftWrite | null>(null);
  const [localBackupSignature, setLocalBackupSignature] = useState<string | null>(null);
  const [backupChecked, setBackupChecked] = useState(false);
  const [serverSavedSignature, setServerSavedSignature] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState("");
  const criterionRefs = useRef<Record<string, HTMLFieldSetElement | null>>({});
  const noteRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const evidenceRef = useRef<HTMLTextAreaElement>(null);
  const recommendationRef = useRef<HTMLSelectElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const actionErrorRef = useRef<HTMLDivElement>(null);
  const latestSignature = useRef("");
  const scoredCount = criteria.filter((criterion) => scores[criterion.id]).length;
  const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  const draftPayload = useMemo(() => ({ ratings: criteria.map((criterion) => ({ criterionId: criterion.id, score: scores[criterion.id] ?? "", note: notes[criterion.id] ?? "" })), evidence, recommendation }), [criteria, evidence, notes, recommendation, scores]);
  const lastSavedSignature = useRef<string | null>(JSON.stringify(draftPayload));
  const draftSignature = JSON.stringify(draftPayload);
  const latestPayload = useRef(draftPayload);
  useLayoutEffect(() => { latestPayload.current = draftPayload; latestSignature.current = draftSignature; }, [draftPayload, draftSignature]);

  useEffect(() => {
    if (actionUnknown) recoveryFocus.current = "action";
    else if (draftConflict) recoveryFocus.current = "conflict";
    else { recoveryFocus.current = null; return; }
    revealScore?.();
  }, [draftConflict, actionUnknown, revealScore]);
  useEffect(() => {
    if (activeView && activeView !== "score") return;
    if (recoveryFocus.current === "action") actionErrorRef.current?.focus();
    if (recoveryFocus.current === "conflict") conflictHeadingRef.current?.focus();
    recoveryFocus.current = null;
  }, [activeView, draftConflict, actionUnknown]);
  useEffect(() => {
    if (!draftConflict && resolvingConflict.current) { resolvingConflict.current = false; criterionRefs.current[firstCriterionId]?.focus(); }
  }, [draftConflict, firstCriterionId]);
  useEffect(() => { if (reviewing) reviewHeadingRef.current?.focus(); }, [reviewing]);

  function emptyDraft(): ScreeningDraft { return { ratings: criteria.map(({ id }) => ({ criterionId: id, score: "", note: "" })), evidence: "", recommendation: "" }; }
  function matchesRubric(snapshot: ScreeningDraftSnapshot) {
    return snapshot.assignmentId === assignmentId && (!snapshot.draft || (snapshot.draft.ratings.length === criteria.length && snapshot.draft.ratings.every(({ criterionId }) => criteria.some(({ id }) => id === criterionId))));
  }
  function canonicalDraft(draft: ScreeningDraft): ScreeningDraft {
    return { ratings: criteria.map(({ id }) => ({ criterionId: id, score: draft.ratings.find(({ criterionId }) => criterionId === id)?.score ?? "", note: draft.ratings.find(({ criterionId }) => criterionId === id)?.note ?? "" })), evidence: draft.evidence, recommendation: draft.recommendation };
  }
  function applyDraft(draft: ScreeningDraft) {
    const next = canonicalDraft(draft);
    setScores(Object.fromEntries(next.ratings.map(({ criterionId, score }) => [criterionId, score])));
    setNotes(Object.fromEntries(next.ratings.map(({ criterionId, note }) => [criterionId, note])));
    setEvidence(next.evidence); setRecommendation(next.recommendation);
  }
  function compareSnapshot(snapshot: ScreeningDraftSnapshot) {
    const server = canonicalDraft(snapshot.draft ?? emptyDraft());
    revision.current = snapshot.revision;
    unconfirmedWrite.current = null;
    conflictActive.current = true;
    lastSavedSignature.current = JSON.stringify(server);
    setServerSavedSignature(snapshot.draft ? JSON.stringify(server) : null);
    setDraftConflict({ local: latestPayload.current, server });
    setDraftReady(false); setReviewing(false); setConfirmingRecusal(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    async function loadDraft() {
      const browser = storage();
      const local = recoveryLocal.current ?? (browser ? readScreeningBackup({ storage: browser, assignmentId, criterionIds: criteria.map(({ id }) => id) }) : null);
      revisionKnown.current = false;
      setDraftReady(false); setDraftLoadFailed(false); setDraftSaveState("loading"); setDraftSaveError("");
      try {
        const { response, body } = await fetchJsonWithTimeout(`/api/member/screening/draft?assignmentId=${encodeURIComponent(assignmentId)}`, { cache: "no-store" }, REQUEST_TIMEOUT_MS,
          (input, init) => authorizedFetch(input, { ...init, signal: AbortSignal.any([controller.signal, ...(init?.signal ? [init.signal] : [])]) }));
        if (controller.signal.aborted || !mounted.current) return;
        if (!response.ok) throw new Error(record(body) && typeof body.error === "string" ? body.error : "Your private draft could not be loaded.");
        const snapshot = parseScreeningDraftSnapshot(body);
        if (!snapshot || !matchesRubric(snapshot)) throw new Error("The saved draft could not be verified against this scoring guide.");
        revision.current = snapshot.revision; revisionKnown.current = true; unconfirmedWrite.current = null; recoveryLocal.current = null;
        const server = snapshot.draft ? canonicalDraft(snapshot.draft) : null;
        if (local && server && JSON.stringify(canonicalDraft(local)) !== JSON.stringify(server)) {
          lastSavedSignature.current = JSON.stringify(server); setServerSavedSignature(lastSavedSignature.current);
          conflictActive.current = true; setDraftConflict({ local: canonicalDraft(local), server });
          setDraftSaveState("idle"); return;
        }
        const recovered = server ?? local ?? emptyDraft();
        lastSavedSignature.current = local && !server ? null : JSON.stringify(canonicalDraft(recovered));
        setServerSavedSignature(server ? JSON.stringify(server) : null);
        applyDraft(recovered); setDraftReady(true); setDraftSaveState(server ? "saved" : "idle");
      } catch (loadError) {
        if (controller.signal.aborted || !mounted.current) return;
        if (local) applyDraft(local);
        setDraftReady(true); setDraftLoadFailed(true); setDraftSaveState("error");
        setDraftSaveError(`${loadError instanceof Error ? loadError.message : "Your private draft could not be loaded."} You can keep scoring and download a private copy. Reload the saved draft before saving or submitting.`);
      }
    }
    void loadDraft();
    return () => controller.abort();
  // Equivalent server-rendered criterion arrays must not reset an active draft.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, criteriaSignature, loadNonce]);

  useEffect(() => {
    if (!draftReady || uncertainAction.current) return;
    const browser = storage();
    const persisted = browser ? writeScreeningBackup({ storage: browser, assignmentId, draft: draftPayload }) : false;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) { setBackupChecked(true); setLocalBackupSignature(persisted ? draftSignature : null); } });
    return () => { cancelled = true; };
  }, [assignmentId, draftReady, draftSignature, draftPayload]);

  const saveCurrentDraft = useCallback(async function drain(retry = false): Promise<boolean> {
    const active = inflightSave.current;
    if (active) { await active; return drain(); }
    if (!mounted.current || !revisionKnown.current || conflictActive.current || uncertainAction.current || actionIntent.current === "RECUSE") return false;
    const previous = unconfirmedWrite.current;
    if (previous && !retry) return false;
    const current = latestPayload.current;
    if (!previous && JSON.stringify(current) === lastSavedSignature.current) return true;
    const request = previous ?? { ...current, expectedRevision: revision.current, mutationId: crypto.randomUUID() };
    unconfirmedWrite.current = request;
    let finish = () => {};
    inflightSave.current = new Promise<void>((resolve) => { finish = resolve; });
    setDraftSaveState("saving"); setDraftSaveError("");
    try {
      const { response, body } = await fetchJsonWithTimeout(`/api/member/screening/draft?assignmentId=${encodeURIComponent(assignmentId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) }, REQUEST_TIMEOUT_MS, authorizedFetch);
      if (!mounted.current) return false;
      const result = parseScreeningDraftWriteResult(body);
      if (response.status === 409 && result?.kind === "conflict" && matchesRubric(result.snapshot)) {
        compareSnapshot(result.snapshot); setDraftSaveState("idle"); return false;
      }
      if (!response.ok && response.status < 500 && response.status !== 408) {
        unconfirmedWrite.current = null;
        setDraftSaveState("error");
        setDraftSaveError(`${record(body) && typeof body.error === "string" ? body.error : "The draft was refused."} The latest save is unconfirmed. Keep your private copy before retrying.`);
        return false;
      }
      if (!response.ok || result?.kind !== "saved" || result.assignmentId !== assignmentId || result.mutationId !== request.mutationId || !sameScreeningDraft(result.draft, request) || !matchesRubric(result)) throw new Error("Unconfirmed draft");
      revision.current = result.revision;
      const signature = JSON.stringify(canonicalDraft(result.draft));
      lastSavedSignature.current = signature; setServerSavedSignature(signature); unconfirmedWrite.current = null;
      if (latestSignature.current === JSON.stringify(canonicalDraft(request))) setDraftSaveState("saved");
      else void drain();
      return true;
    } catch {
      if (mounted.current) { setDraftSaveState("error"); setDraftSaveError("The save could not be confirmed. It may already be saved. Retry confirms the exact earlier request before syncing newer changes. Keep a private copy before leaving."); }
      return false;
    } finally { inflightSave.current = null; finish(); }
  // All payload parsing is scoped to this assignment's scoring guide.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, criteriaSignature]);

  useEffect(() => {
    if (!draftReady || pending || actionUnknown || draftConflict || draftLoadFailed || draftSignature === lastSavedSignature.current) return;
    const timer = window.setTimeout(() => { void saveCurrentDraft(); }, 700);
    return () => window.clearTimeout(timer);
  }, [draftReady, pending, actionUnknown, draftConflict, draftLoadFailed, draftSignature, saveCurrentDraft]);

  useEffect(() => {
    function protectReview(event: BeforeUnloadEvent) {
      if (unconfirmedWrite.current || uncertainAction.current || latestSignature.current !== lastSavedSignature.current) { event.preventDefault(); event.returnValue = ""; }
    }
    window.addEventListener("beforeunload", protectReview);
    return () => window.removeEventListener("beforeunload", protectReview);
  }, []);

  function markDraftChanged() { setReviewing(false); if (revisionKnown.current && !unconfirmedWrite.current) { setDraftSaveState("idle"); setDraftSaveError(""); } }
  function chooseDraft(source: "local" | "server") {
    if (!draftConflict) return;
    const selected = draftConflict[source];
    applyDraft(selected); conflictActive.current = false; resolvingConflict.current = true;
    setDraftConflict(null); setDraftReady(true); setDraftLoadFailed(false); setDraftSaveError("");
    setDraftSaveState(source === "server" && serverSavedSignature !== null ? "saved" : "idle");
  }
  function exportDraft(draft: ScreeningDraft) {
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ assignmentId, exportedAt: new Date().toISOString(), ...draft }, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "mecg-private-screening-review.json"; document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloadStatus("Private copy prepared. Check your download before leaving.");
    } catch { setDownloadStatus("Download could not start. Keep this page open and copy the observations you need."); }
  }
  function unknownAction() {
    if (!mounted.current) return;
    uncertainAction.current = true; setActionUnknown(true); setPending(false);
    setDraftSaveState("error"); setDraftSaveError("The latest action may have locked or removed this private draft. Keep your copy and check the screening queue before continuing.");
    setError("This review action could not be confirmed. It may already be complete. Your observations remain on this page. Check your screening queue before continuing.");
  }
  async function act(payload: { action: "SUBMIT" } | { action: "RECUSE"; reason: string }) {
    if (actionIntent.current || uncertainAction.current) return;
    actionIntent.current = payload.action; setPending(true); setError("");
    try {
      let request: Record<string, unknown>;
      if (payload.action === "SUBMIT") {
        if (!revisionKnown.current || !(await saveCurrentDraft()) || conflictActive.current || unconfirmedWrite.current || latestSignature.current !== lastSavedSignature.current) {
          setError("Confirm the latest saved draft and resolve differing copies before locking this review. Your observations remain here."); setPending(false); return;
        }
        const latest = latestPayload.current;
        request = { action: "SUBMIT", assignmentId, expectedDraftRevision: revision.current, evidence: latest.evidence, recommendation: latest.recommendation, ratings: latest.ratings.map((rating) => ({ ...rating, score: Number(rating.score) })) };
      } else {
        // Finish a started draft request, but never require a successful draft
        // save before a reviewer can declare a conflict and step back.
        await inflightSave.current;
        request = { action: "RECUSE", assignmentId, reason: payload.reason };
      }
      const { response, body } = await fetchJsonWithTimeout("/api/member/screening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) }, REQUEST_TIMEOUT_MS, authorizedFetch);
      if (!mounted.current) return;
      const conflict = parseScreeningDraftWriteResult(body);
      if (payload.action === "SUBMIT" && response.status === 409 && conflict?.kind === "conflict" && matchesRubric(conflict.snapshot)) {
        compareSnapshot(conflict.snapshot); setDraftSaveState("idle"); setPending(false); return;
      }
      if (!response.ok && response.status < 500 && response.status !== 408) {
        setError(record(body) && typeof body.error === "string" ? body.error : "This review action was refused. Your observations remain here."); setPending(false); return;
      }
      const receipt = parseScreeningActionResult(body);
      if (!response.ok || !receipt || receipt.assignmentId !== assignmentId || receipt.kind !== (payload.action === "SUBMIT" ? "submitted" : "recused")) { unknownAction(); return; }
      const browser = storage(); if (browser) clearScreeningBackup(browser, assignmentId);
      const nextAssignmentId = receipt.kind === "submitted" && record(body) && typeof body.nextAssignmentId === "string" && body.nextAssignmentId ? body.nextAssignmentId : null;
      router.replace(withWorkspaceCycle(nextAssignmentId ? `/member/screening/${encodeURIComponent(nextAssignmentId)}` : "/member/screening", cycleId ?? null)); router.refresh();
      // Keep controls locked until the authoritative destination replaces them.
    } catch { unknownAction(); }
    finally { actionIntent.current = null; }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || actionUnknown || !draftReady || conflictActive.current) return;
    const blocker = screeningReviewBlocker(criteria, { scores, notes, evidence, recommendation }, MIN_EVIDENCE_LENGTH);
    if (blocker) {
      setReviewing(false); setError(blocker.message);
      if (blocker.field === "score") criterionRefs.current[blocker.criterionId]?.focus();
      if (blocker.field === "note") noteRefs.current[blocker.criterionId]?.focus();
      if (blocker.field === "evidence") evidenceRef.current?.focus();
      if (blocker.field === "recommendation") recommendationRef.current?.focus();
      return;
    }
    if (!reviewing) { setReviewing(true); setError(""); return; }
    void act({ action: "SUBMIT" });
  }
  const editingBlocked = pending || actionUnknown || !draftReady || Boolean(draftConflict);
  const recusalBlocked = pending || actionUnknown || (!draftReady && !draftConflict);
  const recommendationWarning = screeningRecommendationWarning(scores, recommendation);

  return (
    <div className="space-y-8">
      {draftConflict && <section aria-labelledby={`screening-conflict-${assignmentId}`} className="min-w-0 rounded-xl border border-warning-edge bg-warning-wash p-4 text-warning">
        <h2 ref={conflictHeadingRef} tabIndex={-1} id={`screening-conflict-${assignmentId}`} className="text-lg font-semibold">Choose which private review to keep</h2>
        <p className="mt-2 text-sm leading-6">Neither copy has been overwritten. Compare them and download either before choosing. Choosing the server copy replaces the browser backup; keeping this page writes against the current server revision.</p>
        <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">{(["local", "server"] as const).map((source) => {
          const copy = draftConflict[source];
          return <article key={source} className="min-w-0 rounded-xl border border-warning-edge p-3">
            <h3 className="font-semibold">{source === "local" ? "This page" : "Current server copy"}</h3>
            <dl className="mt-3 space-y-3 text-sm">{criteria.map((criterion) => { const rating = copy.ratings.find(({ criterionId }) => criterionId === criterion.id); return <div key={criterion.id}><dt className="font-medium">{criterion.name}: {rating?.score || "Unrated"}</dt><dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{rating?.note || "No criterion note"}</dd></div>; })}</dl>
            <p className="mt-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm">{copy.evidence || "No overall evidence"}</p><p className="mt-2 text-sm">Recommendation: {copy.recommendation || "Not chosen"}</p>
            <button type="button" onClick={() => exportDraft(copy)} className="mt-3 min-h-11 font-semibold underline">Download {source === "local" ? "this page" : "server"} copy</button>
            <button type="button" disabled={pending || actionUnknown} onClick={() => chooseDraft(source)} className="button-primary mt-3 w-full">{source === "local" ? "Keep this page’s review" : "Use current server review"}</button>
          </article>;
        })}</div><p role="status" className="mt-2 text-sm">{downloadStatus}</p>
      </section>}
      <details className="review-recusal rounded-xl bg-mecg-orange/[0.08] p-4" onToggle={(event) => { if (!(event.currentTarget as HTMLDetailsElement).open) setConfirmingRecusal(false); }}>
        <summary className="min-h-11 cursor-pointer list-none content-center font-semibold text-mecg-orange-ink">Recognize this applicant? Step back</summary>
        <p className="mt-2 text-sm text-muted">Do not name the applicant. A confirmed recusal removes this application from your queue and deletes its private draft only when replacement coverage is available.</p>
        <label className="mt-3 block text-sm font-medium text-mecg-orange-ink" htmlFor="screening-recusal-reason">Reason for recusal</label>
        <textarea
          id="screening-recusal-reason"
          value={recusalReason}
          maxLength={1000}
          disabled={recusalBlocked}
          onChange={(event) => { setRecusalReason(event.target.value); setConfirmingRecusal(false); }}
          placeholder="Brief reason, such as a prior close relationship or an identity revealed in the response"
          className="mt-2 min-h-20 w-full rounded-xl bg-white px-3 py-2 inset-ring inset-ring-line-strong outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)]"
        />
        <p className="mt-1 text-right text-xs tabular-nums text-muted">{recusalReason.length} / 1000</p>
        {confirmingRecusal ? (
          <div className="mt-3 rounded-xl bg-white p-3">
            <p className="text-sm font-medium">This permanently removes the application and its draft from your queue.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={recusalBlocked} onClick={() => void act({ action: "RECUSE", reason: recusalReason })} className="button-primary">{pending ? "Stepping back…" : "Confirm recusal"}</button>
              <button type="button" disabled={recusalBlocked} onClick={() => setConfirmingRecusal(false)} className="button-secondary">Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" disabled={recusalBlocked || recusalReason.trim().length < 5} onClick={() => setConfirmingRecusal(true)} className="button-secondary mt-3">Review recusal</button>
        )}
      </details>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <p className="text-sm text-muted" role="status">{draftSaveState === "loading" ? "Loading private draft…" : draftSaveState === "saving" ? "Saving private draft…" : draftSaveState === "saved" ? "Private draft saved across devices." : draftSaveState === "error" ? "Private draft save unconfirmed" : "Private draft changes"}</p>
        <p className="text-sm text-muted" aria-live="polite">
          {scoredCount} of {criteria.length} criteria scored.
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
              className="rounded-xl p-5 inset-ring inset-ring-line"
            >
              <legend className="px-2 font-semibold">{criterion.name} · {totalWeight ? Math.round((criterion.weight / totalWeight) * 100) : 0}%</legend>
              <details><summary>Rubric guidance</summary><p className="text-sm text-muted">{criterion.description}</p><ol className="mt-2 space-y-2 text-xs text-muted">{SCORE_OPTIONS.map((score) => <li key={score}><strong>{score}</strong> · {SCORE_ANCHORS[score]}</li>)}</ol></details>
              <div className="mt-4 text-sm font-medium" id={`screening-rating-label-${criterion.id}`}>Rating</div>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-labelledby={`screening-rating-label-${criterion.id}`}>
                {SCORE_OPTIONS.map((score) => {
                  const selected = scores[criterion.id] === String(score);
                  const label = `Score ${score}: ${SCORE_ANCHORS[score]}`;
                  return (
                    <label key={score} title={label} className={`relative min-h-11 cursor-pointer rounded-xl text-center text-sm font-semibold transition-[background-color,color,box-shadow] duration-150 ease-out ${
                        selected
                          ? "bg-mecg-navy text-white"
                          : "text-mecg-navy inset-ring inset-ring-line-strong hover:inset-ring-mecg-navy/40"
                      }`}>
                      <input
                        type="radio"
                        name={`screening-rating-${criterion.id}`}
                        value={score}
                        checked={selected}
                        aria-label={label}
                        disabled={editingBlocked}
                        onChange={() => { setScores((current) => ({ ...current, [criterion.id]: String(score) })); markDraftChanged(); setError(""); }}
                        className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-mecg-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed"
                      />
                      <span className="relative inline-flex min-h-11 items-center justify-center">{score}</span>
                    </label>
                  );
                })}
              </div>
              {scores[criterion.id] && <p className="mt-2 text-xs text-muted">{SCORE_ANCHORS[Number(scores[criterion.id])]}</p>}
              <label className="mt-4 block text-sm font-medium" htmlFor={`screening-note-${criterion.id}`}>Evidence note {(["1", "5"].includes(scores[criterion.id])) ? "(required for this rating)" : "(optional)"}</label>
              <textarea
                id={`screening-note-${criterion.id}`}
                ref={(node) => { noteRefs.current[criterion.id] = node; }}
                value={note}
                maxLength={MAX_NOTE_LENGTH}
                disabled={editingBlocked}
                onChange={(event) => { setNotes((current) => ({ ...current, [criterion.id]: event.target.value })); markDraftChanged(); }}
                aria-describedby={`screening-note-count-${criterion.id}`}
                className="mt-2 min-h-20 w-full rounded-xl bg-wash px-3 py-2 inset-ring inset-ring-line-strong outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)]"
              />
              <p id={`screening-note-count-${criterion.id}`} className="mt-1 text-right text-xs tabular-nums text-muted">{note.length} / {MAX_NOTE_LENGTH}</p>
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
            disabled={editingBlocked}
            onChange={(event) => { setEvidence(event.target.value); markDraftChanged(); }}
            aria-describedby="screening-evidence-help"
            className="mt-2 min-h-28 w-full rounded-xl bg-wash px-3 py-2 inset-ring inset-ring-line-strong outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)]"
          />
        </label>
        <p id="screening-evidence-help" className="-mt-3 text-right text-xs tabular-nums text-muted">{evidence.length} / {MAX_EVIDENCE_LENGTH} characters · at least {MIN_EVIDENCE_LENGTH} required</p>
        <label className="block font-medium" htmlFor="screening-recommendation">
          Recommendation
          <select id="screening-recommendation" ref={recommendationRef} required value={recommendation} disabled={editingBlocked} onChange={(event) => { setRecommendation(event.target.value); markDraftChanged(); setError(""); }} className="select-control mt-2">
            <option value="">Choose a recommendation</option>
            <option value="ADVANCE">Advance</option>
            <option value="HOLD">Hold for structured review</option>
            <option value="DECLINE">Do not advance</option>
          </select>
        </label>
        {(draftSaveState === "error" || draftConflict) && <div className={`rounded-xl px-4 py-3 text-sm ${draftSaveState === "error" ? "bg-danger-wash text-danger" : "bg-wash text-muted"}`} role={draftSaveState === "error" ? "alert" : "status"} aria-live="polite">
          {draftSaveState === "idle" && (draftConflict ? "Two saved copies differ. Compare them before continuing." : "Unsaved changes save automatically after the current draft is verified.")}
          {draftSaveState === "error" && <><span>{draftSaveError}</span>{!actionUnknown && <button type="button" disabled={pending || actionUnknown} className="ml-2 min-h-11 font-semibold underline underline-offset-2" onClick={() => {
            if (draftLoadFailed) { recoveryLocal.current = latestPayload.current; setLoadNonce((value) => value + 1); }
            else void saveCurrentDraft(true);
          }}>Retry draft save</button>}</>}
        </div>}
        {(backupChecked || actionUnknown) && !draftConflict && <details open={localBackupSignature !== draftSignature || actionUnknown} className={`rounded-xl px-4 py-3 text-sm ${localBackupSignature === draftSignature ? "bg-wash text-muted" : "bg-warning-wash text-warning"}`} role={localBackupSignature === draftSignature ? "status" : "alert"}>
          <summary className="min-h-11 cursor-pointer content-center font-semibold">Backup &amp; download</summary>
          <p>{localBackupSignature === draftSignature ? "Browser backup is current in this tab, for up to 24 hours." : actionUnknown ? "Browser backup is unavailable. Keep this page open and download your observations before checking the action’s current status." : serverSavedSignature === draftSignature && !draftLoadFailed ? "Browser backup is unavailable. This version is saved on the server." : "Browser backup is unavailable. These changes are only in this open page until a server save is confirmed. Download a copy before retrying or leaving."}</p>
          <button type="button" onClick={() => exportDraft(draftPayload)} className="mt-2 min-h-11 font-semibold underline">Download private review copy</button>
          <p className="mt-1 text-xs">This copy contains private review notes. Keep it in an approved private location.</p>
          <p role="status" className="mt-1">{downloadStatus}</p>
        </details>}
        {recommendationWarning && <OperationNotice kind="info">Consistency check: {recommendationWarning}</OperationNotice>}
        {reviewing && (
          <section className="rounded-xl bg-mecg-navy p-5 text-white" aria-labelledby="screening-review-summary">
            <h2 ref={reviewHeadingRef} tabIndex={-1} id="screening-review-summary" className="font-semibold">Review before locking</h2>
            <dl className="mt-3 space-y-3 text-sm">
              {criteria.map((criterion) => <div key={criterion.id}><dt className="font-semibold">{criterion.name}: {scores[criterion.id]} — {SCORE_ANCHORS[Number(scores[criterion.id])]}</dt><dd className="mt-1 text-white/70">{notes[criterion.id]?.trim() || "No criterion note"}</dd></div>)}
              <div><dt className="font-semibold">Recommendation</dt><dd className="mt-1 text-white/70">{recommendation === "ADVANCE" ? "Advance" : recommendation === "DECLINE" ? "Do not advance" : "Hold for structured review"}</dd></div>
              <div><dt className="font-semibold">Rationale</dt><dd className="mt-1 whitespace-pre-wrap text-white/70">{evidence.trim()}</dd></div>
            </dl>
          </section>
        )}
        {actionUnknown ? <div ref={actionErrorRef} tabIndex={-1} role="alert" aria-atomic="true" className="rounded-xl border border-warning-edge bg-warning-wash p-4 text-sm text-warning">
          <p>{error}</p>
          <div className="mt-3 flex flex-wrap gap-3"><Link href={withWorkspaceCycle("/member/screening", cycleId ?? null)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold underline">Check screening queue (new tab)</Link><button type="button" onClick={() => window.location.reload()} className="button-secondary">Reload current assignment</button></div>
          <p className="mt-2">Download your private copy before reloading. A reload checks the current assignment; it does not repeat the uncertain action.</p>
        </div> : <OperationNotice kind="error">{error}</OperationNotice>}
        <p className="text-sm leading-6 text-muted">The final submit locks this review permanently, then opens your next unread application when one remains.</p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={editingBlocked} className="button-primary">{pending ? "Submitting…" : reviewing ? "Submit locked review" : "Review before submitting"}</button>
          {reviewing && <button type="button" disabled={pending} className="button-secondary" onClick={() => setReviewing(false)}>Keep editing</button>}
        </div>
      </form>
    </div>
  );
}

export default function ScreeningReviewForm(props: Props) { return <ScreeningEditor key={props.assignmentId} {...props} />; }
