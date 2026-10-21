import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { requireAdmin } from "@/lib/auth";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import { screeningRpc, type ScreeningOverview } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";
import StatusPill from "@/components/status-pill";
import PacketAction from "./packet-action";
import ScreeningControls from "./screening-controls";
import { statusLabel } from "@/lib/labels";
import { rankScreeningResults } from "./screening-result-groups";
import { CLASS_YEAR_LABELS, type ClassYear } from "@/lib/workflow";

const REVIEWER_ROLES = ["RECRUITMENT_COMMITTEE", "BOARD", "OWNER"];
const TH = "px-4 py-3 text-[13px] font-semibold text-muted";
const TD = "px-4 py-3 text-[13px] text-muted";

export default async function ScreeningAdminPage() {
  const user = await requireAdmin();
  const cycleId = await selectWorkspaceCycle(user.memberships, "RECRUITMENT_OPERATIONS");
  if (!cycleId) redirect("/member");
  const supabase = await createClient();
  const [{ data: overview, error }, { data: memberships }, { count: submittedCount }] = await Promise.all([
    screeningRpc<ScreeningOverview>(supabase, "screening_admin_overview", { target_cycle_id: cycleId }),
    supabase.from("memberships").select("user_id,role,profiles!inner(display_name)").eq("cycle_id", cycleId).eq("active", true),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("cycle_id", cycleId).not("status", "in", "(DRAFT,WITHDRAWN)"),
  ]);
  if (error) throw new Error(error.message);
  const panelists = new Set((memberships ?? []).filter((item) => item.role === "PANEL").map((item) => item.user_id));
  const members = [...new Map((memberships ?? [])
    .filter((item) => REVIEWER_ROLES.includes(item.role) && !panelists.has(item.user_id))
    .map((item) => [item.user_id, { id: item.user_id, name: item.profiles.display_name }])).values()];
  const packets = overview?.packets ?? [];
  const byStatus = (status: string) => packets.filter((packet) => packet.status === status);
  const approved = byStatus("APPROVED");
  const unapproved = packets.filter((packet) => packet.status !== "APPROVED");
  const batch = overview && {
    id: overview.batchId,
    status: overview.status,
    releasedAt: overview.releasedAt ?? null,
    approved: approved.length,
    pending: byStatus("PENDING").length,
    rejected: byStatus("REJECTED").length,
    assigned: overview.assigned,
    submitted: overview.submitted,
    packets: packets.length,
    reviewers: overview.reviewers.map(({ id, name, assigned, submitted }) => ({ id, name, assigned, submitted })),
  };
  // The overview withholds packets from anyone enrolled as a reader in the batch.
  const packetsHidden = Boolean(overview) && packets.length === 0 && (overview?.assigned ?? 0) > 0;
  const ranked = rankScreeningResults(overview?.results ?? []);
  const reviewerSlots = Math.max(overview?.reviewsPerApplication ?? 3, ...ranked.map((applicant) => applicant.reviews.length));

  // Step 2 body: only packets that still need a decision are expanded.
  const packetList = overview?.status === "DRAFT" && (
    <div className="mt-5 space-y-5">
      {unapproved.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          {unapproved.map((packet) => (
            <article key={packet.id} className="rounded-xl p-5 inset-ring inset-ring-line">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{packet.applicantName}</h3>
                <StatusPill tone="orange">{statusLabel(packet.status)}</StatusPill>
              </div>
              <div className="mt-4 space-y-4">{(packet.content.responses ?? []).map((response, index) => <div key={`${packet.id}-${index}`}><h4 className="text-sm font-medium">{response.question}</h4><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted">{response.answer}</p></div>)}</div>
              <PacketAction cycleId={cycleId} packetId={packet.id} status={packet.status} responses={packet.content.responses ?? []} />
            </article>
          ))}
        </div>
      )}
      {approved.length > 0 && (
        <details className="rounded-xl p-4 inset-ring inset-ring-line">
          <summary className="cursor-pointer text-sm font-semibold text-muted">Approved · {approved.length}</summary>
          <ul className="mt-3 columns-2 gap-6 text-sm text-muted sm:columns-3">
            {approved.map((packet) => <li key={packet.id}><span className="font-mono text-xs text-mecg-navy">{packet.code}</span> {packet.applicantName}</li>)}
          </ul>
        </details>
      )}
    </div>
  );

  return (
    <main className="workspace-stack mx-auto flex max-w-6xl flex-col">
      <WorkspaceHeader
        eyebrow="Recruitment operations"
        title="Application review"
        description="Choose readers, approve the identity-free copies, assign review work, then close and review the internal ranking. Readers never see who wrote what."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/screening" />
      <ScreeningControls cycleId={cycleId} members={members} submittedCount={submittedCount ?? 0} batch={batch || undefined} packetList={packetList || undefined} packetsHidden={packetsHidden} canRelease={user.memberships.some((membership) => membership.cycleId === cycleId && membership.role === "OWNER")} />
      {packetsHidden && <p className="text-sm text-muted">Applications are hidden while you are a reader in this batch.</p>}
      {packets.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">All applications</h2>
          <p className="mt-1 text-sm text-muted">{packets.length} applications · {overview?.assigned ?? 0} reads assigned · {overview?.submitted ?? 0} submitted</p>
          <div className="scroll-cue -mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" tabIndex={0} role="region" aria-label="All applications">
            <div className="min-w-[40rem] overflow-hidden rounded-xl inset-ring inset-ring-line">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={TH}>Code</th>
                    <th className={TH}>Applicant</th>
                    <th className={TH}>Redaction</th>
                    <th className={TH}>Readers</th>
                  </tr>
                </thead>
                <tbody>
                  {packets.map((packet) => (
                    <Fragment key={packet.id}>
                      <tr>
                        <td className="px-4 pt-3 font-mono text-xs text-mecg-navy">{packet.code}</td>
                        <td className="px-4 pt-3 text-[13px] font-semibold text-mecg-navy">{packet.applicantName}</td>
                        <td className="px-4 pt-3"><StatusPill tone={packet.status === "APPROVED" ? "neutral" : "orange"}>{statusLabel(packet.status)}</StatusPill></td>
                        <td className="px-4 pt-3">
                          <div className="flex flex-wrap gap-1.5">
                            {(packet.assignments ?? []).map((assignment) => (
                              <StatusPill key={assignment.reviewerId} tone={["SUBMITTED", "LOCKED"].includes(assignment.status) ? "navy" : assignment.status === "RECUSED" ? "orange" : "neutral"}>
                                {assignment.reviewerName} · {statusLabel(assignment.status)}
                              </StatusPill>
                            ))}
                          </div>
                        </td>
                      </tr>
                      {overview?.status !== "DRAFT" && (
                        <tr className="border-b border-line">
                          <td colSpan={4} className="px-4 pb-3 pt-1">
                            <details>
                              <summary className="cursor-pointer text-[13px] font-semibold text-muted">Responses</summary>
                              <div className="mt-3 space-y-4">{(packet.content?.responses ?? []).map((response, index) => <div key={`${packet.id}-${index}`}><h3 className="text-sm font-medium">{response.question}</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted">{response.answer}</p></div>)}</div>
                            </details>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
      {overview?.status === "FROZEN" && (
        <section>
          <h2 className="text-xl font-semibold">Internal ranking</h2>
          <p className="mt-1 text-sm text-muted">{ranked.length} applicants · tied averages share a rank · <Link href={withWorkspaceCycle("/admin/screening/calibrated", cycleId)} className="font-semibold text-mecg-navy underline-offset-2 hover:underline">Reader-adjusted ranking</Link></p>
          <div className="scroll-cue -mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" tabIndex={0} role="region" aria-label="Screening ranking">
            <div className="min-w-[80rem] overflow-hidden rounded-xl inset-ring inset-ring-line">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={TH}>Rank</th>
                    <th className={TH}>Applicant</th>
                    <th className={TH}>Class</th>
                    <th className={TH}>Major</th>
                    <th className={TH}>Events</th>
                    {Array.from({ length: reviewerSlots }, (_, index) => <th key={index} className={TH}>Reviewer {index + 1}</th>)}
                    <th className={TH}>Average</th>
                    <th className={TH}>Z</th>
                    <th className={TH}>Recs</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((applicant) => (
                    <Fragment key={applicant.code}>
                      <tr className="border-b border-line">
                        <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-mecg-navy">{applicant.rank}</td>
                        <td className="px-4 py-3">
                          {applicant.applicantName
                            ? <><span className="text-[13px] font-semibold text-mecg-navy">{applicant.applicantName}</span><span className="block font-mono text-xs text-muted">{applicant.code}</span></>
                            : <span className="font-mono text-[13px] text-mecg-navy">{applicant.code}</span>}
                        </td>
                        <td className={TD}>{applicant.classYear ? CLASS_YEAR_LABELS[applicant.classYear as ClassYear] ?? applicant.classYear : ""}</td>
                        <td className={TD}>{applicant.major ?? ""}</td>
                        <td className={TD}>{applicant.events.map((event) => <span key={event} className="block whitespace-nowrap">{event}</span>)}</td>
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
                      <tr className="border-b border-line">
                        <td colSpan={8 + reviewerSlots} className="px-4 py-2">
                          <details>
                            <summary className="cursor-pointer text-[13px] font-semibold text-muted">Notes</summary>
                            <div className="mt-3 space-y-4">
                              {applicant.reviews.map((review, index) => (
                                <div key={review.reviewerId ?? index}>
                                  <p className="text-[13px] font-semibold text-mecg-navy">{review.reviewerName ?? `Reviewer ${index + 1}`} · {statusLabel(review.recommendation)}</p>
                                  {review.evidence && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted">{review.evidence}</p>}
                                  <p className="mt-1 text-[13px] text-muted">
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
