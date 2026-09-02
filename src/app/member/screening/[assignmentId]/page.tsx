import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { screeningRpc, type ScreeningDetail } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";
import SectionLabel from "@/components/section-label";
import ScreeningReviewForm from "./screening-review-form";

export default async function ScreeningAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  await requireMember();
  const { assignmentId } = await params;
  const supabase = await createClient();
  const { data: detail, error } = await screeningRpc<ScreeningDetail>(supabase, "screening_assignment_detail", { target_assignment_id: assignmentId });
  if (error || !detail) return <main className="mx-auto max-w-3xl p-8"><p className="text-mecg-navy/55">This assignment is unavailable.</p><Link href="/member/screening" className="button-secondary mt-4 text-sm">Back to queue</Link></main>;
  return (
    <main className="workspace-stack mx-auto flex max-w-3xl flex-col">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="font-mono text-xs text-mecg-orange-ink">{detail.candidateCode}</p>
          <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">Application review</h1>
          <p className="mt-1.5 text-[15px] text-mecg-navy/55">Score only the application below. You cannot see who wrote it, so do not use outside knowledge or attempt to identify the applicant.</p>
        </div>
        <Link href="/member/screening" className="button-secondary text-sm">Reading queue</Link>
      </header>
      <section>
        <SectionLabel number="01">The application</SectionLabel>
        <div className="mt-3.5 space-y-5 rounded-2xl bg-mecg-navy/[0.035] p-6">{(detail.content.responses ?? []).map((response, index) => <article key={index}><h2 className="font-semibold">{response.question}</h2><p className="mt-2 whitespace-pre-wrap leading-7 text-mecg-navy/70">{response.answer}</p></article>)}</div>
      </section>
      <section>
        <SectionLabel number="02">Your review</SectionLabel>
        <div className="mt-3.5">
          <ScreeningReviewForm assignmentId={assignmentId} criteria={detail.criteria} />
        </div>
      </section>
    </main>
  );
}
