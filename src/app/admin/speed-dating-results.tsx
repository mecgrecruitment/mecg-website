import Link from "next/link";
import { SPEED_DATING_SESSIONS } from "@/lib/speed-dating-pairs";

// Shape of the speed_dating_results RPC. Applicants arrive sorted mean desc
// (nulls last), then name.
export type SpeedDatingResults = {
  roundId: string;
  roundName: string;
  roundStatus: string;
  tables: Record<string, number[]>;
  applicants: Array<{
    applicationId: string;
    name: string;
    status: string;
    mean: number | null;
    count: number;
    stddev: number | null;
    tablesVisited: Record<string, number[]>;
    perTable: Array<{ session: number; table: number; mean: number; count: number }>;
    scores: Array<{
      evaluatorName: string;
      evaluatorId: string;
      session: number | null;
      table: number | null;
      score: number;
      note: string;
      submittedAt: string;
    }>;
  }>;
};

export function formatStars(mean: number | null) {
  return mean == null ? "—" : `${mean.toFixed(1)} ★`;
}

export function missedTables(declared: number[], visited: number[]) {
  const seen = new Set(visited);
  return declared.filter((table) => !seen.has(table));
}

const HEAD = "px-4 py-3 text-[13px] font-semibold text-mecg-navy/55";
const CELL = "px-4 py-3 text-[13px] text-mecg-navy/70";

export default function SpeedDatingResultsTable({ results, canViewNotes }: { results: SpeedDatingResults; canViewNotes: boolean }) {
  const sessions = SPEED_DATING_SESSIONS.filter((session) => (results.tables[String(session)] ?? []).length > 0);
  const graded = results.applicants.filter((applicant) => applicant.count > 0).length;
  const tableSummary = sessions
    .map((session) => `S${session} ${results.tables[String(session)].join(", ")}`)
    .join(" · ");
  const missed = sessions.map((session) => ({
    session,
    rows: results.applicants
      .map((applicant) => ({
        applicant,
        missing: missedTables(results.tables[String(session)], applicant.tablesVisited[String(session)] ?? []),
      }))
      .filter((row) => row.missing.length > 0),
  }));

  return (
    <section>
      <p className="tabular text-sm text-mecg-navy/55">
        {results.applicants.length} applicant{results.applicants.length === 1 ? "" : "s"} · {graded} graded
        {tableSummary ? ` · Tables tonight: ${tableSummary}` : ""}
      </p>

      {missed.map(({ session, rows }) => (
        <div key={session} className="mt-4 rounded-2xl bg-paper p-3.5 sm:p-4">
          <p className="text-[13px] font-semibold text-mecg-navy/60">Missed tables · Session {session}{rows.length ? ` · ${rows.length}` : ""}</p>
          {rows.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rows.map(({ applicant, missing }) => (
                <Link
                  key={applicant.applicationId}
                  href={`/admin/applications/${applicant.applicationId}`}
                  className="inline-flex min-h-8 items-center rounded-[2px] bg-white px-2.5 py-1 text-xs font-medium text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] hover:bg-mecg-blue/[0.08]"
                >
                  {applicant.name} · missing {missing.join(", ")}
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-mecg-navy/55">Every applicant has been to every table.</p>
          )}
        </div>
      ))}

      <div className="scroll-cue -mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" tabIndex={0} role="region" aria-label={`${results.roundName} results`}>
        <div className="min-w-[48rem] overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-mecg-navy/10">
                <th className={HEAD}>Applicant</th>
                <th className={HEAD}>Stars</th>
                <th className={HEAD}>Graders</th>
                <th className={HEAD}>Spread</th>
                {sessions.map((session) => <th key={session} className={HEAD}>S{session} tables</th>)}
                <th className={HEAD}><span className="sr-only">Scores and notes</span></th>
              </tr>
            </thead>
            <tbody>
              {results.applicants.map((applicant) => (
                <tr key={applicant.applicationId} className="border-b border-mecg-navy/10 bg-white align-top">
                  <td className="px-4 py-3">
                    <Link href={`/admin/applications/${applicant.applicationId}`} className="text-[13px] font-semibold text-mecg-navy hover:text-mecg-orange-ink">{applicant.name}</Link>
                  </td>
                  <td className={`${CELL} tabular font-semibold text-mecg-navy`}>{formatStars(applicant.mean)}</td>
                  <td className={`${CELL} tabular`}>{applicant.count}</td>
                  <td className={`${CELL} tabular`}>{applicant.stddev == null ? "—" : applicant.stddev.toFixed(1)}</td>
                  {sessions.map((session) => {
                    const declared = results.tables[String(session)];
                    const missing = missedTables(declared, applicant.tablesVisited[String(session)] ?? []);
                    return (
                      <td key={session} className={`${CELL} tabular`}>
                        {declared.length - missing.length}/{declared.length}
                        {missing.length > 0 && <span className="ml-1 text-[11px] text-mecg-navy/50">missing {missing.join(", ")}</span>}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3">
                    {applicant.scores.length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-[13px] font-semibold text-mecg-navy">Scores and notes</summary>
                        <ul className="mt-2 flex flex-col gap-2">
                          {applicant.scores.map((score, index) => (
                            <li key={`${score.evaluatorId}-${score.session}-${score.table}-${index}`} className="text-xs text-mecg-navy/70">
                              <p>{score.session == null || score.table == null ? "No table recorded" : `Session ${score.session} · Table ${score.table}`} · {score.evaluatorName} · {score.score} ★</p>
                              {canViewNotes && score.note?.trim() && <p className="mt-0.5 whitespace-pre-line text-mecg-navy/60">{score.note}</p>}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
              {!results.applicants.length && (
                <tr><td colSpan={5 + sessions.length} className="bg-white p-6 text-center text-sm text-mecg-navy/55">No Speed Dating applicants yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
