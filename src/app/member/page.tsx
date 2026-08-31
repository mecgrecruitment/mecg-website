import type { Metadata } from "next";
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

export const metadata: Metadata = { title: "Evaluation Hub" };

function formatDeadline(closesAt: string) {
  return new Date(closesAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function MemberPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const [user, { round: roundFilter }] = await Promise.all([requireMember(), searchParams]);
  const cycleMembership = user.memberships.find((membership) => ["MEMBER", "BOARD", "PANEL", "OWNER", "RECRUITMENT_COMMITTEE"].includes(membership.role));
  if (!cycleMembership) return null;

  const supabase = await createClient();
  const [{ data: assignments, error }, screeningReviewer, { data: buddySlots, error: buddySlotsError }] = await Promise.all([
    supabase.from("evaluation_assignments").select("id, status, applications!inner(id, pnms!inner(name)), rounds!inner(id, kind, name, status, closes_at, rubrics(id, version, rubric_criteria(id, name, description, weight, required, position))), evaluations(status)").eq("evaluator_id", user.id).eq("rounds.cycle_id", cycleMembership.cycleId),
    screeningRpc<boolean>(supabase, "is_active_screening_reviewer", { target_cycle_id: cycleMembership.cycleId }),
    supabase.from("buddy_slots").select("id, starts_at, ends_at").eq("cycle_id", cycleMembership.cycleId).eq("member_id", user.id).order("starts_at"),
  ]);
  if (error) throw error;
  if (buddySlotsError) throw buddySlotsError;
  const { data: applications, error: applicantsError } = screeningReviewer.data
    ? { data: [], error: null }
    : await supabase.rpc("member_applicants", { target_cycle_id: cycleMembership.cycleId });
  if (screeningReviewer.error) throw new Error(screeningReviewer.error.message);
  if (applicantsError) throw applicantsError;
  const isPanel = user.memberships.some((membership) => membership.cycleId === cycleMembership.cycleId && ["PANEL", "OWNER"].includes(membership.role));
  const canAdmin = user.memberships.some((membership) => membership.cycleId === cycleMembership.cycleId && ["BOARD", "PANEL", "OWNER", "RECRUITMENT_COMMITTEE"].includes(membership.role));
  const visible = (assignments ?? []).filter((assignment) => !roundFilter || assignment.rounds.kind === roundFilter);
  const submittedCount = (assignments ?? []).filter((assignment) => assignment.evaluations.some((evaluation) => ["SUBMITTED", "LOCKED"].includes(evaluation.status))).length;
  const pendingCount = (assignments ?? []).length - submittedCount;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-6 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-mecg-orange-ink">{cycleMembership.cycle.name}</p>
          <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">Evaluation Hub</h1>
          <p className="mt-1.5 text-[15px] text-mecg-navy/55">Signed in as {user.name}</p>
        </div>
        <div className="flex items-center gap-5">
          {canAdmin && <Link href="/admin" className="button-secondary text-sm">Board dashboard</Link>}
          <LogoutButton />
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-mecg-orange/[0.16] px-3 py-1 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-mecg-orange-ink">{pendingCount} pending</span>
        <span className="inline-flex items-center rounded-full bg-mecg-navy/[0.06] px-3 py-1 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-mecg-navy/55">{submittedCount} submitted</span>
      </div>
      <nav aria-label="Rush workspaces" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {screeningReviewer.data && (
          <Link href="/member/screening" className="rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)] transition hover:shadow-[inset_0_0_0_1px_rgba(7,13,31,0.24)]">
            <h2 className="font-semibold">Blind screening</h2>
            <p className="mt-1 text-sm text-mecg-navy/55">Anonymous first-pass application reviews</p>
          </Link>
        )}
        <Link href="/member?round=SPEED_DATING" className="rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)] transition hover:shadow-[inset_0_0_0_1px_rgba(7,13,31,0.24)]">
          <h2 className="font-semibold">Speed Dating</h2>
          <p className="mt-1 text-sm text-mecg-navy/55">Structured conversations and assigned forms</p>
        </Link>
        <Link href="/member?round=GROUP_CASE" className="rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)] transition hover:shadow-[inset_0_0_0_1px_rgba(7,13,31,0.24)]">
          <h2 className="font-semibold">Group Case</h2>
          <p className="mt-1 text-sm text-mecg-navy/55">Individual behavior during team problem solving</p>
        </Link>
        {isPanel ? (
          <Link href="/admin/hash" className="rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)] transition hover:shadow-[inset_0_0_0_1px_rgba(7,13,31,0.24)]">
            <h2 className="font-semibold">Hash</h2>
            <p className="mt-1 text-sm text-mecg-navy/55">Locked evidence and deliberation are on the Board dashboard</p>
          </Link>
        ) : (
          <section className="rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
            <h2 className="font-semibold">Hash</h2>
            <p className="mt-1 text-sm text-mecg-navy/55">Instructions and your submitted evidence only</p>
          </section>
        )}
      </nav>
      {roundFilter && (
        <p className="text-sm text-mecg-navy/55">
          Showing {roundFilter.replaceAll("_", " ").toLowerCase()} assignments. <Link href="/member" className="text-mecg-orange-ink underline">Show all</Link>
        </p>
      )}
      <BuddySlotForm cycleId={cycleMembership.cycleId} slots={(buddySlots ?? []).map((slot) => ({ id: slot.id, startsAt: slot.starts_at, endsAt: slot.ends_at }))} />
      <section className="rounded-2xl bg-mecg-navy/[0.03] p-5">
        <h2 className="font-semibold">Calibration anchors</h2>
        <p className="mt-1 text-sm text-mecg-navy/55">Use these before live Speed Dating or Group Case. They do not change scores.</p>
        <ul className="mt-3 space-y-1.5 text-sm text-mecg-navy/70">
          {Object.entries(SCORE_ANCHORS).map(([score, meaning]) => (
            <li key={score}><span className="font-semibold text-mecg-navy">{score}.</span> {meaning}</li>
          ))}
        </ul>
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
              <article key={assignment.id} className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.14em] text-mecg-orange-ink">{assignment.rounds.name}</p>
                    <h3 className="mt-1 text-lg font-semibold">{assignment.applications.pnms.name}</h3>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-xs font-semibold uppercase tracking-[0.06em] ${submitted ? "bg-mecg-navy/[0.06] text-mecg-navy/55" : "bg-mecg-orange/[0.16] text-mecg-orange-ink"}`}>
                    {submitted ? "Submitted" : assignment.rounds.status}
                  </span>
                </div>
                {assignment.rounds.closes_at && <p className="mt-2 text-xs text-mecg-navy/45">Closes {formatDeadline(assignment.rounds.closes_at)}</p>}
                {submitted ? (
                  <p className="mt-3 text-sm text-mecg-navy/55">Your evaluation is locked. A Board Member can create an audited correction if needed.</p>
                ) : assignment.rounds.status === "ACTIVE" && rubric ? (
                  <EvaluationForm assignmentId={assignment.id} criteria={criteria} />
                ) : (
                  <p className="mt-3 text-sm text-mecg-navy/55">This form opens when the Board activates the round.</p>
                )}
              </article>
            );
          })}
          {!visible.length && <p className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-mecg-navy/55">You have no evaluation assignments yet.</p>}
        </div>
      </section>
    </main>
  );
}
