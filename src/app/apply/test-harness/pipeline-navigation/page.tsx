import { notFound } from "next/navigation";
import Link from "next/link";
import PipelineBoard from "@/app/admin/pipeline-board";
import HarnessReady from "../harness-ready";

export const dynamic = "force-dynamic";
export default function PipelineNavigationHarness() {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  return <main className="workspace-private workspace-stack"><h1>Synthetic attention queues</h1>
    <nav aria-label="Attention queues" className="flex flex-wrap gap-4">
      <Link data-roster-queue href="?cycleId=synthetic-cycle&filter=SUBMITTED#applicants">New submissions</Link>
      <Link data-roster-queue href="?cycleId=synthetic-cycle&filter=FINAL_REVIEW#applicants">In final review</Link>
      <Link data-roster-queue href="?cycleId=synthetic-cycle&filter=MISSING_RESUME#applicants">Missing resumes</Link>
    </nav>
    <PipelineBoard cycleId="synthetic-cycle" canAdvance canOperate={false} referralCount={0} applications={[
      { id: "eligible", name: "Eligible Example", contact: "eligible@example.invalid", major: "Engineering", status: "ELIGIBLE", submittedAt: "2026-10-16T12:00:00Z", submittedLabel: "Oct 16", hasResume: true, hasHeadshot: false },
      { id: "submitted", name: "Submitted Example", contact: "submitted@example.invalid", major: "Engineering", status: "SUBMITTED", submittedAt: "2026-10-16T12:00:00Z", submittedLabel: "Oct 16", hasResume: false, hasHeadshot: false },
      { id: "final", name: "Final Example", contact: "final@example.invalid", major: "Engineering", status: "FINAL_REVIEW", submittedAt: "2026-10-16T12:00:00Z", submittedLabel: "Oct 16", hasResume: true, hasHeadshot: false },
    ]} /><HarnessReady />
  </main>;
}
