import { notFound } from "next/navigation";
import Link from "next/link";
import WorkspaceCycleSwitcher from "@/components/workspace-cycle-switcher";
import EventForm from "@/app/admin/events/new/event-form";
import { CloneCycleForm } from "@/app/admin/rush-controls";
import { workspaceCycleFixture } from "@/lib/workspace-cycle-fixture";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { parseWorkspaceCycleSelection, withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { cycleStatusLabel } from "@/lib/labels";
import HarnessReady from "../harness-ready";

export const dynamic = "force-dynamic";
export default async function CohortWorkspaceHarness({ searchParams }: { searchParams: Promise<{ cycleId?: string | string[]; cycle?: string | string[] }> }) {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  const query = await searchParams;
  const list = (value: string | string[] | undefined) => typeof value === "string" ? [value] : value ?? [];
  const selection = parseWorkspaceCycleSelection([...list(query.cycleId), ...list(query.cycle)]);
  if (selection.kind === "invalid") notFound();
  const cycleId = selectAuthorizedCycleId(workspaceCycleFixture.memberships, "MANAGE_CYCLE", selection.kind === "selected" ? selection.cycleId : null);
  if (!cycleId) notFound();
  const cycles = workspaceCycleFixture.memberships.map(({ cycle }) => ({ id: cycle.id, name: cycle.name, status: cycleStatusLabel(cycle.status) }));
  return <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
    <h1 className="text-2xl font-semibold">Synthetic cohort workspace verification</h1>
    <p>This fixture models authorized routing; it does not change the one-unfinished-cycle database rule.</p>
    <WorkspaceCycleSwitcher cycleId={cycleId} cycles={cycles} />
    <nav aria-label="Synthetic workspace" className="flex flex-wrap gap-4">
      <Link href={withWorkspaceCycle("/admin?filter=pending#applicants", cycleId)}>Recruitment</Link>
      <Link href={withWorkspaceCycle("/admin/rounds", cycleId)}>Interviews</Link>
      <Link href={withWorkspaceCycle("/admin/settings?section=dates#window", cycleId)}>Settings</Link>
    </nav>
    <CloneCycleForm cycleId={cycleId} cycleName={cycles.find((cycle) => cycle.id === cycleId)?.name ?? "Synthetic cohort"} />
    <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Synthetic event creation</summary><EventForm cycleId={cycleId} /></details>
    <HarnessReady />
  </main>;
}
