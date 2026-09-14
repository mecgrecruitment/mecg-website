"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import OperationNotice from "@/components/operation-notice";
import Headshot from "@/components/applicant-headshot";
import { formatStars } from "@/app/admin/speed-dating-results";
import { authorizedFetch, retryOnNetworkError } from "@/lib/client-fetch";
import type { GroupCaseApplicant, GroupCaseRoster, GroupCaseScores } from "@/lib/group-case-roster";
import { GROUP_CASE_GREEN_FLAGS, GROUP_CASE_RED_FLAGS, GROUP_CASE_SCORE_BANDS, groupCaseAnchors, groupCaseTotal } from "@/lib/rubrics";
import { matchesApplicantName } from "@/lib/speed-dating-roster";
import type { GroupCaseRatingResult } from "@/app/api/member/group-case/ratings/route";

const SCORES = [1, 2, 3, 4, 5];
const NOTE_DEBOUNCE_MS = 800;
const ALL_TABLES = "all";
const FLAGS = [
  ...GROUP_CASE_RED_FLAGS.map((text) => ({ text, prefix: "Red flag", className: "bg-red-50 text-red-800" })),
  ...GROUP_CASE_GREEN_FLAGS.map((text) => ({ text, prefix: "Green flag", className: "bg-emerald-50 text-emerald-800" })),
];

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

function chipLabel(text: string) {
  const trimmed = text.replace(/\.$/, "");
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
}

export default function GroupCaseRoster({ initial }: { initial: GroupCaseRoster }) {
  const tableKey = `mecg:group-case-table:${initial.roundId}`;
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Record<string, GroupCaseApplicant>>(() =>
    Object.fromEntries(initial.groups.flatMap((group) => group.applicants).map((applicant) => [applicant.applicationId, applicant])));
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [table, setTable] = useState<string | null>(null);
  const [failedHeadshots, setFailedHeadshots] = useState<Set<string>>(() => new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Last server-confirmed values, so a failed save can put the scores back without losing typed text.
  const saved = useRef<Record<string, GroupCaseApplicant>>({ ...rows });
  const timers = useRef<Record<string, number>>({});
  const sequence = useRef<Record<string, number>>({});
  // Every save carries all six scores, so two taps in flight at once could
  // land at Postgres in the wrong order and the earlier one would erase the
  // later star. One request per applicant at a time; a save that is already
  // superseded when its turn comes is skipped, the newer one carries everything.
  const inflight = useRef<Record<string, Promise<void>>>({});

  const readOnly = initial.roundStatus !== "ACTIVE" || initial.criteria.length === 0;
  const everyone = useMemo(() => initial.groups.flatMap((group) => group.applicants), [initial.groups]);
  const showGroupHeadings = !(initial.groups.length === 1 && initial.groups[0].groupId === null);
  const tables = useMemo(() => initial.groups.filter((group) => group.groupId !== null), [initial.groups]);
  const showTables = tables.length > 1;
  const tableGroups = useMemo(() => showTables && table !== null
    ? initial.groups.filter((group) => group.groupId === table)
    : initial.groups, [initial.groups, showTables, table]);
  const visibleGroups = useMemo(() => tableGroups
    .map((group) => ({ ...group, applicants: group.applicants.filter((applicant) => matchesApplicantName(applicant.name, query)) }))
    .filter((group) => group.applicants.length > 0), [tableGroups, query]);
  const tableApplicants = tableGroups.flatMap((group) => group.applicants);
  const scored = tableApplicants.filter(({ applicationId }) => countScored(rows[applicationId].scores) > 0).length;
  const total = tableApplicants.length;

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

  // Remembered table wins; otherwise the first table this grader already started on.
  // Deferred like application-form's recovery so the server-rendered "All tables" hydrates cleanly.
  useEffect(() => {
    if (!showTables) return;
    let stored: string | null = null;
    try { stored = window.localStorage.getItem(tableKey); } catch {}
    if (stored === ALL_TABLES) return;
    const remembered = stored && tables.some((group) => group.groupId === stored) ? stored : null;
    const started = tables.find((group) => group.applicants.some((applicant) => countScored(applicant.scores) > 0));
    const pick = remembered ?? started?.groupId ?? null;
    if (pick === null) return;
    const timer = window.setTimeout(() => setTable(pick), 0);
    return () => window.clearTimeout(timer);
  }, [tables, showTables, tableKey]);

  function pickTable(groupId: string | null) {
    setTable(groupId);
    try { window.localStorage.setItem(tableKey, groupId ?? ALL_TABLES); } catch {}
  }

  function markHeadshotFailed(applicationId: string) {
    setFailedHeadshots((current) => current.has(applicationId) ? current : new Set(current).add(applicationId));
  }

  function toggleOpen(applicationId: string) {
    setOpenId((current) => current === applicationId ? null : applicationId);
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
    let finish = () => {};
    const ticket = (sequence.current[applicationId] ?? 0) + 1;
    sequence.current[applicationId] = ticket;
    setRowStatus(applicationId, { kind: "saving" });
    await inflight.current[applicationId];
    if (sequence.current[applicationId] !== ticket) return;
    const done = new Promise<void>((resolve) => { finish = resolve; });
    inflight.current[applicationId] = done;
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
    } finally {
      finish();
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

  function addFlag(applicationId: string, prefix: string, text: string) {
    const note = rows[applicationId].note;
    const separator = note.length > 0 && !note.endsWith("\n") ? "\n" : "";
    editNote(applicationId, `${note}${separator}${prefix}: ${text}`);
    requestAnimationFrame(() => grow(document.getElementById(`group-case-note-${applicationId}`) as HTMLTextAreaElement | null));
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mecg-orange-ink">{initial.roundName}</p>
      <p className="mt-3 text-sm font-semibold text-mecg-navy/65" aria-live="polite">Graded {scored} of {total}</p>
      {showTables && (
        <div className="scroll-cue -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-7 sm:px-7" role="group" aria-label="Table">
          {[{ groupId: null, groupName: "All tables", count: everyone.length }, ...tables.map((group) => ({ groupId: group.groupId, groupName: group.groupName, count: group.applicants.length }))].map((chip) => {
            const selected = chip.groupId === table;
            return (
              <button
                key={chip.groupId ?? "all"}
                type="button"
                aria-pressed={selected}
                onClick={() => pickTable(chip.groupId)}
                className={`min-h-12 shrink-0 rounded-xl px-3 py-2 text-left transition-[background-color,box-shadow,scale] active:scale-[0.96] ${selected ? "bg-mecg-navy text-white" : "bg-white text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]"}`}
              >
                <span className="block text-sm font-semibold">{chip.groupName}</span>
                <span className={`mt-0.5 block text-xs ${selected ? "text-white/65" : "text-mecg-navy/55"}`}>{chip.count} {chip.count === 1 ? "applicant" : "applicants"}</span>
              </button>
            );
          })}
        </div>
      )}
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
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-mecg-navy/60">
          Score 1 to 5 on each dimension. Collaboration and Composure count twice.{" "}
          <Link href={`/member/calibration/${initial.roundId}?return=/member/group-case`} className="font-semibold text-mecg-blue underline">Read the rubric</Link>
        </p>
        <button type="button" onClick={() => dialogRef.current?.showModal()} className="button-secondary shrink-0 text-sm">Rubric</button>
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby="group-case-rubric-title"
        onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current.close(); }}
        className="m-auto w-[min(92vw,32rem)] max-h-[85vh] rounded-2xl bg-white p-0 text-mecg-navy backdrop:bg-mecg-navy/40"
      >
        <div className="max-h-[85vh] overflow-y-auto p-5">
          <h3 id="group-case-rubric-title" className="text-lg font-semibold">Group Case rubric</h3>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {GROUP_CASE_SCORE_BANDS.map((band) => (
                <tr key={band.min} className="border-t border-mecg-navy/10">
                  <td className="py-1.5 pr-3 font-semibold tabular-nums">{band.min} to {band.max}</td>
                  <td className="py-1.5">{band.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4 className="mt-4 text-sm font-semibold text-red-800">Red flags</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-mecg-navy/75">
            {GROUP_CASE_RED_FLAGS.map((flag) => <li key={flag}>{flag}</li>)}
          </ul>
          <h4 className="mt-4 text-sm font-semibold text-emerald-800">Green flags</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-mecg-navy/75">
            {GROUP_CASE_GREEN_FLAGS.map((flag) => <li key={flag}>{flag}</li>)}
          </ul>
          <button type="button" onClick={() => dialogRef.current?.close()} className="button-secondary mt-5 text-sm">Close</button>
        </div>
      </dialog>

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
              const result = groupCaseTotal(row.scores, initial.criteria);
              const expanded = openId === applicationId;
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
                    {row.speedDating && (
                      <span
                        className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900"
                        title={`${row.speedDating.count} Speed Dating ${row.speedDating.count === 1 ? "grader" : "graders"}`}
                      >
                        {formatStars(row.speedDating.adjusted)}
                      </span>
                    )}
                    {result ? (
                      <span className="min-w-0 max-w-[8.5rem] shrink-0 text-right">
                        <span className="block text-sm font-bold tabular-nums text-mecg-navy">{result.total} / 40</span>
                        <span className="block truncate text-xs text-mecg-navy/55" title={result.band}>{result.band}</span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs font-semibold text-mecg-navy/55">{scoredCount} of {initial.criteria.length}</span>
                    )}
                  </button>
                  {expanded && (
                    <div id={bodyId} className="mt-3 pl-[3.75rem]">
                      {/* top = WorkspaceNav's top-3 (12px) + its 56px shell. */}
                      <div className="sticky top-[4.25rem] z-10 -mx-2 flex items-center justify-between gap-3 bg-white/95 px-2 py-2 backdrop-blur">
                        <span className="text-sm font-semibold text-mecg-navy">{row.name}</span>
                        <span className="text-xs text-mecg-navy/60">{result ? `${result.total} / 40 · ${result.band}` : `${scoredCount} of ${initial.criteria.length} scored`}</span>
                      </div>
                      <div className="divide-y divide-mecg-navy/[0.06]">
                        {initial.criteria.map((criterion) => {
                          const current = row.scores[criterion.id] ?? null;
                          return (
                            <div key={criterion.id} className="py-3">
                              <details>
                                <summary className="flex list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                                  <span className="text-sm font-semibold text-mecg-navy">{criterion.name}</span>
                                  {criterion.description && (
                                    <span className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full bg-mecg-navy/[0.06] text-xs font-semibold text-mecg-navy" aria-label="What this measures">?</span>
                                  )}
                                </summary>
                                {criterion.description && <p className="mt-1 text-xs leading-5 text-mecg-navy/60">{criterion.description}</p>}
                              </details>
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
                              {current !== null && (
                                <p className="mt-0.5 text-xs leading-5 text-mecg-navy/60">
                                  {groupCaseAnchors(criterion.name)[current]}
                                  <button type="button" disabled={readOnly} onClick={() => rate(applicationId, criterion.id, current)} className="ml-2 text-xs font-semibold text-mecg-blue underline disabled:opacity-60">Clear</button>
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {result && <p className="mt-3 text-sm text-mecg-navy">Your score: <strong>{result.total} / 40</strong> · {result.band}</p>}
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
                        className="mt-3 min-h-11 w-full resize-none rounded-xl bg-mecg-navy/[0.035] px-4 py-2.5 text-sm text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)] disabled:opacity-60"
                      />
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-mecg-navy/60">Add a flag</summary>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {FLAGS.map((flag) => (
                            <button
                              key={flag.text}
                              type="button"
                              disabled={readOnly}
                              title={flag.text}
                              onClick={() => addFlag(applicationId, flag.prefix, flag.text)}
                              className={`min-h-10 rounded-full px-2.5 py-1 text-xs font-semibold disabled:opacity-60 ${flag.className}`}
                            >
                              {chipLabel(flag.text)}
                            </button>
                          ))}
                        </div>
                      </details>
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
