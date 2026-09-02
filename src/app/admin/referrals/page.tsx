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
    [referrals.length, "total"],
    [countOf("NEW"), "sent"],
    [countOf("REVIEWED"), "reviewed"],
    [countOf("INVITED"), "invited"],
  ] as const;

  return (
    <main className="workspace-stack mx-auto flex max-w-7xl flex-col">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycleStatusLabel(cycle.status)}`}
        title="Referrals"
        description="People your members think should be in MECG."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/referrals" />

      <section>
        <div className="grid gap-3 sm:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={label} className="rounded-2xl bg-mecg-navy px-4 py-3">
              <StatTile value={value} label={label} tone="dark" />
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 md:hidden">
          {referrals.map((referral) => (
            <article key={referral.id} className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
              <p className="text-[15px] font-semibold text-mecg-navy">{referral.name}</p>
              <p className="mt-0.5 break-words text-[13px] text-mecg-navy/65">{referral.email}</p>
              <p className="mt-1 text-[12px] text-mecg-navy/55">
                {[referral.year_major, `Referred by ${referrerName.get(referral.referrer_id) ?? "a member"}`].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-2 text-[13px] leading-5 text-mecg-navy/70">{referral.reason}</p>
              <p className="mt-2 text-[12px] text-mecg-navy/55">{formatEasternDateTime(referral.created_at)}</p>
              <div className="mt-3">
                <ReferralStatusForm referralId={referral.id} referralName={referral.name} current={referral.status} />
              </div>
            </article>
          ))}
          {!referrals.length && (
            <p className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-sm text-mecg-navy/55">
              No referrals yet. Members send them from Refer someone.
            </p>
          )}
        </div>

        <div className="scroll-cue mt-4 hidden overflow-x-auto rounded-2xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] md:block" tabIndex={0} role="region" aria-label="Referrals">
          <table className="w-full text-left text-sm">
            <thead className="bg-mecg-navy/[0.03]">
              <tr>
                <th className="p-3 text-[13px] font-semibold text-mecg-navy/60">Person</th>
                <th className="p-3 text-[13px] font-semibold text-mecg-navy/60">Referred by</th>
                <th className="p-3 text-[13px] font-semibold text-mecg-navy/60">Year &amp; major</th>
                <th className="p-3 text-[13px] font-semibold text-mecg-navy/60">Why</th>
                <th className="p-3 text-[13px] font-semibold text-mecg-navy/60">Submitted</th>
                <th className="p-3 text-[13px] font-semibold text-mecg-navy/60">Status</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((referral) => (
                <tr key={referral.id} className="border-t border-mecg-navy/[0.08] align-top">
                  <td className="p-3">
                    <span className="block font-semibold text-mecg-navy">{referral.name}</span>
                    <span className="block text-[12px] text-mecg-navy/60">{referral.email}</span>
                  </td>
                  <td className="p-3 text-[13px] text-mecg-navy/70">{referrerName.get(referral.referrer_id) ?? "A member"}</td>
                  <td className="p-3 text-[13px] text-mecg-navy/70">{referral.year_major || "—"}</td>
                  <td className="max-w-96 p-3 text-[13px] leading-5 text-mecg-navy/70">{referral.reason}</td>
                  <td className="p-3 text-[12px] text-mecg-navy/60">{formatEasternDateTime(referral.created_at)}</td>
                  <td className="p-3">
                    <ReferralStatusForm referralId={referral.id} referralName={referral.name} current={referral.status} />
                  </td>
                </tr>
              ))}
              {!referrals.length && (
                <tr className="border-t border-mecg-navy/[0.08]">
                  <td colSpan={6} className="p-6 text-sm text-mecg-navy/55">No referrals yet. Members send them from Refer someone.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
