import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import LogoutButton from "@/components/logout-button";
import BoardNav from "./board-nav";

export default async function RoundBoardPage({ kind, title, nav }: { kind: string; title: string; nav: string }) {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE") ?? selectAuthorizedCycleId(user.memberships, "HASH_PANEL_ACCESS");
  if (!cycleId) redirect("/member");
  const supabase = await createClient();
  const { data: cycle } = await supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single();
  if (!cycle) redirect("/member");
  const { data: round, error } = await supabase
    .from("rounds")
    .select("id,name,status,kind,evaluation_assignments(id,status,evaluator_id,applications(id,pnms(name)),evaluations(status))")
    .eq("cycle_id", cycleId)
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw error;
  const canManage = hasPermission(user.memberships, cycleId, "MANAGE_CYCLE");

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 p-6 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-orange-700">{cycle.name} · {cycle.status}</p>
          <h1 className="text-3xl font-semibold">{title}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/member" className="rounded border px-3 py-2 text-sm">Evaluation Hub</Link>
          <LogoutButton />
        </div>
      </header>
      <BoardNav current={nav} />
      {!round ? (
        <p className="rounded-xl border border-dashed p-6 text-gray-600">This cycle does not have a {title} round yet.</p>
      ) : (
        <section className="rounded-xl border p-5">
          <p className="text-sm text-gray-600">Round status: {round.status}. {canManage ? "Use Pipeline ops to publish, activate, and freeze." : null}</p>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Applicant</th>
                <th className="py-2">Assignment</th>
                <th className="py-2">Evaluation</th>
              </tr>
            </thead>
            <tbody>
              {(round.evaluation_assignments ?? []).map((assignment) => (
                <tr key={assignment.id} className="border-b">
                  <td className="py-2">{
                    Array.isArray(assignment.applications)
                      ? "Applicant"
                      : assignment.applications?.pnms && !Array.isArray(assignment.applications.pnms)
                        ? assignment.applications.pnms.name
                        : "Applicant"
                  }</td>
                  <td className="py-2">{assignment.status}</td>
                  <td className="py-2">{assignment.evaluations.some((evaluation) => ["SUBMITTED", "LOCKED"].includes(evaluation.status)) ? "Submitted" : "Open"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
