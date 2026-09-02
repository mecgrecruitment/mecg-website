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
  const privileged = new Set((memberships ?? []).filter((item) => ["BOARD", "PANEL", "OWNER"].includes(item.role)).map((item) => item.user_id));
  const members = (memberships ?? []).filter((item) => item.role === "MEMBER" && !privileged.has(item.user_id)).map((item) => ({ id: item.user_id, name: item.profiles.display_name }));

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
          <h2 className="text-xl font-semibold">Locked review evidence</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {(overview.results ?? []).map((result, index) => (
              <article key={`${result.code}-${index}`} className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
                <p className="font-mono text-xs text-mecg-navy/60">{result.code}</p>
                <h3 className="mt-1 font-semibold">{result.applicantName}</h3>
                <p className="mt-2 text-sm text-mecg-navy/70">{statusLabel(result.recommendation)} · {Number(result.score).toFixed(1)}</p>
                <p className="mt-3 text-sm leading-6 text-mecg-navy/65">{result.evidence}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
