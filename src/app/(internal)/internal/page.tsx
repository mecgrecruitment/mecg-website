import Link from "next/link";
import {
  candidates,
  currentMember,
  internalStats,
  stages,
} from "../../../lib/internal-data";

const quickActions = [
  {
    href: "/internal/candidates",
    label: "Review candidates",
    detail: "Open applicant files, statuses, and score links.",
  },
  {
    href: "/internal/calendar",
    label: "Check calendar",
    detail: "Review recruitment events and attendance windows.",
  },
  {
    href: "/internal/hash",
    label: "Open hash",
    detail: "Move final decisions through the voting workflow.",
  },
];

export default function InternalDashboardPage() {
  return (
    <div className="grid gap-8">
      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="panel-strong relative overflow-hidden rounded-[2rem] p-7 md:p-10">
          <div className="absolute right-[-6rem] top-[-6rem] h-64 w-64 rounded-full bg-[var(--orange)]/15 blur-3xl" />
          <div className="absolute bottom-[-7rem] left-[35%] h-72 w-72 rounded-full bg-[var(--blue)]/20 blur-3xl" />

          <div className="relative">
            <p className="eyebrow">Dashboard</p>
            <h2 className="font-display mt-5 max-w-4xl text-5xl font-bold uppercase leading-[0.9] tracking-[-0.07em] md:text-7xl xl:text-8xl">
              Recruitment command center.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/60 md:text-lg">
              Track candidates, scoring progress, member roles, hash sessions,
              calendar events, and audit activity from one internal workspace.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/internal/candidates"
                className="rounded-full bg-[var(--orange)] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.16em] text-white transition hover:bg-[var(--orange-soft)]"
              >
                Open candidates
              </Link>
              <Link
                href="/internal/calendar"
                className="rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.16em] text-white/72 transition hover:border-[var(--orange)] hover:text-white"
              >
                View calendar
              </Link>
            </div>
          </div>
        </div>

        <aside className="panel rounded-[2rem] p-7">
          <p className="eyebrow">Signed in as</p>
          <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-5">
            <h3 className="font-display text-4xl font-bold uppercase leading-none tracking-[-0.05em]">
              {currentMember.name}
            </h3>
            <div className="mt-5 grid gap-2 text-sm text-white/56">
              <p>{currentMember.email}</p>
              <p>
                {currentMember.role} · {currentMember.year} ·{" "}
                {currentMember.major}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-full border border-white/10 bg-white/[0.035] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
              Status
            </span>
            <span className="rounded-full bg-[var(--orange)]/15 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--orange-soft)]">
              {currentMember.status}
            </span>
          </div>

          <Link
            href="/internal/members"
            className="mt-6 inline-flex w-full justify-center rounded-full bg-white px-5 py-3 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--navy-950)] transition hover:bg-[var(--orange-soft)]"
          >
            Open member portal
          </Link>
        </aside>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {internalStats.map((stat) => (
          <article
            key={stat.label}
            className="panel card-hover rounded-[1.5rem] p-6"
          >
            <p className="stat text-5xl font-bold text-white">{stat.value}</p>
            <h3 className="mt-3 text-sm font-extrabold uppercase tracking-[0.14em] text-white/56">
              {stat.label}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-white/42">
              {stat.detail}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="panel rounded-[1.5rem] p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="eyebrow">Cycle stages</p>
            <span className="annotation">Winter 2026</span>
          </div>

          <div className="mt-6 grid gap-3">
            {stages.map((stage, index) => (
              <div
                key={stage.id}
                className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 rounded-[1rem] border border-white/10 bg-white/[0.025] p-4"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xs font-extrabold text-white/50">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-bold">{stage.label}</span>
                <span className="rounded-full bg-[var(--orange)]/12 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--orange-soft)]">
                  {stage.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel rounded-[1.5rem] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Recent candidates</p>
              <h3 className="font-display mt-2 text-3xl font-bold uppercase tracking-[-0.05em]">
                Active review queue
              </h3>
            </div>
            <Link
              href="/internal/candidates"
              className="hidden rounded-full border border-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--orange)] transition hover:border-[var(--orange)] hover:bg-[var(--orange)] hover:text-white md:inline-flex"
            >
              View all
            </Link>
          </div>

          <div className="mt-6 grid gap-3">
            {candidates.slice(0, 4).map((candidate) => (
              <Link
                key={candidate.code}
                href={`/internal/candidates/${candidate.code}`}
                className="grid gap-3 rounded-[1rem] border border-white/10 bg-white/[0.025] p-4 transition hover:border-[var(--orange)] hover:bg-white/[0.06] md:grid-cols-[5rem_1fr_10rem]"
              >
                <span className="font-mono text-sm font-bold text-[var(--orange)]">
                  {candidate.code}
                </span>
                <span>
                  <strong className="block">{candidate.name}</strong>
                  <span className="block text-sm text-white/44">
                    {candidate.major}
                  </span>
                </span>
                <span className="text-sm font-bold text-white/52 md:text-right">
                  {candidate.status}
                </span>
              </Link>
            ))}
          </div>

          <Link
            href="/internal/candidates"
            className="mt-5 inline-flex rounded-full border border-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--orange)] md:hidden"
          >
            View all candidates
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="panel card-hover rounded-[1.5rem] p-6"
          >
            <p className="annotation">Quick action</p>
            <h3 className="font-display mt-4 text-3xl font-bold uppercase tracking-[-0.05em]">
              {action.label}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-white/48">
              {action.detail}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}