"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GROUP_CASE_SCORE_BANDS } from "@/lib/rubrics";
import { matchesApplicantName } from "@/lib/speed-dating-roster";
import { fixed, useLiveRefresh } from "./speed-dating-results";

// Shape of the group_case_results RPC. Applicants arrive sorted mean desc
// (nulls last). "weighted" is a grader's 8..40 score over the criteria they
// observed; "mean" averages those across graders.
export type GroupCaseResults = {
  roundId: string;
  roundName: string;
  roundStatus: string;
  criteria: Array<{ id: string; key: string; name: string; weight: number; position: number }>;
  summary: { applicants: number; graded: number; graders: number; evaluations: number };
  applicants: Array<{
    applicationId: string;
    name: string;
    status: string;
    groupName: string | null;
    count: number;
    mean: number | null;
    criterionMeans: Record<string, number | null>;
    evaluations: Array<{
      evaluatorId: string;
      evaluatorName: string;
      weighted: number | null;
      scoredCount: number;
      criteriaCount: number;
      scores: Record<string, number | null>;
      note: string;
      submittedAt: string;
    }>;
  }>;
  graders: Array<{ evaluatorId: string; evaluatorName: string; count: number; mean: number | null; notes: number }>;
};

type SortKey = "mean" | "count";
type Direction = "desc" | "asc";
type Row = GroupCaseResults["applicants"][number];

const HEAD = "px-4 py-3 text-[13px] font-semibold text-mecg-navy/55";
const CELL = "px-4 py-3 text-[13px] text-mecg-navy/70";
const CRITERION_COLUMN = "hidden md:table-cell";

// Weighted scores land in 8..40, which the bands fully cover.
function bandLabel(mean: number | null) {
  if (mean == null) return "—";
  const total = Math.round(mean);
  return GROUP_CASE_SCORE_BANDS.find((entry) => total >= entry.min && total <= entry.max)?.label ?? "—";
}

// Ungraded applicants sink to the bottom and nulls sort after values in either direction.
function compareRows(a: Row, b: Row, key: SortKey, direction: Direction) {
  if ((a.count === 0) !== (b.count === 0)) return a.count === 0 ? 1 : -1;
  const left = a[key];
  const right = b[key];
  if (left == null || right == null) return left == null ? (right == null ? 0 : 1) : -1;
  return (direction === "desc" ? right - left : left - right) || a.name.localeCompare(b.name);
}

function SortHeader({ label, sortKey, active, direction, onSort }: { label: string; sortKey: SortKey; active: boolean; direction: Direction; onSort: (key: SortKey) => void }) {
  return (
    <th className={HEAD} aria-sort={active ? (direction === "desc" ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => onSort(sortKey)} className={`inline-flex items-center gap-1 hover:text-mecg-navy ${active ? "text-mecg-navy" : ""}`}>
        {label}
        <span aria-hidden="true" className={active ? "" : "invisible"}>{direction === "desc" ? "↓" : "↑"}</span>
      </button>
    </th>
  );
}

export default function GroupCaseResultsTable({ results, canViewNotes, canExport, exportHref }: { results: GroupCaseResults; canViewNotes: boolean; canExport: boolean; exportHref: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<{ key: SortKey; direction: Direction }>({ key: "mean", direction: "desc" });
  const [query, setQuery] = useState("");
  const secondsAgo = useLiveRefresh();

  function toggleExpanded(applicationId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(applicationId)) next.add(applicationId);
      return next;
    });
  }
  function sortBy(key: SortKey) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "desc" ? "asc" : "desc" }));
  }

  const sorted = useMemo(() => [...results.applicants].sort((a, b) => compareRows(a, b, sort.key, sort.direction)), [results.applicants, sort]);
  const visible = sorted.filter((applicant) => matchesApplicantName(applicant.name, query));
  const { summary, criteria } = results;
  const columnCount = 5 + criteria.length + (canViewNotes ? 1 : 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="tabular text-sm text-mecg-navy/55">
          {summary.graded}/{summary.applicants} graded · {summary.graders} grader{summary.graders === 1 ? "" : "s"} · {summary.evaluations} rating{summary.evaluations === 1 ? "" : "s"}
        </p>
        <p className="text-xs text-mecg-navy/45">Live · updated {secondsAgo}s ago</p>
        {canExport && (
          <a href={exportHref} className="button-secondary text-sm sm:ml-auto" download>Excel backup</a>
        )}
      </div>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search a name"
        aria-label="Search applicants"
        autoComplete="off"
        className="mt-3 min-h-11 w-full max-w-md rounded-xl border border-mecg-navy/15 bg-white px-4 py-2 text-sm text-mecg-navy outline-none transition focus:border-mecg-blue focus:ring-4 focus:ring-mecg-blue/10"
      />

      <div className="scroll-cue -mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" tabIndex={0} role="region" aria-label={`${results.roundName} results`}>
        <div className="min-w-[40rem] overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-mecg-navy/10">
                <th className={HEAD}>Applicant</th>
                <th className={HEAD}>Table</th>
                <SortHeader label="Score" sortKey="mean" active={sort.key === "mean"} direction={sort.direction} onSort={sortBy} />
                <th className={HEAD}>Band</th>
                <SortHeader label="Graders" sortKey="count" active={sort.key === "count"} direction={sort.direction} onSort={sortBy} />
                {criteria.map((criterion) => (
                  <th key={criterion.id} className={`${HEAD} ${CRITERION_COLUMN} w-16`} title={criterion.name}>{criterion.name.split(/\s+/)[0]}</th>
                ))}
                {canViewNotes && <th className={HEAD}><span className="sr-only">Notes</span></th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((applicant) => {
                const ungraded = applicant.count === 0;
                const open = expanded.has(applicant.applicationId);
                return (
                  <tr key={applicant.applicationId} className={`border-b border-mecg-navy/10 bg-white align-top ${ungraded ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/applications/${applicant.applicationId}`} className="text-[13px] font-semibold text-mecg-navy hover:text-mecg-orange-ink">{applicant.name}</Link>
                      {ungraded && <p className="mt-1 text-xs text-mecg-navy/55">Not yet graded</p>}
                    </td>
                    <td className={CELL}>{applicant.groupName ?? "—"}</td>
                    <td className={`${CELL} tabular font-bold text-mecg-navy`}>{fixed(applicant.mean)}</td>
                    <td className={CELL}>{bandLabel(applicant.mean)}</td>
                    <td className={`${CELL} tabular`}>{applicant.count}</td>
                    {criteria.map((criterion) => (
                      <td key={criterion.id} className={`${CELL} ${CRITERION_COLUMN} tabular`}>{fixed(applicant.criterionMeans[criterion.id] ?? null)}</td>
                    ))}
                    {canViewNotes && (
                      <td className="px-4 py-3">
                        {applicant.evaluations.length > 0 && (
                          <>
                            <button type="button" aria-expanded={open} onClick={() => toggleExpanded(applicant.applicationId)} className="text-[13px] font-semibold text-mecg-navy hover:text-mecg-orange-ink">
                              {open ? "Hide" : "Notes"}
                            </button>
                            {open && (
                              <ul className="mt-2 flex w-64 flex-col gap-3">
                                {applicant.evaluations.map((evaluation) => (
                                  <li key={evaluation.evaluatorId} className="text-xs text-mecg-navy/70">
                                    <p>
                                      <span className="font-semibold text-mecg-navy">{evaluation.evaluatorName}</span> · <span className="tabular">{fixed(evaluation.weighted)}</span>/40 · {evaluation.scoredCount}/{evaluation.criteriaCount} observed
                                    </p>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {criteria.map((criterion) => evaluation.scores[criterion.id] == null ? null : (
                                        <span key={criterion.id} className="rounded-full bg-mecg-navy/[0.055] px-2 py-0.5 tabular" title={criterion.name}>
                                          {criterion.name.split(/\s+/)[0]} {evaluation.scores[criterion.id]}
                                        </span>
                                      ))}
                                    </div>
                                    {evaluation.note.trim() && <p className="mt-1 whitespace-pre-line text-mecg-navy/60">{evaluation.note}</p>}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {!visible.length && (
                <tr><td colSpan={columnCount} className="bg-white p-6 text-center text-sm text-mecg-navy/55">{results.applicants.length ? "No applicant matches." : "No Group Case applicants yet."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
