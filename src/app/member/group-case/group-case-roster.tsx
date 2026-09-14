"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import OperationNotice from "@/components/operation-notice";
import Headshot from "@/components/applicant-headshot";
import { formatStars } from "@/app/admin/speed-dating-results";
import { authorizedFetch, retryOnNetworkError } from "@/lib/client-fetch";
import type { GroupCaseApplicant, GroupCaseRoster, GroupCaseScores } from "@/lib/group-case-roster";
import { groupCaseAnchors } from "@/lib/rubrics";
import { matchesApplicantName } from "@/lib/speed-dating-roster";
import type { GroupCaseRatingResult } from "@/app/api/member/group-case/ratings/route";

const SCORES = [1, 2, 3, 4, 5];
const NOTE_DEBOUNCE_MS = 800;

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

function countScored(scores: GroupCaseScores) {
  return Object.values(scores).filter((score) => score !== null).length;
}

export default function GroupCaseRoster({ initial }: { initial: GroupCaseRoster }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Record<string, GroupCaseApplicant>>(() =>
    Object.fromEntries(initial.groups.flatMap((group) => group.applicants).map((applicant) => [applicant.applicationId, applicant])));
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [failedHeadshots, setFailedHeadshots] = useState<Set<string>>(() => new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  // Last server-confirmed values, so a failed save can put the scores back without losing typed text.
  const saved = useRef<Record<string, GroupCaseApplicant>>({ ...rows });
  const timers = useRef<Record<string, number>>({});
  const sequence = useRef<Record<string, number>>({});

  const readOnly = initial.roundStatus !== "ACTIVE" || initial.criteria.length === 0;
  const everyone = useMemo(() => initial.groups.flatMap((group) => group.applicants), [initial.groups]);
  const visibleGroups = useMemo(() => initial.groups
    .map((group) => ({ ...group, applicants: group.applicants.filter((applicant) => matchesApplicantName(applicant.name, query)) }))
    .filter((group) => group.applicants.length > 0), [initial.groups, query]);
  const showGroupHeadings = !(initial.groups.length === 1 && initial.groups[0].groupId === null);
  const scored = Object.values(rows).filter((row) => countScored(row.scores) > 0).length;

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

  function toggleOpen(applicationId: string) {
    setOpen((current) => {
      const copy = new Set(current);
      if (copy.has(applicationId)) copy.delete(applicationId); else copy.add(applicationId);
      return copy;
    });
  }

  function patchRow(applicationId: string, patch: Partial<GroupCaseApplicant>) {
    setRows((current) => ({ ...current, [applicationId]: { ...current[applicationId], ...patch } }));
  }

  function setRowStatus(applicationId: string, next: RowStatus | null) {
    setStatus((current) => {
      const copy = { ...current };
      if (next) copy[applicationId] = next; else delete copy[applicationId];
      return copy;
    });
  }

  // The RPC upserts every criterion at once, so always send the full set with nulls for the unobserved.
  function fullScores(scores: GroupCaseScores): GroupCaseScores {
    return Object.fromEntries(initial.criteria.map((criterion) => [criterion.id, scores[criterion.id] ?? null]));
  }

  async function save(applicationId: string, scores: GroupCaseScores, note: string) {
    const ticket = (sequence.current[applicationId] ?? 0) + 1;
    sequence.current[applicationId] = ticket;
    setRowStatus(applicationId, { kind: "saving" });
    try {
      // Ratings upsert per grader and applicant, so resending after a dropped
      // connection is safe. stillWanted drops a retry once a newer tap for the
      // same applicant has taken over, so an old score cannot land last.
      const response = await retryOnNetworkError(() => authorizedFetch("/api/member/group-case/ratings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roundId: initial.roundId, applicationId, scores: fullScores(scores), note }),
      }), { stillWanted: () => sequence.current[applicationId] === ticket });
      const body: Partial<GroupCaseRatingResult> & { error?: string } | null = await response.json().catch(() => null);
      if (!response.ok || typeof body?.savedAt !== "string") throw new Error(body?.error ?? "Could not save this rating");
      if (sequence.current[applicationId] !== ticket) return;
      const confirmed = { ...saved.current[applicationId], scores: body.scores ?? scores, note, savedAt: body.savedAt };
      saved.current[applicationId] = confirmed;
      patchRow(applicationId, { scores: confirmed.scores, savedAt: confirmed.savedAt });
      setRowStatus(applicationId, { kind: "saved" });
    } catch (saveError) {
      if (sequence.current[applicationId] !== ticket) return;
      patchRow(applicationId, { scores: saved.current[applicationId].scores });
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

  function rate(applicationId: string, criterionId: string, score: number) {
    cancelTimer(applicationId);
    const row = rows[applicationId];
    // Tapping the selected star again clears it: the criterion was not observed.
    const scores = { ...row.scores, [criterionId]: row.scores[criterionId] === score ? null : score };
    patchRow(applicationId, { scores });
    void save(applicationId, scores, row.note);
  }

  function editNote(applicationId: string, note: string) {
    patchRow(applicationId, { note });
    cancelTimer(applicationId);
    const scores = rows[applicationId].scores;
    if (countScored(scores) === 0) { setRowStatus(applicationId, { kind: "hint", message: "Pick a star to save" }); return; }
    timers.current[applicationId] = window.setTimeout(() => {
      delete timers.current[applicationId];
      void save(applicationId, scores, note);
    }, NOTE_DEBOUNCE_MS);
  }

  function flushNote(applicationId: string) {
    if (!timers.current[applicationId]) return;
    cancelTimer(applicationId);
    const row = rows[applicationId];
    if (countScored(row.scores) > 0) void save(applicationId, row.scores, row.note);
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
        Score 1 to 5 on each dimension. Collaboration and Composure count twice.{" "}
        <Link href={`/member/calibration/${initial.roundId}?return=/member/group-case`} className="font-semibold text-mecg-blue underline">Read the rubric</Link>
      </p>

      {initial.roundStatus === "PUBLISHED" && <div className="mt-4"><OperationNotice kind="info">Grading opens when the board starts the round.</OperationNotice></div>}
      {initial.roundStatus === "FROZEN" && <div className="mt-4"><OperationNotice kind="info">This round is frozen. Ratings can no longer be changed.</OperationNotice></div>}
      {initial.criteria.length === 0 && <div className="mt-4"><OperationNotice kind="error">The Board must configure the Group Case rubric before grading can begin.</OperationNotice></div>}

      {visibleGroups.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-mecg-navy/15 px-5 py-8 text-center">
          <p className="font-semibold text-mecg-navy">{everyone.length === 0 ? "No applicants are enrolled yet" : `No applicant matches “${query.trim()}”`}</p>
          <p className="mt-1 text-sm text-mecg-navy/55">{everyone.length === 0 ? "Applicants appear here once the Board moves them into Group Case." : "Check the spelling or try their other name."}</p>
        </div>
      )}
      {visibleGroups.map((group) => (
        <section key={group.groupId ?? "ungrouped"} className="mt-5" aria-label={group.groupName}>
          {showGroupHeadings && <h3 className="text-sm font-semibold text-mecg-navy">{group.groupName}</h3>}
          <ul className="mt-2 divide-y divide-mecg-navy/10">
            {group.applicants.map(({ applicationId }) => {
              const row = rows[applicationId];
              const rowStatus = status[applicationId];
              const scoredCount = countScored(row.scores);
              const expanded = open.has(applicationId);
              const bodyId = `group-case-${applicationId}`;
              return (
                <li key={applicationId} className={`-mx-2 rounded-xl px-2 py-3 ${scoredCount > 0 ? "bg-mecg-navy/[0.03]" : ""}`}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={bodyId}
                    onClick={() => toggleOpen(applicationId)}
                    className="flex w-full items-center gap-x-4 text-left"
                  >
                    <Headshot applicant={row} failed={failedHeadshots.has(applicationId)} onFail={() => markHeadshotFailed(applicationId)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-mecg-navy">{row.name}</span>
                      <span className="mt-0.5 block min-h-4 text-xs text-mecg-navy/55" aria-live="polite">
                        {rowStatus?.kind === "saving" && "Saving…"}
                        {rowStatus?.kind === "saved" && "Saved"}
                        {rowStatus?.kind === "hint" && rowStatus.message}
                        {rowStatus?.kind === "error" && <span className="font-semibold text-red-700">{rowStatus.message}</span>}
                        {!rowStatus && row.savedAt && "Saved"}
                      </span>
                    </span>
                    {row.speedDating ? (
                      <span
                        className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900"
                        title={`${row.speedDating.count} Speed Dating ${row.speedDating.count === 1 ? "grader" : "graders"}`}
                      >
                        {formatStars(row.speedDating.adjusted)}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs font-semibold text-mecg-navy/55">{scoredCount} of {initial.criteria.length} scored</span>
                    )}
                  </button>
                  {expanded && (
                    <div id={bodyId} className="mt-3 space-y-3 pl-[3.75rem]">
                      {initial.criteria.map((criterion) => {
                        const current = row.scores[criterion.id] ?? null;
                        return (
                          <div key={criterion.id}>
                            <p className="text-sm font-semibold text-mecg-navy">
                              {criterion.name}
                              {criterion.required && <span className="font-normal text-mecg-navy/50"> · required</span>}
                            </p>
                            {criterion.description && <p className="mt-0.5 text-xs leading-5 text-mecg-navy/60">{criterion.description}</p>}
                            <div className="mt-1 flex" role="group" aria-label={`${row.name}, ${criterion.name}`}>
                              {SCORES.map((score) => (
                                <button
                                  key={score}
                                  type="button"
                                  disabled={readOnly}
                                  aria-pressed={current === score}
                                  aria-label={`${score}, ${groupCaseAnchors(criterion.name)[score]}`}
                                  onClick={() => rate(applicationId, criterion.id, score)}
                                  className="flex size-11 items-center justify-center rounded-lg hover:bg-amber-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                >
                                  <Star filled={current !== null && score <= current} />
                                </button>
                              ))}
                            </div>
                            {current !== null && <p className="mt-0.5 text-xs leading-5 text-mecg-navy/60">{groupCaseAnchors(criterion.name)[current]}</p>}
                          </div>
                        );
                      })}
                      <textarea
                        id={`group-case-note-${applicationId}`}
                        rows={1}
                        value={row.note}
                        maxLength={4000}
                        disabled={readOnly}
                        placeholder="Note (optional)"
                        aria-label={`Note for ${row.name}`}
                        ref={grow}
                        onInput={(event) => grow(event.currentTarget)}
                        onChange={(event) => editNote(applicationId, event.target.value)}
                        onBlur={() => flushNote(applicationId)}
                        className="min-h-11 w-full resize-none rounded-xl bg-mecg-navy/[0.035] px-4 py-2.5 text-sm text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)] disabled:opacity-60"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
