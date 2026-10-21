import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import Link from "@/components/workspace-link";
import { requireMember } from "@/lib/auth";
import { screeningRpc, type ScreeningDetail } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";
import ScreeningReviewForm from "./screening-review-form";
import { parseScreeningProgress, screeningDeadlineLabel } from "../screening-draft";
import ScreeningReadingDesk from "./screening-reading-desk";

export default async function ScreeningAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const user = await requireMember();
  const cycleId = await selectWorkspaceCycle(user.memberships, "WORKSPACE_ACCESS");
  const { assignmentId } = await params;
  const cycleName = user.memberships.find((membership) => membership.active && membership.cycleId === cycleId)?.cycle.name;
  const supabase = await createClient();
  const { data: detail, error } = await screeningRpc<ScreeningDetail>(supabase, "screening_assignment_detail", { target_assignment_id: assignmentId });
  if (error || !detail) return <main className="workspace-private mx-auto max-w-3xl p-8"><p className="text-muted">This assignment is unavailable.</p><Link href={withWorkspaceCycle("/member/screening", cycleId)} className="button-secondary mt-4 text-sm">Back to queue</Link></main>;
  const progress = parseScreeningProgress((detail as ScreeningDetail & { progress?: unknown }).progress);
  return (
    <main className="workspace-private workspace-stack mx-auto flex max-w-7xl flex-col">
      <nav aria-label="Review context" className="workspace-focus-context"><Link href={withWorkspaceCycle("/member/screening", cycleId)}>Reading queue</Link>{cycleName && <span>{cycleName}</span>}<span aria-hidden="true">/</span><span className="tabular">{detail.candidateCode}</span></nav>
      <header className="workspace-page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em]">Candidate <span className="tabular">{detail.candidateCode}</span></h1>
          <p className="mt-1.5 text-[15px] text-muted">Read every response before scoring. Use only the submitted material; do not attempt to identify the applicant. The resume is context only and is not scored.</p>
        </div>
      </header>
      {progress && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-mecg-blue/10 px-5 py-4 text-sm">
          <p><span className="font-semibold">{progress.completed} of {progress.total}</span> reviews complete</p>
          <p className="font-semibold text-muted">{screeningDeadlineLabel(progress.deadline)}</p>
        </section>
      )}
      <ScreeningReadingDesk
        reader={(
          <section className="application-document" aria-label="Application responses">
            <nav className="reading-contents" aria-label="Jump to application section">
              {(detail.content.responses ?? []).map((response, index) => <a key={index} href={`#response-${index + 1}`} title={response.question}>Response {index + 1}</a>)}
              <a href="#application-resume">Resume</a>
            </nav>
            <div>
              {!detail.content.responses?.length && <p className="py-8">No written responses are available.</p>}
              {(detail.content.responses ?? []).map((response, index) => (
                <article key={`${response.question}\u0000${response.answer}`} id={`response-${index + 1}`} className="reading-response">
                  <p className="review-response-label">Response {index + 1}</p>
                  <h2 className="mt-2 text-balance font-semibold">{response.question}</h2>
                  <p className="mt-3 whitespace-pre-wrap text-pretty leading-7 text-muted">{response.answer}</p>
                </article>
              ))}
              <details id="application-resume" className="reading-resume">
                <summary>Resume <span>· context only, not scored</span></summary>
                {detail.hasResume ? (
                  <div className="mt-3 overflow-hidden rounded-xl inset-ring inset-ring-line-strong">
                    <iframe
                      loading="lazy"
                      src={`/api/member/screening/${assignmentId}/resume`}
                      title="Applicant resume"
                      className="h-[75vh] min-h-[480px] w-full bg-white"
                    />
                    <div className="border-t border-line bg-wash p-2 text-center">
                      <a
                        className="text-[13px] font-semibold text-mecg-orange-ink"
                        href={`/api/member/screening/${assignmentId}/resume`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open in new tab ↗
                      </a>
                      <p className="mt-1 text-xs text-muted">If the preview does not load, open the PDF in a new tab.</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">No resume was attached.</p>
                )}
              </details>
            </div>
          </section>
        )}
        scorer={(
          <section>
            <h2 className="text-lg font-semibold">Your review</h2>
            <p className="mt-1 text-sm text-muted">Private to you. Apply the same rubric to every application.</p>
            <div className="mt-3.5"><ScreeningReviewForm assignmentId={assignmentId} criteria={detail.criteria} cycleId={cycleId ?? undefined} /></div>
          </section>
        )}
      />
    </main>
  );
}
