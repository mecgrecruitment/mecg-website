"use client";

import { useState } from "react";
import Link from "next/link";
import { initials } from "@/lib/initials";

// Shape of the speed_dating_results RPC. Applicants arrive sorted mean desc
// (nulls last), then name, so ungraded applicants already sit at the bottom.
export type SpeedDatingResults = {
  roundId: string;
  roundName: string;
  roundStatus: string;
  applicants: Array<{
    applicationId: string;
    name: string;
    status: string;
    mean: number | null;
    count: number;
    stddev: number | null;
    scores: Array<{
      evaluatorName: string;
      evaluatorId: string;
      session: number | null;
      score: number;
      note: string;
      submittedAt: string;
    }>;
  }>;
};

export function formatStars(mean: number | null) {
  return mean == null ? "—" : `${mean.toFixed(1)} ★`;
}

// Applicants graded fewer times than the round's median, so the board can
// route members to them. Skipped until 5 applicants have scores.
export function fewestGradedNames(applicants: Array<{ name: string; count: number }>) {
  const counts = applicants.map((applicant) => applicant.count).filter((count) => count > 0).sort((a, b) => a - b);
  if (counts.length < 5) return [];
  const median = counts.length % 2 ? counts[(counts.length - 1) / 2] : (counts[counts.length / 2 - 1] + counts[counts.length / 2]) / 2;
  return applicants.filter((applicant) => applicant.count < median).map((applicant) => applicant.name);
}

const HEAD = "px-4 py-3 text-[13px] font-semibold text-mecg-navy/55";
const CELL = "px-4 py-3 text-[13px] text-mecg-navy/70";

export default function SpeedDatingResultsTable({ results, canViewNotes }: { results: SpeedDatingResults; canViewNotes: boolean }) {
  const [failedHeadshots, setFailedHeadshots] = useState<Set<string>>(() => new Set());
  function markHeadshotFailed(applicationId: string) {
    setFailedHeadshots((current) => current.has(applicationId) ? current : new Set(current).add(applicationId));
  }
  const gradedApplicants = results.applicants.filter((applicant) => applicant.count > 0);
  const graders = new Set(results.applicants.flatMap((applicant) => applicant.scores.map((score) => score.evaluatorId))).size;
  const fewestGraded = fewestGradedNames(results.applicants);

  return (
    <section>
      <p className="tabular text-sm text-mecg-navy/55">
        {results.applicants.length} applicant{results.applicants.length === 1 ? "" : "s"} · {gradedApplicants.length} graded · {graders} grader{graders === 1 ? "" : "s"} · {results.applicants.length - gradedApplicants.length} not yet graded
      </p>
      {fewestGraded.length > 0 && (
        <p className="mt-1 text-sm text-mecg-navy/55">
          <span className="font-semibold text-mecg-navy/70">Fewest graders:</span> {fewestGraded.join(", ")}
        </p>
      )}

      <div className="scroll-cue -mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" tabIndex={0} role="region" aria-label={`${results.roundName} results`}>
        <div className="min-w-[48rem] overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-mecg-navy/10">
                <th className={HEAD}>Applicant</th>
                <th className={HEAD}>Stars</th>
                <th className={HEAD}>Graders</th>
                <th className={HEAD}>Spread</th>
                <th className={HEAD}><span className="sr-only">Scores and notes</span></th>
              </tr>
            </thead>
            <tbody>
              {results.applicants.map((applicant) => (
                <tr key={applicant.applicationId} className="border-b border-mecg-navy/10 bg-white align-top">
                  <td className="px-4 py-3">
                    <Link href={`/admin/applications/${applicant.applicationId}`} className="flex items-center gap-2.5 text-[13px] font-semibold text-mecg-navy hover:text-mecg-orange-ink">
                      {failedHeadshots.has(applicant.applicationId)
                        ? <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-mecg-navy/[0.06] text-[11px] text-mecg-navy/60" aria-hidden="true">{initials(applicant.name)}</span>
                        // eslint-disable-next-line @next/next/no-img-element -- authorized same-origin route
                        : <img
                            src={`/api/admin/applications/${encodeURIComponent(applicant.applicationId)}/headshot`}
                            alt=""
                            loading="lazy"
                            className="size-8 shrink-0 rounded-full object-cover"
                            // The server-rendered img can fail before React attaches onError, so also check on mount.
                            ref={(node) => { if (node?.complete && node.naturalWidth === 0) markHeadshotFailed(applicant.applicationId); }}
                            onError={() => markHeadshotFailed(applicant.applicationId)}
                          />}
                      {applicant.name}
                    </Link>
                  </td>
                  <td className={`${CELL} tabular font-semibold text-mecg-navy`}>{formatStars(applicant.mean)}</td>
                  <td className={`${CELL} tabular`}>{applicant.count}</td>
                  <td className={`${CELL} tabular`}>{applicant.stddev == null ? "—" : applicant.stddev.toFixed(1)}</td>
                  <td className="px-4 py-3">
                    {applicant.scores.length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-[13px] font-semibold text-mecg-navy">Scores and notes</summary>
                        <ul className="mt-2 flex flex-col gap-2">
                          {applicant.scores.map((score, index) => (
                            <li key={`${score.evaluatorId}-${score.session}-${index}`} className="text-xs text-mecg-navy/70">
                              <p>{score.session == null ? "" : `Session ${score.session} · `}{score.evaluatorName} · {score.score} ★</p>
                              {canViewNotes && score.note.trim() && <p className="mt-0.5 whitespace-pre-line text-mecg-navy/60">{score.note}</p>}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
              {!results.applicants.length && (
                <tr><td colSpan={5} className="bg-white p-6 text-center text-sm text-mecg-navy/55">No Speed Dating applicants yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
