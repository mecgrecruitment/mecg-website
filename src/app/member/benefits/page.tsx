import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { selectWorkspaceMembership } from "@/lib/workspace-cycle";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import BenefitsDirectory from "./benefits-directory";

export const metadata: Metadata = {
  title: "Benefits & resources",
  robots: { index: false, follow: false },
};

export default async function BenefitsPage() {
  const user = await requireMember();
  const membership = await selectWorkspaceMembership(user);
  if (!membership) return null;

  return <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
    <WorkspaceHeader eyebrow="MECG community" title="Benefits & resources" description="Make the most of being a Michigan student. Find learning, software, career support and tools for your next project." />
    <WorkspaceNav user={user} cycleId={membership.cycleId} current="/member/benefits" />
    <div className="border-l-2 border-mecg-orange pl-4 text-sm leading-6 text-muted">
      <p>Researched November 11, 2026. These are provider resources, not MECG partnerships or guaranteed offers. Eligibility, renewal and client-use restrictions vary.</p>
      <p className="mt-2">Start with “Student benefits” for campus entitlements and student offers, or “Free access available” for no-cost learning and tools.</p>
    </div>
    <BenefitsDirectory />
  </main>;
}
