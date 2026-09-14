import type { Metadata } from "next";
import Link from "next/link";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { requireMember } from "@/lib/auth";
import type { GroupCaseRoster as Roster } from "@/lib/group-case-roster";
import { cycleStatusLabel } from "@/lib/labels";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";
import GroupCaseRoster from "./group-case-roster";

export const metadata: Metadata = { title: "Group Case" };

export default async function GroupCasePage() {
  const user = await requireMember();
  const membership = user.memberships.find((item) =>
    item.active && ["MEMBER", "BOARD", "PANEL", "OWNER"].includes(item.role));
  // Committee-only accounts reach this page from the nav but cannot grade; a
  // blank page reads as a crash, so say what is going on.
  if (!membership) {
    return (
      <main className="workspace-stack mx-auto flex max-w-3xl flex-col">
        <section className="rounded-2xl bg-white p-6 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
          <h1 className="text-xl font-semibold text-mecg-navy">Group Case grading is for members</h1>
          <p className="mt-2 text-sm leading-6 text-mecg-navy/65">Your account has the Recruitment Committee role only. Ask an owner to add the Member role if you are grading tonight.</p>
          <Link href="/member" className="button-secondary mt-5 inline-flex">Return to My work</Link>
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("id")
    .eq("cycle_id", membership.cycleId)
    .eq("kind", "GROUP_CASE")
    .in("status", ["PUBLISHED", "ACTIVE"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (roundError) throw roundError;

  let roster: Roster | null = null;
  if (round) {
    const result = await screeningRpc<Roster>(supabase, "group_case_roster", { target_round_id: round.id });
    if (result.error) throw new Error(result.error.message);
    roster = result.data;
  }

  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow={`${membership.cycle.name} · ${cycleStatusLabel(membership.cycle.status)}`}
        title="Group Case"
        description="Add the applicants at your table, then capture observations and score them from My work."
      />
      <WorkspaceNav user={user} cycleId={membership.cycleId} current="/member/group-case" />
      {roster ? (
        <GroupCaseRoster initial={roster} />
      ) : (
        <section className="rounded-2xl bg-white p-6 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
          <h2 className="text-xl font-semibold text-mecg-navy">No Group Case round is ready</h2>
          <p className="mt-2 text-sm leading-6 text-mecg-navy/65">This workspace appears after the Board publishes the round.</p>
          <Link href="/member" className="button-secondary mt-5 inline-flex">Return to My work</Link>
        </section>
      )}
    </main>
  );
}
