"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StatusPill from "@/components/status-pill";
import { initials } from "@/lib/initials";
import { compareResults, matchesApplicantName, matchesNote, type ResultsSortKey } from "@/lib/speed-dating-roster";

// Shape of the speed_dating_results RPC. Applicants arrive sorted adjusted
// desc (nulls last). "adjusted" is the grader-normalized score on the same
// 1..5 feel as the stars (3 = average); "thin" is fewer than 8 graders and
// "split" a spread of a star or more.
export type SpeedDatingResults = {
  roundId: string;
  roundName: string;
  roundStatus: string;
  summary: { applicants: number; graded: number; graders: number; thin: number; split: number; scores: number };
  applicants: Array<{
    applicationId: string;
    name: string;
    status: string;
    mean: number | null;
    median: number | null;
    count: number;
    stddev: number | null;
    adjusted: number | null;
    histogram: number[];
    thin: boolean;
    split: boolean;
    scores: Array<{
      evaluatorName: string;
      evaluatorId: string;
      session: number | null;
      score: number;
      note: string;
      submittedAt: string;
    }>;
  }>;
  graders: Array<{ evaluatorId: string; evaluatorName: string; count: number; mean: number; stddev: number | null; notes: number }>;
};

type GraderSortKey = "count" | "mean";
type Direction = "desc" | "asc";
type Flag = "thin" | "split" | null;

const REFRESH_MS = 30_000;
const STARS = [1, 2, 3, 4, 5];

const timeFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", hour: "numeric", minute: "2-digit" });

export function formatStars(mean: number | null) {
  return mean == null ? "—" : `${mean.toFixed(1)} ★`;
}

function fixed(value: number | null) {
  return value == null ? "—" : value.toFixed(1);
}

// Seconds since the last server refresh; refreshes only while the tab is showing.
function useLiveRefresh() {
  const router = useRouter();
  const [secondsAgo, setSecondsAgo] = useState(0);
  useEffect(() => {
    let last = Date.now();
    function tick() {
      const current = Date.now();
      if (document.visibilityState === "visible" && current - last >= REFRESH_MS) {
        last = current;
        router.refresh();
      }
      setSecondsAgo(Math.round((current - last) / 1000));
    }
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);
  return secondsAgo;
}

const HEAD = "px-4 py-3 text-[13px] font-semibold text-mecg-navy/55";
const CELL = "px-4 py-3 text-[13px] text-mecg-navy/70";
const CHIP = "inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold transition";

function SortHeader<Key extends string>({ label, sortKey, active, direction, onSort }: { label: string; sortKey: Key; active: boolean; direction: Direction; onSort: (key: Key) => void }) {
  return (
    <th className={HEAD} aria-sort={active ? (direction === "desc" ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => onSort(sortKey)} className={`inline-flex items-center gap-1 hover:text-mecg-navy ${active ? "text-mecg-navy" : ""}`}>
        {label}
        <span aria-hidden="true" className={active ? "" : "invisible"}>{direction === "desc" ? "↓" : "↑"}</span>
      </button>
    </th>
  );
}

function Histogram({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  return (
    <div className="flex h-6 items-end gap-0.5" title={STARS.map((star) => `${star}★: ${counts[star - 1] ?? 0}`).join(" · ")} role="img" aria-label={STARS.map((star) => `${counts[star - 1] ?? 0} at ${star} star${counts[star - 1] === 1 ? "" : "s"}`).join(", ")}>
      {STARS.map((star) => (
        <span key={star} className="w-1.5 rounded-sm bg-mecg-navy/60" style={{ height: `${Math.max(counts[star - 1] ? 8 : 2, ((counts[star - 1] ?? 0) / max) * 100)}%` }} />
      ))}
    </div>
  );
}

export default function SpeedDatingResultsTable({ results, canViewNotes, canExport }: { results: SpeedDatingResults; canViewNotes: boolean; canExport: boolean }) {
  const [failedHeadshots, setFailedHeadshots] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<{ key: ResultsSortKey; direction: Direction }>({ key: "adjusted", direction: "desc" });
  const [graderSort, setGraderSort] = useState<{ key: GraderSortKey; direction: Direction }>({ key: "count", direction: "desc" });
  const [flag, setFlag] = useState<Flag>(null);
  const [query, setQuery] = useState("");
  const secondsAgo = useLiveRefresh();

  function markHeadshotFailed(applicationId: string) {
    setFailedHeadshots((current) => current.has(applicationId) ? current : new Set(current).add(applicationId));
  }
  function toggleExpanded(applicationId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(applicationId)) next.add(applicationId);
      return next;
    });
  }
  function sortBy(key: ResultsSortKey) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "desc" ? "asc" : "desc" }));
  }
  function sortGradersBy(key: GraderSortKey) {
    setGraderSort((current) => ({ key, direction: current.key === key && current.direction === "desc" ? "asc" : "desc" }));
  }

  // Rank follows the sort, not the filter, so a searched row keeps its place in the room.
  const ranked = useMemo(() => [...results.applicants].sort((a, b) => compareResults(a, b, sort.key, sort.direction)).map((applicant, index) => ({ applicant, rank: index + 1 })), [results.applicants, sort]);
  const visible = ranked.flatMap(({ applicant, rank }) => {
    if (flag && !applicant[flag]) return [];
    const noteHit = canViewNotes && applicant.scores.some((score) => matchesNote(score.note, query));
    if (!matchesApplicantName(applicant.name, query) && !noteHit) return [];
    return [{ applicant, rank, noteHit }];
  });
  const graders = [...results.graders].sort((a, b) => (graderSort.direction === "desc" ? b[graderSort.key] - a[graderSort.key] : a[graderSort.key] - b[graderSort.key]) || a.evaluatorName.localeCompare(b.evaluatorName));
  const { summary } = results;
  const exportHref = (kind: string) => `/api/admin/export?kind=${kind}&roundId=${encodeURIComponent(results.roundId)}`;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="tabular text-sm text-mecg-navy/55">
          {summary.graded}/{summary.applicants} graded · {summary.graders} grader{summary.graders === 1 ? "" : "s"} · {summary.scores} score{summary.scores === 1 ? "" : "s"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={flag === "thin"} onClick={() => setFlag(flag === "thin" ? null : "thin")} className={`${CHIP} ${flag === "thin" ? "bg-mecg-navy text-white" : "bg-mecg-orange/[0.14] text-mecg-orange-ink hover:bg-mecg-orange/[0.24]"}`}>
            {summary.thin} thin
          </button>
          <button type="button" aria-pressed={flag === "split"} onClick={() => setFlag(flag === "split" ? null : "split")} className={`${CHIP} ${flag === "split" ? "bg-mecg-navy text-white" : "bg-mecg-orange/[0.14] text-mecg-orange-ink hover:bg-mecg-orange/[0.24]"}`}>
            {summary.split} split room
          </button>
        </div>
        <p className="text-xs text-mecg-navy/45">Live · updated {secondsAgo}s ago</p>
        {canExport && (
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <a href={exportHref("speed-dating-summary")} className="button-secondary text-sm" download>Summary CSV</a>
            <a href={exportHref("speed-dating-scores")} className="button-secondary text-sm" download>All scores CSV</a>
          </div>
        )}
      </div>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={canViewNotes ? "Search a name or a note" : "Search a name"}
        aria-label="Search applicants"
        autoComplete="off"
        className="mt-3 min-h-11 w-full max-w-md rounded-xl border border-mecg-navy/15 bg-white px-4 py-2 text-sm text-mecg-navy outline-none transition focus:border-mecg-blue focus:ring-4 focus:ring-mecg-blue/10"
      />

      <div className="scroll-cue -mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" tabIndex={0} role="region" aria-label={`${results.roundName} results`}>
        <div className="min-w-[56rem] overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-mecg-navy/10">
                <th className={HEAD}>#</th>
                <th className={HEAD}>Applicant</th>
                <SortHeader label="Adjusted" sortKey="adjusted" active={sort.key === "adjusted"} direction={sort.direction} onSort={sortBy} />
                <SortHeader label="Mean ★" sortKey="mean" active={sort.key === "mean"} direction={sort.direction} onSort={sortBy} />
                <SortHeader label="Graders" sortKey="count" active={sort.key === "count"} direction={sort.direction} onSort={sortBy} />
                <SortHeader label="Spread" sortKey="stddev" active={sort.key === "stddev"} direction={sort.direction} onSort={sortBy} />
                <th className={HEAD}>Histogram</th>
                <th className={HEAD}>Flags</th>
                <th className={HEAD}><span className="sr-only">Scores and notes</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ applicant, rank, noteHit }) => {
                const ungraded = applicant.count === 0;
                const open = noteHit || expanded.has(applicant.applicationId);
                const scores = [...applicant.scores].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
                return (
                  <tr key={applicant.applicationId} className={`border-b border-mecg-navy/10 bg-white align-top ${ungraded ? "opacity-60" : ""}`}>
                    <td className={`${CELL} tabular`}>{ungraded ? "—" : rank}</td>
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
                      {ungraded && <p className="mt-1 text-xs text-mecg-navy/55">Not graded yet</p>}
                    </td>
                    <td className={`${CELL} tabular font-bold text-mecg-navy`}>{fixed(applicant.adjusted)}</td>
                    <td className={`${CELL} tabular`}>{formatStars(applicant.mean)}</td>
                    <td className={`${CELL} tabular`}>{applicant.count}</td>
                    <td className={`${CELL} tabular`}>{fixed(applicant.stddev)}</td>
                    <td className="px-4 py-3">{ungraded ? null : <Histogram counts={applicant.histogram} />}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {applicant.thin && <StatusPill tone="orange">thin</StatusPill>}
                        {applicant.split && <StatusPill tone="orange">split</StatusPill>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {scores.length > 0 && (
                        <>
                          <button type="button" aria-expanded={open} onClick={() => toggleExpanded(applicant.applicationId)} className="text-[13px] font-semibold text-mecg-navy hover:text-mecg-orange-ink">
                            {open ? "Hide" : "Scores"}
                          </button>
                          {open && (
                            <ul className="mt-2 flex w-56 flex-col gap-2">
                              {scores.map((score, index) => {
                                const hit = canViewNotes && matchesNote(score.note, query);
                                return (
                                  <li key={`${score.evaluatorId}-${score.session}-${index}`} className="text-xs text-mecg-navy/70">
                                    <p>{score.evaluatorName} · {score.score} ★{score.session == null ? "" : ` · Session ${score.session}`} · {timeFormatter.format(new Date(score.submittedAt)).toLowerCase()}</p>
                                    {canViewNotes && score.note.trim() && <p className={`mt-0.5 whitespace-pre-line text-mecg-navy/60 ${hit ? "rounded bg-amber-100 px-1 text-mecg-navy" : ""}`}>{score.note}</p>}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!visible.length && (
                <tr><td colSpan={9} className="bg-white p-6 text-center text-sm text-mecg-navy/55">{results.applicants.length ? "No applicant matches." : "No Speed Dating applicants yet."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <h3 className="mt-8 text-[15px] font-semibold text-mecg-navy">Graders</h3>
      <div className="scroll-cue -mx-4 mt-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" tabIndex={0} role="region" aria-label={`${results.roundName} graders`}>
        <div className="min-w-[36rem] overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-mecg-navy/10">
                <th className={HEAD}>Grader</th>
                <SortHeader label="Graded" sortKey="count" active={graderSort.key === "count"} direction={graderSort.direction} onSort={sortGradersBy} />
                <SortHeader label="Mean ★" sortKey="mean" active={graderSort.key === "mean"} direction={graderSort.direction} onSort={sortGradersBy} />
                <th className={HEAD}>Spread</th>
                <th className={HEAD}>Notes</th>
                <th className={HEAD}><span className="sr-only">Flags</span></th>
              </tr>
            </thead>
            <tbody>
              {graders.map((grader) => (
                <tr key={grader.evaluatorId} className="border-b border-mecg-navy/10 bg-white">
                  <td className={`${CELL} font-semibold text-mecg-navy`}>{grader.evaluatorName}</td>
                  <td className={`${CELL} tabular`}>{grader.count}</td>
                  <td className={`${CELL} tabular`}>{formatStars(grader.mean)}</td>
                  <td className={`${CELL} tabular`}>{fixed(grader.stddev)}</td>
                  <td className={`${CELL} tabular`}>{grader.notes}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {grader.mean >= 4.5 && <StatusPill tone="neutral">lenient</StatusPill>}
                      {grader.mean <= 2 && <StatusPill tone="neutral">harsh</StatusPill>}
                      {grader.count < 10 && <StatusPill tone="neutral">few</StatusPill>}
                    </div>
                  </td>
                </tr>
              ))}
              {!graders.length && (
                <tr><td colSpan={6} className="bg-white p-6 text-center text-sm text-mecg-navy/55">No one has graded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
