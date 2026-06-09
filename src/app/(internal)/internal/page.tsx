import { candidates, currentMember, internalStats, stages } from "../../../lib/internal-data";

export default function InternalDashboardPage() {
  return (
    <div className="grid gap-8">
      <section className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
        <div className="panel-strong rounded-[2rem] p-7 md:p-9">
          <p className="eyebrow">Dashboard</p>
          <h2 className="font-display mt-5 text-5xl font-bold uppercase leading-[0.95] tracking-[-0.06em] md:text-7xl">
            Recruitment command center.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/56">
            Track candidates, scoring progress, member roles, hash sessions, and audit activity from one internal workspace.
          </p>
        </div>

        <aside className="panel rounded-[2rem] p-7">
          <p className="eyebrow">Signed in as</p>
          <h3 className="font-display mt-5 text-4xl font-bold uppercase tracking-[-0.05em]">
            {currentMember.name}
          </h3>
          <div className="mt-6 grid gap-3 text-sm text-white/56">
            <p>{currentMember.email}</p>
            <p>{currentMember.role} · {currentMember.year} · {currentMember.major}</p>
            <p>Status: {currentMember.status}</p>
          </div>
          <a href="/internal/members" className="mt-7 inline-block rounded-full bg-[var(--orange)] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.16em]">
            Open member portal
          </a>       </aside>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {internalStats.map((stat) => (
          <article key={stat.label} className="panel rounded-[1.5rem] p-6">
            <p className="stat text-5xl font-bold">{stat.value}</p>
            <h3 className="mt-2 text-sm font-bold uppercase tracking-[0.14em] text-white/50">
              {stat.label}
            </h3>
            <p className="mt-3 text-sm text-white/42">{stat.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Cycle stages</p>
          <div className="mt-6 grid gap-3">
            {stages.map((stage) => (
              <div key={stage.id} className="flex items-center justify-between border-b border-white/10 py-4">
                <span className="font-bold">{stage.label}</span>
                <span className="text-sm text-[var(--orange)]">{stage.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel rounded-[1.5rem] p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="eyebrow">Recent candidates</p>
            <a href="/internal/candidates" className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--orange)]">
              View all →
            </a>
          </div>
          <div className="mt-6 grid gap-3">
            {candidates.slice(0, 4).map((candidate) => (
              <a
                key={candidate.code}
                href={`/internal/candidates/${candidate.code}`}
                className="grid gap-3 rounded-[1rem] border border-white/10 p-4 transition hover:border-[var(--orange)] md:grid-cols-[5rem_1fr_10rem]"
              >
                <span className="font-bold text-[var(--orange)]">{candidate.code}</span>
                <span>
                  <strong>{candidate.name}</strong>
                  <span className="block text-sm text-white/44">{candidate.major}</span>
                </span>
                <span className="text-sm text-white/48">{candidate.status}</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
