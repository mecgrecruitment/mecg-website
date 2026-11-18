import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { selectWorkspaceMembership } from "@/lib/workspace-cycle";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { canSubmitAvailability } from "@/lib/staffing/access";
import { loadMyAvailability } from "@/lib/staffing/server";
import AvailabilityForm from "./availability-form";

export const metadata: Metadata = { title: "Staffing availability", robots: { index: false, follow: false } };

export default async function StaffingAvailabilityPage() {
  const user = await requireMember();
  const membership = await selectWorkspaceMembership(user);
  if (!membership) return null;
  const cycleId = membership.cycleId;
  const eligible = canSubmitAvailability(user.memberships, cycleId);
  const loaded = eligible ? await loadMyAvailability(cycleId) : null;
  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow="Client work"
        title="Staffing availability"
        description="Tell the board how much time you have this cycle, what you're good at and which projects you'd like."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/member/staffing" />
      {!eligible ? (
        <p className="rounded-xl bg-white p-4 text-sm text-muted inset-ring inset-ring-line">
          Staffing availability is for members of this cycle. Panel-only access doesn&apos;t include client projects.
        </p>
      ) : !loaded ? (
        <p role="alert" className="rounded-xl bg-white p-4 text-sm text-muted inset-ring inset-ring-line">
          Your availability could not be loaded, so it can&apos;t be changed right now. Try again later.
        </p>
      ) : (
        <AvailabilityForm availability={loaded.availability} projects={loaded.projects} />
      )}
    </main>
  );
}
