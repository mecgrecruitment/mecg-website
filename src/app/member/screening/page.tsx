import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { screeningRpc, type ScreeningQueueItem } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";
import SectionLabel from "@/components/section-label";
import StatusPill from "@/components/status-pill";

function statusTone(status: ScreeningQueueItem["assignment_status"]) {
  if (status === "ASSIGNED") return "orange" as const;
  if (status === "RECUSED") return "neutral" as const;
  return "navy" as const;
}

export default async function ScreeningQueuePage() {
  const user = await requireMember();
  const cycle = user.memberships.find((membership) => membership.active && membership.role === "MEMBER");
  if (!cycle) return <main className="mx-auto max-w-3xl p-8"><p className="text-mecg-navy/55">You are not enrolled as a blind reviewer.</p></main>;
  const supabase = await createClient();
  const { data: queue, error } = await screeningRpc<ScreeningQueueItem[]>(supabase, "my_screening_queue", { target_cycle_id: cycle.cycleId });
  if (error) throw new Error(error.message);
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-6 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-mecg-orange-ink">{cycle.cycle.name}</p>
          <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">Blind application screening</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] text-mecg-navy/55">Review only the evidence in each packet. Do not try to identify applicants or discuss assignments with other reviewers.</p>
        </div>
        <Link href="/member" className="button-secondary text-sm">Evaluation Hub</Link>
      </header>
      <section>
        <SectionLabel number="01">Screening queue</SectionLabel>
        <div className="mt-3.5 grid gap-4 sm:grid-cols-2">
          {(queue ?? []).map((item) => (
            <article key={item.assignment_id} className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-mecg-navy/60">{item.candidate_code}</p>
              <div className="mt-2"><StatusPill tone={statusTone(item.assignment_status)}>{item.assignment_status}</StatusPill></div>
              {item.assignment_status === "ASSIGNED" && <Link href={`/member/screening/${item.assignment_id}`} className="button-primary mt-4">Open blind review</Link>}
            </article>
          ))}
          {!queue?.length && <p className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-mecg-navy/55">No blind screening assignments are open.</p>}
        </div>
      </section>
    </main>
  );
}
