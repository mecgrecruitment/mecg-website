import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireBoard } from "@/lib/auth";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import ProjectEditor, { type ProjectRow, type StaffOption } from "./project-editor";

export const metadata: Metadata = { title: "Projects" };

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default async function ProjectsPage() {
  // Projects are org-wide, not cycle-scoped, so this gates on being board
  // rather than on a capability within a cycle.
  const user = await requireBoard();
  const cycleId = selectAuthorizedCycleId(user.memberships, "WORKSPACE_ACCESS");
  if (!cycleId) redirect("/member");
  const supabase = await createClient();
  const [projectsResult, staffingResult, membersResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id,slug,title,client_label,industry,semester,decision,context,handoff,methods,deliverables,constraints,member_work,is_public,sort_order")
      .order("sort_order")
      .order("title"),
    supabase.from("project_members").select("project_id,user_id"),
    supabase.from("memberships").select("user_id,profiles!inner(display_name)").eq("cycle_id", cycleId).eq("active", true),
  ]);
  if (projectsResult.error) throw projectsResult.error;
  if (staffingResult.error) throw staffingResult.error;
  if (membersResult.error) throw membersResult.error;

  const staffedByProject = new Map<string, string[]>();
  for (const row of staffingResult.data ?? []) {
    staffedByProject.set(row.project_id, [...(staffedByProject.get(row.project_id) ?? []), row.user_id]);
  }
  const projects: ProjectRow[] = (projectsResult.data ?? []).map((project) => ({
    id: project.id,
    slug: project.slug,
    title: project.title,
    clientLabel: project.client_label,
    industry: project.industry,
    semester: project.semester,
    decision: project.decision,
    context: project.context,
    handoff: project.handoff,
    methods: stringList(project.methods),
    deliverables: stringList(project.deliverables),
    constraints: stringList(project.constraints),
    memberWork: stringList(project.member_work),
    isPublic: project.is_public,
    sortOrder: project.sort_order,
    staffedUserIds: staffedByProject.get(project.id) ?? [],
  }));
  const staff: StaffOption[] = Array.from(
    new Map((membersResult.data ?? []).map((member) => [member.user_id, member.profiles.display_name])).entries(),
  )
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow="Client work"
        title="Projects"
        description="The engagements this group has run, who worked on them, and which are safe to show publicly."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/projects" />
      <ProjectEditor projects={projects} staff={staff} />
    </main>
  );
}
