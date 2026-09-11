import { Fragment } from "react";
import { redirect } from "next/navigation";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { requireAdmin } from "@/lib/auth";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { screeningRpc, type ScreeningOverview } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";
import StatusPill from "@/components/status-pill";
import PacketAction from "./packet-action";
import ScreeningControls from "./screening-controls";
import { statusLabel } from "@/lib/labels";
import { rankScreeningResults } from "./screening-result-groups";
import { CLASS_YEAR_LABELS, type ClassYear } from "@/lib/workflow";

const REVIEWER_ROLES = ["RECRUITMENT_COMMITTEE", "BOARD", "OWNER"];
const TH = "px-4 py-3 text-[13px] font-semibold text-mecg-navy/55";
const TD = "px-4 py-3 text-[13px] text-mecg-navy/55";

export default async function ScreeningAdminPage() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "RECRUITMENT_OPERATIONS");
  if (!cycleId) redirect("/member");
  const supabase = await createClient();
  const [{ data: overview, error }, { data: memberships }] = await Promise.all([
    screeningRpc<ScreeningOverview>(supabase, "screening_admin_overview", { target_cycle_id: cycleId }),
    supabase.from("memberships").select("user_id,role,profiles!inner(display_name)").eq("cycle_id", cycleId).eq("active", true),
  ]);
  if (error) throw new Error(error.message);
  const panelists = new Set((memberships ?? []).filter((item) => item.role === "PANEL").map((item) => item.user_id));
  const members = [...new Map((memberships ?? [])
    .filter((item) => REVIEWER_ROLES.includes(item.role) && !panelists.has(item.user_id))
    .map((item) => [item.user_id, { id: item.user_id, name: item.profiles.display_name }])).values()];
  const ranked = rankScreeningResults(overview?.results ?? []);
  const reviewerSlots = Math.max(overview?.reviewsPerApplication ?? 3, ...ranked.map((applicant) => applicant.reviews.length));

  return (
    <main className="workspace-stack mx-auto flex max-w-6xl flex-col">
      <WorkspaceHeader
        eyebrow="Recruitment operations"
        title="Review setup"
        description="Review and approve identity-free copies of each application before assigning exactly three independent reviewers. Reviewers never see who wrote what."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/screening" />
      <ScreeningControls cycleId={cycleId} members={members} batchId={overview?.batchId} status={overview?.status} />
      {overview && (
        <p className="rounded-2xl bg-mecg-navy/[0.03] p-4 text-sm text-mecg-navy/70">
          {overview.packets.length} applications · {overview.assigned} active assignments · {overview.submitted} submitted reviews
        </p>
      )}
      <section className="grid gap-5 lg:grid-cols-2">
        {(overview?.packets ?? []).map((packet) => (
          <article key={packet.id} className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-mecg-navy/60">{packet.code}</p>
                <h2 className="mt-1 font-semibold">Identity steward: {packet.applicantName}</h2>
              </div>
              <StatusPill tone="orange">{statusLabel(packet.status)}</StatusPill>
            </div>
            <div className="mt-4 space-y-4">{(packet.content.responses ?? []).map((response, index) => <div key={`${packet.id}-${index}`}><h3 className="text-sm font-medium">{response.question}</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-mecg-navy/65">{response.answer}</p></div>)}</div>
            {overview?.status === "DRAFT" && <PacketAction cycleId={cycleId} packetId={packet.id} status={packet.status} responses={packet.content.responses ?? []} />}
          </article>
        ))}
      </section>
      {overview?.status === "FROZEN" && (
        <section>
          <h2 className="text-xl font-semibold">Ranking</h2>
          <div className="scroll-cue -mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" tabIndex={0} role="region" aria-label="Screening ranking">
            <div className="min-w-[56rem] overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-mecg-navy/10">
                    <th className={TH}>Rank</th>
                    <th className={TH}>Applicant</th>
                    <th className={TH}>Class</th>
                    <th className={TH}>Major</th>
                    {Array.from({ length: reviewerSlots }, (_, index) => <th key={index} className={TH}>Reviewer {index + 1}</th>)}
                    <th className={TH}>Average</th>
                    <th className={TH}>Z</th>
                    <th className={TH}>Recs</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((applicant) => (
                    <Fragment key={applicant.code}>
                      <tr className="border-b border-mecg-navy/10">
                        <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-mecg-navy">{applicant.rank}</td>
                        <td className="px-4 py-3">
                          {applicant.applicantName
                            ? <><span className="text-[13px] font-semibold text-mecg-navy">{applicant.applicantName}</span><span className="block font-mono text-xs text-mecg-navy/60">{applicant.code}</span></>
                            : <span className="font-mono text-[13px] text-mecg-navy">{applicant.code}</span>}
                        </td>
                        <td className={TD}>{applicant.classYear ? CLASS_YEAR_LABELS[applicant.classYear as ClassYear] ?? applicant.classYear : ""}</td>
                        <td className={TD}>{applicant.major ?? ""}</td>
                        {Array.from({ length: reviewerSlots }, (_, index) => {
                          const review = applicant.reviews[index];
                          return (
                            <td key={index} className={TD}>
                              {review && <><span className="block text-mecg-navy">{review.reviewerName ?? `Reviewer ${index + 1}`}</span><span className="tabular-nums">{review.score.toFixed(1)}</span></>}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-mecg-navy">{applicant.averageScore.toFixed(1)}</td>
                        <td className={`${TD} tabular-nums`}>{applicant.zScore === null ? "\u2013" : applicant.zScore.toFixed(2)}</td>
                        <td className={`${TD} tabular-nums`}>{Object.entries(applicant.recommendationCounts).map(([recommendation, count]) => `${count}${recommendation[0]}`).join(" ")}</td>
                      </tr>
                      <tr className="border-b border-mecg-navy/10">
                        <td colSpan={7 + reviewerSlots} className="px-4 py-2">
                          <details>
                            <summary className="cursor-pointer text-[13px] font-semibold text-mecg-navy/70">Notes</summary>
                            <div className="mt-3 space-y-4">
                              {applicant.reviews.map((review, index) => (
                                <div key={review.reviewerId ?? index}>
                                  <p className="text-[13px] font-semibold text-mecg-navy">{review.reviewerName ?? `Reviewer ${index + 1}`} · {statusLabel(review.recommendation)}</p>
                                  {review.evidence && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-mecg-navy/65">{review.evidence}</p>}
                                  <p className="mt-1 text-[13px] text-mecg-navy/55">
                                    {review.ratings.map((rating) => `${rating.name} ${rating.score}${rating.note ? ` (${rating.note})` : ""}`).join(" \u00b7 ")}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </details>
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
