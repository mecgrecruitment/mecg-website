import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import Link from "@/components/workspace-link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import EventForm from "./event-form";

export default async function NewEventPage() {
  const user = await requireAdmin();
  const cycleId = await selectWorkspaceCycle(user.memberships, "RECRUITMENT_OPERATIONS");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS")) redirect("/admin");

  return (
    <main className="workspace-stack mx-auto flex w-full max-w-4xl flex-col">
      <WorkspaceHeader
        eyebrow="Attendance event"
        title="New event"
        description="Create check-in details and share the generated QR code only when you are ready."
        action={<Link href={withWorkspaceCycle("/admin/rounds", cycleId)} className="button-secondary text-sm">Back to interviews</Link>}
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/rounds" />
      <EventForm cycleId={cycleId} />
    </main>
  );
}
