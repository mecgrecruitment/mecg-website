import Link from "next/link";

export default async function ApplicantDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ submitted?: string }>;
}) {
  const params = await searchParams;
  const submitted = params?.submitted === "1";

  return (
    <div className="grid gap-8">
      <section>
        <p className="eyebrow">Status</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em] md:text-7xl">
          Application status.
        </h2>
        <p className="mt-4 max-w-2xl text-white/54">
          Demo applicant dashboard with application progress, attendance, and next steps.
        </p>
      </section>

      {submitted ? (
        <div className="rounded-[1.5rem] border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-5 text-[var(--orange-soft)]">
          Demo application submitted successfully.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Application</p>
          <h3 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
            Draft
          </h3>
          <p className="mt-3 text-sm text-white/48">Submit or revise your application form.</p>
        </article>

        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Attendance</p>
          <h3 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
            0 / 3
          </h3>
          <p className="mt-3 text-sm text-white/48">Check in at open rush events.</p>
        </article>

        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Stage</p>
          <h3 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
            Apply
          </h3>
          <p className="mt-3 text-sm text-white/48">Next review happens after applications close.</p>
        </article>
      </section>

      <section className="panel rounded-[2rem] p-6 md:p-8">
        <p className="eyebrow">Applicant actions</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/apply/create" className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
            Open application
          </Link>
          <Link href="/apply/checkin" className="rounded-full border border-white/10 px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 hover:border-[var(--orange)] hover:text-white">
            Check in
          </Link>
        </div>
      </section>
    </div>
  );
}
