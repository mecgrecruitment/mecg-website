"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import OperationNotice from "@/components/operation-notice";
import Headshot from "@/components/applicant-headshot";
import RatingStar from "@/components/rating-star";
import TallyStrip from "@/components/tally-strip";
import { authorizedFetch, retryOnNetworkError } from "@/lib/client-fetch";
import { createRetryBackoff } from "@/lib/retry-backoff";
import { SPEED_DATING_SCORE_LABELS } from "@/lib/rubrics";
import { matchesApplicantName, type RosterApplicant, type SpeedDatingRoster } from "@/lib/speed-dating-roster";
import { flushPendingNotes, type PendingNote } from "./pending-notes";
import type { SpeedDatingRatingResult } from "@/app/api/member/speed-dating/ratings/route";

const SCORES = [1, 2, 3, 4, 5];
const NOTE_DEBOUNCE_MS = 800;
// One sitting per night: every rating is session 1. The column stays in the
// schema so an older multi-session round still reads back.
const SESSION = 1;

type RowStatus = { kind: "saving" | "saved" | "retrying" | "error" | "hint"; message?: string };

function grow(node: HTMLTextAreaElement | null) {
  if (!node) return;
  node.style.height = "auto";
  node.style.height = `${node.scrollHeight}px`;
}

export default function SpeedDatingRoster({ initial }: { initial: SpeedDatingRoster }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Record<string, RosterApplicant>>(() =>
    Object.fromEntries(initial.applicants.map((applicant) => [applicant.applicationId, applicant])));
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const [failedHeadshots, setFailedHeadshots] = useState<Set<string>>(() => new Set());
  const [hovered, setHovered] = useState<{ id: string; score: number } | null>(null);
  const [lastRated, setLastRated] = useState<{ id: string; score: number; at: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pendingNotes = useRef<Record<string, PendingNote>>({});
  const sequence = useRef<Record<string, number>>({});
  const [backoff] = useState(() => createRetryBackoff());
  const flushAllRef = useRef(() => {});

  const readOnly = initial.roundStatus !== "ACTIVE" || !initial.rubricReady;
  const visible = useMemo(() => initial.applicants.filter((applicant) => matchesApplicantName(applicant.name, query)), [initial.applicants, query]);
  const scored = Object.values(rows).filter((row) => row.score !== null).length;

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) inputRef.current?.focus();
    function focusSearch(event: KeyboardEvent) {
      if (event.key === "/" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    const sendNotes = () => flushAllRef.current();
    window.addEventListener("keydown", focusSearch);
    window.addEventListener("pagehide", sendNotes);
    return () => {
      window.removeEventListener("keydown", focusSearch);
      window.removeEventListener("pagehide", sendNotes);
      sendNotes();
      backoff.resetAll();
    };
  }, [backoff]);

  // A note still waiting on its debounce goes out through save, so it takes a
  // new ticket and any older retry for that applicant stands down.
  // keepalive lets the request outlive the page.
  useEffect(() => {
    flushAllRef.current = () => flushPendingNotes(pendingNotes.current, (applicationId, score, note) => {
      backoff.reset(applicationId);
      void save(applicationId, score, note, true);
    });
  });

  // A save that failed offline keeps its star on screen; try it again once the browser reconnects.
  useEffect(() => {
    function retryUnsaved() {
      for (const [applicationId, rowStatus] of Object.entries(status)) {
        if (rowStatus.kind === "error" || rowStatus.kind === "retrying") retry(applicationId);
      }
    }
    window.addEventListener("online", retryUnsaved);
    return () => window.removeEventListener("online", retryUnsaved);
  });

  function markHeadshotFailed(applicationId: string) {
    setFailedHeadshots((current) => current.has(applicationId) ? current : new Set(current).add(applicationId));
  }

  function patchRow(applicationId: string, patch: Partial<RosterApplicant>) {
    setRows((current) => ({ ...current, [applicationId]: { ...current[applicationId], ...patch } }));
  }

  function setRowStatus(applicationId: string, next: RowStatus | null) {
    setStatus((current) => {
      const copy = { ...current };
      if (next) copy[applicationId] = next; else delete copy[applicationId];
      return copy;
    });
  }

  async function save(applicationId: string, score: number, note: string, keepalive = false) {
    const ticket = (sequence.current[applicationId] ?? 0) + 1;
    sequence.current[applicationId] = ticket;
    setRowStatus(applicationId, { kind: "saving" });
    try {
      // Ratings upsert per grader and applicant, so resending after a dropped
      // connection is safe. stillWanted drops a retry once a newer tap for the
      // same applicant has taken over, so an old score cannot land last.
      const response = await retryOnNetworkError(() => authorizedFetch("/api/member/speed-dating/ratings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roundId: initial.roundId, applicationId, session: SESSION, score, note }),
        keepalive,
      }), {
        stillWanted: () => sequence.current[applicationId] === ticket,
        // Say so at the first dropped request, not after the quiet retries run out.
        onRetry: () => { if (sequence.current[applicationId] === ticket) setRowStatus(applicationId, { kind: "retrying" }); },
      });
      const body: Partial<SpeedDatingRatingResult> & { error?: string } | null = await response.json().catch(() => null);
      if (!response.ok || typeof body?.savedAt !== "string") throw new Error(body?.error ?? "Could not save this rating.");
      if (sequence.current[applicationId] !== ticket) return;
      backoff.reset(applicationId);
      patchRow(applicationId, { session: body.session ?? SESSION, savedAt: body.savedAt });
      setRowStatus(applicationId, { kind: "saved" });
    } catch (saveError) {
      if (sequence.current[applicationId] !== ticket) return;
      if (saveError instanceof Error && !(saveError instanceof TypeError)) {
        setRowStatus(applicationId, { kind: "error", message: saveError.message });
        return;
      }
      // Only this ticket's score and note are resent, and only while nothing newer has replaced them.
      const queued = backoff.schedule(applicationId, () => {
        if (sequence.current[applicationId] === ticket) void save(applicationId, score, note);
      });
      setRowStatus(applicationId, queued ? { kind: "retrying" } : { kind: "error", message: "" });
    }
  }

  function cancelTimer(applicationId: string) {
    window.clearTimeout(pendingNotes.current[applicationId]?.timer);
    delete pendingNotes.current[applicationId];
  }

  function rate(applicationId: string, score: number) {
    cancelTimer(applicationId);
    backoff.reset(applicationId);
    patchRow(applicationId, { score });
    setHovered(null);
    setLastRated((previous) => ({ id: applicationId, score, at: (previous?.at ?? 0) + 1 }));
    void save(applicationId, score, rows[applicationId].note);
  }

  function retry(applicationId: string) {
    backoff.reset(applicationId);
    const row = rows[applicationId];
    if (row.score !== null) void save(applicationId, row.score, row.note);
  }

  // A rating needs a score, so a note typed first waits in the row and rides along with the first star.
  function editNote(applicationId: string, note: string) {
    patchRow(applicationId, { note });
    cancelTimer(applicationId);
    backoff.reset(applicationId);
    const score = rows[applicationId].score;
    if (score === null) { setRowStatus(applicationId, { kind: "hint", message: "Note saves when you pick a star" }); return; }
    const timer = window.setTimeout(() => {
      delete pendingNotes.current[applicationId];
      void save(applicationId, score, note);
    }, NOTE_DEBOUNCE_MS);
    pendingNotes.current[applicationId] = { timer, score, note };
  }

  function flushNote(applicationId: string) {
    const pending = pendingNotes.current[applicationId];
    if (!pending) return;
    cancelTimer(applicationId);
    void save(applicationId, pending.score, pending.note);
  }

  function focusFirstRow(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    listRef.current?.querySelector<HTMLElement>("li[tabindex]")?.focus();
  }

  return (
    <section className="grading-workspace speed-dating-workspace rounded-xl bg-white p-5 inset-ring inset-ring-line sm:p-7">
      <div className="grading-workspace-heading"><h2>Rate your conversations</h2></div>
      <TallyStrip caption={`${scored} of ${initial.progress.total} rated`} items={initial.applicants.map(({ applicationId }) => ({ id: applicationId, state: rows[applicationId].score !== null ? "done" : "empty" }))} />
      {scored > 0 && scored === initial.applicants.length && !readOnly && <p className="ballot-complete">Every conversation is rated. You can still change a rating until the round is frozen.</p>}
      <div className="relative mt-4">
        <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={focusFirstRow}
          placeholder="Search a name"
          aria-label="Search applicants"
          autoComplete="off"
          className="workspace-search min-h-12 w-full rounded-xl border border-line bg-white py-3 pl-12 pr-4 text-base text-mecg-navy outline-none transition focus:border-mecg-blue focus:ring-4 focus:ring-mecg-blue/10"
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">
        {SCORES.map((score, index) => (
          <span key={score}>{index > 0 && " · "}<span className="font-semibold text-mecg-navy">{score}</span> {SPEED_DATING_SCORE_LABELS[score]}</span>
        ))}
      </p>

      {initial.roundStatus === "PUBLISHED" && <div className="mt-4"><OperationNotice kind="info">Grading opens when the board starts the round.</OperationNotice></div>}
      {initial.roundStatus === "FROZEN" && <div className="mt-4"><OperationNotice kind="info">This round is frozen. Ratings can no longer be changed.</OperationNotice></div>}
      {!initial.rubricReady && <div className="mt-4"><OperationNotice kind="error">The Board must configure one required 100% Speed Dating criterion before grading can begin.</OperationNotice></div>}

      <ul ref={listRef} className="mt-5 divide-y divide-line">
        {visible.length === 0 && (
          <li className="rounded-xl border border-dashed border-line px-5 py-8 text-center">
            <p className="font-semibold text-mecg-navy">No applicant matches “{query.trim()}”</p>
            <p className="mt-1 text-sm text-muted">Check the spelling or try their other name.</p>
          </li>
        )}
        {visible.map(({ applicationId }) => {
          const row = rows[applicationId];
          const rowStatus = status[applicationId];
          const noteId = `speed-note-${applicationId}`;
          const preview = hovered?.id === applicationId ? hovered.score : null;
          const shown = preview ?? row.score;
          const onKeys = (event: ReactKeyboardEvent<HTMLLIElement>) => {
            if (readOnly || event.repeat || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            const score = Number(event.key);
            if (!SCORES.includes(score) || score === row.score) return;
            event.preventDefault();
            rate(applicationId, score);
          };
          return (
            <li
              key={applicationId}
              tabIndex={readOnly ? undefined : 0}
              aria-keyshortcuts={readOnly ? undefined : "1 2 3 4 5"}
              onKeyDown={onKeys}
              className={`flex flex-wrap items-start gap-x-4 gap-y-2 py-3 ${row.score !== null ? "bg-wash" : ""} -mx-2 rounded-xl px-2 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)]`}
            >
              <Headshot applicant={row} failed={failedHeadshots.has(applicationId)} onFail={() => markHeadshotFailed(applicationId)} />
              <div className="min-w-0 flex-1 basis-40">
                <p className="font-semibold text-mecg-navy">{row.name}</p>
                <p className="mt-0.5 min-h-4 text-xs text-muted" aria-live="polite">
                  {rowStatus?.kind === "saving" && "Saving…"}
                  {rowStatus?.kind === "saved" && "Saved"}
                  {rowStatus?.kind === "retrying" && "No connection. Retrying…"}
                  {rowStatus?.kind === "hint" && rowStatus.message}
                  {rowStatus?.kind === "error" && <span className="font-semibold text-danger">{rowStatus.message ? `Not saved. ${rowStatus.message}` : "Not saved."}</span>}
                  {!rowStatus && row.savedAt && "Saved"}
                </p>
                {(rowStatus?.kind === "error" || rowStatus?.kind === "retrying") && row.score !== null && (
                  <button type="button" onClick={() => retry(applicationId)} className="mt-1 min-h-11 text-xs font-semibold text-mecg-blue underline">Retry</button>
                )}
              </div>
              <div className="rating-scale">
                <div className="flex" role="group" aria-label={`${row.name} score`} onPointerLeave={() => setHovered(null)}>
                  {SCORES.map((score) => (
                    <button
                      key={score}
                      type="button"
                      disabled={readOnly}
                      aria-pressed={row.score === score}
                      aria-keyshortcuts={String(score)}
                      aria-label={`${score}, ${SPEED_DATING_SCORE_LABELS[score]}`}
                      onClick={() => rate(applicationId, score)}
                      onPointerEnter={(event) => { if (!readOnly && event.pointerType === "mouse") setHovered({ id: applicationId, score }); }}
                      className="rating-button"
                    >
                      <RatingStar
                        key={lastRated?.id === applicationId && lastRated.score === score ? lastRated.at : score}
                        state={shown !== null && score <= shown ? (preview !== null ? "preview" : "filled") : "empty"}
                        pop={lastRated?.id === applicationId && lastRated.score === score}
                      />
                    </button>
                  ))}
                </div>
                <span className="rating-meaning" data-preview={preview !== null || undefined} aria-hidden="true">{shown !== null ? SPEED_DATING_SCORE_LABELS[shown] : ""}</span>
              </div>
              <textarea
                id={noteId}
                rows={1}
                value={row.note}
                maxLength={2000}
                disabled={readOnly}
                placeholder="Note (optional)"
                aria-label={`Note for ${row.name}`}
                ref={grow}
                onInput={(event) => grow(event.currentTarget)}
                onChange={(event) => editNote(applicationId, event.target.value)}
                onBlur={() => flushNote(applicationId)}
                className="min-h-11 w-full basis-full resize-none rounded-xl bg-wash px-4 py-2.5 text-sm text-mecg-navy inset-ring inset-ring-line-strong outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)] disabled:opacity-60 sm:basis-auto sm:flex-1 lg:basis-64"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
