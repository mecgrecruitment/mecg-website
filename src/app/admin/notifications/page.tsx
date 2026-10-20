import { requestedWorkspaceCycleId } from "@/lib/workspace-cycle";
import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { redirect } from "next/navigation";

export default async function NotificationsPage() {
  redirect(withWorkspaceCycle("/admin/messages?view=delivery", await requestedWorkspaceCycleId()));
}
