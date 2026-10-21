import { selectWorkspaceMembership } from "@/lib/workspace-cycle";
import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cycleStatusLabel, referralStatusLabel } from "@/lib/labels";
import { formatEasternDateTime } from "@/lib/date-time";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import SectionLabel from "@/components/section-label";
import StatusPill from "@/components/status-pill";
import ReferralForm from "./referral-form";

export const metadata: Metadata = { title: "Refer someone" };

function statusTone(status: string) {
  if (status === "INVITED") return "navy" as const;
  if (status === "PASSED") return "neutral" as const;
  return "orange" as const;
}

function nextAction(status: string) {
  if (status === "NEW") return "Board review is next. Nothing else for you to do.";
  if (status === "REVIEWED") return "The Board reviewed it. Nothing else for you to do.";
  if (status === "INVITED") return "The Board recorded an invitation. You can follow up with them personally.";
  if (status === "PASSED") return "This referral is closed for this cycle.";
  return "The Board will update this status when it has a next step.";
}

export default async function ReferPage() {
  const user = await requireMember();
  const cycleMembership = await selectWorkspaceMembership(user, ["MEMBER", "BOARD", "PANEL", "OWNER", "RECRUITMENT_COMMITTEE"]);
  if (!cycleMembership) return null;

  const supabase = await createClient();
  const { data: referrals, error } = await supabase
    .from("referrals")
    .select("id,name,email,year_major,status,created_at")
    .eq("cycle_id", cycleMembership.cycleId)
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (
    <main className="workspace-stack mx-auto flex max-w-4xl flex-col">
      <WorkspaceHeader
        eyebrow={`${cycleMembership.cycle.name} · ${cycleStatusLabel(cycleMembership.cycle.status)}`}
        title="Refer someone"
        description="Know someone who would be good in MECG? Tell the board about them."
      />
      <WorkspaceNav user={user} cycleId={cycleMembership.cycleId} current="/member/refer" />

      <section>
        <SectionLabel number="01">New referral</SectionLabel>
        <div className="mt-3.5">
          <ReferralForm cycleId={cycleMembership.cycleId} />
        </div>
      </section>

      <section>
        <SectionLabel number="02">Your referrals</SectionLabel>
        <div className="mt-3.5 flex flex-col gap-3">
          {(referrals ?? []).map((referral) => (
            <article key={referral.id} className="rounded-xl bg-white p-4 inset-ring inset-ring-line">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-mecg-navy">{referral.name}</p>
                  <p className="mt-0.5 break-words text-[13px] text-muted">{referral.email}</p>
                  {referral.year_major && <p className="mt-0.5 text-xs text-muted">{referral.year_major}</p>}
                </div>
                <StatusPill tone={statusTone(referral.status)}>{referralStatusLabel(referral.status)}</StatusPill>
              </div>
              <div className="mt-3 rounded-xl bg-wash px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Next</p>
                <p className="mt-1 text-[13px] leading-5 text-muted">{nextAction(referral.status)}</p>
              </div>
              <p className="mt-2 text-xs text-muted">Submitted {formatEasternDateTime(referral.created_at)}</p>
            </article>
          ))}
          {!referrals?.length && (
            <p className="rounded-xl border-[1.5px] border-dashed border-line p-6 text-sm text-muted">
              No referrals yet. Submit one above and its Board-review status will appear here.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
