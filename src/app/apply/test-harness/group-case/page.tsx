import Link from "next/link";
import { notFound } from "next/navigation";
import GroupCaseRoster from "@/app/member/group-case/group-case-roster";
import { groupCaseWorkspaceState } from "@/app/member/group-case/workspace-state";
import HarnessReady from "../harness-ready";

export const dynamic = "force-dynamic";
export default async function GroupCaseTestHarness({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  const { state } = await searchParams;
  const status = state === "FROZEN" || state === "FINALIZED" || state === "ARCHIVED" ? state : "ACTIVE";
  const availability = groupCaseWorkspaceState({ status, closes_at: state === "expired" ? "2000-01-01T00:00:00Z" : null });
  return <main className="workspace-stack mx-auto flex w-full min-w-0 max-w-5xl flex-col"><h1 className="text-2xl font-semibold">Synthetic Group Case verification</h1><GroupCaseRoster initial={{
    roundId: "synthetic-group-case", roundName: "Group Case", roundStatus: status, canSeeSpeedDating: false,
    criteria: [
      { id: "collaboration", name: "Team Collaboration", description: "Use observed evidence.", weight: 75, required: true },
      { id: "presentation", name: "Presentation & Communication", description: "Communicate the recommendation.", weight: 25, required: false },
    ],
    progress: { scored: 0, total: 1 },
    groups: [{ groupId: null, groupName: "Applicants", applicants: [{ revision: null, applicationId: "synthetic-applicant", name: "Synthetic Applicant", scores: { collaboration: null, presentation: null }, note: "", savedAt: null, quality: null, speedDating: null }] }],
  }} readOnlyReason={availability.kind === "read-only" ? availability.detail : undefined} /><Link href="/apply/test-harness">Leave Group Case</Link><HarnessReady /></main>;
}
