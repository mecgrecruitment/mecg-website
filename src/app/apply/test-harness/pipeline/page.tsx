import { notFound } from "next/navigation";
import PipelineBoard from "@/app/admin/pipeline-board";
import HarnessReady from "../harness-ready";

export const dynamic = "force-dynamic";
export default function PipelineTestHarness() {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  return <main className="mx-auto max-w-5xl p-4"><h1 className="mb-5 text-xl font-semibold">Synthetic advancement verification</h1><PipelineBoard cycleId="synthetic-pipeline-cycle" canAdvance canOperate={false} referralCount={0} applications={[
    { id: "synthetic-applicant", name: "Synthetic Applicant", contact: "applicant@example.invalid", major: "Engineering", status: "ELIGIBLE", submittedAt: "2026-10-16T12:00:00Z", submittedLabel: "Oct 16", hasResume: true, hasHeadshot: false },
  ]} /><HarnessReady /></main>;
}
