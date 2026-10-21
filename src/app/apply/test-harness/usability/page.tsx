import { notFound } from "next/navigation";
import BuddySlotForm from "@/app/member/buddy-slot-form";
import ConflictForm from "@/app/member/conflict-form";
import ProfileForm from "@/app/member/profile-form";
import WorkspaceSidebar from "@/components/workspace-sidebar";
import WorkspaceCycleSwitcher from "@/components/workspace-cycle-switcher";
import PillNav from "@/components/pill-nav";
import ApplicantStatusRefresh from "@/app/applicant/status-refresh";
import HarnessReady from "../harness-ready";
import { gradTermBaseYear } from "@/lib/grad-term";

export const dynamic = "force-dynamic";
export default async function UsabilityHarness({ searchParams }: { searchParams: Promise<{ cycleId?: string }> }) {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  const { cycleId = "sample-a" } = await searchParams;
  const cycles = [{ id: "sample-a", name: "Sample A", status: "Active" }, { id: "sample-b", name: "Sample B", status: "Draft" }];
  return <main className="workspace-private workspace-stack mx-auto flex max-w-7xl flex-col">
    <WorkspaceSidebar current="/member" cycle="Sample A" account="Sample member" signOut={<span>Fictional session</span>} groups={[{ label: "My work", links: [["/member", "My work"]] }]} switcher={<WorkspaceCycleSwitcher cycleId={cycleId} cycles={cycles} />} />
    <h1>Fictional usability checks</h1>
    <ConflictForm applications={[{ id: "sample-app", name: "Sample Applicant" }]} />
    <BuddySlotForm cycleId={cycleId} />
    <ApplicantStatusRefresh />
    <ProfileForm initial={{ displayName: "Sample Member", major: "Engineering", gradTerm: "Winter 2028", position: "Member", bio: "" }} gradBaseYear={gradTermBaseYear(new Date())} />
    <div style={{ paddingTop: 600 }}>
      <PillNav ariaLabel="Sample section navigation" current="#section-12" links={Array.from({ length: 12 }, (_, index) => [`#section-${index + 1}`, `Section ${index + 1}`] as const)} />
    </div>
    <HarnessReady />
  </main>;
}
