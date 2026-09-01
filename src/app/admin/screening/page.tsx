import { redirect } from "next/navigation";
import BoardNav from "../board-nav";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { screeningRpc, type ScreeningOverview } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";
import StatusPill from "@/components/status-pill";
import PacketAction from "./packet-action";
import ScreeningControls from "./screening-controls";

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
    <main className="mx-auto flex max-w-6xl flex-col gap-8 p-6 sm:p-10">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-mecg-orange-ink">Recruitment operations</p>
        <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">Blind application screening</h1>
        <p className="mt-1.5 max-w-3xl text-[15px] text-mecg-navy/55">Review and approve identity-free packets before assigning exactly three independent reviewers.</p>
      </header>
      <BoardNav current="/admin/screening" recruitmentOperations={hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS")} hashPanel={hasPermission(user.memberships, cycleId, "HASH_PANEL_ACCESS")} />
      <ScreeningControls cycleId={cycleId} members={members} batchId={overview?.batchId} status={overview?.status} />
      {overview && (
        <p className="rounded-2xl bg-mecg-navy/[0.03] p-4 text-sm text-mecg-navy/70">
          {overview.packets.length} packets · {overview.assigned} active assignments · {overview.submitted} submitted reviews
        </p>
      )}
      <section className="grid gap-5 lg:grid-cols-2">
        {(overview?.packets ?? []).map((packet) => (
          <article key={packet.id} className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-mecg-navy/60">{packet.code}</p>
                <h2 className="mt-1 font-semibold">Identity steward: {packet.applicantName}</h2>
              </div>
              <StatusPill tone="orange">{packet.status}</StatusPill>
            </div>
            <div className="mt-4 space-y-4">{(packet.content.responses ?? []).map((response, index) => <div key={`${packet.id}-${index}`}><h3 className="text-sm font-medium">{response.question}</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-mecg-navy/65">{response.answer}</p></div>)}</div>
            {overview?.status === "DRAFT" && <PacketAction cycleId={cycleId} packetId={packet.id} status={packet.status} responses={packet.content.responses ?? []} />}
          </article>
        ))}
      </section>
      {overview?.status === "FROZEN" && (
        <section>
          <h2 className="text-xl font-semibold">Frozen screening evidence</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {(overview.results ?? []).map((result, index) => (
              <article key={`${result.code}-${index}`} className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-mecg-navy/60">{result.code}</p>
                <h3 className="mt-1 font-semibold">{result.applicantName}</h3>
                <p className="mt-2 text-sm text-mecg-navy/70">{result.recommendation} · {Number(result.score).toFixed(1)}</p>
                <p className="mt-3 text-sm leading-6 text-mecg-navy/65">{result.evidence}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
