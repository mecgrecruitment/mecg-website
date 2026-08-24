import { redirect } from "next/navigation";
import BoardNav from "../board-nav";
import { requireBoard } from "@/lib/auth";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { screeningRpc, type ScreeningOverview } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";
import PacketAction from "./packet-action";
import ScreeningControls from "./screening-controls";

export default async function ScreeningAdminPage() {
  const user = await requireBoard();
  const cycleId = selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE");
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
    <main className="mx-auto flex max-w-6xl flex-col gap-7 p-6 sm:p-10">
      <header><p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-orange-ink">Recruitment operations</p><h1 className="mt-2 text-3xl font-semibold">Blind application screening</h1><p className="mt-2 max-w-3xl text-mecg-navy/60">Review and approve identity-free packets before assigning exactly three independent reviewers.</p></header>
      <BoardNav current="/admin/screening" />
      <ScreeningControls cycleId={cycleId} members={members} batchId={overview?.batchId} status={overview?.status} />
      {overview && <p className="rounded-xl bg-mecg-blue/10 p-4 text-sm">{overview.packets.length} packets · {overview.assigned} active assignments · {overview.submitted} submitted reviews</p>}
      <section className="grid gap-5 lg:grid-cols-2">
        {(overview?.packets ?? []).map((packet) => (
          <article key={packet.id} className="rounded-2xl border border-mecg-navy/10 p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs uppercase tracking-[0.14em] text-mecg-navy/45">{packet.code}</p><h2 className="mt-1 font-semibold">Identity steward: {packet.applicantName}</h2></div><span className="inline-flex items-center rounded-full bg-mecg-orange/15 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-mecg-orange-ink">{packet.status}</span></div>
            <div className="mt-4 space-y-4">{(packet.content.responses ?? []).map((response, index) => <div key={`${packet.id}-${index}`}><h3 className="text-sm font-medium">{response.question}</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-mecg-navy/65">{response.answer}</p></div>)}</div>
            {overview?.status === "DRAFT" && <PacketAction cycleId={cycleId} packetId={packet.id} status={packet.status} responses={packet.content.responses ?? []} />}
          </article>
        ))}
      </section>
      {overview?.status === "FROZEN" && <section><h2 className="text-2xl font-semibold">Frozen screening evidence</h2><div className="mt-4 grid gap-4 lg:grid-cols-2">{(overview.results ?? []).map((result, index) => <article key={`${result.code}-${index}`} className="rounded-2xl border p-5"><p className="font-mono text-xs uppercase tracking-[0.14em] text-mecg-navy/45">{result.code}</p><h3 className="mt-1 font-semibold">{result.applicantName}</h3><p className="mt-2 text-sm">{result.recommendation} · {Number(result.score).toFixed(1)}</p><p className="mt-3 text-sm leading-6 text-mecg-navy/65">{result.evidence}</p></article>)}</div></section>}
    </main>
  );
}
