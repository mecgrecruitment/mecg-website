import Link from "next/link";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

export default async function InternalDashboardPage() {
  const supabase = createDemoAdminClient();

  const { data: applications } = await supabase
    .from("demo_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(6);

  const { data: checkins } = await supabase
    .from("demo_checkins")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <div className="grid gap-8">
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">Dashboard</p>
        <h2 className="font-display mt-5 max-w-4xl text-5xl font-bold uppercase leading-[0.9] tracking-[-0.07em] md:text-7xl">
          Internal command center.
        </h2>
        <p className="mt-6 max-w-2xl text-white/58">
          Review applicants, attendance, events, scoring, hash, members, and
          recruitment operations.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/internal/candidates"
            className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]"
          >
            Applicants
          </Link>
          <Link
            href="/internal/events"
            className="rounded-full border border-white/10 px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 hover:border-[var(--orange)] hover:text-white"
          >
            Events
          </Link>
          <Link
            href="/internal/score"
            className="rounded-full border border-white/10 px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 hover:border-[var(--orange)] hover:text-white"
          >
            Scoring
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Applicants</p>
          <h3 className="font-display mt-4 text-5xl font-bold tracking-[-0.05em]">
            {applications?.length ?? 0}
          </h3>
          <p className="mt-2 text-sm text-white/44">Stored applications</p>
        </article>

        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Check-ins</p>
          <h3 className="font-display mt-4 text-5xl font-bold tracking-[-0.05em]">
            {checkins?.length ?? 0}
          </h3>
          <p className="mt-2 text-sm text-white/44">Attendance records</p>
        </article>

        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Stages</p>
          <h3 className="font-display mt-4 text-5xl font-bold tracking-[-0.05em]">
            4
          </h3>
          <p className="mt-2 text-sm text-white/44">
            Apply, speed dating, case, interview
          </p>
        </article>

        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Hash</p>
          <h3 className="font-display mt-4 text-5xl font-bold tracking-[-0.05em]">
            Live
          </h3>
          <p className="mt-2 text-sm text-white/44">
            Decision workflow demo
          </p>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel rounded-[2rem] p-6 md:p-8">
          <p className="eyebrow">Recent applicants</p>
          <div className="mt-6 grid gap-3">
            {(applications ?? []).map((app) => (
              <article
                key={app.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <h4 className="font-bold">{app.full_name}</h4>
                <p className="text-sm text-white/44">{app.email}</p>
                <p className="mt-2 text-sm text-white/44">
                  {app.major || "Major TBD"} · {app.year || "Year TBD"}
                </p>
              </article>
            ))}

            {(applications ?? []).length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-white/44">
                No demo applications yet.
              </p>
            ) : null}
          </div>
        </div>

        <div className="panel rounded-[2rem] p-6 md:p-8">
          <p className="eyebrow">Recent check-ins</p>
          <div className="mt-6 grid gap-3">
            {(checkins ?? []).map((checkin) => (
              <article
                key={checkin.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
               <h4 className="font-bold">{checkin.event_name}</h4>
                <p className="text-sm text-white/44">{checkin.email}</p>
                <p className="mt-2 font-mono text-sm font-bold text-[var(--orange)]">
                  {checkin.event_phrase}
                </p>
              </article>
            ))}

            {(checkins ?? []).length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-white/44">
                No demo check-ins yet.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
