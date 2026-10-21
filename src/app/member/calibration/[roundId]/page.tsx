import { requestedWorkspaceCycleId } from "@/lib/workspace-cycle";
import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { hasPermission } from "@/lib/authorization";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { screeningRpc } from "@/lib/screening-rpc";
import WorkspaceHeader from "@/components/workspace-header";
import SectionLabel from "@/components/section-label";
import { SCORE_ANCHORS, SPEED_DATING_SCORE_ANCHORS, SPEED_DATING_SCORE_LABELS, groupCaseAnchors, GROUP_CASE_SCORE_BANDS, GROUP_CASE_RED_FLAGS, GROUP_CASE_GREEN_FLAGS } from "@/lib/rubrics";
import CalibrationForm from "./calibration-form";
import type { CalibrationDetail } from "../types";

export const metadata: Metadata = { title: "Round calibration" };

export default async function RoundCalibrationPage({ params, searchParams }: {
  params: Promise<{ roundId: string }>;
  searchParams: Promise<{ return?: string }>;
}) {
  const [user, { roundId }, query] = await Promise.all([requireMember(), params, searchParams]);
  const requestedCycle = await requestedWorkspaceCycleId();
  if (requestedCycle && !hasPermission(user.memberships, requestedCycle, "WORKSPACE_ACCESS")) notFound();
  const supabase = await createClient();
  const [{ data: detail, error }, { data: round, error: roundError }] = await Promise.all([
    screeningRpc<CalibrationDetail>(supabase, "round_calibration_detail", { target_round_id: roundId }),
    supabase.from("rounds").select("kind,cycle_id").eq("id", roundId).maybeSingle(),
  ]);
  if (error || !detail) notFound();
  if (roundError) throw roundError;
  const cycleId = round?.cycle_id;
  if (!cycleId || !hasPermission(user.memberships, cycleId, "WORKSPACE_ACCESS")) notFound();
  const returnTo = withWorkspaceCycle(query.return?.startsWith("/member") ? query.return : "/member", cycleId);
  const speedDating = round?.kind === "SPEED_DATING";
  const groupCase = round?.kind === "GROUP_CASE";

  return (
    <main className="workspace-private workspace-stack mx-auto flex max-w-3xl flex-col">
      <nav aria-label="Calibration context" className="workspace-focus-context"><Link href={returnTo}>Return to your work</Link><span aria-hidden="true">/</span><span>Rubric version {detail.rubricVersion}</span></nav>
      <WorkspaceHeader
        eyebrow={`Rubric version ${detail.rubricVersion}`}
        title={`${detail.roundName} calibration`}
        description="Review the shared anchors before opening applicant evaluations."
      />

      {!groupCase && <section>
        <SectionLabel number="01">Score anchors</SectionLabel>
        <div className="mt-3.5 grid gap-2 sm:grid-cols-5">
          {Object.entries(speedDating ? SPEED_DATING_SCORE_ANCHORS : SCORE_ANCHORS).map(([score, meaning]) => (
            <div key={score} className="rounded-xl bg-paper p-4">
              <p className="tabular text-xl font-semibold text-mecg-navy">{score}</p>
              {speedDating && <p className="mt-1 text-sm font-semibold text-mecg-navy">{SPEED_DATING_SCORE_LABELS[Number(score)]}</p>}
              <p className="mt-1 text-xs leading-5 text-muted">{meaning}</p>
            </div>
          ))}
        </div>
      </section>}

      <section>
        <SectionLabel number="02">Active rubric guidance</SectionLabel>
        <div className="mt-3.5 flex flex-col gap-3">
          {detail.criteria.map((criterion) => (
            <article key={criterion.id} className="rounded-xl p-5 inset-ring inset-ring-line">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-mecg-navy">{criterion.name}</h2>
                <span className="text-xs font-semibold text-muted">{criterion.weight}%{criterion.required ? " · required" : ""}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">{criterion.description}</p>
              {groupCase && (
                <ol className="mt-3 space-y-1.5">
                  {Object.entries(groupCaseAnchors(criterion.name)).map(([score, text]) => (
                    <li key={score} className="flex gap-3 text-sm leading-6 text-muted">
                      <span className="tabular w-4 shrink-0 font-semibold text-mecg-navy">{score}</span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-2 text-xs leading-5 text-muted">Record what the applicant said or did. Do not infer traits from attendance, identity, or another evaluator’s opinion.</p>
            </article>
          ))}
        </div>
      </section>

      {groupCase && (
        <section>
          <SectionLabel number="03">Scoring and the final call</SectionLabel>
          <p className="mt-3.5 text-sm leading-6 text-muted">Weighted score = Collaboration ×2 + Problem-Solving + Leadership + Creativity + Composure ×2 + Presentation, out of 40. The number is a guide, not the decision.</p>
          <div className="mt-3.5 grid gap-2 sm:grid-cols-5">
            {GROUP_CASE_SCORE_BANDS.map(({ min, max, label }) => (
              <div key={min} className="rounded-xl bg-paper p-4">
                <p className="tabular text-xl font-semibold text-mecg-navy">{min}–{max}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl p-5 inset-ring inset-ring-line">
              <h3 className="font-semibold text-mecg-navy">Red flags, note regardless of score</h3>
              <ul className="mt-2 space-y-1.5 text-sm leading-6 text-danger">
                {GROUP_CASE_RED_FLAGS.map((flag) => <li key={flag}>{flag}</li>)}
              </ul>
            </div>
            <div className="rounded-xl p-5 inset-ring inset-ring-line">
              <h3 className="font-semibold text-mecg-navy">Green flags, note regardless of score</h3>
              <ul className="mt-2 space-y-1.5 text-sm leading-6 text-success">
                {GROUP_CASE_GREEN_FLAGS.map((flag) => <li key={flag}>{flag}</li>)}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section>
        <SectionLabel number={groupCase ? "04" : "03"}>Evidence standard</SectionLabel>
        <ul className="mt-3.5 space-y-2 rounded-xl bg-mecg-navy p-5 text-sm leading-6 text-white/70 sm:p-6">
          {speedDating ? (
            <>
              <li>Score the whole conversation with one star rating.</li>
              <li>Write 1–2 sentences for every 1, 2 or 5.</li>
              <li>Do not compare notes or scores with peers before submitting.</li>
            </>
          ) : groupCase ? (
            <>
              <li>Score each dimension independently before comparing notes with your co-judge.</li>
              <li>Use a score only when you observed enough evidence; leave a dimension blank if you did not see it.</li>
              <li>Put red and green flags in the note, tied to what the applicant said or did.</li>
              <li>Do not let the final presentation overwrite what you saw in the working session.</li>
            </>
          ) : (
            <>
              <li>Use a score only when you observed enough evidence for that criterion.</li>
              <li>Use “Not observed” when the conversation did not cover it.</li>
              <li>Extreme scores require a concrete note tied to behavior.</li>
              <li>Do not compare notes or scores with peers before submitting.</li>
            </>
          )}
        </ul>
        {detail.acknowledgedAt ? (
          <div className="mt-6 rounded-xl bg-success-wash p-5 text-sm text-success">
            <p className="font-semibold">Calibration already acknowledged</p>
            <Link href={returnTo} className="button-secondary mt-4 inline-flex">Return to My Work</Link>
          </div>
        ) : (
          <CalibrationForm roundId={detail.roundId} rubricId={detail.rubricId} returnTo={returnTo} />
        )}
      </section>
    </main>
  );
}
