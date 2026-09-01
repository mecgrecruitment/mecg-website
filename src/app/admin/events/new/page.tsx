import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import EventForm from "./event-form";

export default async function NewEventPage() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "RECRUITMENT_OPERATIONS");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS")) redirect("/admin");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-10">
      <WorkspaceHeader
        eyebrow="Attendance event"
        title="New event"
        description="Create check-in details and share the generated QR code only when you are ready."
        action={<Link href="/admin" className="button-secondary text-sm">Back to pipeline</Link>}
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin" />
      <EventForm />
    </main>
  );
}
