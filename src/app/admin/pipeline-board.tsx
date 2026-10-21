"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DragStart,
  type DraggableProvidedDragHandleProps,
  type DropResult,
} from "@hello-pangea/dnd";
import { advancementReceipt, canSelectForAdvancement, snapshotAdvancement } from "./pipeline-selection";
import PipelineStatusForm from "./pipeline-status-form";
import {
  KANBAN_TRACK_CLASS_NAME,
  canMoveApplication,
  kanbanDropStatuses,
  moveApplicationInBoard,
  moveApplicationRequest,
} from "./pipeline-kanban";
import StatusPill from "@/components/status-pill";
import SegmentedControl from "@/components/segmented-control";
import { initials } from "@/lib/initials";
import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { applicationStatusLabel } from "@/lib/labels";
import { canonicalMajor } from "@/lib/major";
import {
  DECIDED_PIPELINE_STATUSES,
  PIPELINE_STATUSES,
  isPipelineStatus,
  type PipelineStatus,
} from "@/lib/workflow";
import { authorizedFetch, fetchJsonWithTimeout, RequestTimeoutError } from "@/lib/client-fetch";

type PipelineApplication = {
  id: string;
  status: PipelineStatus;
  name: string;
  contact: string;
  major: string;
  submittedAt: string;
  submittedLabel: string;
  hasResume: boolean;
  hasHeadshot: boolean;
};

type ApplicantView = "ALL" | "PIPELINE";
type ResumeFilter = "ALL" | "ON_FILE" | "MISSING";
type StatusFilter = "ALL" | PipelineStatus;
type RosterSort = "NAME" | "MAJOR" | "NEWEST" | "OLDEST";

function rosterLocation(params: Pick<URLSearchParams, "get">): { view: ApplicantView; query: string; statusFilter: StatusFilter; resumeFilter: ResumeFilter; sort: RosterSort; showDecided: boolean } {
  const filter = params.get("filter");
  const resume = params.get("resume");
  const order = params.get("sort");
  return {
    view: params.get("view") === "PIPELINE" ? "PIPELINE" : "ALL",
    query: params.get("query") ?? "",
    statusFilter: filter && isPipelineStatus(filter) ? filter : "ALL",
    resumeFilter: resume === "ON_FILE" || resume === "MISSING" ? resume : filter === "MISSING_RESUME" ? "MISSING" : "ALL",
    sort: order === "MAJOR" || order === "NEWEST" || order === "OLDEST" ? order : "NAME",
    showDecided: params.get("decided") === "1",
  };
}

const ACTIVE_STATUSES = PIPELINE_STATUSES.filter((status) => !DECIDED_PIPELINE_STATUSES.has(status));
// Columns bigger than this get their own search box.
const COLUMN_SEARCH_THRESHOLD = 8;

function matchesApplicant(application: { name: string; contact: string }, term: string) {
  return application.name.toLowerCase().includes(term) || application.contact.toLowerCase().includes(term);
}
const DECIDED_STATUSES = PIPELINE_STATUSES.filter((status) => DECIDED_PIPELINE_STATUSES.has(status));

function ApplicantCard({
  application,
  canOperate,
  canAdvance,
  cycleId,
  controlId,
  returnTo,
  dragHandleProps,
  dragHandleRef,
  isDragging = false,
  isMoving = false,
}: {
  application: PipelineApplication;
  canOperate: boolean;
  canAdvance: boolean;
  cycleId: string;
  controlId: string;
  returnTo: string;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  dragHandleRef?: (element: HTMLButtonElement | null) => void;
  isDragging?: boolean;
  isMoving?: boolean;
}) {
  // Plain <img>: same-origin route, no images.remotePatterns configured, and the
  // initials stay as the fallback for a missing or unreadable photo.
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <div className={`flex flex-col gap-2 rounded-xl bg-white p-3 transition-[box-shadow,opacity] ${isDragging ? "shadow-pop" : "shadow-xs"} ${isMoving ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2">
        {dragHandleProps && (
          <button
            type="button"
            ref={dragHandleRef}
            {...dragHandleProps}
            data-drag-handle-id={application.id}
            aria-label={`Move ${application.name}`}
            className="hidden h-10 w-10 shrink-0 touch-none items-center justify-center rounded-lg text-muted transition-[background-color,transform] hover:bg-mecg-blue/10 hover:text-mecg-navy active:scale-[0.96] sm:inline-flex"
          >
            <svg width="16" height="18" viewBox="0 0 16 18" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="4" r="1.25" />
              <circle cx="11" cy="4" r="1.25" />
              <circle cx="5" cy="9" r="1.25" />
              <circle cx="11" cy="9" r="1.25" />
              <circle cx="5" cy="14" r="1.25" />
              <circle cx="11" cy="14" r="1.25" />
            </svg>
          </button>
        )}
        {application.hasHeadshot && !photoFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- authorized same-origin route, no images.remotePatterns
          <img
            src={`/api/admin/applications/${application.id}/headshot`}
            alt=""
            onError={() => setPhotoFailed(true)}
            className="h-[26px] w-[26px] shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-mecg-navy text-xs font-semibold text-white">
            {initials(application.name)}
          </span>
        )}
        <Link href={withWorkspaceCycle(`/admin/applications/${application.id}?${new URLSearchParams({ returnTo })}`, cycleId)} className="inline-flex min-h-10 items-center text-[13px] font-semibold text-mecg-navy hover:underline">
          {application.name}
        </Link>
      </div>
      <p className="flex items-center gap-1 text-xs text-muted">
        {application.hasResume ? (
          <>
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0 text-muted" aria-hidden="true">
              <path d="M4 10.5l4 4 8-9" />
            </svg>
            <span className="text-muted">Resume on file</span>
          </>
        ) : (
          "No resume"
        )}
      </p>
      {canOperate && (
        <PipelineStatusForm
          applicationId={application.id}
          cycleId={cycleId}
          status={application.status}
          controlId={controlId}
          compact
          disabled={isMoving}
          canAdvance={canAdvance}
        />
      )}
    </div>
  );
}

function ApplicantRoster({
  applications,
  total,
  canAdvance,
  cycleId,
  statusFilter,
  resumeFilter,
  sort,
  onStatusFilterChange,
  onResumeFilterChange,
  onSortChange,
  selectedIds,
  onToggleSelected,
  selectionPending,
  returnTo,
}: {
  applications: PipelineApplication[];
  total: number;
  canAdvance: boolean;
  cycleId: string;
  statusFilter: StatusFilter;
  resumeFilter: ResumeFilter;
  sort: RosterSort;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onResumeFilterChange: (filter: ResumeFilter) => void;
  onSortChange: (sort: RosterSort) => void;
  selectedIds: Set<string>;
  onToggleSelected: (applicationId: string) => void;
  selectionPending: boolean;
  returnTo: string;
}) {
  return (
    <div className="mt-4">
      <div className="applicant-roster-toolbar flex flex-wrap items-end justify-between gap-3 rounded-xl bg-wash p-3.5 inset-ring inset-ring-line">
        <div className="flex flex-wrap gap-3">
          <label className="text-xs font-medium text-muted">
            <span className="mb-1 block">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                const value = event.target.value;
                onStatusFilterChange(isPipelineStatus(value) ? value : "ALL");
              }}
              className="select-control w-48 text-sm"
            >
              <option value="ALL">All statuses</option>
              {PIPELINE_STATUSES.map((status) => (
                <option key={status} value={status}>{applicationStatusLabel(status)}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted">
            <span className="mb-1 block">Resume</span>
            <select
              value={resumeFilter}
              onChange={(event) => {
                const value = event.target.value;
                onResumeFilterChange(value === "ON_FILE" || value === "MISSING" ? value : "ALL");
              }}
              className="select-control w-48 text-sm"
            >
              <option value="ALL">All resumes</option>
              <option value="ON_FILE">Resume on file</option>
              <option value="MISSING">Missing resume</option>
            </select>
          </label>
          <label className="text-xs font-medium text-muted">
            <span className="mb-1 block">Sort</span>
            <select
              value={sort}
              onChange={(event) => {
                const value = event.target.value;
                onSortChange(value === "MAJOR" || value === "NEWEST" || value === "OLDEST" ? value : "NAME");
              }}
              className="select-control w-48 text-sm"
            >
              <option value="NAME">Name (A-Z)</option>
              <option value="MAJOR">Major (A-Z)</option>
              <option value="NEWEST">Date applied (newest)</option>
              <option value="OLDEST">Date applied (oldest)</option>
            </select>
          </label>
        </div>
        <p className="text-sm text-muted" aria-live="polite">Showing {applications.length} of {total}</p>
      </div>

      {applications.length ? (
        <ul className="applicant-roster mt-3 flex flex-col gap-2" aria-label="All applicants">
          {applications.map((application) => (
            <li key={application.id} className={`applicant-roster-row grid gap-3 rounded-xl bg-white p-4 inset-ring inset-ring-line md:items-center ${canAdvance ? "md:grid-cols-[auto_minmax(0,1.5fr)_minmax(140px,0.75fr)_minmax(130px,0.65fr)_auto]" : "md:grid-cols-[minmax(0,1.5fr)_minmax(140px,0.75fr)_minmax(130px,0.65fr)_auto]"}`}>
              {canAdvance && (canSelectForAdvancement(application.status) ? (
                  <label className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-muted">
                    <input
                      type="checkbox"
                      disabled={selectionPending}
                      checked={selectedIds.has(application.id)}
                      onChange={() => onToggleSelected(application.id)}
                      className="h-5 w-5 accent-mecg-navy"
                    />
                    <span className="sr-only">Select {application.name}</span>
                  </label>
                ) : <span aria-hidden="true" />)}
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mecg-navy text-xs font-semibold text-white">
                  {initials(application.name)}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-mecg-navy">{application.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{[application.contact, canonicalMajor(application.major)].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <div>
                <StatusPill tone="orange">{applicationStatusLabel(application.status)}</StatusPill>
                <p className="mt-1 text-xs text-muted">
                  Submitted <time dateTime={application.submittedAt}>{application.submittedLabel}</time>
                </p>
              </div>
              <p className={`text-xs font-medium ${application.hasResume ? "text-muted" : "text-mecg-orange-ink"}`}>
                {application.hasResume ? "Resume on file" : "Missing resume"}
              </p>
              <Link href={withWorkspaceCycle(`/admin/applications/${application.id}?${new URLSearchParams({ returnTo })}`, cycleId)} aria-label={`Open file for ${application.name}`} className="inline-flex min-h-11 items-center justify-end gap-2 text-xs font-semibold text-mecg-navy hover:underline">
                Open file <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl border-[1.5px] border-dashed border-line p-8 text-center text-sm text-muted">
          {total === 0 ? "No submitted applicants in this cycle yet." : "No applicants match these filters. Change the search, status or resume filter to see more."}
        </p>
      )}
    </div>
  );
}

function PipelineBoardInner({
  applications,
  canOperate,
  canAdvance,
  cycleId,
  referralCount,
}: {
  applications: PipelineApplication[];
  canOperate: boolean;
  canAdvance: boolean;
  cycleId: string;
  referralCount: number;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const location = rosterLocation(searchParams);
  const locationKey = JSON.stringify(location);
  const [lastLocationKey, setLastLocationKey] = useState(locationKey);
  const [boardApplications, setBoardApplications] = useState(applications);
  const [applicationSource, setApplicationSource] = useState(applications);
  const [view, setView] = useState<ApplicantView>(location.view);
  const [query, setQuery] = useState(location.query);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(location.statusFilter);
  const [resumeFilter, setResumeFilter] = useState<ResumeFilter>(location.resumeFilter);
  const [sort, setSort] = useState<RosterSort>(location.sort);
  const [showDecided, setShowDecided] = useState(location.showDecided);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [advanceReview, setAdvanceReview] = useState<ReturnType<typeof snapshotAdvancement> | null>(null);
  const [showSelected, setShowSelected] = useState(false);
  const advanceReviewRef = useRef<HTMLDivElement>(null);
  const advanceTriggerRef = useRef<HTMLButtonElement>(null);
  const advanceResultRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (advanceReview) {
      advanceReviewRef.current?.focus();
      advanceReviewRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [advanceReview]);
  const [advancePending, setAdvancePending] = useState(false);
  const [advanceNotice, setAdvanceNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  useEffect(() => {
    if (advanceNotice && !advancePending && !advanceReview) advanceResultRef.current?.focus();
  }, [advanceNotice, advancePending, advanceReview]);
  const [draggingApplicationId, setDraggingApplicationId] = useState<string | null>(null);
  const [movingIds, setMovingIds] = useState<Set<string>>(new Set());
  const [pendingMoveTargets, setPendingMoveTargets] = useState<Map<string, PipelineStatus>>(new Map());
  const [moveNotice, setMoveNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const dragHandleElements = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    // An explicit attention click also resets local filters when its URL is
    // already current. Scope this to the same page/cohort and leave selection
    // and in-flight mutation state intact.
    const openQueue = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || !(event.target instanceof Element)) return;
      const link = event.target.closest("a[data-roster-queue]");
      if (!(link instanceof HTMLAnchorElement)) return;
      const url = new URL(link.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.searchParams.get("cycleId") !== cycleId) return;
      const next = rosterLocation(url.searchParams);
      setView(next.view);
      setQuery(next.query);
      setStatusFilter(next.statusFilter);
      setResumeFilter(next.resumeFilter);
      setSort(next.sort);
      setShowDecided(next.showDecided);
      setShowSelected(false);
      setAdvanceReview(null);
    };
    document.addEventListener("click", openQueue);
    return () => document.removeEventListener("click", openQueue);
  }, [cycleId]);

  // Next preserves this client instance on query-only navigation. Apply the
  // requested queue before rendering; retain selected IDs and their hidden count,
  // but require a fresh advancement review after the visible context changes.
  if (lastLocationKey !== locationKey) {
    setLastLocationKey(locationKey);
    setView(location.view);
    setQuery(location.query);
    setStatusFilter(location.statusFilter);
    setResumeFilter(location.resumeFilter);
    setSort(location.sort);
    setShowDecided(location.showDecided);
    setShowSelected(false);
    setAdvanceReview(null);
  }

  if (applicationSource !== applications) {
    setApplicationSource(applications);
    setBoardApplications(applications.map((application) => {
      const pendingStatus = pendingMoveTargets.get(application.id);
      return pendingStatus ? { ...application, status: pendingStatus } : application;
    }));
  }

  function rememberDragHandle(applicationId: string, element: HTMLButtonElement | null) {
    if (element) dragHandleElements.current.set(applicationId, element);
    else dragHandleElements.current.delete(applicationId);
  }

  function startDragging(start: DragStart) {
    setDraggingApplicationId(start.draggableId);
    setMoveNotice(null);
  }

  async function finishDragging(result: DropResult) {
    setDraggingApplicationId(null);
    const destinationStatus = result.destination?.droppableId;
    if (!destinationStatus || result.source.droppableId === destinationStatus) return;

    const application = boardApplications.find((candidate) => candidate.id === result.draggableId);
    if (!application || movingIds.has(application.id) || !canMoveApplication(application.status, destinationStatus, canAdvance)) return;

    const previousStatus = application.status;
    setMoveNotice(null);
    setPendingMoveTargets((current) => new Map(current).set(application.id, destinationStatus));
    setMovingIds((current) => new Set(current).add(application.id));
    setBoardApplications((current) => moveApplicationInBoard(current, application.id, destinationStatus));

    try {
      const response = await authorizedFetch("/api/admin/rush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(moveApplicationRequest(cycleId, application.id, destinationStatus)),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not update status");

      setMoveNotice({
        kind: "success",
        message: destinationStatus === "INVITED"
          ? `${application.name} moved to Speed Dating and staffed with 2 evaluators.`
          : `${application.name} moved to ${applicationStatusLabel(destinationStatus)}.`,
      });
      router.refresh();
    } catch (error) {
      setBoardApplications((current) => current.map((candidate) =>
        candidate.id === application.id && candidate.status === destinationStatus
          ? { ...candidate, status: previousStatus }
          : candidate,
      ));
      setMoveNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not update status. Check your connection and try again.",
      });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => dragHandleElements.current.get(application.id)?.focus());
      });
    } finally {
      setPendingMoveTargets((current) => {
        const next = new Map(current);
        next.delete(application.id);
        return next;
      });
      setMovingIds((current) => {
        const next = new Set(current);
        next.delete(application.id);
        return next;
      });
    }
  }

  function toggleSelected(applicationId: string) {
    if (advancePending) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(applicationId)) next.delete(applicationId);
      else next.add(applicationId);
      return next;
    });
    setAdvanceReview(null);
    setAdvanceNotice(null);
  }

  async function advanceToSpeedDating(ids: string[]) {
    if (!canAdvance || advancePending || ids.length === 0) return;
    const count = ids.length;
    setAdvancePending(true);
    setAdvanceNotice(null);
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/admin/rush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ADVANCE_SPEED_DATING", cycleId, applicationIds: ids }),
      }, 15_000, authorizedFetch);
      if (!response.ok) {
        if (response.status >= 500 || response.status === 408) throw new RequestTimeoutError();
        throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Could not advance applicants");
      }
      const result = advancementReceipt(body, count);
      if (!result) throw new RequestTimeoutError();
      const assignments = result.newAssignments;
      const notifications = result.notificationsEnqueued;
      setAdvanceNotice({ kind: "success", message: `Advanced ${count} applicant${count === 1 ? "" : "s"}, created ${assignments} assignment${assignments === 1 ? "" : "s"}, and queued ${notifications} notification${notifications === 1 ? "" : "s"}.` });
      setSelectedIds(new Set());
      setAdvanceReview(null);
      setShowSelected(false);
      router.refresh();
    } catch (error) {
      if (error instanceof RequestTimeoutError || error instanceof TypeError) {
        setAdvanceReview(null);
        setSelectedIds(new Set());
        setShowSelected(false);
        setAdvanceNotice({ kind: "error", message: "Advancement could not be confirmed. Some changes may already be saved. Refresh the board and check the Speed Dating roster before reviewing another cohort." });
        router.refresh();
      } else setAdvanceNotice({ kind: "error", message: error instanceof Error ? error.message : "Could not advance applicants" });
    } finally {
      setAdvancePending(false);
    }
  }

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return boardApplications;
    return boardApplications.filter((application) => matchesApplicant(application, term));
  }, [boardApplications, query]);
  // Per-column filter for the stage board. "Application in" holds most of the
  // cycle at the start, and the page-level search sits a long scroll away.
  const [columnQueries, setColumnQueries] = useState<Partial<Record<PipelineStatus, string>>>({});

  const filteredApplications = useMemo(() => searchResults.filter((application) => {
    if (statusFilter !== "ALL" && application.status !== statusFilter) return false;
    if (resumeFilter === "ON_FILE" && !application.hasResume) return false;
    if (resumeFilter === "MISSING" && application.hasResume) return false;
    return true;
  }), [resumeFilter, searchResults, statusFilter]);

  const rosterApplications = useMemo(() => {
    const rows = showSelected ? boardApplications.filter((application) => selectedIds.has(application.id)) : [...filteredApplications];
    if (sort === "MAJOR") {
      // Blank majors sort last so the roster does not open on a wall of empties.
      return rows.sort((a, b) =>
        (a.major ? 0 : 1) - (b.major ? 0 : 1) ||
        canonicalMajor(a.major).localeCompare(canonicalMajor(b.major), undefined, { sensitivity: "base" }) ||
        a.name.localeCompare(b.name));
    }
    if (sort === "NEWEST") return rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    if (sort === "OLDEST") return rows.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [boardApplications, filteredApplications, selectedIds, showSelected, sort]);

  const visibleIds = new Set((view === "ALL" ? rosterApplications : searchResults.filter((application) => {
    if (DECIDED_PIPELINE_STATUSES.has(application.status)) return showDecided;
    const term = (columnQueries[application.status] ?? "").trim().toLowerCase();
    return !term || matchesApplicant(application, term);
  })).map((application) => application.id));
  const selectedApplications = boardApplications.filter((application) => selectedIds.has(application.id));
  const hiddenSelectedCount = selectedApplications.filter((application) => !visibleIds.has(application.id)).length;
  const eligibleShown = boardApplications.filter((application) => visibleIds.has(application.id) && canSelectForAdvancement(application.status));

  function reviewAdvancement(ids: ReadonlySet<string>) {
    setAdvanceReview(snapshotAdvancement(boardApplications, ids, visibleIds));
    setAdvanceNotice(null);
  }

  const decidedCount = boardApplications.filter((application) => DECIDED_PIPELINE_STATUSES.has(application.status)).length;
  const draggingApplication = draggingApplicationId
    ? boardApplications.find((application) => application.id === draggingApplicationId) ?? null
    : null;
  const legalDropStatuses = draggingApplication
    ? new Set(kanbanDropStatuses(draggingApplication.status, canAdvance))
    : null;
  const returnTo = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (view !== "ALL") params.set("view", view);
    if (statusFilter !== "ALL") params.set("filter", statusFilter);
    if (resumeFilter !== "ALL") params.set("resume", resumeFilter);
    if (sort !== "NAME") params.set("sort", sort);
    if (showDecided) params.set("decided", "1");
    const serialized = params.toString();
    return withWorkspaceCycle(serialized ? `/admin?${serialized}` : "/admin", cycleId);
  }, [cycleId, query, resumeFilter, showDecided, sort, statusFilter, view]);

  return (
    <section id="applicants">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold tracking-[-0.02em]">Applicants</h2>
        <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-start">
          <p className="text-sm text-muted">{boardApplications.length} submitted</p>
          <label>
            <span className="sr-only">Search applicants by name or contact</span>
            <input
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setShowSelected(false); }}
              placeholder="Search name or contact…"
              className="field-control min-h-11 w-full rounded-xl bg-white text-sm sm:w-64"
            />
          </label>
        </div>
      </div>

      <div className="applicant-list-actions mt-4 flex flex-wrap items-center gap-2">
        <div className="applicant-view-switch w-full max-w-xs">
          <SegmentedControl
            name="Applicant view"
            value={view}
            onChange={(value) => setView(value === "PIPELINE" ? "PIPELINE" : "ALL")}
            options={[
              { value: "ALL", label: "All applicants" },
              { value: "PIPELINE", label: "By stage" },
            ]}
          />
        </div>
        {canOperate && (
          <Link href={withWorkspaceCycle("/admin/referrals", cycleId)} className="inline-flex min-h-11 items-center rounded-full px-4 text-[13px] font-semibold text-mecg-blue inset-ring inset-ring-line-strong hover:bg-mecg-blue/10">
            Referrals · {referralCount}
          </Link>
        )}
        {canAdvance && selectedApplications.length === 0 && <button type="button" disabled={advancePending || !eligibleShown.length} className="ml-auto inline-flex min-h-11 items-center text-xs font-medium text-muted hover:text-mecg-navy" onClick={() => { setSelectedIds(new Set(eligibleShown.map(application => application.id))); setAdvanceReview(null); }}>Select eligible shown</button>}
      </div>

      {canAdvance && (selectedApplications.length > 0 || advanceNotice?.kind === "error") && (
        <div className="applicant-bulk-actions mt-3 rounded-xl bg-mecg-navy p-3.5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm" aria-live="polite"><span className="font-semibold">{selectedApplications.length} selected</span> · {hiddenSelectedCount} hidden</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={advancePending || !eligibleShown.length} className="button-ghost-light text-sm" onClick={() => {
                setSelectedIds((current) => new Set([...current, ...eligibleShown.map((application) => application.id)]));
                setAdvanceReview(null);
              }}>Select eligible shown</button>
              <button type="button" disabled={advancePending || !selectedApplications.length} aria-pressed={showSelected && view === "ALL"} className="button-ghost-light text-sm" onClick={() => { setView("ALL"); setShowSelected((current) => view !== "ALL" || !current); }}>{showSelected && view === "ALL" ? "Show filtered applicants" : "Show selected"}</button>
              <button type="button" disabled={advancePending || !selectedIds.size} className="button-ghost-light text-sm" onClick={() => { setSelectedIds(new Set()); setAdvanceReview(null); setShowSelected(false); }}>Clear selection</button>
              <button ref={advanceTriggerRef} type="button" disabled={advancePending || !selectedApplications.length} className="button-light text-sm" onClick={() => reviewAdvancement(selectedIds)}>Review advancement</button>
            </div>
          </div>
          {showSelected && view === "ALL" && <p className="mt-2 text-sm text-white/70">Showing the selected cohort across all search, status and resume filters.</p>}
          {advanceReview && (
            <div ref={advanceReviewRef} tabIndex={-1} className="mt-4 border-t border-white/15 pt-4" role="region" aria-label="Review advancement to Speed Dating">
              <h3 className="text-base font-semibold">Advance {advanceReview.length} applicants to Speed Dating</h3>
              <p className="mt-2 text-sm text-white/70">{advanceReview.length * 2} evaluator assignments required. The whole cohort stops if any applicant cannot be staffed. No partial changes are saved.</p>
              <p className="mt-2 text-sm text-white/70">This review keeps the applicants listed below fixed. Hidden labels reflect the view when review opened.</p>
              <ul className="mt-3 max-h-64 overflow-y-auto text-sm" aria-label="Applicants in this advancement">
                {advanceReview.map((application) => <li key={application.id} className="flex flex-wrap justify-between gap-2 border-t border-white/12 py-2"><Link className="inline-flex min-h-11 items-center underline" href={withWorkspaceCycle(`/admin/applications/${application.id}?${new URLSearchParams({ returnTo })}`, cycleId)}>{application.name}</Link>{application.hidden && <span className="self-center text-white/70">Hidden by current view at review</span>}</li>)}
              </ul>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button type="button" className="button-ghost-light text-sm" disabled={advancePending} onClick={() => { setAdvanceReview(null); window.requestAnimationFrame(() => advanceTriggerRef.current?.focus()); }}>Cancel</button>
                <button type="button" className="button-light text-sm" disabled={advancePending || !advanceReview.length} onClick={() => void advanceToSpeedDating(advanceReview.map((application) => application.id))}>{advancePending ? "Advancing…" : `Confirm ${advanceReview.length} applicants to Speed Dating`}</button>
              </div>
            </div>
          )}
        </div>
      )}
      {advanceNotice && (
        <p ref={advanceResultRef} tabIndex={-1} role={advanceNotice.kind === "error" ? "alert" : "status"} className={`mt-3 rounded-xl px-4 py-3 text-sm ${advanceNotice.kind === "error" ? "bg-danger-wash text-danger" : "bg-success-wash text-success"}`}>
          {advanceNotice.message}
        </p>
      )}

      {view === "ALL" ? (
        <div key="all-applicants" className="panel-seat">
          <ApplicantRoster
            applications={rosterApplications}
            total={boardApplications.length}
            canAdvance={canAdvance}
            cycleId={cycleId}
            statusFilter={statusFilter}
            resumeFilter={resumeFilter}
            sort={sort}
            onStatusFilterChange={(value) => { setStatusFilter(value); setShowSelected(false); }}
            onResumeFilterChange={(value) => { setResumeFilter(value); setShowSelected(false); }}
            onSortChange={setSort}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
            selectionPending={advancePending}
            returnTo={returnTo}
          />
        </div>
      ) : (
        <div key="pipeline" className="panel-seat">
          {moveNotice && (
            <p
              role={moveNotice.kind === "error" ? "alert" : "status"}
              aria-live={moveNotice.kind === "error" ? "assertive" : "polite"}
              className={`mt-3 rounded-xl px-4 py-3 text-sm ${moveNotice.kind === "error" ? "bg-danger-wash text-danger" : "bg-success-wash text-success"}`}
            >
              {moveNotice.message}
            </p>
          )}
          <DragDropContext onDragStart={startDragging} onDragEnd={finishDragging}>
            <div className={KANBAN_TRACK_CLASS_NAME} tabIndex={0} role="region" aria-label="Applicants by stage">
              {ACTIVE_STATUSES.map((status) => {
                const stageApplications = searchResults.filter((application) => application.status === status);
                const columnTerm = (columnQueries[status] ?? "").trim().toLowerCase();
                const column = columnTerm ? stageApplications.filter((application) => matchesApplicant(application, columnTerm)) : stageApplications;
                const acceptsDraggedCard = legalDropStatuses?.has(status) ?? true;
                return (
                  <article
                    key={status}
                    className={`flex min-h-40 flex-col rounded-xl bg-wash p-2.5 inset-ring inset-ring-line transition-opacity ${draggingApplication && !acceptsDraggedCard ? "opacity-45" : ""}`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
                      <p className="text-[13px] font-semibold text-muted">{applicationStatusLabel(status)}</p>
                      <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-mecg-orange/[0.18] px-1.5 py-0.5 tabular text-xs font-bold text-mecg-orange-ink">
                        {columnTerm ? `${column.length}/${stageApplications.length}` : stageApplications.length}
                      </span>
                    </div>
                    {status === "ELIGIBLE" && canAdvance && column.length > 0 && (
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5 px-0.5">
                        <button type="button" disabled={advancePending} className="button-secondary text-xs" onClick={() => reviewAdvancement(new Set(column.map((application) => application.id)))}>
                          {columnTerm ? `Review ${column.length} shown` : `Review all ${column.length} for Speed Dating`}
                        </button>
                      </div>
                    )}
                    {(stageApplications.length > COLUMN_SEARCH_THRESHOLD || columnTerm) && (
                      <label className="mb-1.5 block">
                        <span className="sr-only">Search {applicationStatusLabel(status)}</span>
                        <input
                          type="search"
                          value={columnQueries[status] ?? ""}
                          onChange={(event) => setColumnQueries((current) => ({ ...current, [status]: event.target.value }))}
                          placeholder="Search this stage…"
                          className="field-control min-h-9 w-full rounded-lg bg-white text-[13px]"
                        />
                      </label>
                    )}
                    <Droppable
                      droppableId={status}
                      isDropDisabled={Boolean(draggingApplication && !acceptsDraggedCard)}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex min-h-28 max-h-[68vh] flex-1 flex-col gap-1.5 overflow-y-auto rounded-xl transition-[background-color,box-shadow] ${snapshot.isDraggingOver ? "bg-mecg-blue/10 inset-ring-2 inset-ring-mecg-blue/30" : ""}`}
                        >
                          {column.length === 0 && (
                            <div className={`flex min-h-28 flex-1 items-center justify-center rounded-xl border-[1.5px] border-dashed p-3 text-center ${snapshot.isDraggingOver ? "border-mecg-blue/45" : "border-line"}`}>
                              <p className="text-xs text-muted">
                                {snapshot.isDraggingOver ? "Drop here" : draggingApplication && !acceptsDraggedCard ? "Not a legal next stage" : query || columnTerm ? "No matches" : "No applicants yet"}
                              </p>
                            </div>
                          )}
                          {column.map((application, index) => {
                            const isMoving = movingIds.has(application.id);
                            const hasDestination = kanbanDropStatuses(application.status, canAdvance).some(
                              (candidate) => candidate !== application.status,
                            );
                            return (
                              <Draggable
                                key={application.id}
                                draggableId={application.id}
                                index={index}
                                isDragDisabled={!canOperate || isMoving || !hasDestination}
                              >
                                {(draggableProvided, draggableSnapshot) => (
                                  <div
                                    ref={draggableProvided.innerRef}
                                    {...draggableProvided.draggableProps}
                                    style={draggableProvided.draggableProps.style}
                                  >
                                    <ApplicantCard
                                      application={application}
                                      canOperate={canOperate}
                                      canAdvance={canAdvance}
                                      cycleId={cycleId}
                                      controlId={application.id}
                                      returnTo={returnTo}
                                      dragHandleProps={draggableProvided.dragHandleProps}
                                      dragHandleRef={(element) => rememberDragHandle(application.id, element)}
                                      isDragging={draggableSnapshot.isDragging}
                                      isMoving={isMoving}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </article>
                );
              })}
            </div>
          </DragDropContext>
          <div className="mt-4 rounded-xl bg-wash p-4">
            <button type="button" onClick={() => setShowDecided((value) => !value)} aria-expanded={showDecided} aria-controls="decided-pipeline" className="flex min-h-11 w-full items-center justify-between gap-4 text-left">
              <span className="text-[13px] font-semibold text-muted">Decided · {decidedCount}</span>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-mecg-blue">
                {showDecided ? "Hide" : "Show"}
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={`disclosure-chevron ${showDecided ? "rotate-180" : ""}`} aria-hidden="true">
                  <path d="M5 8l5 5 5-5" />
                </svg>
              </span>
            </button>
            {!showDecided ? (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {DECIDED_STATUSES.map((status) => (
                  <StatusPill key={status} tone="neutral">
                    {applicationStatusLabel(status)} · {boardApplications.filter((application) => application.status === status).length}
                  </StatusPill>
                ))}
              </div>
            ) : (
              <div id="decided-pipeline" className="panel-seat mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {DECIDED_STATUSES.map((status) => {
                  const column = searchResults.filter((application) => application.status === status);
                  return (
                    <div key={status}>
                      <p className="text-[13px] font-semibold text-muted">
                        {applicationStatusLabel(status)} · {column.length}
                      </p>
                      <div className="mt-1.5 flex flex-col gap-1.5">
                        {column.map((application) => (
                          <div key={application.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs inset-ring inset-ring-line">
                            <Link href={withWorkspaceCycle(`/admin/applications/${application.id}?${new URLSearchParams({ returnTo })}`, cycleId)} className="inline-flex min-h-10 items-center font-semibold text-mecg-navy hover:underline">
                              {application.name}
                            </Link>
                            {canOperate && (
                              <PipelineStatusForm
                                applicationId={application.id}
                                cycleId={cycleId}
                                status={application.status}
                                controlId={`decided-${application.id}`}
                                canAdvance={canAdvance}
                              />
                            )}
                          </div>
                        ))}
                        {!column.length && <p className="text-xs text-muted">None</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default function PipelineBoard(props: { applications: PipelineApplication[]; canOperate: boolean; canAdvance: boolean; cycleId: string; referralCount: number }) {
  return (
    <Suspense fallback={null}>
      <PipelineBoardInner {...props} />
    </Suspense>
  );
}
