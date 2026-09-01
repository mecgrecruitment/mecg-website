import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import BoardNav from "../../board-nav";
import EventForm from "./event-form";

export default async function NewEventPage() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "RECRUITMENT_OPERATIONS");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS")) redirect("/admin");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-mecg-orange-ink">Attendance event</p>
          <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">New event</h1>
          <p className="mt-1.5 text-sm text-mecg-navy/55">Create check-in details and share the generated QR code only when you are ready.</p>
        </div>
        <Link href="/admin" className="button-secondary text-sm">Back to pipeline</Link>
      </header>
      <BoardNav current="/admin" recruitmentOperations hashPanel={hasPermission(user.memberships, cycleId, "HASH_PANEL_ACCESS")} />
      <EventForm />
    </main>
  );
}
