import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Applicants are not auth users (SEC-8), so the status lookup is
// server-mediated: we match the logged-in account's email against the active
// cycle's candidates with the service-role client and expose ONLY the coarse
// member-visible status set (ATS-4: Applied | In process | Closed). No stage
// detail, scores, or any evaluation data ever reaches this page (EX-63).

const CLOSED_STATUSES = ["cut", "withdrawn", "accepted", "rejected"] as const;

type CoarseStatus = "Applied" | "In process" | "Closed";

async function getApplicationStatus(
  email: string
): Promise<{ status: CoarseStatus; submittedAt: string } | null> {
  const admin = createAdminClient();

  const { data: cycle } = await admin
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!cycle) return null;

  const { data: candidate } = await admin
    .from("candidates")
    .select("created_at, current_stage, status")
    .eq("cycle_id", cycle.id)
    .eq("email", email.toLowerCase())
    .is("deleted_at", null)
    .maybeSingle();
  if (!candidate) return null;

  const closed = (CLOSED_STATUSES as readonly string[]).includes(
    candidate.status
  );
  const status: CoarseStatus = closed
    ? "Closed"
    : candidate.current_stage === "applied"
      ? "Applied"
      : "In process";

  return {
    status,
    submittedAt: new Date(candidate.created_at).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
}

export default async function ApplicantDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/auth/login?message=Log in to view your applicant dashboard.");
  }

  const application = await getApplicationStatus(user.email);

  return (
    <main className="px-5 py-20 text-white md:px-8">
      <section className="container grid gap-8">
        <div>
          <p className="eyebrow">Applicant dashboard</p>
          <h1 className="display mt-5 text-6xl uppercase md:text-8xl">
            Your MECG application.
          </h1>
        </div>

        {params.message && (
          <p className="rounded-card border border-accent/30 bg-accent/10 p-4 text-white/80">
            {params.message}
          </p>
        )}

        <section className="grid gap-5 md:grid-cols-2">
          <article className="panel rounded-panel p-7">
            <p className="eyebrow">Application status</p>
            {application ? (
              <>
                <h2 className="font-display mt-5 text-4xl font-bold uppercase tracking-[-0.05em]">
                  {application.status}
                </h2>
                <p className="mt-4 text-white/52">
                  Application received {application.submittedAt}. We&apos;ll
                  reach out by email as the cycle progresses.
                </p>
              </>
            ) : (
              <>
                <h2 className="font-display mt-5 text-4xl font-bold uppercase tracking-[-0.05em]">
                  No application on file
                </h2>
                <p className="mt-4 text-white/52">
                  We don&apos;t have an application from {user.email} for the
                  current cycle.
                </p>
                <a
                  href="/apply"
                  className="mt-7 inline-block rounded-pill border border-rule px-5 py-3 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 hover:border-accent"
                >
                  Apply now
                </a>
              </>
            )}
          </article>

          <article className="panel rounded-panel p-7">
            <p className="eyebrow">Event check-in</p>
            <h2 className="font-display mt-5 text-4xl font-bold uppercase tracking-[-0.05em]">
              Attendance portal.
            </h2>
            <p className="mt-4 text-white/52">
              Check in during open-rush events using your account and the event
              phrase shown at the event.
            </p>
            <a
              href="/apply/checkin"
              className="mt-7 inline-block rounded-pill border border-rule px-5 py-3 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 hover:border-accent"
            >
              Check in
            </a>
          </article>
        </section>
      </section>
    </main>
  );
}
