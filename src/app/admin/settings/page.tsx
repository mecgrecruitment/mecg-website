import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { CycleControls } from "../rush-controls";

export const metadata: Metadata = { title: "Cycle settings" };

export default async function SettingsPage() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "MANAGE_CYCLE")) redirect("/admin");
  const supabase = await createClient();
  const { data: cycle, error } = await supabase
    .from("rush_cycles")
    .select("id,name,status,opens_at,closes_at")
    .eq("id", cycleId)
    .single();
  if (error) throw error;
  if (!cycle) redirect("/admin");

  const window = [
    ["Opens", cycle.opens_at],
    ["Closes", cycle.closes_at],
  ] as const;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-6 sm:p-10">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycle.status}`}
        title="Cycle settings"
        description="The workflow state that governs what everyone else in the workspace can do."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/settings" />
      <CycleControls cycleId={cycleId} cycleStatus={cycle.status} />
      <section className="rounded-2xl bg-paper p-5">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Application window</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {window.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
              <dt className="text-[11px] uppercase tracking-[0.1em] text-mecg-navy/45">{label}</dt>
              <dd className="mt-1 text-sm font-semibold text-mecg-navy">
                {value ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Detroit" }) : "Not set"}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs leading-5 text-mecg-navy/45">
          The window is seeded with the cycle. Editing it here needs a cycle editor, which is not built yet.
        </p>
      </section>
    </main>
  );
}
