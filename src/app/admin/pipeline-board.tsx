"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PipelineStatusForm from "./pipeline-status-form";
import SectionLabel from "@/components/section-label";
import { PIPELINE_STATUSES, DECIDED_PIPELINE_STATUSES } from "@/lib/workflow";

type PipelineApplication = { id: string; status: string; name: string; hasResume: boolean };

const ACTIVE_STATUSES = PIPELINE_STATUSES.filter((status) => !DECIDED_PIPELINE_STATUSES.has(status));
const DECIDED_STATUSES = PIPELINE_STATUSES.filter((status) => DECIDED_PIPELINE_STATUSES.has(status));

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function ApplicantCard({
  application,
  canOperate,
  cycleId,
  nonTerminalOnly,
}: {
  application: PipelineApplication;
  canOperate: boolean;
  cycleId: string;
  nonTerminalOnly: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-white p-2.5 shadow-[0_1px_2px_rgba(7,13,31,0.06)]">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-mecg-navy font-mono text-[10px] font-semibold text-white">
          {initials(application.name)}
        </span>
        <Link href={`/admin/applications/${application.id}`} className="text-[13px] font-semibold text-mecg-navy hover:underline">
          {application.name}
        </Link>
      </div>
      <p className="flex items-center gap-1 text-[11.5px] text-mecg-navy/45">
        {application.hasResume ? (
          <>
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" className="flex-shrink-0 text-mecg-navy/55">
              <path d="M4 10.5l4 4 8-9" />
            </svg>
            <span className="text-mecg-navy/55">Resume on file</span>
          </>
        ) : (
          "No resume"
        )}
      </p>
      {canOperate && <PipelineStatusForm applicationId={application.id} cycleId={cycleId} status={application.status} nonTerminalOnly={nonTerminalOnly} />}
    </div>
  );
}

export default function PipelineBoard({
  applications,
  canOperate,
  cycleId,
  nonTerminalOnly,
}: {
  applications: PipelineApplication[];
  canOperate: boolean;
  cycleId: string;
  nonTerminalOnly: boolean;
}) {
  const [query, setQuery] = useState("");
  const [showDecided, setShowDecided] = useState(false);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? applications.filter((application) => application.name.toLowerCase().includes(term)) : applications;
  }, [applications, query]);

  const decidedCount = applications.filter((application) => DECIDED_PIPELINE_STATUSES.has(application.status)).length;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <SectionLabel number="02">Applicant pipeline</SectionLabel>
          <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">Applicant pipeline</h2>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-mecg-navy/50">{applications.length} applicants in this cycle</p>
          <label>
            <span className="sr-only">Search applicants</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name…"
              className="min-h-10 w-48 rounded-full bg-mecg-navy/[0.035] px-4 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
            />
          </label>
        </div>
      </div>
      <div className="mt-3.5 grid grid-flow-col auto-cols-[248px] gap-3 overflow-x-auto pb-2">
        {ACTIVE_STATUSES.map((status) => {
          const column = filtered.filter((application) => application.status === status);
          return (
            <article key={status} className="flex flex-col gap-1.5 rounded-[18px] bg-mecg-navy/[0.025] p-2.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/55">{status.replaceAll("_", " ")}</p>
                <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-mecg-orange/[0.18] px-1.5 py-0.5 font-mono text-[11px] font-bold text-mecg-orange-ink">
                  {column.length}
                </span>
              </div>
              {column.length === 0 ? (
                <div className="rounded-xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-3 text-center">
                  <p className="text-[11.5px] text-mecg-navy/40">{query ? "No matches" : "No applicants yet"}</p>
                </div>
              ) : (
                column.map((application) => (
                  <ApplicantCard key={application.id} application={application} canOperate={canOperate} cycleId={cycleId} nonTerminalOnly={nonTerminalOnly} />
                ))
              )}
            </article>
          );
        })}
      </div>
      <div className="mt-4 rounded-2xl bg-mecg-navy/[0.025] p-4">
        <button type="button" onClick={() => setShowDecided((value) => !value)} className="flex w-full items-center justify-between text-left">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/55">Decided · {decidedCount}</span>
          <span className="text-xs font-semibold text-mecg-blue">{showDecided ? "Hide" : "Show"}</span>
        </button>
        {!showDecided ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {DECIDED_STATUSES.map((status) => (
              <span key={status} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-mecg-navy/50 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                {status.replaceAll("_", " ")}
                <span className="text-mecg-navy/70">{applications.filter((application) => application.status === status).length}</span>
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DECIDED_STATUSES.map((status) => {
              const column = filtered.filter((application) => application.status === status);
              return (
                <div key={status}>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-mecg-navy/45">
                    {status.replaceAll("_", " ")} · {column.length}
                  </p>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {column.map((application) => (
                      <div key={application.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[12px] shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]">
                        <Link href={`/admin/applications/${application.id}`} className="font-semibold text-mecg-navy hover:underline">
                          {application.name}
                        </Link>
                        {canOperate && <PipelineStatusForm applicationId={application.id} cycleId={cycleId} status={application.status} nonTerminalOnly={nonTerminalOnly} />}
                      </div>
                    ))}
                    {!column.length && <p className="text-[11px] text-mecg-navy/35">None</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
