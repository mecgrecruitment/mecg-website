"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import OperationNotice from "@/components/operation-notice";
import Headshot from "@/components/applicant-headshot";
import { formatStars } from "@/app/admin/speed-dating-results";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import type { GroupCaseApplicant, GroupCaseRoster, GroupCaseScores } from "@/lib/group-case-roster";
import { GROUP_CASE_GREEN_FLAGS, GROUP_CASE_RED_FLAGS, groupCaseAnchors } from "@/lib/rubrics";
import { matchesApplicantName } from "@/lib/speed-dating-roster";
import { groupCaseQualityMessage } from "@/lib/group-case-roster";

import { parseGroupCaseWriteResult, type GroupCaseWriteRequest, type GroupCaseWriteSnapshot } from "@/lib/group-case-write";

const SCORES = [1, 2, 3, 4, 5];
const NOTE_DEBOUNCE_MS = 800;
const ALL_TABLES = "all";
const FLAGS = [
  ...GROUP_CASE_RED_FLAGS.map((text) => ({ text, prefix: "Red flag", className: "bg-red-50 text-red-800" })),
  ...GROUP_CASE_GREEN_FLAGS.map((text) => ({ text, prefix: "Green flag", className: "bg-emerald-50 text-emerald-800" })),
];

type RowStatus = { kind: "saving" | "saved" } | { kind: "error" | "hint" | "unknown" | "conflict"; message: string };

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

export default function GroupCaseRoster({ initial, readOnlyReason }: { initial: GroupCaseRoster; readOnlyReason?: string }) {
  const tableKey = `mecg:group-case-table:${initial.roundId}`;
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Record<string, GroupCaseApplicant>>(() =>
    Object.fromEntries(initial.groups.flatMap((group) => group.applicants).map((applicant) => [applicant.applicationId, applicant])));
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const rowsRef = useRef(rows);
  const pendingWrites = useRef<Record<string, GroupCaseWriteRequest>>({});
  const conflictsRef = useRef<Record<string, GroupCaseWriteSnapshot>>({});
  const [conflicts, setConflicts] = useState<Record<string, GroupCaseWriteSnapshot>>({});
  const [copyStatus, setCopyStatus] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [table, setTable] = useState<string | null>(null);
  const [failedHeadshots, setFailedHeadshots] = useState<Set<string>>(() => new Set());
  const conflictFocus = useRef<string | null>(null);
  const choiceFocus = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Last server-confirmed evidence; unconfirmed edits stay available for retry.
  const saved = useRef<Record<string, GroupCaseApplicant>>({ ...rows });
  const timers = useRef<Record<string, number>>({});
  // Drain the latest whole-row intent behind one active request per applicant.
  // A queued edit never retries an uncertain write; only explicit retry may do so.
  // Database revisions also guard against competing tabs and devices.
  const inflight = useRef<Record<string, Promise<void>>>({});

  const readOnly = Boolean(readOnlyReason) || initial.roundStatus !== "ACTIVE" || initial.criteria.length === 0;
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

  useEffect(() => {
    const applicationId = conflictFocus.current;
    const heading = applicationId ? document.getElementById(`group-case-conflict-${applicationId}`) : null;
    if (heading) { heading.focus(); conflictFocus.current = null; }
    const selected = choiceFocus.current;
    if (selected) {
      document.getElementById(`group-case-toggle-${selected}`)?.focus();
      choiceFocus.current = null;
    }
  }, [conflicts]);

  useEffect(() => {
    function protectObservations(event: BeforeUnloadEvent) {
      const dirty = Object.entries(rowsRef.current).some(([id, row]) => signature(row) !== signature(saved.current[id]));
      if (dirty || Object.keys(pendingWrites.current).length || Object.keys(conflictsRef.current).length) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", protectObservations);
    return () => window.removeEventListener("beforeunload", protectObservations);
  });

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
    rowsRef.current = { ...rowsRef.current, [applicationId]: { ...rowsRef.current[applicationId], ...patch } };
    setRows(rowsRef.current);
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

  function signature(row: { scores: GroupCaseScores; note: string }) {
    return JSON.stringify({ scores: fullScores(row.scores), note: row.note });
  }
  const observationsUnconfirmed = Object.values(status).some((rowStatus) =>
    rowStatus.kind === "saving" || rowStatus.kind === "unknown" || rowStatus.kind === "conflict" || rowStatus.kind === "error"
    || (rowStatus.kind === "hint" && rowStatus.message === "Unsaved changes"));
  function checkRubricNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (observationsUnconfirmed && !window.confirm("Some observations are not yet confirmed. Leaving may lose changes held only on this page. Choose Cancel to wait for confirmation or download your observations first.")) event.preventDefault();
  }
  const unknownMessage = "Save could not be confirmed. It may already be saved. Newer observations remain on this page. Retry confirms the earlier request before sending newer changes.";
  async function save(applicationId: string, retry = false) {
    const active = inflight.current[applicationId];
    if (active) {
      await active;
      return save(applicationId);
    }
    if (readOnly) return;
    if (conflictsRef.current[applicationId]) return;
    const previous = pendingWrites.current[applicationId];
    if (previous && !retry) { setRowStatus(applicationId, { kind: "unknown", message: unknownMessage }); return; }
    const latest = rowsRef.current[applicationId];
    if (!previous && signature(latest) === signature(saved.current[applicationId])) {
      setRowStatus(applicationId, latest.savedAt ? { kind: "saved" } : { kind: "hint", message: "No evidence saved yet" });
      return;
    }
    const request = previous ?? { roundId: initial.roundId, applicationId, scores: fullScores(latest.scores), note: latest.note, expectedRevision: saved.current[applicationId].revision, mutationId: crypto.randomUUID() };
    pendingWrites.current[applicationId] = request;
    let finish = () => {};
    inflight.current[applicationId] = new Promise<void>((resolve) => { finish = resolve; });
    setRowStatus(applicationId, { kind: "saving" });
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/member/group-case/ratings", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request),
      }, 15_000, authorizedFetch);
      const result = parseGroupCaseWriteResult(body);
      if (response.status === 409 && result?.kind === "conflict" && result.snapshot.applicationId === applicationId) {
        delete pendingWrites.current[applicationId];
        conflictsRef.current[applicationId] = result.snapshot;
        conflictFocus.current = applicationId;
        setQuery("");
        setTable(null);
        setOpenId(applicationId);
        setConflicts({ ...conflictsRef.current });
        setRowStatus(applicationId, { kind: "conflict", message: "Saved observations changed elsewhere. Compare both copies before continuing." });
        return;
      }
      if (!response.ok && response.status < 500 && response.status !== 408) {
        delete pendingWrites.current[applicationId];
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "These observations were refused. Check the round and your access before retrying.";
        setRowStatus(applicationId, { kind: "error", message });
        return;
      }
      if (!response.ok || result?.kind !== "saved" || result.applicationId !== applicationId || result.mutationId !== request.mutationId) throw new Error("Unconfirmed save");
      saved.current[applicationId] = { ...saved.current[applicationId], ...result };
      delete pendingWrites.current[applicationId];
      if (signature(rowsRef.current[applicationId]) !== signature(request)) {
        cancelTimer(applicationId);
        void save(applicationId);
      } else {
        cancelTimer(applicationId);
        patchRow(applicationId, { scores: result.scores, note: result.note, savedAt: result.savedAt, quality: result.quality, revision: result.revision });
        setRowStatus(applicationId, { kind: "saved" });
      }
    } catch {
      setRowStatus(applicationId, { kind: "unknown", message: unknownMessage });
    } finally {
      delete inflight.current[applicationId];
      finish();
    }
  }

  function chooseCopy(applicationId: string, source: "local" | "server") {
    const snapshot = conflictsRef.current[applicationId];
    if (!snapshot || (source === "local" && readOnly)) return;
    choiceFocus.current = applicationId;
    cancelTimer(applicationId);
    saved.current[applicationId] = { ...saved.current[applicationId], ...snapshot };
    delete pendingWrites.current[applicationId]; delete conflictsRef.current[applicationId];
    setConflicts({ ...conflictsRef.current });
    if (source === "server") {
      patchRow(applicationId, snapshot);
      setRowStatus(applicationId, snapshot.savedAt ? { kind: "saved" } : { kind: "hint", message: "Server copy selected; no evidence saved yet." });
    } else { void save(applicationId); }
  }

  function downloadCopy(applicationId: string) {
    try {
      const data = { roundId: initial.roundId, applicationId, exportedAt: new Date().toISOString(), local: rowsRef.current[applicationId], lastConfirmed: saved.current[applicationId], conflictingServer: conflictsRef.current[applicationId] ?? null, unconfirmedRequest: pendingWrites.current[applicationId] ?? null };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "mecg-private-group-case-observations.json"; document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setCopyStatus((current) => ({ ...current, [applicationId]: "Private copy prepared. Check your download before leaving this page." }));
    } catch { setCopyStatus((current) => ({ ...current, [applicationId]: "Download could not start. Keep this page open and copy the observations you need." })); }
  }

  function cancelTimer(applicationId: string) {
    window.clearTimeout(timers.current[applicationId]);
    delete timers.current[applicationId];
  }

  function rate(applicationId: string, criterionId: string, score: number) {
    cancelTimer(applicationId);
    const row = rowsRef.current[applicationId];
    // Tapping the selected star again clears it: the criterion was not observed.
    const scores = { ...row.scores, [criterionId]: row.scores[criterionId] === score ? null : score };
    patchRow(applicationId, { scores });
    void save(applicationId);
  }

  function editNote(applicationId: string, note: string) {
    patchRow(applicationId, { note });
    cancelTimer(applicationId);
    const scores = rowsRef.current[applicationId].scores;
    setRowStatus(applicationId, pendingWrites.current[applicationId] && status[applicationId]?.kind === "unknown" ? { kind: "unknown", message: unknownMessage } : { kind: "hint", message: "Unsaved changes" });
    if (countScored(scores) === 0 && !note.trim() && !saved.current[applicationId].savedAt) return;
    timers.current[applicationId] = window.setTimeout(() => {
      delete timers.current[applicationId];
      void save(applicationId);
    }, NOTE_DEBOUNCE_MS);
  }

  function flushNote(applicationId: string) {
    if (!timers.current[applicationId]) return;
    cancelTimer(applicationId);
    const row = rowsRef.current[applicationId];
    if (countScored(row.scores) > 0 || row.note.trim() || saved.current[applicationId].savedAt) void save(applicationId);
  }

  function addFlag(applicationId: string, prefix: string, text: string) {
    const note = rowsRef.current[applicationId].note;
    const separator = note.length > 0 && !note.endsWith("\n") ? "\n" : "";
    editNote(applicationId, `${note}${separator}${prefix}: ${text}`);
    requestAnimationFrame(() => grow(document.getElementById(`group-case-note-${applicationId}`) as HTMLTextAreaElement | null));
  }

  return (
    <section className="grading-workspace group-case-workspace min-w-0 rounded-2xl bg-white p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-7">
      <div className="grading-workspace-heading"><h2>Observe your case team</h2><p aria-live="polite">Started grading {scored} of {total}</p></div>
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
          className="workspace-search min-h-12 w-full rounded-xl border border-mecg-navy/15 bg-white py-3 pl-12 pr-4 text-base text-mecg-navy outline-none transition focus:border-mecg-blue focus:ring-4 focus:ring-mecg-blue/10"
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-mecg-navy/60">
          Score only behavior you observed, from 1 to 5. Leave unobserved dimensions blank. Notes can be saved without scores.{" "}
          <Link onClick={checkRubricNavigation} href={`/member/calibration/${initial.roundId}?return=/member/group-case`} className="font-semibold text-mecg-blue underline">Read the rubric</Link>
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
          <p className="mt-2 text-sm leading-6 text-mecg-navy/65">Rate the behavior you observed. Use the anchors below for each dimension; a rating does not determine the admission decision.</p>
          <div className="mt-3 divide-y divide-mecg-navy/10">
            {initial.criteria.map((criterion) => (
              <details key={criterion.id} className="py-2">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">{criterion.name}</summary>
                <ol className="space-y-2 pb-2">
                  {Object.entries(groupCaseAnchors(criterion.name)).map(([score, anchor]) => (
                    <li key={score} className="flex gap-3 text-sm leading-6 text-mecg-navy/65">
                      <span className="tabular shrink-0 font-semibold text-mecg-navy">{score}</span><span>{anchor}</span>
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
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
      {readOnlyReason ? <div className="mt-4"><OperationNotice kind="info">{readOnlyReason}</OperationNotice></div> : initial.roundStatus === "FROZEN" && <div className="mt-4"><OperationNotice kind="info">This round is frozen. Ratings can no longer be changed.</OperationNotice></div>}
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
              const savedLabel = row.quality ? `Evidence saved · review ${row.quality.valid ? "qualifies" : "incomplete"}` : "Evidence saved · quality unavailable";
              const expanded = openId === applicationId;
              const rowReadOnly = readOnly || Boolean(conflicts[applicationId]);
              const bodyId = `group-case-${applicationId}`;
              return (
                <li key={applicationId} className={`-mx-2 rounded-xl px-2 py-3 ${scoredCount > 0 ? "bg-mecg-navy/[0.03]" : ""}`}>
                  <button
                    type="button"
                    id={`group-case-toggle-${applicationId}`}
                    aria-expanded={expanded}
                    aria-controls={bodyId}
                    onClick={() => toggleOpen(applicationId)}
                    className="flex w-full items-center gap-x-4 text-left"
                  >
                    <Headshot applicant={row} failed={failedHeadshots.has(applicationId)} onFail={() => markHeadshotFailed(applicationId)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-mecg-navy">{row.name}</span>
                      <span className="group-case-save-status mt-0.5 block min-h-4 text-xs text-mecg-navy/55" aria-live="polite">
                        {rowStatus?.kind === "saving" && "Saving…"}
                        {rowStatus?.kind === "saved" && savedLabel}
                        {rowStatus?.kind === "hint" && rowStatus.message}
                        {(rowStatus?.kind === "error" || rowStatus?.kind === "unknown" || rowStatus?.kind === "conflict") && <span className="font-semibold text-red-700">{rowStatus.message}</span>}
                        {!rowStatus && row.savedAt && savedLabel}
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
                    <span className="shrink-0 text-xs text-mecg-navy/65">{scoredCount} of {initial.criteria.length} rated</span>
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={`shrink-0 text-mecg-navy/65 ${expanded ? "rotate-180" : ""}`}><path d="m5 8 5 5 5-5" /></svg>
                  </button>
                  {expanded && (
                    <div id={bodyId} className="mt-3 pl-[3.75rem]">
                      {/* top = WorkspaceNav's top-3 (12px) + its 56px shell. */}
                      <div className="sticky top-0 z-10 -mx-2 flex items-center justify-between gap-3 bg-white/95 px-2 py-2 backdrop-blur">
                        <span className="text-sm font-semibold text-mecg-navy">{row.name}</span>
                        <span className="text-xs text-mecg-navy/60">{`${scoredCount} of ${initial.criteria.length} dimensions rated`}</span>
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
                                    disabled={rowReadOnly}
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
                                  <button type="button" disabled={rowReadOnly} onClick={() => rate(applicationId, criterion.id, current)} className="ml-2 text-xs font-semibold text-mecg-blue underline disabled:opacity-60">Clear</button>
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <textarea
                        id={`group-case-note-${applicationId}`}
                        rows={1}
                        value={row.note}
                        maxLength={4000}
                        disabled={rowReadOnly}
                        placeholder="Note (optional)"
                        aria-label={`Note for ${row.name}`}
                        ref={grow}
                        onInput={(event) => grow(event.currentTarget)}
                        onChange={(event) => editNote(applicationId, event.target.value)}
                        onBlur={() => flushNote(applicationId)}
                        className="mt-3 min-h-11 w-full resize-none rounded-xl bg-mecg-navy/[0.035] px-4 py-2.5 text-sm text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)] disabled:opacity-60"
                      />
                      <p className="my-2 text-sm leading-6 text-mecg-navy/65" aria-live="polite">
                        {rowStatus?.kind === "saving" || rowStatus?.kind === "hint" || rowStatus?.kind === "error" || rowStatus?.kind === "unknown" || rowStatus?.kind === "conflict"
                          ? "Changes are unconfirmed. Review quality will update after a confirmed save."
                          : row.savedAt ? groupCaseQualityMessage(row.quality) : "No evidence saved yet. Save only behavior you observed; unobserved dimensions can stay blank."}
                      </p>
                      {(rowStatus?.kind === "error" || rowStatus?.kind === "hint" || rowStatus?.kind === "unknown" || rowStatus?.kind === "conflict") && (
                        <div className="mt-2 text-sm text-mecg-navy/65">
                          <p className="font-semibold">{rowStatus.message}</p>
                          <p>These changes are only in this open page until a save is confirmed. Copy your note before leaving.</p>
                          <p className="mt-2">A private copy contains scores and notes. Download it before reloading or choosing a different copy.</p>
                          <button type="button" onClick={() => downloadCopy(applicationId)} className="button-secondary mt-2 mr-2 min-h-11 text-sm">Download observations</button>
                          <p role="status" className="mt-2">{copyStatus[applicationId]}</p>
                          {conflicts[applicationId] && <section role="alert" className="mt-3 border-y border-mecg-navy/15 py-3">
                            <h4 id={`group-case-conflict-${applicationId}`} tabIndex={-1} className="font-semibold">Choose which observations to keep</h4>
                            <div className="mt-3 grid min-w-0 gap-4 sm:grid-cols-2">{(["local", "server"] as const).map((source) => {
                              const copy = source === "local" ? row : conflicts[applicationId];
                              return <div key={source} className="min-w-0"><h5 className="font-semibold">{source === "local" ? "This page" : "Current server copy"}</h5><ul className="mt-2 space-y-1">{initial.criteria.map((criterion) => <li key={criterion.id}>{criterion.name}: {copy.scores[criterion.id] ?? "Not observed"}</li>)}</ul><p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{copy.note || "No note"}</p></div>;
                            })}</div>
                            <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={readOnly} onClick={() => chooseCopy(applicationId, "local")} className="button-primary">Keep this page’s observations</button><button type="button" onClick={() => chooseCopy(applicationId, "server")} className="button-secondary">Use current server copy</button></div>
                          </section>}

                          <button type="button" disabled={rowReadOnly || (rowStatus.kind !== "unknown" && scoredCount === 0 && !row.note.trim() && !row.savedAt)} onClick={() => { cancelTimer(applicationId); void save(applicationId, true); }} className="button-secondary mt-2 min-h-11 text-sm">Retry save</button>
                        </div>
                      )}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-mecg-navy/60">Add a flag</summary>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {FLAGS.map((flag) => (
                            <button
                              key={flag.text}
                              type="button"
                              disabled={rowReadOnly}
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
