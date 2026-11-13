import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { selectWorkspaceMembership } from "@/lib/workspace-cycle";
import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { isToolKind, tools, toolKinds } from "@/lib/member-tools/model";
import { loadToolWorkspace } from "@/lib/member-tools/server";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import ToolWorkspace from "../tool-workspace";
import LabCase from "../lab-case";

export const metadata: Metadata = { title: "MECG project tools", robots: { index: false, follow: false } };
export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!isToolKind(tool)) notFound();
  const user = await requireMember();
  const membership = await selectWorkspaceMembership(user);
  if (!membership) return null;
  let workspace;
  try { workspace = await loadToolWorkspace(membership.cycleId, tool); }
  catch (error) { console.error("member_tool_workspace unavailable", error); }
  return <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
    <WorkspaceHeader eyebrow="MECG project tools" title={tools[tool].title} description={tools[tool].description} />
    <WorkspaceNav user={user} cycleId={membership.cycleId} current={`/member/tools/${tool}`} />
    <nav aria-label="Project tools" className="flex flex-wrap gap-2">{toolKinds.map((kind) => <Link key={kind} href={withWorkspaceCycle(`/member/tools/${kind}`, membership.cycleId)} aria-current={kind === tool ? "page" : undefined} className={kind === tool ? "button-primary" : "button-secondary"}>{kind === "pipeline" ? "Pipeline" : kind === "evidence" ? "Evidence library" : "AI lab"}</Link>)}</nav>
    <Link href={withWorkspaceCycle("/member/consulting", membership.cycleId)} className="text-sm font-semibold text-mecg-blue underline">Open the consulting workbench · nine evidence-linked workflows</Link>
    {tool === "lab" && <LabCase />}
    {workspace ? <ToolWorkspace kind={tool} cycleId={membership.cycleId} userId={user.id} {...workspace} /> : <section className="rounded-xl bg-warning-wash p-6 text-warning" role="status"><h2 className="text-lg font-semibold">Saved records are unavailable</h2><p className="mt-2 text-sm leading-6">We couldn’t load this workspace. Reload to try again. If this tool is newly installed, ask the website maintainer to finish its database setup. No records are shown while access can’t be checked.</p></section>}
  </main>;
}
