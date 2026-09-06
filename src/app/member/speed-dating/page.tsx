import type { Metadata } from "next";
import Link from "next/link";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { requireMember } from "@/lib/auth";
import { cycleStatusLabel } from "@/lib/labels";
import { screeningRpc } from "@/lib/screening-rpc";
import type { SpeedDatingPairQueue } from "@/lib/speed-dating-pairs";
import { createClient } from "@/lib/supabase/server";
import SpeedDatingPairSearch from "./speed-dating-pair-search";

export const metadata: Metadata = { title: "Speed Dating" };

export default async function SpeedDatingPage() {
  const user = await requireMember();
  const membership = user.memberships.find((item) =>
    item.active && ["MEMBER", "BOARD", "PANEL", "OWNER"].includes(item.role));
  if (!membership) return null;

  const supabase = await createClient();
  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("id")
    .eq("cycle_id", membership.cycleId)
    .eq("kind", "SPEED_DATING")
    .in("status", ["PUBLISHED", "ACTIVE"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (roundError) throw roundError;

  let queue: SpeedDatingPairQueue | null = null;
  if (round) {
    const result = await screeningRpc<SpeedDatingPairQueue>(supabase, "my_speed_dating_pairs", {
      target_round_id: round.id,
    });
    if (result.error) throw new Error(result.error.message);
    queue = result.data;
  }

  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow={`${membership.cycle.name} · ${cycleStatusLabel(membership.cycle.status)}`}
        title="Speed Dating"
        description="Find the two applicants in front of you, then claim their pair."
      />
      <WorkspaceNav user={user} cycleId={membership.cycleId} current="/member/speed-dating" />
      {queue ? (
        <SpeedDatingPairSearch initialQueue={queue} />
      ) : (
        <section className="rounded-2xl bg-white p-6 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
          <h2 className="text-xl font-semibold text-mecg-navy">No Speed Dating round is ready</h2>
          <p className="mt-2 text-sm leading-6 text-mecg-navy/65">This workspace appears after the Board publishes the round and its applicant pairs.</p>
          <Link href="/member" className="button-secondary mt-5 inline-flex">Return to My work</Link>
        </section>
      )}
    </main>
  );
}
