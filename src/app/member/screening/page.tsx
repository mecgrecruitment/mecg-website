import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { screeningRpc, type ScreeningQueueItem } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

export default async function ScreeningQueuePage() {
  const user = await requireMember();
  const cycle = user.memberships.find((membership) => membership.active && membership.role === "MEMBER");
  if (!cycle) return <main className="mx-auto max-w-3xl p-8"><p>You are not enrolled as a blind reviewer.</p></main>;
  const supabase = await createClient();
  const { data: queue, error } = await screeningRpc<ScreeningQueueItem[]>(supabase, "my_screening_queue", { target_cycle_id: cycle.cycleId });
  if (error) throw new Error(error.message);
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-7 p-6 sm:p-10">
      <header><p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-orange-ink">{cycle.cycle.name}</p><h1 className="mt-2 text-3xl font-semibold">Blind application screening</h1><p className="mt-2 max-w-2xl text-mecg-navy/60">Review only the evidence in each packet. Do not try to identify applicants or discuss assignments with other reviewers.</p></header>
      <div className="grid gap-4 sm:grid-cols-2">
        {(queue ?? []).map((item) => (
          <article key={item.assignment_id} className="rounded-2xl border border-mecg-navy/10 p-5"><p className="font-mono text-xs uppercase tracking-[0.14em] text-mecg-navy/45">{item.candidate_code}</p><p className="mt-2 font-semibold">{item.assignment_status}</p>{item.assignment_status === "ASSIGNED" && <Link href={`/member/screening/${item.assignment_id}`} className="button-primary mt-4">Open blind review</Link>}</article>
        ))}
        {!queue?.length && <p className="rounded-2xl border border-dashed p-6 text-mecg-navy/60">No blind screening assignments are open.</p>}
      </div>
      <Link href="/member" className="underline">Back to Evaluation Hub</Link>
    </main>
  );
}
