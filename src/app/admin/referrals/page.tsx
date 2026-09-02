import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";
import { cycleStatusLabel } from "@/lib/labels";
import { formatEasternDateTime } from "@/lib/date-time";
import StatTile from "@/components/stat-tile";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import ReferralStatusForm from "./referral-status-form";

export const metadata: Metadata = { title: "Referrals" };

export default async function ReferralsPage() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "RECRUITMENT_OPERATIONS");
  if (!cycleId) redirect("/member");
  const supabase = await createClient();
  const [cycleResult, referralsResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    supabase
      .from("referrals")
      .select("id,name,email,year_major,reason,status,created_at,referrer_id")
      .eq("cycle_id", cycleId)
      .order("created_at", { ascending: false }),
  ]);
  if (cycleResult.error) throw cycleResult.error;
  if (referralsResult.error) throw referralsResult.error;
  const cycle = cycleResult.data;
  if (!cycle) redirect("/member");
  const referrals = referralsResult.data ?? [];

  // Second query rather than an embed: the referrer name is the only thing
  // needed from profiles and this keeps one referrer's missing profile row from
  // dropping the referral out of the board's list.
  const referrerIds = [...new Set(referrals.map((referral) => referral.referrer_id))];
  const { data: referrers, error: referrersError } = referrerIds.length
    ? await supabase.from("profiles").select("id,display_name").in("id", referrerIds)
    : { data: [], error: null };
  if (referrersError) throw referrersError;
  const referrerName = new Map((referrers ?? []).map((profile) => [profile.id, profile.display_name]));

  const countOf = (status: string) => referrals.filter((referral) => referral.status === status).length;
  const stats = [
    [referrals.length, "total referrals"],
    [countOf("NEW"), "awaiting review"],
    [countOf("REVIEWED"), "ready for outreach"],
    [countOf("INVITED") + countOf("PASSED"), "complete"],
  ] as const;
  const statusPriority: Record<string, number> = { NEW: 0, REVIEWED: 1, INVITED: 2, PASSED: 3 };
  const orderedReferrals = [...referrals].sort((a, b) => (statusPriority[a.status] ?? 4) - (statusPriority[b.status] ?? 4));

  return (
    <main className="workspace-stack mx-auto flex max-w-7xl flex-col">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycleStatusLabel(cycle.status)}`}
        title="Referrals"
        description="Review each member referral, handle outreach, and keep one reliable status."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin" />

      <section>
        <div className="grid gap-3 sm:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={label} className="rounded-2xl bg-mecg-navy px-4 py-3">
              <StatTile value={value} label={label} tone="dark" />
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3" aria-label="Referral review queue">
          {orderedReferrals.map((referral) => (
            <article key={referral.id} className="grid gap-4 rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div>
                    <p className="text-[15px] font-semibold text-mecg-navy">{referral.name}</p>
                    <p className="mt-0.5 break-words text-[13px] text-mecg-navy/65">{referral.email}</p>
                  </div>
                  <p className="text-[12px] text-mecg-navy/55">Submitted {formatEasternDateTime(referral.created_at)}</p>
                </div>
                <p className="mt-2 text-[12px] text-mecg-navy/55">
                  {[referral.year_major, `Referred by ${referrerName.get(referral.referrer_id) ?? "a member"}`].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-3 rounded-xl bg-mecg-navy/[0.035] px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mecg-navy/45">Why they may fit</p>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-mecg-navy/70">{referral.reason}</p>
                </div>
              </div>
              <div className="border-t border-mecg-navy/[0.08] pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <ReferralStatusForm key={`${referral.id}-${referral.status}`} referralId={referral.id} referralName={referral.name} current={referral.status} />
              </div>
            </article>
          ))}
          {!referrals.length && (
            <div className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6">
              <p className="text-sm font-semibold text-mecg-navy">No referrals to review</p>
              <p className="mt-1 text-sm leading-6 text-mecg-navy/55">When a member submits a referral, it will appear here at the top of the review queue.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
