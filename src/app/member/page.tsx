import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import EvaluationForm from "./evaluation-form";
import ConflictForm from "./conflict-form";
import PasswordForm from "./password-form";

export default async function MemberPage() {
  const user = await requireUser();
  const cycleMembership = user.memberships.find((membership) =>
    ["MEMBER", "BOARD", "PANEL", "OWNER"].includes(membership.role),
  );
  if (!cycleMembership) {
    return <main className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-semibold">No active membership</h1><p className="mt-2 text-gray-600">A Board Member must add you to the current rush cycle.</p></main>;
  }
  const [assignments, applications] = await Promise.all([prisma.evaluationAssignment.findMany({
    where: { evaluatorId: user.id, round: { cycleId: cycleMembership.cycleId } },
    include: {
      application: { include: { pnm: true } },
      round: { include: { rubric: { include: { criteria: { orderBy: { position: "asc" } } } } } },
      evaluations: true,
    },
    orderBy: [{ round: { kind: "asc" } }, { application: { pnm: { name: "asc" } } }],
  }), prisma.application.findMany({ where: { cycleId: cycleMembership.cycleId }, select: { id: true, pnm: { select: { name: true } } }, orderBy: { pnm: { name: "asc" } } })]);
  const isPanel = user.memberships.some((membership) => membership.cycleId === cycleMembership.cycleId && ["PANEL", "OWNER"].includes(membership.role));

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-6 sm:p-10">
      <header className="flex items-start justify-between gap-4">
        <div><p className="text-sm text-gray-500">{cycleMembership.cycle.name}</p><h1 className="text-3xl font-semibold">Evaluation Hub</h1><p className="mt-2 text-gray-600">Signed in as {user.name}</p></div>
        {isPanel && <Link href="/admin" className="rounded border px-3 py-2 text-sm">Board dashboard</Link>}
      </header>

      <nav aria-label="Rush workspaces" className="grid gap-3 sm:grid-cols-3">
        {[
          ["Speed Dating", "Structured conversations and assigned forms"],
          ["Group Case", "Individual behavior during team problem solving"],
          ["Hash", isPanel ? "Locked evidence and deliberation are on the Board dashboard" : "Instructions and your submitted evidence only"],
        ].map(([name, description]) => <section key={name} className="rounded-xl border p-4"><h2 className="font-semibold">{name}</h2><p className="mt-1 text-sm text-gray-600">{description}</p></section>)}
      </nav>

      <ConflictForm applications={applications.map((application) => ({ id: application.id, name: application.pnm.name }))} />
      <PasswordForm />

      <section>
        <h2 className="text-xl font-semibold">Your assignments</h2>
        <div className="mt-4 flex flex-col gap-5">
          {assignments.map((assignment) => {
            const submitted = assignment.evaluations.some((evaluation) => ["SUBMITTED", "LOCKED"].includes(evaluation.status));
            return <article key={assignment.id} className="rounded-xl border p-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium text-orange-700">{assignment.round.name}</p><h3 className="text-lg font-semibold">{assignment.application.pnm.name}</h3></div><span className="rounded-full bg-gray-100 px-3 py-1 text-sm">{submitted ? "Submitted" : assignment.round.status}</span></div>
              {submitted ? <p className="mt-3 text-sm text-gray-600">Your evaluation is locked. A Board Member can create an audited correction if needed.</p> : assignment.round.status === "ACTIVE" && assignment.round.rubric ? <EvaluationForm assignmentId={assignment.id} criteria={assignment.round.rubric.criteria} /> : <p className="mt-3 text-sm text-gray-600">This form opens when the Board activates the round.</p>}
            </article>;
          })}
          {!assignments.length && <p className="rounded-xl border border-dashed p-6 text-gray-600">You have no evaluation assignments yet. You still have access to all three workspace instructions.</p>}
        </div>
      </section>
    </main>
  );
}
