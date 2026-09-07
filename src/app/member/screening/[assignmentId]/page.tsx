import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { screeningRpc, type ScreeningDetail } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";
import SectionLabel from "@/components/section-label";
import ScreeningReviewForm from "./screening-review-form";
import { parseScreeningProgress, screeningDeadlineLabel } from "../screening-draft";
import ScreeningReadingDesk from "./screening-reading-desk";

export default async function ScreeningAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  await requireMember();
  const { assignmentId } = await params;
  const supabase = await createClient();
  const { data: detail, error } = await screeningRpc<ScreeningDetail>(supabase, "screening_assignment_detail", { target_assignment_id: assignmentId });
  if (error || !detail) return <main className="mx-auto max-w-3xl p-8"><p className="text-mecg-navy/55">This assignment is unavailable.</p><Link href="/member/screening" className="button-secondary mt-4 text-sm">Back to queue</Link></main>;
  const progress = parseScreeningProgress((detail as ScreeningDetail & { progress?: unknown }).progress);
  return (
    <main className="workspace-stack mx-auto flex max-w-7xl flex-col">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="font-mono text-xs text-mecg-orange-ink">{detail.candidateCode}</p>
          <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">Application review</h1>
          <p className="mt-1.5 text-[15px] text-mecg-navy/55">Score only the application below. You cannot see who wrote it, so do not use outside knowledge or attempt to identify the applicant.</p>
        </div>
        <Link href="/member/screening" className="button-secondary text-sm">Reading queue</Link>
      </header>
      {progress && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-mecg-blue/[0.08] px-5 py-4 text-sm">
          <p><span className="font-semibold">{progress.completed} of {progress.total}</span> reviews complete</p>
          <p className="font-semibold text-mecg-navy/70">{screeningDeadlineLabel(progress.deadline)}</p>
        </section>
      )}
      <ScreeningReadingDesk
        reader={(
          <section>
            <SectionLabel number="01">Read the application</SectionLabel>
            <p className="mt-2 text-sm text-mecg-navy/60">Read every response before scoring. Use only what is written here.</p>
            <div className="mt-3.5 space-y-6 rounded-2xl bg-mecg-navy/[0.035] p-5 sm:p-6">
              {(detail.content.responses ?? []).map((response, index) => (
                <article key={`${response.question}\u0000${response.answer}`} className="border-b border-mecg-navy/10 pb-6 last:border-0 last:pb-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-mecg-orange-ink">Response {index + 1}</p>
                  <h2 className="mt-2 text-balance font-semibold">{response.question}</h2>
                  <p className="mt-3 whitespace-pre-wrap text-pretty leading-7 text-mecg-navy/75">{response.answer}</p>
                </article>
              ))}
            </div>
          </section>
        )}
        scorer={(
          <section>
            <SectionLabel number="02">Score independently</SectionLabel>
            <p className="mt-2 text-sm text-mecg-navy/60">Apply the same anchors to every application. Your draft and final review are private.</p>
            <div className="mt-3.5"><ScreeningReviewForm assignmentId={assignmentId} criteria={detail.criteria} /></div>
          </section>
        )}
      />
    </main>
  );
}
