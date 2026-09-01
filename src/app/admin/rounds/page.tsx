import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { RoundControls } from "../rush-controls";
import { memberAccountsFor } from "../member-accounts";

export const metadata: Metadata = { title: "Rounds" };

const ROUND_BOARDS: ReadonlyArray<readonly [kind: string, href: string, label: string]> = [
  ["SPEED_DATING", "/admin/speed-dating", "Speed Dating board"],
  ["GROUP_CASE", "/admin/group-case", "Group Case board"],
];

export default async function RoundsPage() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "RECRUITMENT_OPERATIONS");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS")) redirect("/admin");
  const supabase = await createClient();
  const [cycleResult, roundsResult, membersResult, appsResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    supabase.from("rounds").select("id,name,kind,status").eq("cycle_id", cycleId).order("name"),
    supabase.from("memberships").select("user_id,role,profiles!inner(display_name)").eq("cycle_id", cycleId).eq("active", true),
    supabase.from("applications").select("id,status,pnms!inner(name)").eq("cycle_id", cycleId).neq("status", "DRAFT"),
  ]);
  for (const result of [cycleResult, roundsResult, membersResult, appsResult]) if (result.error) throw result.error;
  const cycle = cycleResult.data;
  if (!cycle) redirect("/admin");

  const rounds = (roundsResult.data ?? []).map((round) => ({ id: round.id, label: round.name, status: round.status, kind: round.kind }));
  const applications = (appsResult.data ?? [])
    .filter((application) => !["WITHDRAWN", "REJECTED"].includes(application.status))
    .map((application) => ({ id: application.id, label: application.pnms.name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 p-6 sm:p-10">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycle.status}`}
        title="Rounds"
        description="Open and freeze evaluation rounds, and assign evaluators to applicants."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/rounds" />
      <RoundControls
        cycleId={cycleId}
        rounds={rounds}
        memberAccounts={memberAccountsFor(membersResult.data ?? [])}
        applications={applications}
      />
      <section>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Coverage</p>
        <p className="mt-1 text-sm text-mecg-navy/55">Per-applicant assignment and submission state lives on each round board.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {ROUND_BOARDS.filter(([kind]) => rounds.some((round) => round.kind === kind)).map(([kind, href, label]) => (
            <Link key={kind} href={href} className="button-secondary text-sm">{label}</Link>
          ))}
        </div>
      </section>
    </main>
  );
}
