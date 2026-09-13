import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { screeningRpc } from "@/lib/screening-rpc";
import WorkspaceHeader from "@/components/workspace-header";
import SectionLabel from "@/components/section-label";
import { SCORE_ANCHORS, SPEED_DATING_SCORE_ANCHORS, SPEED_DATING_SCORE_LABELS } from "@/lib/rubrics";
import CalibrationForm from "./calibration-form";
import type { CalibrationDetail } from "../types";

export const metadata: Metadata = { title: "Round calibration" };

export default async function RoundCalibrationPage({ params, searchParams }: {
  params: Promise<{ roundId: string }>;
  searchParams: Promise<{ return?: string }>;
}) {
  const [, { roundId }, query] = await Promise.all([requireMember(), params, searchParams]);
  const returnTo = query.return?.startsWith("/member") ? query.return : "/member";
  const supabase = await createClient();
  const [{ data: detail, error }, { data: round, error: roundError }] = await Promise.all([
    screeningRpc<CalibrationDetail>(supabase, "round_calibration_detail", { target_round_id: roundId }),
    supabase.from("rounds").select("kind").eq("id", roundId).maybeSingle(),
  ]);
  if (error || !detail) notFound();
  if (roundError) throw roundError;
  const speedDating = round?.kind === "SPEED_DATING";

  return (
    <main className="workspace-stack mx-auto flex max-w-3xl flex-col">
      <WorkspaceHeader
        eyebrow={`Rubric version ${detail.rubricVersion}`}
        title={`${detail.roundName} calibration`}
        description="Review the shared anchors before opening applicant evaluations."
      />

      <section>
        <SectionLabel number="01">Score anchors</SectionLabel>
        <div className="mt-3.5 grid gap-2 sm:grid-cols-5">
          {Object.entries(speedDating ? SPEED_DATING_SCORE_ANCHORS : SCORE_ANCHORS).map(([score, meaning]) => (
            <div key={score} className="rounded-2xl bg-paper p-4">
              <p className="tabular text-xl font-semibold text-mecg-navy">{score}</p>
              {speedDating && <p className="mt-1 text-sm font-semibold text-mecg-navy">{SPEED_DATING_SCORE_LABELS[Number(score)]}</p>}
              <p className="mt-1 text-xs leading-5 text-mecg-navy/60">{meaning}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel number="02">Active rubric guidance</SectionLabel>
        <div className="mt-3.5 flex flex-col gap-3">
          {detail.criteria.map((criterion) => (
            <article key={criterion.id} className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-mecg-navy">{criterion.name}</h2>
                <span className="text-xs font-semibold text-mecg-navy/45">{criterion.weight}%{criterion.required ? " · required" : ""}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-mecg-navy/65">{criterion.description}</p>
              <p className="mt-2 text-xs leading-5 text-mecg-navy/50">Record what the applicant said or did. Do not infer traits from attendance, identity, or another evaluator’s opinion.</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel number="03">Evidence standard</SectionLabel>
        <ul className="mt-3.5 space-y-2 rounded-2xl bg-mecg-navy p-5 text-sm leading-6 text-white/75 sm:p-6">
          {speedDating ? (
            <>
              <li>Score the whole conversation with one star rating.</li>
              <li>Write 1–2 sentences for every 1, 2 or 5.</li>
              <li>Do not compare notes or scores with peers before submitting.</li>
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
          <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-900">
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
