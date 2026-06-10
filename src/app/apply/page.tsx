import Link from "next/link";

export default function ApplicantPortalPage() {
  const timeline = [
    ["Application", "Submit your resume and written responses."],
    ["Open Rush", "Attend events and check in with event codes."],
    ["Review", "MECG reviews applications and event attendance."],
    ["Invite Stages", "Selected applicants move to speed dating, group case, and interview."],
  ];

  return (
    <div className="grid gap-8">
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">Winter 2026</p>
        <h2 className="font-display mt-5 max-w-4xl text-5xl font-bold uppercase leading-[0.9] tracking-[-0.07em] md:text-7xl">
          Your MECG application hub.
        </h2>
        <p className="mt-6 max-w-2xl text-white/58">
          Submit your application, check into recruitment events, and track your application status from one applicant portal.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/apply/create" className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
            Start application
          </Link>
          <Link href="/apply/checkin" className="rounded-full border border-white/10 px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 hover:border-[var(--orange)] hover:text-white">
            Event check-in
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Status</p>
          <h3 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
            Open
          </h3>
          <p className="mt-3 text-sm text-white/48">
            Applications are open in demo mode for presentation.
          </p>
        </article>

        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Attendance</p>
          <h3 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
            Codes
          </h3>
          <p className="mt-3 text-sm text-white/48">
            Applicants can enter event phrases from recruiting events.
          </p>
        </article>

        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Next Step</p>
          <h3 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
            Review
          </h3>
          <p className="mt-3 text-sm text-white/48">
            Internal reviewers evaluate submissions after the deadline.
          </p>
        </article>
      </section>

      <section className="panel rounded-[2rem] p-6 md:p-8">
        <p className="eyebrow">Recruitment timeline</p>
        <div className="mt-6 grid gap-3">
          {timeline.map(([title, detail], index) => (
            <article key={title} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[4rem_1fr]">
              <p className="font-mono text-sm font-bold text-[var(--orange)]">
                {String(index + 1).padStart(2, "0")}
              </p>
              <div>
                <h4 className="font-bold">{title}</h4>
                <p className="mt-1 text-sm text-white/48">{detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
