import { Fragment } from "react";
import { redirect } from "next/navigation";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { requireAdmin } from "@/lib/auth";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import { screeningRpc, type ScreeningOverview } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";
import { statusLabel } from "@/lib/labels";
import { calibrateScreeningResults } from "../reader-calibration";
import { CLASS_YEAR_LABELS, type ClassYear } from "@/lib/workflow";

const TH = "px-4 py-3 text-[13px] font-semibold text-mecg-navy/55";
const TD = "px-4 py-3 text-[13px] text-mecg-navy/55";
const signed = (value: number, digits: number) => `${value < 0 ? "-" : "+"}${Math.abs(value).toFixed(digits)}`;

export default async function CalibratedScreeningPage() {
  const user = await requireAdmin();
  const cycleId = await selectWorkspaceCycle(user.memberships, "RECRUITMENT_OPERATIONS");
  if (!cycleId) redirect("/member");
  const supabase = await createClient();
  const { data: overview, error } = await screeningRpc<ScreeningOverview>(supabase, "screening_admin_overview", { target_cycle_id: cycleId });
  if (error) throw new Error(error.message);
  const frozen = overview?.status === "FROZEN";
  const { readers, applicants } = frozen ? calibrateScreeningResults(overview.results ?? []) : { readers: [], applicants: [] };
  const reviewerSlots = Math.max(overview?.reviewsPerApplication ?? 3, ...applicants.map((applicant) => applicant.adjustedReviews.length));

  return (
    <main className="workspace-stack mx-auto flex max-w-6xl flex-col">
      <WorkspaceHeader
        eyebrow="Recruitment operations"
        title="Reader-adjusted ranking"
        description="Every reader grades a little harder or softer than the group. This ranking removes each reader's average lean, measured only against co-readers on the same applications, so an applicant is not helped or hurt by who happened to read them."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/screening" />
      {!frozen && <p className="text-sm text-mecg-navy/55">The ranking appears once the batch is closed.</p>}
      {frozen && (
        <section>
          <h2 className="text-xl font-semibold">Readers</h2>
          <p className="mt-1 text-sm text-mecg-navy/55">Lean is the points a reader sits above or below a neutral reader. Spread is how widely they use the scale.</p>
          <div className="scroll-cue -mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" tabIndex={0} role="region" aria-label="Readers">
            <div className="min-w-[30rem] overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-mecg-navy/10">
                    <th className={TH}>Reader</th>
                    <th className={TH}>Reads</th>
                    <th className={TH}>Lean</th>
                    <th className={TH}>Spread</th>
                  </tr>
                </thead>
                <tbody>
                  {readers.map((reader) => (
                    <tr key={reader.id} className="border-b border-mecg-navy/10">
                      <td className="px-4 py-3 text-[13px] font-semibold text-mecg-navy">{reader.name}</td>
                      <td className={`${TD} tabular-nums`}>{reader.reads}</td>
                      <td className={`${TD} tabular-nums`}>{signed(reader.effect, 1)}</td>
                      <td className={`${TD} tabular-nums`}>±{Math.round(reader.spread)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
      {frozen && (
        <section>
          <h2 className="text-xl font-semibold">Ranking</h2>
          <p className="mt-1 text-sm text-mecg-navy/55">{applicants.length} applicants · ranked on adjusted average · tied averages share a rank</p>
          <div className="scroll-cue -mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" tabIndex={0} role="region" aria-label="Reader-adjusted ranking">
            <div className="min-w-[80rem] overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-mecg-navy/10">
                    <th className={TH}>Rank</th>
                    <th className={TH}>Raw rank</th>
                    <th className={TH}>Move</th>
                    <th className={TH}>Applicant</th>
                    <th className={TH}>Class</th>
                    <th className={TH}>Major</th>
                    {Array.from({ length: reviewerSlots }, (_, index) => <th key={index} className={TH}>Reviewer {index + 1}</th>)}
                    <th className={TH}>Raw avg</th>
                    <th className={TH}>Adjusted avg</th>
                    <th className={TH}>Recs</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.map((applicant) => {
                    const move = applicant.rawRank - applicant.adjustedRank;
                    return (
                      <Fragment key={applicant.code}>
                        <tr className="border-b border-mecg-navy/10">
                          <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-mecg-navy">{applicant.adjustedRank}</td>
                          <td className={`${TD} tabular-nums`}>{applicant.rawRank}</td>
                          <td className={`px-4 py-3 text-[13px] font-semibold tabular-nums ${move > 0 ? "text-emerald-700" : move < 0 ? "text-red-700" : "text-mecg-navy/55"}`}>{move === 0 ? "·" : signed(move, 0)}</td>
                          <td className="px-4 py-3">
                            {applicant.applicantName
                              ? <><span className="text-[13px] font-semibold text-mecg-navy">{applicant.applicantName}</span><span className="block font-mono text-xs text-mecg-navy/60">{applicant.code}</span></>
                              : <span className="font-mono text-[13px] text-mecg-navy">{applicant.code}</span>}
                          </td>
                          <td className={TD}>{applicant.classYear ? CLASS_YEAR_LABELS[applicant.classYear as ClassYear] ?? applicant.classYear : ""}</td>
                          <td className={TD}>{applicant.major ?? ""}</td>
                          {Array.from({ length: reviewerSlots }, (_, index) => {
                            const review = applicant.adjustedReviews[index];
                            return (
                              <td key={index} className={TD}>
                                {review && <><span className="block text-mecg-navy">{review.reviewerName ?? `Reviewer ${index + 1}`}</span><span className="tabular-nums">{review.score.toFixed(1)} {"→"} {review.adjusted.toFixed(1)}</span></>}
                              </td>
                            );
                          })}
                          <td className={`${TD} tabular-nums`}>{applicant.averageScore.toFixed(1)}</td>
                          <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-mecg-navy">{applicant.adjustedScore.toFixed(1)}</td>
                          <td className={`${TD} tabular-nums`}>{Object.entries(applicant.recommendationCounts).map(([recommendation, count]) => `${count}${recommendation[0]}`).join(" ")}</td>
                        </tr>
                        <tr className="border-b border-mecg-navy/10">
                          <td colSpan={9 + reviewerSlots} className="px-4 py-2">
                            <details>
                              <summary className="cursor-pointer text-[13px] font-semibold text-mecg-navy/70">Notes</summary>
                              <div className="mt-3 space-y-4">
                                {applicant.reviews.map((review, index) => (
                                  <div key={review.reviewerId ?? index}>
                                    <p className="text-[13px] font-semibold text-mecg-navy">{review.reviewerName ?? `Reviewer ${index + 1}`} · {statusLabel(review.recommendation)}</p>
                                    {review.evidence && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-mecg-navy/65">{review.evidence}</p>}
                                    <p className="mt-1 text-[13px] text-mecg-navy/55">
                                      {review.ratings.map((rating) => `${rating.name} ${rating.score}${rating.note ? ` (${rating.note})` : ""}`).join(" · ")}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
