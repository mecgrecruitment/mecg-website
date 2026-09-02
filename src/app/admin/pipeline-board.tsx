"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PipelineStatusForm from "./pipeline-status-form";
import StatusPill from "@/components/status-pill";
import SegmentedControl from "@/components/segmented-control";
import { initials } from "@/lib/initials";
import { applicationStatusLabel } from "@/lib/labels";
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
  submittedAt: string;
  submittedLabel: string;
  hasResume: boolean;
};

type ApplicantView = "ALL" | "PIPELINE";
type ResumeFilter = "ALL" | "ON_FILE" | "MISSING";
type StatusFilter = "ALL" | PipelineStatus;

const ACTIVE_STATUSES = PIPELINE_STATUSES.filter((status) => !DECIDED_PIPELINE_STATUSES.has(status));
const DECIDED_STATUSES = PIPELINE_STATUSES.filter((status) => DECIDED_PIPELINE_STATUSES.has(status));

function ApplicantCard({
  application,
  canOperate,
  cycleId,
  controlId,
}: {
  application: PipelineApplication;
  canOperate: boolean;
  cycleId: string;
  controlId: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(7,13,31,0.06)]">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-mecg-navy text-[10px] font-semibold text-white">
          {initials(application.name)}
        </span>
        <Link href={`/admin/applications/${application.id}`} className="inline-flex min-h-10 items-center text-[13px] font-semibold text-mecg-navy hover:underline">
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
        />
      )}
    </div>
  );
}

function ApplicantRoster({
  applications,
  total,
  canOperate,
  cycleId,
  statusFilter,
  resumeFilter,
  onStatusFilterChange,
  onResumeFilterChange,
}: {
  applications: PipelineApplication[];
  total: number;
  canOperate: boolean;
  cycleId: string;
  statusFilter: StatusFilter;
  resumeFilter: ResumeFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onResumeFilterChange: (filter: ResumeFilter) => void;
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
        </div>
        <p className="text-sm text-mecg-navy/60" aria-live="polite">Showing {applications.length} of {total}</p>
      </div>

      {applications.length ? (
        <ul className="mt-3 flex flex-col gap-2" aria-label="All applicants">
          {applications.map((application) => (
            <li key={application.id} className="grid gap-3 rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] md:grid-cols-[minmax(0,1.5fr)_minmax(140px,0.75fr)_minmax(130px,0.65fr)_auto] md:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mecg-navy text-[11px] font-semibold text-white">
                  {initials(application.name)}
                </span>
                <div className="min-w-0">
                  <Link href={`/admin/applications/${application.id}`} className="font-semibold text-mecg-navy hover:underline">
                    {application.name}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-mecg-navy/60">{application.contact}</p>
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
                <Link href={`/admin/applications/${application.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-mecg-blue hover:underline">
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
  cycleId,
}: {
  applications: PipelineApplication[];
  canOperate: boolean;
  cycleId: string;
}) {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter");
  const [view, setView] = useState<ApplicantView>("ALL");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    filterParam && isPipelineStatus(filterParam) ? filterParam : "ALL",
  );
  const [resumeFilter, setResumeFilter] = useState<ResumeFilter>(
    filterParam === "MISSING_RESUME" ? "MISSING" : "ALL",
  );
  const [showDecided, setShowDecided] = useState(false);

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return applications;
    return applications.filter((application) =>
      application.name.toLowerCase().includes(term) || application.contact.toLowerCase().includes(term),
    );
  }, [applications, query]);

  const rosterApplications = useMemo(() => searchResults.filter((application) => {
    if (statusFilter !== "ALL" && application.status !== statusFilter) return false;
    if (resumeFilter === "ON_FILE" && !application.hasResume) return false;
    if (resumeFilter === "MISSING" && application.hasResume) return false;
    return true;
  }), [resumeFilter, searchResults, statusFilter]);

  const decidedCount = applications.filter((application) => DECIDED_PIPELINE_STATUSES.has(application.status)).length;

  return (
    <section id="applicants">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Applicants</h2>
        <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-start">
          <p className="text-sm text-mecg-navy/60">{applications.length} submitted applicants in this cycle</p>
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

      <div className="mt-4 max-w-xs">
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

      {view === "ALL" ? (
        <div key="all-applicants" className="panel-seat">
          <ApplicantRoster
            applications={rosterApplications}
            total={applications.length}
            canOperate={canOperate}
            cycleId={cycleId}
            statusFilter={statusFilter}
            resumeFilter={resumeFilter}
            onStatusFilterChange={setStatusFilter}
            onResumeFilterChange={setResumeFilter}
          />
        </div>
      ) : (
        <div key="pipeline" className="panel-seat">
          <div className="scroll-cue mt-3.5 grid grid-cols-1 gap-3 sm:grid-flow-col sm:auto-cols-[minmax(190px,1fr)] sm:overflow-x-auto sm:pb-2" tabIndex={0} role="region" aria-label="Applicants by stage">
            {ACTIVE_STATUSES.map((status) => {
              const column = searchResults.filter((application) => application.status === status);
              return (
                <article key={status} className="flex flex-col gap-1.5 rounded-2xl bg-mecg-navy/[0.025] p-2.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-mecg-navy/55">{applicationStatusLabel(status)}</p>
                    <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-mecg-orange/[0.18] px-1.5 py-0.5 tabular text-[11px] font-bold text-mecg-orange-ink">
                      {column.length}
                    </span>
                  </div>
                  {column.length === 0 ? (
                    <div className="rounded-xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-3 text-center">
                      <p className="text-[11.5px] text-mecg-navy/60">{query ? "No matches" : "No applicants yet"}</p>
                    </div>
                  ) : (
                    column.map((application) => (
                      <ApplicantCard
                        key={application.id}
                        application={application}
                        canOperate={canOperate}
                        cycleId={cycleId}
                        controlId={application.id}
                      />
                    ))
                  )}
                </article>
              );
            })}
          </div>
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
                    {applicationStatusLabel(status)} · {applications.filter((application) => application.status === status).length}
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
                            <Link href={`/admin/applications/${application.id}`} className="inline-flex min-h-10 items-center font-semibold text-mecg-navy hover:underline">
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

export default function PipelineBoard(props: { applications: PipelineApplication[]; canOperate: boolean; cycleId: string }) {
  return (
    <Suspense fallback={null}>
      <PipelineBoardInner {...props} />
    </Suspense>
  );
}
