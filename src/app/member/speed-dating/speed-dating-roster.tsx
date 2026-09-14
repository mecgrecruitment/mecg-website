"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import OperationNotice from "@/components/operation-notice";
import Headshot from "@/components/applicant-headshot";
import { authorizedFetch, retryOnNetworkError } from "@/lib/client-fetch";
import { SPEED_DATING_SCORE_LABELS } from "@/lib/rubrics";
import { matchesApplicantName, type RosterApplicant, type SpeedDatingRoster } from "@/lib/speed-dating-roster";
import type { SpeedDatingRatingResult } from "@/app/api/member/speed-dating/ratings/route";

const SCORES = [1, 2, 3, 4, 5];
const NOTE_DEBOUNCE_MS = 800;
// One sitting per night: every rating is session 1. The column stays in the
// schema so an older multi-session round still reads back.
const SESSION = 1;

type RowStatus = { kind: "saving" | "saved" | "error" | "hint"; message?: string };

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className={`size-7 ${filled ? "text-amber-400" : "text-mecg-navy/30"}`} aria-hidden="true">
      <path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8Z" />
    </svg>
  );
}

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
  const inputRef = useRef<HTMLInputElement>(null);
  // Last server-confirmed values, so a failed save can put the score back without losing typed text.
  const saved = useRef<Record<string, RosterApplicant>>({ ...rows });
  const timers = useRef<Record<string, number>>({});
  const sequence = useRef<Record<string, number>>({});

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
    window.addEventListener("keydown", focusSearch);
    const pending = timers.current;
    return () => {
      window.removeEventListener("keydown", focusSearch);
      Object.values(pending).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

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

  async function save(applicationId: string, score: number, note: string) {
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
      }), { stillWanted: () => sequence.current[applicationId] === ticket });
      const body: Partial<SpeedDatingRatingResult> & { error?: string } | null = await response.json().catch(() => null);
      if (!response.ok || typeof body?.savedAt !== "string") throw new Error(body?.error ?? "Could not save this rating");
      if (sequence.current[applicationId] !== ticket) return;
      const confirmed = { ...saved.current[applicationId], score, note, session: body.session ?? SESSION, savedAt: body.savedAt };
      saved.current[applicationId] = confirmed;
      patchRow(applicationId, { session: confirmed.session, savedAt: confirmed.savedAt });
      setRowStatus(applicationId, { kind: "saved" });
    } catch (saveError) {
      if (sequence.current[applicationId] !== ticket) return;
      patchRow(applicationId, { score: saved.current[applicationId].score });
      const message = saveError instanceof Error && !(saveError instanceof TypeError)
        ? saveError.message
        : "No connection. Check wifi and tap the star again.";
      setRowStatus(applicationId, { kind: "error", message });
    }
  }

  function cancelTimer(applicationId: string) {
    window.clearTimeout(timers.current[applicationId]);
    delete timers.current[applicationId];
  }

  function rate(applicationId: string, score: number) {
    cancelTimer(applicationId);
    patchRow(applicationId, { score });
    void save(applicationId, score, rows[applicationId].note);
  }

  function editNote(applicationId: string, note: string) {
    patchRow(applicationId, { note });
    cancelTimer(applicationId);
    const score = rows[applicationId].score;
    if (score === null) { setRowStatus(applicationId, { kind: "hint", message: "Pick a star to save" }); return; }
    timers.current[applicationId] = window.setTimeout(() => {
      delete timers.current[applicationId];
      void save(applicationId, score, note);
    }, NOTE_DEBOUNCE_MS);
  }

  function flushNote(applicationId: string) {
    if (!timers.current[applicationId]) return;
    cancelTimer(applicationId);
    const row = rows[applicationId];
    if (row.score !== null) void save(applicationId, row.score, row.note);
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mecg-orange-ink">{initial.roundName}</p>
      <p className="mt-3 text-sm font-semibold text-mecg-navy/65" aria-live="polite">Graded {scored} of {initial.progress.total}</p>
      <div className="relative mt-4">
        <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mecg-navy/45" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a name"
          aria-label="Search applicants"
          autoComplete="off"
          className="min-h-12 w-full rounded-xl border border-mecg-navy/15 bg-white py-3 pl-12 pr-4 text-base text-mecg-navy outline-none transition focus:border-mecg-blue focus:ring-4 focus:ring-mecg-blue/10"
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-mecg-navy/60">
        {SCORES.map((score, index) => (
          <span key={score}>{index > 0 && " · "}<span className="font-semibold text-mecg-navy/80">{score}</span> {SPEED_DATING_SCORE_LABELS[score]}</span>
        ))}
      </p>

      {initial.roundStatus === "PUBLISHED" && <div className="mt-4"><OperationNotice kind="info">Grading opens when the board starts the round.</OperationNotice></div>}
      {initial.roundStatus === "FROZEN" && <div className="mt-4"><OperationNotice kind="info">This round is frozen. Ratings can no longer be changed.</OperationNotice></div>}
      {!initial.rubricReady && <div className="mt-4"><OperationNotice kind="error">The Board must configure one required 100% Speed Dating criterion before grading can begin.</OperationNotice></div>}

      <ul className="mt-5 divide-y divide-mecg-navy/10">
        {visible.length === 0 && (
          <li className="rounded-xl border border-dashed border-mecg-navy/15 px-5 py-8 text-center">
            <p className="font-semibold text-mecg-navy">No applicant matches “{query.trim()}”</p>
            <p className="mt-1 text-sm text-mecg-navy/55">Check the spelling or try their other name.</p>
          </li>
        )}
        {visible.map(({ applicationId }) => {
          const row = rows[applicationId];
          const rowStatus = status[applicationId];
          const noteId = `speed-note-${applicationId}`;
          return (
            <li key={applicationId} className={`flex flex-wrap items-start gap-x-4 gap-y-2 py-3 ${row.score !== null ? "bg-mecg-navy/[0.03]" : ""} -mx-2 rounded-xl px-2`}>
              <Headshot applicant={row} failed={failedHeadshots.has(applicationId)} onFail={() => markHeadshotFailed(applicationId)} />
              <div className="min-w-0 flex-1 basis-40">
                <p className="font-semibold text-mecg-navy">{row.name}</p>
                <p className="mt-0.5 min-h-4 text-xs text-mecg-navy/55" aria-live="polite">
                  {rowStatus?.kind === "saving" && "Saving…"}
                  {rowStatus?.kind === "saved" && "Saved"}
                  {rowStatus?.kind === "hint" && rowStatus.message}
                  {rowStatus?.kind === "error" && <span className="font-semibold text-red-700">{rowStatus.message}</span>}
                  {!rowStatus && row.savedAt && "Saved"}
                </p>
              </div>
              <div className="flex" role="group" aria-label={`${row.name} score`}>
                {SCORES.map((score) => (
                  <button
                    key={score}
                    type="button"
                    disabled={readOnly}
                    aria-pressed={row.score === score}
                    aria-label={`${score}, ${SPEED_DATING_SCORE_LABELS[score]}`}
                    onClick={() => rate(applicationId, score)}
                    className="flex size-11 items-center justify-center rounded-lg hover:bg-amber-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <Star filled={row.score !== null && score <= row.score} />
                  </button>
                ))}
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
                className="min-h-11 w-full basis-full resize-none rounded-xl bg-mecg-navy/[0.035] px-4 py-2.5 text-sm text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)] disabled:opacity-60 sm:basis-auto sm:flex-1 lg:basis-64"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
