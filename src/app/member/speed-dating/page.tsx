import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { selectWorkspaceMembership, requestedWorkspaceCycleId } from "@/lib/workspace-cycle";
import type { Metadata } from "next";
import Link from "next/link";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { requireMember } from "@/lib/auth";
import { cycleStatusLabel } from "@/lib/labels";
import { screeningRpc } from "@/lib/screening-rpc";
import type { SpeedDatingRoster as Roster } from "@/lib/speed-dating-roster";
import { createClient } from "@/lib/supabase/server";
import SpeedDatingRoster from "./speed-dating-roster";

export const metadata: Metadata = { title: "Speed Dating" };

export default async function SpeedDatingPage() {
  const user = await requireMember();
  const membership = await selectWorkspaceMembership(user, ["MEMBER", "BOARD", "PANEL", "OWNER"]);
  const cycleId = membership?.cycleId ?? await requestedWorkspaceCycleId();
  // Committee-only accounts reach this page from the nav but cannot grade; a
  // blank page reads as a crash, so say what is going on.
  if (!membership) {
    return (
      <main className="workspace-stack mx-auto flex max-w-3xl flex-col">
        <section className="rounded-xl bg-white p-6 inset-ring inset-ring-line">
          <h1 className="text-xl font-semibold text-mecg-navy">Speed Dating grading is for members</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Your account has the Recruitment Committee role only. Ask an owner to add the Member role if you are grading tonight.</p>
          <Link href={withWorkspaceCycle("/member", cycleId)} className="button-secondary mt-5 inline-flex">Return to My work</Link>
        </section>
      </main>
    );
  }

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

  let roster: Roster | null = null;
  if (round) {
    const result = await screeningRpc<Roster>(supabase, "my_speed_dating_roster", { target_round_id: round.id });
    if (result.error) throw new Error(result.error.message);
    roster = result.data;
  }

  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow={`${membership.cycle.name} · ${cycleStatusLabel(membership.cycle.status)}`}
        title="Speed Dating"
        description="Find each applicant as they reach your table and tap a star. Every rating saves on its own."
      />
      <WorkspaceNav user={user} cycleId={membership.cycleId} current="/member/speed-dating" />
      {roster ? (
        <SpeedDatingRoster initial={roster} />
      ) : (
        <section className="rounded-xl bg-white p-6 inset-ring inset-ring-line">
          <h2 className="text-xl font-semibold text-mecg-navy">No Speed Dating round is ready</h2>
          <p className="mt-2 text-sm leading-6 text-muted">This workspace appears after the Board publishes the round.</p>
          <Link href={withWorkspaceCycle("/member", cycleId)} className="button-secondary mt-5 inline-flex">Return to My work</Link>
        </section>
      )}
    </main>
  );
}
