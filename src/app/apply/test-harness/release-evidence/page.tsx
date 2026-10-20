import { notFound } from "next/navigation";
import ReleaseEvidenceView from "@/app/admin/applications/[id]/release-evidence/evidence-view";
import { releaseEvidenceFixture } from "@/lib/release-evidence-fixture";
import { parseReleaseEvidence } from "@/lib/release-evidence";

export const dynamic = "force-dynamic";
export default async function Harness({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  const { scenario } = await searchParams;
  const ready = scenario === "ready";
  const value = ready ? { ...releaseEvidenceFixture, ready: true, rounds: releaseEvidenceFixture.rounds.map((round) => ({ ...round, status: "FINALIZED", validLockedEvaluations: 2, missingRequiredCriteria: [], blockers: [] })) } : releaseEvidenceFixture;
  const report = parseReleaseEvidence(value);
  if (!report) notFound();
  return <main className="workspace-stack mx-auto flex max-w-5xl flex-col p-6"><h1 className="text-2xl font-semibold">Synthetic release evidence verification</h1><ReleaseEvidenceView report={report} cycleId="synthetic-older-cycle" /></main>;
}
