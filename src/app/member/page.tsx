import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import EvaluationForm from "./evaluation-form";
import ConflictForm from "./conflict-form";
import PasswordForm from "./password-form";
import BuddySlotForm from "./buddy-slot-form";
import LogoutButton from "@/components/logout-button";
import { SCORE_ANCHORS } from "@/lib/rubrics";
import { screeningRpc } from "@/lib/screening-rpc";

export default async function MemberPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const [user, { round: roundFilter }] = await Promise.all([requireMember(), searchParams]);
  const cycleMembership = user.memberships.find((membership) => ["MEMBER", "BOARD", "PANEL", "OWNER"].includes(membership.role));
  if (!cycleMembership) return null;

  const supabase = await createClient();
  const [{ data: assignments, error }, screeningReviewer] = await Promise.all([
    supabase.from("evaluation_assignments").select("id, status, applications!inner(id, pnms!inner(name)), rounds!inner(id, kind, name, status, rubrics(id, version, rubric_criteria(id, name, description, weight, required, position))), evaluations(status)").eq("evaluator_id", user.id).eq("rounds.cycle_id", cycleMembership.cycleId),
    screeningRpc<boolean>(supabase, "is_active_screening_reviewer", { target_cycle_id: cycleMembership.cycleId }),
  ]);
  if (error) throw error;
  const { data: applications, error: applicantsError } = screeningReviewer.data
    ? { data: [], error: null }
    : await supabase.rpc("member_applicants", { target_cycle_id: cycleMembership.cycleId });
  if (screeningReviewer.error) throw new Error(screeningReviewer.error.message);
  if (applicantsError) throw applicantsError;
  const isPanel = user.memberships.some((membership) => membership.cycleId === cycleMembership.cycleId && ["PANEL", "OWNER"].includes(membership.role));
  const canBoard = user.memberships.some((membership) => membership.cycleId === cycleMembership.cycleId && ["BOARD", "PANEL", "OWNER"].includes(membership.role));
  const visible = (assignments ?? []).filter((assignment) => !roundFilter || assignment.rounds.kind === roundFilter);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-6 sm:p-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">{cycleMembership.cycle.name}</p>
          <h1 className="text-3xl font-semibold">Evaluation Hub</h1>
          <p className="mt-2 text-gray-600">Signed in as {user.name}</p>
        </div>
        <div className="flex items-center gap-3">{canBoard && <Link href="/admin" className="rounded border px-3 py-2 text-sm">Board dashboard</Link>}<LogoutButton /></div>
      </header>
      <nav aria-label="Rush workspaces" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {screeningReviewer.data && <Link href="/member/screening" className="rounded-xl border p-4"><h2 className="font-semibold">Blind screening</h2><p className="mt-1 text-sm text-gray-600">Anonymous first-pass application reviews</p></Link>}
        <Link href="/member?round=SPEED_DATING" className="rounded-xl border p-4">
          <h2 className="font-semibold">Speed Dating</h2>
          <p className="mt-1 text-sm text-gray-600">Structured conversations and assigned forms</p>
        </Link>
        <Link href="/member?round=GROUP_CASE" className="rounded-xl border p-4">
          <h2 className="font-semibold">Group Case</h2>
          <p className="mt-1 text-sm text-gray-600">Individual behavior during team problem solving</p>
        </Link>
        {isPanel ? (
          <Link href="/admin/hash" className="rounded-xl border p-4">
            <h2 className="font-semibold">Hash</h2>
            <p className="mt-1 text-sm text-gray-600">Locked evidence and deliberation are on the Board dashboard</p>
          </Link>
        ) : (
          <section className="rounded-xl border p-4">
            <h2 className="font-semibold">Hash</h2>
            <p className="mt-1 text-sm text-gray-600">Instructions and your submitted evidence only</p>
          </section>
        )}
      </nav>
      {roundFilter && <p className="text-sm text-gray-500">Showing {roundFilter.replaceAll("_", " ").toLowerCase()} assignments. <Link href="/member" className="underline">Show all</Link></p>}
      <BuddySlotForm cycleId={cycleMembership.cycleId} />
      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Calibration anchors</h2>
        <p className="mt-1 text-sm text-gray-600">Use these before live Speed Dating or Group Case. They do not change scores.</p>
        <ul className="mt-3 space-y-1 text-sm">{Object.entries(SCORE_ANCHORS).map(([score, meaning]) => <li key={score}><span className="font-medium">{score}.</span> {meaning}</li>)}</ul>
      </section>
      {!screeningReviewer.data && <ConflictForm applications={(applications ?? []).map((application) => ({ id: application.id, name: application.name }))} />}
      <PasswordForm />
      <section>
        <h2 className="text-xl font-semibold">Your assignments</h2>
        <div className="mt-4 flex flex-col gap-5">
          {visible.map((assignment) => {
            const rubric = [...assignment.rounds.rubrics].sort((a, b) => b.version - a.version)[0];
            const submitted = assignment.evaluations.some((evaluation) => ["SUBMITTED", "LOCKED"].includes(evaluation.status));
            const criteria = (rubric?.rubric_criteria ?? []).sort((a, b) => a.position - b.position);
            return (
              <article key={assignment.id} className="rounded-xl border p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-orange-700">{assignment.rounds.name}</p>
                    <h3 className="text-lg font-semibold">{assignment.applications.pnms.name}</h3>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">{submitted ? "Submitted" : assignment.rounds.status}</span>
                </div>
                {submitted ? <p className="mt-3 text-sm text-gray-600">Your evaluation is locked. A Board Member can create an audited correction if needed.</p> : assignment.rounds.status === "ACTIVE" && rubric ? <EvaluationForm assignmentId={assignment.id} criteria={criteria} /> : <p className="mt-3 text-sm text-gray-600">This form opens when the Board activates the round.</p>}
              </article>
            );
          })}
          {!visible.length && <p className="rounded-xl border border-dashed p-6 text-gray-600">You have no evaluation assignments yet.</p>}
        </div>
      </section>
    </main>
  );
}
