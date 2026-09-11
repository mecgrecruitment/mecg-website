"use client";

import { Suspense, useMemo, useRef, useState } from "react";
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
import PipelineStatusForm from "./pipeline-status-form";
import {
  KANBAN_TRACK_CLASS_NAME,
  canMoveApplication,
  kanbanDropStatuses,
  moveApplicationInBoard,
} from "./pipeline-kanban";
import StatusPill from "@/components/status-pill";
import SegmentedControl from "@/components/segmented-control";
import { initials } from "@/lib/initials";
import { applicationStatusLabel } from "@/lib/labels";
import { canonicalMajor } from "@/lib/major";
import {
  DECIDED_PIPELINE_STATUSES,
  PIPELINE_STATUSES,
  isPipelineStatus,
  type PipelineStatus,
} from "@/lib/workflow";

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

const ACTIVE_STATUSES = PIPELINE_STATUSES.filter((status) => !DECIDED_PIPELINE_STATUSES.has(status));
const DECIDED_STATUSES = PIPELINE_STATUSES.filter((status) => DECIDED_PIPELINE_STATUSES.has(status));

function ApplicantCard({
  application,
  canOperate,
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
    <div className={`flex flex-col gap-2 rounded-xl bg-white p-3 transition-[box-shadow,opacity] ${isDragging ? "shadow-[0_14px_32px_rgba(7,13,31,0.2)]" : "shadow-[0_1px_2px_rgba(7,13,31,0.06)]"} ${isMoving ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2">
        {dragHandleProps && (
          <button
            type="button"
            ref={dragHandleRef}
            {...dragHandleProps}
            data-drag-handle-id={application.id}
            aria-label={`Move ${application.name}`}
            className="hidden h-10 w-10 shrink-0 touch-none items-center justify-center rounded-lg text-mecg-navy/45 transition-[background-color,transform] hover:bg-mecg-blue/[0.08] hover:text-mecg-navy active:scale-[0.96] sm:inline-flex"
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
          <span className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-mecg-navy text-[10px] font-semibold text-white">
            {initials(application.name)}
          </span>
        )}
        <Link href={`/admin/applications/${application.id}?${new URLSearchParams({ returnTo })}`} className="inline-flex min-h-10 items-center text-[13px] font-semibold text-mecg-navy hover:underline">
          {application.name}
        </Link>
      </div>
      <p className="flex items-center gap-1 text-[11.5px] text-mecg-navy/60">
        {application.hasResume ? (
          <>
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0 text-mecg-navy/55" aria-hidden="true">
              <path d="M4 10.5l4 4 8-9" />
            </svg>
            <span className="text-mecg-navy/55">Resume on file</span>
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
        />
      )}
    </div>
  );
}

function ApplicantRoster({
  applications,
  total,
  canOperate,
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
  returnTo,
}: {
  applications: PipelineApplication[];
  total: number;
  canOperate: boolean;
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
  returnTo: string;
}) {
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-mecg-navy/[0.025] p-3.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]">
        <div className="flex flex-wrap gap-3">
          <label className="text-xs font-medium text-mecg-navy/65">
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
          <label className="text-xs font-medium text-mecg-navy/65">
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
          <label className="text-xs font-medium text-mecg-navy/65">
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
        <p className="text-sm text-mecg-navy/60" aria-live="polite">Showing {applications.length} of {total}</p>
      </div>

      {applications.length ? (
        <ul className="mt-3 flex flex-col gap-2" aria-label="All applicants">
          {applications.map((application) => (
            <li key={application.id} className={`grid gap-3 rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] md:items-center ${canAdvance ? "md:grid-cols-[auto_minmax(0,1.5fr)_minmax(140px,0.75fr)_minmax(130px,0.65fr)_auto]" : "md:grid-cols-[minmax(0,1.5fr)_minmax(140px,0.75fr)_minmax(130px,0.65fr)_auto]"}`}>
              {canAdvance && (["ELIGIBLE", "INVITED", "IN_PROCESS"].includes(application.status) ? (
                  <label className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-mecg-navy/65">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(application.id)}
                      onChange={() => onToggleSelected(application.id)}
                      className="h-5 w-5 accent-mecg-navy"
                    />
                    <span className="sr-only">Select {application.name}</span>
                  </label>
                ) : <span aria-hidden="true" />)}
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mecg-navy text-[11px] font-semibold text-white">
                  {initials(application.name)}
                </span>
                <div className="min-w-0">
                  <Link href={`/admin/applications/${application.id}?${new URLSearchParams({ returnTo })}`} className="font-semibold text-mecg-navy hover:underline">
                    {application.name}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-mecg-navy/60">{[application.contact, canonicalMajor(application.major)].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <div>
                <StatusPill tone="orange">{applicationStatusLabel(application.status)}</StatusPill>
                <p className="mt-1 text-[11px] text-mecg-navy/60">
                  Submitted <time dateTime={application.submittedAt}>{application.submittedLabel}</time>
                </p>
              </div>
              <p className={`text-xs font-medium ${application.hasResume ? "text-mecg-navy/60" : "text-mecg-orange-ink"}`}>
                {application.hasResume ? "Resume on file" : "Missing resume"}
              </p>
              {canOperate ? (
                <PipelineStatusForm
                  applicationId={application.id}
                  cycleId={cycleId}
                  status={application.status}
                  controlId={`roster-${application.id}`}
                />
              ) : (
                <Link href={`/admin/applications/${application.id}?${new URLSearchParams({ returnTo })}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-mecg-blue hover:underline">
                  Open file
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-8 text-center text-sm text-mecg-navy/60">
          No applicants match these filters.
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
  const filterParam = searchParams.get("filter");
  const [boardApplications, setBoardApplications] = useState(applications);
  const [applicationSource, setApplicationSource] = useState(applications);
  const [view, setView] = useState<ApplicantView>(searchParams.get("view") === "PIPELINE" ? "PIPELINE" : "ALL");
  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    filterParam && isPipelineStatus(filterParam) ? filterParam : "ALL",
  );
  const [resumeFilter, setResumeFilter] = useState<ResumeFilter>(() => {
    const resumeParam = searchParams.get("resume");
    if (resumeParam === "ON_FILE" || resumeParam === "MISSING") return resumeParam;
    return filterParam === "MISSING_RESUME" ? "MISSING" : "ALL";
  });
  const [sort, setSort] = useState<RosterSort>(() => {
    const sortParam = searchParams.get("sort");
    return sortParam === "MAJOR" || sortParam === "NEWEST" || sortParam === "OLDEST" ? sortParam : "NAME";
  });
  const [showDecided, setShowDecided] = useState(searchParams.get("decided") === "1");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingAdvance, setConfirmingAdvance] = useState(false);
  const [advancePending, setAdvancePending] = useState(false);
  const [advanceNotice, setAdvanceNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [draggingApplicationId, setDraggingApplicationId] = useState<string | null>(null);
  const [movingIds, setMovingIds] = useState<Set<string>>(new Set());
  const [pendingMoveTargets, setPendingMoveTargets] = useState<Map<string, PipelineStatus>>(new Map());
  const [moveNotice, setMoveNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const dragHandleElements = useRef(new Map<string, HTMLButtonElement>());

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
    if (!application || movingIds.has(application.id) || !canMoveApplication(application.status, destinationStatus)) return;

    const previousStatus = application.status;
    setMoveNotice(null);
    setPendingMoveTargets((current) => new Map(current).set(application.id, destinationStatus));
    setMovingIds((current) => new Set(current).add(application.id));
    setBoardApplications((current) => moveApplicationInBoard(current, application.id, destinationStatus));

    try {
      const response = await fetch("/api/admin/rush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SET_APPLICATION_STATUS",
          cycleId,
          applicationId: application.id,
          status: destinationStatus,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not update status");

      setMoveNotice({
        kind: "success",
        message: `${application.name} moved to ${applicationStatusLabel(destinationStatus)}.`,
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
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(applicationId)) next.delete(applicationId);
      else next.add(applicationId);
      return next;
    });
    setConfirmingAdvance(false);
    setAdvanceNotice(null);
  }

  async function advanceToSpeedDating() {
    if (!canAdvance || selectedIds.size === 0) return;
    const count = selectedIds.size;
    setAdvancePending(true);
    setAdvanceNotice(null);
    try {
      const response = await fetch("/api/admin/rush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ADVANCE_SPEED_DATING", cycleId, applicationIds: [...selectedIds] }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not advance applicants");
      const result = body?.id && typeof body.id === "object" ? body.id : {};
      const assignments = typeof result.newAssignments === "number" ? result.newAssignments : count * 2;
      const notifications = typeof result.notificationsEnqueued === "number" ? result.notificationsEnqueued : 0;
      setAdvanceNotice({ kind: "success", message: `Advanced ${count} applicant${count === 1 ? "" : "s"}, created ${assignments} assignment${assignments === 1 ? "" : "s"}, and queued ${notifications} notification${notifications === 1 ? "" : "s"}.` });
      setSelectedIds(new Set());
      setConfirmingAdvance(false);
      router.refresh();
    } catch (error) {
      setAdvanceNotice({ kind: "error", message: error instanceof Error ? error.message : "Could not advance applicants" });
    } finally {
      setAdvancePending(false);
    }
  }

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return boardApplications;
    return boardApplications.filter((application) =>
      application.name.toLowerCase().includes(term) || application.contact.toLowerCase().includes(term),
    );
  }, [boardApplications, query]);

  const filteredApplications = useMemo(() => searchResults.filter((application) => {
    if (statusFilter !== "ALL" && application.status !== statusFilter) return false;
    if (resumeFilter === "ON_FILE" && !application.hasResume) return false;
    if (resumeFilter === "MISSING" && application.hasResume) return false;
    return true;
  }), [resumeFilter, searchResults, statusFilter]);

  const rosterApplications = useMemo(() => {
    const rows = [...filteredApplications];
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
  }, [filteredApplications, sort]);

  const decidedCount = boardApplications.filter((application) => DECIDED_PIPELINE_STATUSES.has(application.status)).length;
  const draggingApplication = draggingApplicationId
    ? boardApplications.find((application) => application.id === draggingApplicationId) ?? null
    : null;
  const legalDropStatuses = draggingApplication
    ? new Set(kanbanDropStatuses(draggingApplication.status))
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
    return serialized ? `/admin?${serialized}` : "/admin";
  }, [query, resumeFilter, showDecided, sort, statusFilter, view]);

  return (
    <section id="applicants">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Applicants</h2>
        <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-start">
          <p className="text-sm text-mecg-navy/60">{boardApplications.length} submitted applicants in this cycle</p>
          <label>
            <span className="sr-only">Search applicants by name or contact</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or contact…"
              className="field-control min-h-11 w-full rounded-xl bg-white text-sm sm:w-64"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
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
          <Link href="/admin/referrals" className="inline-flex min-h-11 items-center rounded-full px-4 text-[13px] font-semibold text-mecg-blue shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] hover:bg-mecg-blue/[0.08]">
            Referrals · {referralCount}
          </Link>
        )}
      </div>

      {canAdvance && selectedIds.size > 0 && (
        <div className="mt-3 rounded-2xl bg-mecg-navy p-3.5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm"><span className="font-semibold">{selectedIds.size} selected</span> · {selectedIds.size * 2} evaluator assignments required</p>
              {confirmingAdvance && <p className="mt-1 text-xs text-white/65">The whole cohort stops if any applicant cannot be staffed. No partial changes are saved.</p>}
            </div>
            {confirmingAdvance ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="button-ghost-light text-sm" disabled={advancePending} onClick={() => setConfirmingAdvance(false)}>Cancel</button>
                <button type="button" className="button-light text-sm" disabled={advancePending} onClick={advanceToSpeedDating}>
                  {advancePending ? "Advancing…" : `Confirm ${selectedIds.size} applicants`}
                </button>
              </div>
            ) : (
              <button type="button" className="button-light text-sm" onClick={() => setConfirmingAdvance(true)}>Review advancement</button>
            )}
          </div>
        </div>
      )}
      {advanceNotice && (
        <p role={advanceNotice.kind === "error" ? "alert" : "status"} className={`mt-3 rounded-xl px-4 py-3 text-sm ${advanceNotice.kind === "error" ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"}`}>
          {advanceNotice.message}
        </p>
      )}

      {view === "ALL" ? (
        <div key="all-applicants" className="panel-seat">
          <ApplicantRoster
            applications={rosterApplications}
            total={boardApplications.length}
            canOperate={canOperate}
            canAdvance={canAdvance}
            cycleId={cycleId}
            statusFilter={statusFilter}
            resumeFilter={resumeFilter}
            sort={sort}
            onStatusFilterChange={setStatusFilter}
            onResumeFilterChange={setResumeFilter}
            onSortChange={setSort}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
            returnTo={returnTo}
          />
        </div>
      ) : (
        <div key="pipeline" className="panel-seat">
          {moveNotice && (
            <p
              role={moveNotice.kind === "error" ? "alert" : "status"}
              aria-live={moveNotice.kind === "error" ? "assertive" : "polite"}
              className={`mt-3 rounded-xl px-4 py-3 text-sm ${moveNotice.kind === "error" ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"}`}
            >
              {moveNotice.message}
            </p>
          )}
          <DragDropContext onDragStart={startDragging} onDragEnd={finishDragging}>
            <div className={KANBAN_TRACK_CLASS_NAME} tabIndex={0} role="region" aria-label="Applicants by stage">
              {ACTIVE_STATUSES.map((status) => {
                const column = searchResults.filter((application) => application.status === status);
                const acceptsDraggedCard = legalDropStatuses?.has(status) ?? true;
                return (
                  <article
                    key={status}
                    className={`flex min-h-40 flex-col rounded-2xl bg-mecg-navy/[0.025] p-2.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)] transition-opacity ${draggingApplication && !acceptsDraggedCard ? "opacity-45" : ""}`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
                      <p className="text-[13px] font-semibold text-mecg-navy/55">{applicationStatusLabel(status)}</p>
                      <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-mecg-orange/[0.18] px-1.5 py-0.5 tabular text-[11px] font-bold text-mecg-orange-ink">
                        {column.length}
                      </span>
                    </div>
                    <Droppable
                      droppableId={status}
                      isDropDisabled={Boolean(draggingApplication && !acceptsDraggedCard)}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex min-h-28 max-h-[68vh] flex-1 flex-col gap-1.5 overflow-y-auto rounded-xl transition-[background-color,box-shadow] ${snapshot.isDraggingOver ? "bg-mecg-blue/[0.08] shadow-[inset_0_0_0_2px_rgba(38,91,174,0.35)]" : ""}`}
                        >
                          {column.length === 0 && (
                            <div className={`flex min-h-28 flex-1 items-center justify-center rounded-xl border-[1.5px] border-dashed p-3 text-center ${snapshot.isDraggingOver ? "border-mecg-blue/45" : "border-mecg-navy/[0.14]"}`}>
                              <p className="text-[11.5px] text-mecg-navy/60">
                                {snapshot.isDraggingOver ? "Drop here" : draggingApplication && !acceptsDraggedCard ? "Not a legal next stage" : query ? "No matches" : "No applicants yet"}
                              </p>
                            </div>
                          )}
                          {column.map((application, index) => {
                            const isMoving = movingIds.has(application.id);
                            const hasDestination = kanbanDropStatuses(application.status).some(
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
          <div className="mt-4 rounded-2xl bg-mecg-navy/[0.025] p-4">
            <button type="button" onClick={() => setShowDecided((value) => !value)} aria-expanded={showDecided} aria-controls="decided-pipeline" className="flex min-h-11 w-full items-center justify-between gap-4 text-left">
              <span className="text-[13px] font-semibold text-mecg-navy/55">Decided · {decidedCount}</span>
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
                      <p className="text-[13px] font-semibold text-mecg-navy/60">
                        {applicationStatusLabel(status)} · {column.length}
                      </p>
                      <div className="mt-1.5 flex flex-col gap-1.5">
                        {column.map((application) => (
                          <div key={application.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[12px] shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]">
                            <Link href={`/admin/applications/${application.id}?${new URLSearchParams({ returnTo })}`} className="inline-flex min-h-10 items-center font-semibold text-mecg-navy hover:underline">
                              {application.name}
                            </Link>
                            {canOperate && (
                              <PipelineStatusForm
                                applicationId={application.id}
                                cycleId={cycleId}
                                status={application.status}
                                controlId={`decided-${application.id}`}
                              />
                            )}
                          </div>
                        ))}
                        {!column.length && <p className="text-[11px] text-mecg-navy/60">None</p>}
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
