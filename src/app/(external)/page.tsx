import { GearLogo } from "../../components/brand/GearLogo";
import { clients, pillars, recruitmentEvents, services } from "../../lib/site-content";

const stats = [
  ["80+", "Members"],
  ["25+", "Projects Completed"],
  ["15+", "Majors Represented"],
];

export default function Home() {
  return (
    <main>
      <section className="grid-bg relative px-5 py-20 md:px-8 md:py-28">
        <div className="orb right-[-12rem] top-[-12rem] h-[34rem] w-[34rem] bg-[var(--blue)]" />
        <div className="orb bottom-[-12rem] left-[-12rem] h-[28rem] w-[28rem] bg-[var(--orange-dark)]" />

        <div className="container relative grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="eyebrow reveal">Michigan Engineering Consulting Group</p>

            <h1 className="display reveal-2 mt-8 max-w-5xl text-6xl uppercase text-white md:text-8xl xl:text-[8rem]">
              Pro-bono consulting at Michigan.
            </h1>

            <p className="reveal-3 mt-8 max-w-2xl text-xl leading-relaxed text-white/62 md:text-2xl">
              MECG helps students develop consulting skills through client projects, technical education, professional development, and community.
            </p>

            <div className="reveal-3 mt-10 flex flex-wrap gap-3">
              <a
                href="/apply"
                className="focus-ring rounded-full bg-[var(--orange)] px-6 py-3.5 text-xs font-extrabold uppercase tracking-[0.16em] text-white transition hover:bg-white hover:text-[var(--navy-950)]"
              >
                Apply to MECG
              </a>
              <a
                href="/services"
                className="focus-ring rounded-full border border-white/14 px-6 py-3.5 text-xs font-extrabold uppercase tracking-[0.16em] text-white/72 transition hover:border-white/34 hover:text-white"
              >
                Client Services
              </a>
            </div>
          </div>

          <aside className="panel-strong reveal-3 rounded-[2rem] p-6">
            <div className="flex items-start justify-between gap-8">
              <div>
                <p className="eyebrow">Overview</p>
                <h2 className="font-display mt-6 max-w-lg text-4xl font-bold uppercase leading-[0.95] tracking-[-0.055em] text-white md:text-5xl">
                  Real project work for students across majors.
                </h2>
              </div>
              <GearLogo className="hidden h-20 w-20 shrink-0 text-[var(--orange)] opacity-80 md:block" spin />
            </div>

            <div className="mt-10 grid gap-3">
              {["Strategy", "Operations", "Data Analytics", "Product Development", "Marketing"].map((item, index) => (
                <div
                  key={item}
                  className="grid grid-cols-[3rem_1fr] items-center border-t border-white/10 py-4"
                >
                  <span className="text-sm font-bold text-[var(--orange)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-lg font-semibold text-white/80">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="border-y border-white/10 px-5 py-8 md:px-8">
        <div className="container grid gap-4 md:grid-cols-3">
          {stats.map(([value, label]) => (
            <div key={label} className="panel rounded-[1.5rem] p-6">
              <p className="stat text-5xl font-bold text-white">{value}</p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.14em] text-white/42">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="container grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow">What members build</p>
            <h2 className="display mt-5 text-5xl uppercase text-white md:text-7xl">
              A practical path into consulting.
            </h2>
          </div>

          <div className="border-t border-white/10">
            {pillars.map((pillar) => (
              <article
                key={pillar.index}
                className="card-hover grid gap-5 border-b border-white/10 py-7 md:grid-cols-[5rem_1fr_1.35fr]"
              >
                <p className="text-sm font-bold text-[var(--orange)]">
                  {pillar.index}
                </p>
                <h3 className="font-display text-2xl font-bold uppercase leading-none tracking-[-0.04em] text-white">
                  {pillar.title}
                </h3>
                <p className="leading-relaxed text-white/52">
                  {pillar.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section border-y border-white/10 bg-white/[0.025]">
        <div className="container grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="eyebrow">Client services</p>
            <h2 className="display mt-5 text-5xl uppercase text-white md:text-7xl">
              Support for strategic and technical problems.
            </h2>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/56">
              Teams scope projects, conduct research, analyze data, and present recommendations to client organizations.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <article key={service.title} className="card-hover panel rounded-[1.5rem] p-6">
                <p className="text-sm font-bold text-[var(--orange)]">{service.index}</p>
                <h3 className="font-display mt-6 text-2xl font-bold uppercase tracking-[-0.04em] text-white">
                  {service.title}
                </h3>
                <p className="mt-4 leading-relaxed text-white/50">
                  {service.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Project experience</p>
              <h2 className="display mt-5 text-5xl uppercase text-white md:text-7xl">
                Past client work.
              </h2>
            </div>
            <a
              href="/placement"
              className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)] hover:text-white"
            >
              View placement →
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {clients.slice(0, 8).map((client) => (
              <article key={client.name} className="panel rounded-[1.35rem] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/34">
                  {client.term}
                </p>
                <h3 className="font-display mt-8 text-2xl font-bold uppercase leading-none tracking-[-0.04em] text-white">
                  {client.name}
                </h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section border-y border-white/10 bg-white/[0.025]">
        <div className="container grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="eyebrow">Recruitment</p>
            <h2 className="display mt-5 text-5xl uppercase text-white md:text-7xl">
              Winter 2026 timeline.
            </h2>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/56">
              Learn about MECG through open events, then apply and move through invite-only stages.
            </p>
          </div>

          <div className="grid gap-3">
            {recruitmentEvents.slice(0, 5).map((event) => (
              <article
                key={event.code}
                className="panel card-hover grid gap-4 rounded-[1.35rem] p-5 md:grid-cols-[5rem_1fr_12rem]"
              >
                <p className="font-bold text-[var(--orange)]">{event.code}</p>
                <div>
                  <h3 className="font-display text-xl font-bold uppercase tracking-[-0.035em] text-white">
                    {event.title}
                  </h3>
                  <p className="mt-2 text-sm text-white/48">{event.body}</p>
                </div>
                <p className="text-sm leading-relaxed text-white/42">
                  {event.date}<br />
                  {event.time}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container grid gap-5 md:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] bg-white p-8 text-[var(--navy-950)] md:p-12">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[var(--orange-dark)]">
              Apply
            </p>
            <h2 className="font-display mt-7 max-w-4xl text-5xl font-bold uppercase leading-[0.92] tracking-[-0.065em] md:text-7xl">
              Join MECG this recruitment cycle.
            </h2>
          </div>

          <div className="panel rounded-[2rem] p-8 md:p-10">
            <p className="text-lg leading-relaxed text-white/58">
              MECG is open to students across majors who want to learn consulting through structured education, client work, and collaboration.
            </p>
            <a
              href="/apply"
              className="focus-ring mt-8 inline-block rounded-full bg-[var(--orange)] px-7 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white transition hover:bg-white hover:text-[var(--navy-950)]"
            >
              Start application
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
