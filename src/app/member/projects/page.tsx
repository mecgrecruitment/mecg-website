import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { selectWorkspaceMembership } from "@/lib/workspace-cycle";
import { detroitToday } from "@/lib/engagement/model";
import { loadTracker } from "@/lib/engagement/server";
import EngagementTracker from "@/components/engagement-tracker";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";

export const metadata: Metadata = { title: "Projects I lead", robots: { index: false, follow: false } };

// Project leads who are not on the board edit their own delivery record here.
// The database returns only projects this member currently leads.
export default async function LedProjectsPage() {
  const user = await requireMember();
  const membership = await selectWorkspaceMembership(user);
  if (!membership) return null;
  const tracker = await loadTracker();
  const now = new Date();
  return <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
    <WorkspaceHeader eyebrow="Client work" title="Projects I lead" description="Keep status, milestones, risks and client contact current, and record the weekly health flag." />
    <WorkspaceNav user={user} cycleId={membership.cycleId} current="/member/projects" />
    <EngagementTracker tracker={tracker} now={now.toISOString()} today={detroitToday(now)} />
  </main>;
}
