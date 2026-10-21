"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { roundCloseJsonRequest, type RoundCloseOutcome } from "./round-close-request";
import { roundStatusLabel } from "@/lib/labels";
import { canTransitionRound } from "@/lib/workflow";
import { parseRoundCloseSummary, type RoundCloseSummary } from "@/lib/round-close-summary";

const STATUSES = ["DRAFT", "PUBLISHED", "ACTIVE", "FROZEN", "FINALIZED", "ARCHIVED"];
type Review = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; summary: RoundCloseSummary };

function hasPendingClose(roundId: string) {
  try { return window.sessionStorage.getItem(`mecg:pending-round-close:${roundId}`) === "1"; } catch { return false; }
}
function rememberPendingClose(roundId: string, pending: boolean) {
  try {
    if (pending) window.sessionStorage.setItem(`mecg:pending-round-close:${roundId}`, "1");
    else window.sessionStorage.removeItem(`mecg:pending-round-close:${roundId}`);
  } catch { /* The in-memory lock still protects this page when browser storage is unavailable. */ }
}
const UNKNOWN_CLOSE = "The close outcome is unknown. Grading may already be closed. Do not repeat the close action. Check the round status again or review the round.";

export default function RoundStatusControl({ round, act, closeRound, pending, error }: {
  round: { id: string; label: string; status: string };
  act: (payload: Record<string, unknown>) => Promise<boolean>;
  closeRound?: (roundId: string) => Promise<RoundCloseOutcome>;
  pending: boolean;
  error: string;
}) {
  const [status, setStatus] = useState(round.status);
  const [confirming, setConfirming] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [closeState, setCloseState] = useState<"idle" | "writing" | "checking" | "unknown" | "closed">("idle");
  const [notice, setNotice] = useState("");
  const rejectedRef = useRef<string | null>(null);
  const [review, setReview] = useState<Review>({ kind: "loading" });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const statusHeadingRef = useRef<HTMLHeadingElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const submitLock = useRef(false);
  const closesGrading = status === "FROZEN" && round.status !== "FROZEN";

  useEffect(() => {
    if (["FROZEN", "FINALIZED", "ARCHIVED"].includes(round.status)) { rememberPendingClose(round.id, false); return; }
    if (!hasPendingClose(round.id)) return;
    const timer = window.setTimeout(() => {
      setStatus("FROZEN");
      setCloseState("unknown");
      setNotice(UNKNOWN_CLOSE);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [round.id, round.status]);

  useEffect(() => {
    if (!confirming) return;
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    const statusHeading = statusHeadingRef.current;
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      if (trigger?.isConnected && !trigger.disabled) trigger.focus();
      else if (statusHeading?.isConnected) statusHeading.focus();
    };
  }, [confirming]);

  useEffect(() => {
    if (!confirming || closeState !== "idle") return;
    let current = true;
    const fail = (message: string) => { if (current) setReview({ kind: "error", message }); };
    void (async () => {
      try {
        const { response, body } = await roundCloseJsonRequest(`/api/admin/round-close?roundId=${encodeURIComponent(round.id)}`, { cache: "no-store" });
        if (!response.ok) { fail("Coverage is unavailable. Retry, or keep grading open and review the round."); return; }
        const summary = parseRoundCloseSummary(body);
        if (!summary || summary.roundId !== round.id) { fail("Coverage could not be verified. Retry before closing grading."); return; }
        if (summary.roundStatus !== round.status) { fail("The round status changed. Reload the round before continuing."); return; }
        if (current) setReview({ kind: "ready", summary });
      } catch {
        fail("Coverage is unavailable. Retry, or keep grading open and review the round.");
      }
    })();
    return () => { current = false; };
  }, [confirming, attempt, round.id, round.status, closeState]);

  async function reconcileClose() {
    setCloseState("checking");
    setNotice("");
    try {
      const { response, body } = await roundCloseJsonRequest(`/api/admin/round-close?roundId=${encodeURIComponent(round.id)}`, { cache: "no-store" });
      const summary = response.ok ? parseRoundCloseSummary(body) : null;
      if (summary?.roundId === round.id) {
        if (["FROZEN", "FINALIZED", "ARCHIVED"].includes(summary.roundStatus)) {
          rememberPendingClose(round.id, false);
          setCloseState("closed");
          setNotice("Grading is closed. The current round status was verified with the server.");
          return;
        }
        if (summary.roundStatus === "ACTIVE" && rejectedRef.current !== null) {
          rememberPendingClose(round.id, false);
          setNotice(`The close request was rejected: ${rejectedRef.current}. The server currently reports grading is open. Review coverage and confirm again only if you still want to close it.`);
          setReview({ kind: "ready", summary });
          setCloseState("idle");
          return;
        }
      }
    } catch {
      // Neither a failed read nor ACTIVE proves an ambiguous write cannot commit later.
    }
    setCloseState("unknown");
    setNotice(UNKNOWN_CLOSE);
  }

  async function saveStatus(nextStatus: string) {
    if (pending || submitLock.current || closeState !== "idle") return;
    if (nextStatus === "FROZEN" && review.kind !== "ready") return;
    submitLock.current = true;
    try {
      if (nextStatus !== "FROZEN") {
        if (await act({ action: "SET_ROUND_STATUS", roundId: round.id, status: nextStatus })) setConfirming(false);
        return;
      }
      if (hasPendingClose(round.id)) { setCloseState("unknown"); setNotice(UNKNOWN_CLOSE); return; }
      rememberPendingClose(round.id, true);
      setCloseState("writing");
      setNotice("");
      let outcome: RoundCloseOutcome;
      try {
        // Legacy boolean adapters cannot distinguish a rejection from lost acknowledgement.
        outcome = closeRound ? await closeRound(round.id) : (await act({ action: "SET_ROUND_STATUS", roundId: round.id, status: nextStatus }) ? { kind: "acknowledged" } : { kind: "unknown" });
      } catch { outcome = { kind: "unknown" }; }
      rejectedRef.current = outcome.kind === "rejected" ? outcome.message : null;
      await reconcileClose();
    } finally { submitLock.current = false; }
  }

  function refreshCoverage() {
    setReview({ kind: "loading" });
    setAttempt((value) => value + 1);
  }

  return <div className="rounded-xl bg-white px-3.5 py-2 inset-ring inset-ring-line">
    <form className="flex flex-wrap items-center justify-between gap-3" onSubmit={(event) => {
      event.preventDefault();
      if (pending || status === round.status || closeState === "closed") return;
      if (closesGrading) { if (closeState === "idle") setReview({ kind: "loading" }); setConfirming(true); }
      else void saveStatus(status);
    }}>
      <h3 ref={statusHeadingRef} tabIndex={-1} className="text-[13px] font-semibold">{round.label}{closeState === "closed" ? " · Grading closed" : ""}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <select name="status" aria-label={`Status for ${round.label}`} value={status} disabled={pending || closeState !== "idle"} onChange={(event) => setStatus(event.target.value)} className="select-control min-h-11 w-44 text-[13px]">
          {STATUSES.filter((candidate) => canTransitionRound(round.status, candidate)).map((candidate) => <option key={candidate} value={candidate}>{roundStatusLabel(candidate)}</option>)}
        </select>
        <button ref={triggerRef} type="submit" disabled={pending || status === round.status || closeState === "closed"} className="button-secondary min-h-11 text-xs">{closeState === "closed" ? "Grading closed" : closeState === "unknown" ? "Check grading status…" : pending ? "Saving…" : closesGrading ? "Close grading…" : "Save status"}</button>
      </div>
    </form>
    {closeState === "closed" && <Link href={`/admin/rounds/${encodeURIComponent(round.id)}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-mecg-blue underline underline-offset-4">Review round results</Link>}
    {!confirming && error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    {confirming && <dialog ref={dialogRef} aria-labelledby={`close-grading-${round.id}`} aria-describedby={`close-grading-description-${round.id}`}
      onCancel={(event) => { event.preventDefault(); if (!pending && !submitLock.current && closeState !== "checking") setConfirming(false); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl bg-white p-5 text-mecg-navy shadow-2xl backdrop:bg-mecg-navy/50 sm:p-6">
      <h3 id={`close-grading-${round.id}`} className="text-xl font-semibold">{closeState === "closed" ? `Grading closed for ${round.label}` : closeState === "unknown" || closeState === "checking" ? `Verify grading status for ${round.label}` : `Close grading for ${round.label}?`}</h3>
      <div id={`close-grading-description-${round.id}`} className="mt-3 space-y-3 text-sm leading-6 text-muted">
        <p>Submitted evaluations and assignments will lock. Unfinished evaluations cannot be completed while the round is closed.</p>
        <p className="font-semibold text-mecg-navy">The current workflow has no transition back to open grading.</p>
      </div>
      <div aria-live="polite" className="mt-4 text-sm">
        {notice && <p role="status">{notice}</p>}
        {closeState === "writing" && <p>Sending close request…</p>}
        {closeState === "checking" && <p>Checking the current round status…</p>}
        {closeState === "unknown" && <button type="button" onClick={() => void reconcileClose()} className="button-secondary mt-3 min-h-11">Check round status</button>}
      </div>
      {closeState === "idle" && <div className="mt-5" aria-live="polite" aria-busy={review.kind === "loading"}>
        {review.kind === "loading" && <p className="text-sm text-muted">Loading current coverage…</p>}
        {review.kind === "error" && <div><p role="alert" className="text-sm text-danger">{review.message}</p><button type="button" onClick={refreshCoverage} className="button-secondary mt-3 min-h-11 text-sm">Retry coverage</button></div>}
        {review.kind === "ready" && <>
          <table className="w-full text-sm"><caption className="pb-2 text-left font-semibold">Current round coverage</caption><tbody>
            {[["Applicants in this round", review.summary.applicants], ["With two valid independent evaluations", review.summary.applicantsReady], ["Still need valid evaluations", review.summary.applicantsIncomplete], ["Submitted evaluations", review.summary.submittedEvaluations], ["Valid independent evaluations", review.summary.validEvaluations], ["Open assignments", review.summary.openAssignments]].map(([label, value]) => <tr key={label} className="border-t border-line"><th scope="row" className="py-2 pr-3 text-left font-normal text-muted">{label}</th><td className="tabular py-2 text-right font-semibold">{value}</td></tr>)}
          </tbody></table>
          <p className="mt-3 text-xs leading-5 text-muted">Counts cover enrolled or assigned applicants, excluding drafts and withdrawals. Submitted work may be partial; valid work must meet the current rubric and conflict rules. Open assignments count actual records, including unfinished work.</p>
          {review.summary.applicants === 0 ? <p className="mt-3 text-sm font-semibold">No applicants are enrolled or assigned to this round.</p> : (review.summary.applicantsIncomplete > 0 || review.summary.openAssignments > 0) && <p className="mt-3 text-sm font-semibold">Unfinished work remains. Closing is still allowed and will prevent further grading.</p>}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><span>Loaded {new Date(review.summary.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Counts can change until grading closes.</span><button type="button" disabled={pending} onClick={refreshCoverage} className="min-h-11 underline underline-offset-4">Refresh coverage</button></div>
        </>}
      </div>}
      <Link href={`/admin/rounds/${encodeURIComponent(round.id)}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">Review round coverage and results</Link>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button ref={cancelRef} type="button" disabled={pending || closeState === "writing" || closeState === "checking"} onClick={() => setConfirming(false)} className="button-secondary min-h-11">{closeState === "idle" ? "Keep grading open" : "Dismiss"}</button>
        <button type="button" disabled={pending || closeState !== "idle" || review.kind !== "ready"} onClick={() => void saveStatus("FROZEN")} className="button-primary min-h-11">{pending ? "Closing grading…" : "Close grading and lock submissions"}</button>
      </div>
    </dialog>}
  </div>;
}
