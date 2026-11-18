import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { selectWorkspaceMembership } from "@/lib/workspace-cycle";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { AlumniDirectory } from "@/components/alumni-directory";
import { canUseAlumniDirectory } from "@/lib/alumni/access";
import { loadAlumniDirectory } from "@/lib/alumni/server";

export const metadata: Metadata = { title: "Alumni directory", robots: { index: false, follow: false } };

export default async function AlumniDirectoryPage() {
  // The directory is org-wide; the cycle only keeps the workspace navigation
  // in context. The database re-checks membership on every read and write.
  const user = await requireMember();
  const membership = await selectWorkspaceMembership(user);
  if (!membership) return null;
  const eligible = canUseAlumniDirectory(user.memberships);
  const directory = eligible ? await loadAlumniDirectory() : null;
  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow="Club network"
        title="Alumni directory"
        description="Graduating and graduated members who chose to be listed, and what each chose to share."
      />
      <WorkspaceNav user={user} cycleId={membership.cycleId} current="/member/alumni" />
      {eligible ? <AlumniDirectory directory={directory} /> : (
        <p className="rounded-xl bg-white p-4 text-sm text-muted inset-ring inset-ring-line">
          The alumni directory is for club members. Panel-only access doesn&apos;t include it.
        </p>
      )}
    </main>
  );
}
