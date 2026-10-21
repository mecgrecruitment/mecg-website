"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import OperationNotice from "@/components/operation-notice";
import Headshot from "@/components/applicant-headshot";
import RatingStar from "@/components/rating-star";
import TallyStrip from "@/components/tally-strip";
import { formatStars } from "@/app/admin/speed-dating-results";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import { createRetryBackoff } from "@/lib/retry-backoff";
import type { GroupCaseApplicant, GroupCaseRoster, GroupCaseScores } from "@/lib/group-case-roster";
import { GROUP_CASE_GREEN_FLAGS, GROUP_CASE_RED_FLAGS, groupCaseAnchors } from "@/lib/rubrics";
import { matchesApplicantName } from "@/lib/speed-dating-roster";
import { groupCaseQualityMessage } from "@/lib/group-case-roster";

import { parseGroupCaseWriteResult, type GroupCaseWriteRequest, type GroupCaseWriteSnapshot } from "@/lib/group-case-write";
import { firstToRate, holdsOpenRow, isUnstarted, keyRating, nextApplicantId, showsWhenUnstartedOnly, unstartedIds } from "./grading-flow";

const SCORES = [1, 2, 3, 4, 5];
const NOTE_DEBOUNCE_MS = 800;
const ALL_TABLES = "all";
const FLAGS = [
  ...GROUP_CASE_RED_FLAGS.map((text) => ({ text, prefix: "Red flag", className: "bg-danger-wash text-danger" })),
  ...GROUP_CASE_GREEN_FLAGS.map((text) => ({ text, prefix: "Green flag", className: "bg-success-wash text-success" })),
];

type RowStatus = { kind: "saving" | "saved" } | { kind: "error" | "hint" | "unknown" | "conflict"; message: string };

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

// Arrow keys move between one dimension's stars; Tab moves between dimensions.
function roveStars(event: ReactKeyboardEvent<HTMLDivElement>) {
  const stars = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(".rating-button")];
  const at = stars.indexOf(event.target as HTMLButtonElement);
  if (at === -1) return;
  const to = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: stars.length - 1 }[event.key];
  if (to === undefined || !stars[to]) return;
  event.preventDefault();
  stars[to].focus();
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
  const [lastRated, setLastRated] = useState<string | null>(null);
  const [heldOpen, setHeldOpen] = useState<string | null>(null);
  // Applicants that were unstarted when the filter went on; null shows everyone.
  const [unstartedSnapshot, setUnstartedSnapshot] = useState<Set<string> | null>(null);
  // criterionId null focuses the applicant's toggle instead of a star.
  const focusAfterOpen = useRef<{ applicationId: string; criterionId: string | null } | null>(null);
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
  // Resends only the same unconfirmed request, a few times, then waits for Retry save.
  const [backoff] = useState(() => createRetryBackoff());

  const readOnly = Boolean(readOnlyReason) || initial.roundStatus !== "ACTIVE" || initial.criteria.length === 0;
  const everyone = useMemo(() => initial.groups.flatMap((group) => group.applicants), [initial.groups]);
  const showGroupHeadings = !(initial.groups.length === 1 && initial.groups[0].groupId === null);
  const tables = useMemo(() => initial.groups.filter((group) => group.groupId !== null), [initial.groups]);
  const showTables = tables.length > 1;
  const tableGroups = useMemo(() => showTables && table !== null
    ? initial.groups.filter((group) => group.groupId === table)
    : initial.groups, [initial.groups, showTables, table]);
  const visibleGroups = useMemo(() => tableGroups
    .map((group) => ({ ...group, applicants: group.applicants.filter(({ applicationId, name }) =>
      matchesApplicantName(name, query) && showsWhenUnstartedOnly(applicationId, unstartedSnapshot, rows[applicationId])) }))
    .filter((group) => group.applicants.length > 0), [tableGroups, query, unstartedSnapshot, rows]);
  const order = visibleGroups.flatMap((group) => group.applicants.map(({ applicationId }) => applicationId));
  const tableApplicants = tableGroups.flatMap((group) => group.applicants);
  const unstartedCount = tableApplicants.filter(({ applicationId }) => isUnstarted(rows[applicationId])).length;
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
    return () => {
      window.removeEventListener("keydown", focusSearch);
      backoff.resetAll();
    };
  }, [backoff]);

  // A note still waiting on its debounce is sent when the grader leaves, not dropped.
  // Client-side navigation fires neither beforeunload nor pagehide, so unmount flushes too.
  const flushAllRef = useRef(() => {});
  useEffect(() => {
    flushAllRef.current = () => Object.keys(timers.current).forEach((applicationId) => flushNote(applicationId));
  });
  useEffect(() => {
    const flushAll = () => flushAllRef.current();
    window.addEventListener("pagehide", flushAll);
    return () => {
      window.removeEventListener("pagehide", flushAll);
      flushAll();
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
    const target = focusAfterOpen.current;
    if (!target) return;
    focusAfterOpen.current = null;
    const toggle = document.getElementById(`group-case-toggle-${target.applicationId}`);
    toggle?.scrollIntoView({ block: "start" });
    const star = target.criterionId === null ? null : document.getElementById(`group-case-${target.applicationId}`)?.querySelector<HTMLElement>(`[data-criterion-id="${CSS.escape(target.criterionId)}"] .rating-button[tabindex='0']:not(:disabled)`);
    (star ?? toggle)?.focus({ preventScroll: true });
  }, [openId]);

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

  // Reconnecting resends the same unconfirmed request, exactly as Retry save does.
  useEffect(() => {
    function retryUnconfirmed() {
      for (const applicationId of Object.keys(pendingWrites.current)) {
        if (applicationId in inflight.current) continue;
        backoff.reset(applicationId);
        void save(applicationId, true);
      }
    }
    window.addEventListener("online", retryUnconfirmed);
    return () => window.removeEventListener("online", retryUnconfirmed);
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
  function unconfirmed(applicationId: string): RowStatus {
    return {
      kind: "unknown",
      message: backoff.scheduled(applicationId)
        ? "Save could not be confirmed. It may already be saved. Retrying… Newer observations remain on this page."
        : "Save could not be confirmed. It may already be saved. Newer observations remain on this page. Retry save confirms the earlier request before sending newer changes.",
    };
  }
  async function save(applicationId: string, retry = false) {
    const active = inflight.current[applicationId];
    if (active) {
      await active;
      return save(applicationId);
    }
    if (readOnly) return;
    if (conflictsRef.current[applicationId]) return;
    const previous = pendingWrites.current[applicationId];
    if (previous && !retry) { setRowStatus(applicationId, unconfirmed(applicationId)); return; }
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
        backoff.reset(applicationId);
        conflictsRef.current[applicationId] = result.snapshot;
        conflictFocus.current = applicationId;
        // Keep the grader's filters; loosen one only if it hides this applicant.
        const { name } = rowsRef.current[applicationId];
        const groupId = initial.groups.find((group) => group.applicants.some((applicant) => applicant.applicationId === applicationId))?.groupId ?? null;
        setQuery((current) => matchesApplicantName(name, current) ? current : "");
        setTable((current) => current === null || current === groupId ? current : null);
        setUnstartedSnapshot((current) => current && !showsWhenUnstartedOnly(applicationId, current, rowsRef.current[applicationId]) ? null : current);
        setOpenId(applicationId);
        setConflicts({ ...conflictsRef.current });
        setRowStatus(applicationId, { kind: "conflict", message: "Saved observations changed elsewhere. Compare both copies before continuing." });
        return;
      }
      if (!response.ok && response.status < 500 && response.status !== 408) {
        delete pendingWrites.current[applicationId];
        backoff.reset(applicationId);
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "These observations were refused. Check the round and your access before retrying.";
        setRowStatus(applicationId, { kind: "error", message });
        return;
      }
      if (!response.ok || result?.kind !== "saved" || result.applicationId !== applicationId || result.mutationId !== request.mutationId) throw new Error("Unconfirmed save");
      saved.current[applicationId] = { ...saved.current[applicationId], ...result };
      delete pendingWrites.current[applicationId];
      backoff.reset(applicationId);
      if (signature(rowsRef.current[applicationId]) !== signature(request)) {
        cancelTimer(applicationId);
        void save(applicationId);
      } else {
        cancelTimer(applicationId);
        patchRow(applicationId, { scores: result.scores, note: result.note, savedAt: result.savedAt, quality: result.quality, revision: result.revision });
        setRowStatus(applicationId, { kind: "saved" });
      }
    } catch {
      // Only the same request is resent; a refusal, conflict or newer confirmation drops it.
      backoff.schedule(applicationId, () => {
        if (pendingWrites.current[applicationId]?.mutationId === request.mutationId && !inflight.current[applicationId]) void save(applicationId, true);
      });
      setRowStatus(applicationId, unconfirmed(applicationId));
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

  // Save the open row through the usual path, then open the next applicant in view.
  // At the end of the list the row closes and focus returns to the first applicant.
  function advance(applicationId: string) {
    if (holdsOpenRow(status[applicationId])) {
      setHeldOpen(applicationId);
      const retry = document.getElementById(`group-case-retry-${applicationId}`) as HTMLButtonElement | null;
      (retry && !retry.disabled ? retry : document.getElementById(`group-case-conflict-${applicationId}`) ?? document.getElementById(`group-case-download-${applicationId}`))?.focus();
      return;
    }
    if (!readOnly && !conflictsRef.current[applicationId]) flushNote(applicationId);
    const nextId = nextApplicantId(order, applicationId);
    const target = nextId ?? order[0];
    if (!target) return;
    focusAfterOpen.current = { applicationId: target, criterionId: nextId === null ? null : firstToRate(initial.criteria.map((criterion) => criterion.id), rowsRef.current[target].scores) };
    setOpenId(nextId);
  }

  function focusCriterion(applicationId: string, criterionId: string | null) {
    const body = document.getElementById(`group-case-${applicationId}`);
    const target = criterionId === null
      ? document.getElementById(`group-case-next-${applicationId}`)
      : body?.querySelector<HTMLElement>(`[data-criterion-id="${CSS.escape(criterionId)}"] .rating-button[tabindex='0']`);
    target?.focus();
  }

  function rate(applicationId: string, criterionId: string, score: number) {
    cancelTimer(applicationId);
    const row = rowsRef.current[applicationId];
    // Tapping the selected star again clears it: the criterion was not observed.
    const scores = { ...row.scores, [criterionId]: row.scores[criterionId] === score ? null : score };
    patchRow(applicationId, { scores });
    setLastRated(`${applicationId}:${criterionId}:${scores[criterionId]}`);
    void save(applicationId);
  }

  function editNote(applicationId: string, note: string) {
    patchRow(applicationId, { note });
    cancelTimer(applicationId);
    const scores = rowsRef.current[applicationId].scores;
    setRowStatus(applicationId, pendingWrites.current[applicationId] && status[applicationId]?.kind === "unknown" ? unconfirmed(applicationId) : { kind: "hint", message: "Unsaved changes" });
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
    <section className="grading-workspace group-case-workspace min-w-0 rounded-xl bg-white p-5 inset-ring inset-ring-line sm:p-7">
      <div className="grading-workspace-heading"><h2>Observe your case team</h2></div>
      <TallyStrip caption={`Started grading ${scored} of ${total}`} items={tableApplicants.map(({ applicationId }) => {
        const row = rows[applicationId];
        return { id: applicationId, state: row.quality?.valid ? "done" : countScored(row.scores) > 0 || row.savedAt ? "partial" : "empty" };
      })} />
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
                className={`min-h-12 shrink-0 rounded-xl px-3 py-2 text-left transition-[background-color,box-shadow,scale] active:scale-[0.96] ${selected ? "bg-mecg-navy text-white" : "bg-white text-mecg-navy inset-ring inset-ring-line"}`}
              >
                <span className="block text-sm font-semibold">{chip.groupName}</span>
                <span className={`mt-0.5 block text-xs ${selected ? "text-white/70" : "text-muted"}`}>{chip.count} {chip.count === 1 ? "applicant" : "applicants"}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 basis-60">
        <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
          className="workspace-search min-h-12 w-full rounded-xl border border-line bg-white py-3 pl-12 pr-4 text-base text-mecg-navy outline-none transition focus:border-mecg-blue focus:ring-4 focus:ring-mecg-blue/10"
        />
      </div>
        <button
          type="button"
          aria-pressed={!!unstartedSnapshot}
          disabled={!unstartedSnapshot && unstartedCount === 0}
          onClick={() => setUnstartedSnapshot((current) => current ? null : unstartedIds(rowsRef.current))}
          className="group-case-filter"
        >
          Unstarted only ({unstartedCount})
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-muted">
          Score only behavior you observed, from 1 to 5. Leave unobserved dimensions blank. Notes can be saved without scores.{" "}
          <Link onClick={checkRubricNavigation} href={`/member/calibration/${initial.roundId}?return=/member/group-case`} className="font-semibold text-mecg-blue underline">Read the rubric</Link>
        </p>
        <button type="button" onClick={() => dialogRef.current?.showModal()} className="button-secondary shrink-0 text-sm">Rubric</button>
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby="group-case-rubric-title"
        onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current.close(); }}
        className="m-auto w-[min(92vw,32rem)] max-h-[85vh] rounded-xl bg-white p-0 text-mecg-navy backdrop:bg-mecg-navy/40"
      >
        <div className="max-h-[85vh] overflow-y-auto p-5">
          <h3 id="group-case-rubric-title" className="text-lg font-semibold">Group Case rubric</h3>
          <p className="mt-2 text-sm leading-6 text-muted">Rate the behavior you observed. Use the anchors below for each dimension; a rating does not determine the admission decision.</p>
          <div className="mt-3 divide-y divide-line">
            {initial.criteria.map((criterion) => (
              <details key={criterion.id} className="py-2">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">{criterion.name}</summary>
                <ol className="space-y-2 pb-2">
                  {Object.entries(groupCaseAnchors(criterion.name)).map(([score, anchor]) => (
                    <li key={score} className="flex gap-3 text-sm leading-6 text-muted">
                      <span className="tabular shrink-0 font-semibold text-mecg-navy">{score}</span><span>{anchor}</span>
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
          <h4 className="mt-4 text-sm font-semibold text-danger">Red flags</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
            {GROUP_CASE_RED_FLAGS.map((flag) => <li key={flag}>{flag}</li>)}
          </ul>
          <h4 className="mt-4 text-sm font-semibold text-success">Green flags</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
            {GROUP_CASE_GREEN_FLAGS.map((flag) => <li key={flag}>{flag}</li>)}
          </ul>
          <button type="button" onClick={() => dialogRef.current?.close()} className="button-secondary mt-5 text-sm">Close</button>
        </div>
      </dialog>

      {initial.roundStatus === "PUBLISHED" && <div className="mt-4"><OperationNotice kind="info">Grading opens when the board starts the round.</OperationNotice></div>}
      {readOnlyReason ? <div className="mt-4"><OperationNotice kind="info">{readOnlyReason}</OperationNotice></div> : initial.roundStatus === "FROZEN" && <div className="mt-4"><OperationNotice kind="info">This round is frozen. Ratings can no longer be changed.</OperationNotice></div>}
      {initial.criteria.length === 0 && <div className="mt-4"><OperationNotice kind="error">The Board must configure the Group Case rubric before grading can begin.</OperationNotice></div>}

      {visibleGroups.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-line px-5 py-8 text-center">
          <p className="font-semibold text-mecg-navy">{everyone.length === 0 ? "No applicants are enrolled yet" : query.trim() ? `No applicant matches “${query.trim()}”` : "Everyone here is started"}</p>
          <p className="mt-1 text-sm text-muted">{everyone.length === 0 ? "Applicants appear here once the Board moves them into Group Case." : query.trim() ? "Check the spelling or try their other name." : "Turn off Unstarted only to see every applicant."}</p>
        </div>
      )}
      {visibleGroups.map((group) => (
        <section key={group.groupId ?? "ungrouped"} className="mt-5" aria-label={group.groupName}>
          {showGroupHeadings && <h3 className="text-sm font-semibold text-mecg-navy">{group.groupName}</h3>}
          <ul className="mt-2 divide-y divide-line">
            {group.applicants.map(({ applicationId }) => {
              const row = rows[applicationId];
              const rowStatus = status[applicationId];
              const scoredCount = countScored(row.scores);
              const savedLabel = row.quality ? `Evidence saved · review ${row.quality.valid ? "qualifies" : "incomplete"}` : "Evidence saved · quality unavailable";
              const expanded = openId === applicationId;
              const rowReadOnly = readOnly || Boolean(conflicts[applicationId]);
              const bodyId = `group-case-${applicationId}`;
              const criterionIds = initial.criteria.map((criterion) => criterion.id);
              const firstUnscored = criterionIds.find((id) => (row.scores[id] ?? null) === null);
              const nextId = expanded ? nextApplicantId(order, applicationId) : null;
              const onKeys = (event: ReactKeyboardEvent<HTMLLIElement>) => {
                if (!expanded || rowReadOnly || event.repeat || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
                if (event.metaKey || event.ctrlKey || event.altKey) return;
                const focusedId = (event.target as HTMLElement).closest<HTMLElement>("[data-criterion-id]")?.dataset.criterionId ?? null;
                const hit = keyRating(event.key, { criterionIds, scores: row.scores, focusedId });
                if (!hit) return;
                event.preventDefault();
                rate(applicationId, hit.criterionId, hit.score);
                focusCriterion(applicationId, hit.focusNextId);
              };
              return (
                <li key={applicationId} onKeyDown={onKeys} className={`group-case-row -mx-2 rounded-xl px-2 py-3 ${scoredCount > 0 ? "bg-wash" : ""}`}>
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
                      <span className="group-case-save-status mt-0.5 block min-h-4 text-xs text-muted" aria-live="polite">
                        {rowStatus?.kind === "saving" && "Saving…"}
                        {rowStatus?.kind === "saved" && savedLabel}
                        {rowStatus?.kind === "hint" && rowStatus.message}
                        {(rowStatus?.kind === "error" || rowStatus?.kind === "unknown" || rowStatus?.kind === "conflict") && <span className="font-semibold text-danger">{rowStatus.message}</span>}
                        {!rowStatus && row.savedAt && savedLabel}
                      </span>
                    </span>
                    {row.speedDating && (
                      <span
                        className="inline-flex shrink-0 items-center rounded-full bg-warning-wash px-2.5 py-0.5 text-xs font-semibold text-warning"
                        title={`${row.speedDating.count} Speed Dating ${row.speedDating.count === 1 ? "grader" : "graders"}`}
                      >
                        {formatStars(row.speedDating.adjusted)}
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-muted">{scoredCount} of {initial.criteria.length} rated</span>
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={`shrink-0 text-muted ${expanded ? "rotate-180" : ""}`}><path d="m5 8 5 5 5-5" /></svg>
                  </button>
                  {expanded && (
                    <div id={bodyId} className="mt-3 pl-[3.75rem]">
                      {/* top = WorkspaceNav's top-3 (12px) + its 56px shell. */}
                      <div className="sticky top-0 z-10 -mx-2 flex items-center justify-between gap-3 bg-white/95 px-2 py-2 backdrop-blur">
                        <span className="text-sm font-semibold text-mecg-navy">{row.name}</span>
                        <span className="text-xs text-muted">{`${scoredCount} of ${initial.criteria.length} dimensions rated`}</span>
                      </div>
                      <div className="divide-y divide-line">
                        {initial.criteria.map((criterion) => {
                          const current = row.scores[criterion.id] ?? null;
                          return (
                            <div key={criterion.id} data-criterion-id={criterion.id} data-next={criterion.id === firstUnscored || undefined} className="group-case-criterion py-3">
                              <details>
                                <summary className="flex list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                                  <span className="text-sm font-semibold text-mecg-navy">{criterion.name}</span>
                                  {criterion.description && (
                                    <span className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full bg-wash text-xs font-semibold text-mecg-navy" aria-label="What this measures">?</span>
                                  )}
                                </summary>
                                {criterion.description && <p className="mt-1 text-xs leading-5 text-muted">{criterion.description}</p>}
                              </details>
                              <div className="mt-1 flex items-center" role="group" aria-label={`${row.name}, ${criterion.name}`} aria-keyshortcuts={rowReadOnly ? undefined : "1 2 3 4 5"} onKeyDown={roveStars}>
                                {SCORES.map((score) => (
                                  <button
                                    key={score}
                                    type="button"
                                    tabIndex={score === (current ?? SCORES[0]) ? 0 : -1}
                                    disabled={rowReadOnly}
                                    aria-pressed={current === score}
                                    aria-label={`${score}, ${groupCaseAnchors(criterion.name)[score]}`}
                                    onClick={() => rate(applicationId, criterion.id, score)}
                                    className="rating-button"
                                  >
                                    <RatingStar state={current !== null && score <= current ? "filled" : "empty"} pop={current === score && lastRated === `${applicationId}:${criterion.id}:${score}`} />
                                  </button>
                                ))}
                                {!rowReadOnly && <kbd aria-hidden="true" className="group-case-keys">1–5</kbd>}
                              </div>
                              {current !== null && (
                                <p className="mt-0.5 text-xs leading-5 text-muted">
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
                        className="mt-3 min-h-11 w-full resize-none rounded-xl bg-wash px-4 py-2.5 text-sm text-mecg-navy inset-ring inset-ring-line-strong outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)] disabled:opacity-60"
                      />
                      <p className="my-2 text-sm leading-6 text-muted" aria-live="polite">
                        {rowStatus?.kind === "saving" || rowStatus?.kind === "hint" || rowStatus?.kind === "error" || rowStatus?.kind === "unknown" || rowStatus?.kind === "conflict"
                          ? "Changes are unconfirmed. Review quality will update after a confirmed save."
                          : row.savedAt ? groupCaseQualityMessage(row.quality) : "No evidence saved yet. Save only behavior you observed; unobserved dimensions can stay blank."}
                      </p>
                      {(rowStatus?.kind === "error" || rowStatus?.kind === "unknown" || rowStatus?.kind === "conflict") && (
                        <div className="mt-2 text-sm text-muted">
                          <p className="font-semibold">{rowStatus.message}</p>
                          <p>These changes are only in this open page until a save is confirmed. Copy your note before leaving.</p>
                          <p className="mt-2">A private copy contains scores and notes. Download it before reloading or choosing a different copy.</p>
                          <button type="button" id={`group-case-download-${applicationId}`} onClick={() => downloadCopy(applicationId)} className="button-secondary mt-2 mr-2 min-h-11 text-sm">Download observations</button>
                          <p role="status" className="mt-2">{copyStatus[applicationId]}</p>
                          {conflicts[applicationId] && <section role="alert" className="mt-3 border-y border-line py-3">
                            <h4 id={`group-case-conflict-${applicationId}`} tabIndex={-1} className="font-semibold">Choose which observations to keep</h4>
                            <div className="mt-3 grid min-w-0 gap-4 sm:grid-cols-2">{(["local", "server"] as const).map((source) => {
                              const copy = source === "local" ? row : conflicts[applicationId];
                              return <div key={source} className="min-w-0"><h5 className="font-semibold">{source === "local" ? "This page" : "Current server copy"}</h5><ul className="mt-2 space-y-1">{initial.criteria.map((criterion) => <li key={criterion.id}>{criterion.name}: {copy.scores[criterion.id] ?? "Not observed"}</li>)}</ul><p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{copy.note || "No note"}</p></div>;
                            })}</div>
                            <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={readOnly} onClick={() => chooseCopy(applicationId, "local")} className="button-primary">Keep this page’s observations</button><button type="button" onClick={() => chooseCopy(applicationId, "server")} className="button-secondary">Use current server copy</button></div>
                          </section>}

                          <button type="button" id={`group-case-retry-${applicationId}`} disabled={rowReadOnly || (rowStatus.kind !== "unknown" && scoredCount === 0 && !row.note.trim() && !row.savedAt)} onClick={() => { cancelTimer(applicationId); backoff.reset(applicationId); void save(applicationId, true); }} className="button-secondary mt-2 min-h-11 text-sm">Retry save</button>
                        </div>
                      )}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-muted">Add a flag</summary>
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
                      <p role="status" className="mt-4 text-sm font-semibold text-danger empty:mt-0">{heldOpen === applicationId && holdsOpenRow(rowStatus) ? "This applicant's save isn't confirmed. Retry or download before moving on." : ""}</p>
                      <button
                        type="button"
                        id={`group-case-next-${applicationId}`}
                        onClick={() => advance(applicationId)}
                        className="button-secondary mt-4 min-h-11 max-w-full text-sm"
                      >
                        {nextId ? <><span className="truncate">Next: {rows[nextId].name}</span><span aria-hidden="true">→</span></> : "Back to top"}
                      </button>
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
