import Link from "next/link";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

type SearchParams = {
  email?: string;
  submitted?: string;
  checkedin?: string;
};

export default async function ApplicantDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const email = params?.email?.toLowerCase() ?? "";
  const submitted = params?.submitted === "1";
  const checkedin = params?.checkedin === "1";

  const supabase = createDemoAdminClient();

  const { data: application } = email
    ? await supabase
        .from("demo_applications")
        .select("*")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: checkins } = email
    ? await supabase
        .from("demo_checkins")
        .select("*")
        .eq("email", email)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="grid gap-8">
      <section>
        <p className="eyebrow">Applicant Dashboard</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em] md:text-7xl">
          Your application.
        </h2>
        <p className="mt-4 max-w-2xl text-white/54">
          Track your submitted application, event attendance, and current stage.
        </p>
      </section>

      {!email ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-white/58">
          Enter through the applicant login page first.
          <Link href="/apply" className="ml-2 text-[var(--orange)]">
            Go to applicant login
          </Link>
        </div>
      ) : null}

      {submitted ? (
        <div className="rounded-[1.5rem] border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-5 text-[var(--orange-soft)]">
          Application saved.
        </div>
      ) : null}

      {checkedin ? (
        <div className="rounded-[1.5rem] border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-5 text-[var(--orange-soft)]">
          Attendance check-in saved.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Application</p>
          <h3 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
            {application ? "Submitted" : "Not Started"}
          </h3>
          <p className="mt-3 text-sm text-white/48">
            {application
              ? `${application.full_name} · ${application.major || "Major TBD"}`
              : "Submit your application form."}
          </p>
        </article>

        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Attendance</p>
          <h3 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
            {(checkins ?? []).length} / 3
          </h3>
          <p className="mt-3 text-sm text-white/48">
            Check in at open rush events.
          </p>
        </article>

        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Stage</p>
          <h3 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
            Apply
          </h3>
          <p className="mt-3 text-sm text-white/48">
            Next review happens after applications close.
          </p>
        </article>
      </section>

      <section className="panel rounded-[2rem] p-6 md:p-8">
        <p className="eyebrow">Applicant actions</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/apply/application?email=${encodeURIComponent(email)}`}
            className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]"
          >
            Submit application
          </Link>
          <Link
            href={`/apply/checkin?email=${encodeURIComponent(email)}`}
            className="rounded-full border border-white/10 px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 hover:border-[var(--orange)] hover:text-white"
          >
            Check in
          </Link>
        </div>
      </section>

      <section className="panel rounded-[2rem] p-6 md:p-8">
        <p className="eyebrow">Saved information</p>
        {application ? (
          <div className="mt-5 grid gap-3 text-sm text-white/58">
            <p>
              <strong className="text-white">Name:</strong>{" "}
              {application.full_name}
            </p>
            <p>
              <strong className="text-white">Email:</strong>{" "}
              {application.email}
            </p>
            <p>
              <strong className="text-white">Year:</strong>{" "}
              {application.year || "TBD"}
            </p>
            <p>
              <strong className="text-white">Major:</strong>{" "}
              {application.major || "TBD"}
            </p>
            <p>
              <strong className="text-white">Resume:</strong>{" "}
              {application.resume_name || "No file name stored"}
            </p>
          </div>
        ) : (
          <p className="mt-5 text-white/48">No application submitted yet.</p>
        )}
      </section>
    </div>
  );
}
