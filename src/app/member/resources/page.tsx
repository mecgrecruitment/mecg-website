import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { selectWorkspaceMembership } from "@/lib/workspace-cycle";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import ResourceDirectory from "./resource-directory";

export const metadata: Metadata = {
  title: "Club resources",
  robots: { index: false, follow: false },
};

export default async function ResourcesPage({ searchParams }: { searchParams?: Promise<{ q?: string; category?: string }> } = {}) {
  const user = await requireMember();
  const membership = await selectWorkspaceMembership(user);
  if (!membership) return null;

  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q.slice(0, 512) : "";
  const category = typeof params?.category === "string" ? params.category : "";

  return <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
    <WorkspaceHeader eyebrow="MECG community" title="Club resources" description="Find consulting templates, workshop materials and practical resources for your next case or client project." />
    <WorkspaceNav user={user} cycleId={membership.cycleId} current="/member/resources" />
    <ResourceDirectory query={query} category={category} cycleId={membership.cycleId} />
  </main>;
}
