import { GearLogo } from "../../components/brand/GearLogo";
import { clients, pillars, recruitmentEvents, services } from "../../lib/site-content";
import HeroGears from "./components/HeroGears";

const stats = [
  ["80+", "Members"],
  ["25+", "Projects Completed"],
  ["15+", "Majors Represented"],
];

export default function Home() {
  return (
    <main>
      {/* SEC.01 — Hero: the drivetrain. Scroll powers the gears. */}
      <section className="grid-bg relative flex min-h-svh flex-col justify-end overflow-hidden px-5 pb-14 pt-32 md:px-8">
        <div className="orb right-[-12rem] top-[-12rem] h-[34rem] w-[34rem] bg-[var(--blue)]" />
        <div className="orb bottom-[-14rem] left-[-12rem] h-[28rem] w-[28rem] bg-[var(--orange-dark)]" />

        {/* WebGL gear assembly — full-bleed stage, weighted to the right. */}
        <div className="absolute inset-0 lg:left-auto lg:w-[60%]">
          <HeroGears />
        </div>

        <div className="container relative">
          <p className="annotation annotation-accent" data-reveal>
            Fig. 01 — Michigan Engineering Consulting Group
          </p>

          <h1 className="display-xl mt-6 text-white" data-split>
            Pro-bono
            <br />
            <span className="text-ghost">consulting</span>
            <br />
            at Michigan.
          </h1>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <p className="max-w-xl text-lg leading-relaxed text-white/62 md:text-xl" data-reveal>
              Students from every major learn consulting the way engineers
              learn anything — by building. Client projects, technical
              education, professional development, community.
            </p>

            <div className="flex flex-wrap gap-3" data-reveal>
              <a
                href="/apply"
                data-magnetic
                className="focus-ring rounded-full bg-[var(--orange)] px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-white hover:text-[var(--navy-950)]"
              >
                Apply to MECG
              </a>
              <a
                href="/services"
                data-magnetic
                className="focus-ring rounded-full border border-white/16 px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-white/40 hover:text-white"
              >
                Client services
              </a>
            </div>
          </div>

          <div className="mt-14 flex items-center gap-4" data-reveal>
            <span className="annotation">Scroll to drive</span>
            <span className="dim-rule w-24" />
            <GearLogo className="h-4 w-4 text-[var(--orange)]/70" />
          </div>
        </div>
</section>

      {/* Stats — measured values, counted up on entry. */}
      <section className="border-y border-white/10 px-5 md:px-8">
        <div className="container grid md:grid-cols-3" data-reveal-group>
          {stats.map(([value, label], i) => (
            <div
              key={label}
              className="border-b border-white/10 py-9 md:border-b-0 md:border-r md:px-10 md:first:pl-0 md:last:border-r-0"
              data-reveal
            >
              <p className="annotation">{`Ref. ${String(i + 1).padStart(2, "0")}`}</p>
              <p className="stat mt-3 text-6xl font-bold text-white md:text-7xl" data-counter>
                {value}
              </p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.14em] text-white/42">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SEC.02 — Pillars */}
      <section className="section relative overflow-hidden">
        <div className="container grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="annotation annotation-accent" data-reveal>
              Sec. 02 — What members build
            </p>
            <h2 className="display mt-5 text-5xl uppercase text-white md:text-7xl" data-split>
              A practical path into consulting.
            </h2>
          </div>

          <div className="border-t border-white/10" data-reveal-group>
            {pillars.map((pillar) => (
              <article
                key={pillar.index}
                className="card-hover grid gap-5 border-b border-white/10 py-8 md:grid-cols-[5rem_1fr_1.35fr]"
                data-reveal
              >
                <p className="font-mono text-sm font-bold text-[var(--orange)]">
                  {pillar.index}
                </p>
                <h3 className="font-display text-2xl font-bold uppercase leading-none tracking-[-0.04em] text-white">
                  {pillar.title}
                </h3>
                <p className="leading-relaxed text-white/52">{pillar.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* SEC.03 — Services: the drawing sheet (inverted). */}
      <section className="sheet relative px-5 py-20 md:px-8 md:py-28">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="annotation !text-[rgba(5,9,20,0.45)]" data-reveal>
                Sec. 03 — Client services
              </p>
              <h2
                className="display mt-5 text-5xl uppercase text-[var(--navy-950)] md:text-7xl"
                data-split
              >
                Strategic and technical problems, solved.
              </h2>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-[var(--on-paper-muted)]" data-reveal>
                Teams scope projects, conduct research, analyze data, and
                present recommendations to client organizations — at no cost.
              </p>
              <a
                href="/services"
                data-magnetic
                className="focus-ring mt-8 inline-block rounded-full bg-[var(--navy-950)] px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[var(--orange)]"
                data-reveal
              >
                Explore services
              </a>
            </div>

            <div className="grid gap-px overflow-hidden rounded-[1rem] border border-[var(--paper-rule)] bg-[var(--paper-rule)] sm:grid-cols-2" data-reveal-group>
              {services.map((service) => (
                <article
                  key={service.title}
                  className="group bg-[var(--paper)] p-6 transition-colors duration-300 hover:bg-[var(--navy-950)] sm:last:col-span-2"
                  data-reveal
                >
                  <p className="font-mono text-sm font-bold text-[var(--orange-dark)] group-hover:text-[var(--orange)]">
                    {service.index}
                  </p>
                  <h3 className="font-display mt-6 text-2xl font-bold uppercase tracking-[-0.04em] text-[var(--navy-950)] transition-colors duration-300 group-hover:text-white">
                    {service.title}
                  </h3>
                  <p className="mt-4 leading-relaxed text-[var(--on-paper-muted)] transition-colors duration-300 group-hover:text-white/60">
                    {service.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SEC.04 — Clients: the index + the ticker. */}
      <section className="section overflow-hidden">
        <div className="container">
          <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="annotation annotation-accent" data-reveal>
                Sec. 04 — Project experience
              </p>
              <h2 className="display mt-5 text-5xl uppercase text-white md:text-7xl" data-split>
                Past client work.
              </h2>
            </div>
            <a
              href="/placement"
              className="focus-ring font-mono text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)] hover:text-white"
              data-reveal
            >
              View placement →
            </a>
          </div>
        </div>

        {/* Full-bleed client ticker. */}
        <div className="marquee border-y border-white/10 py-6" data-reveal>
          {[0, 1].map((dup) => (
            <div key={dup} className="marquee-track" aria-hidden={dup === 1}>
              {clients.map((client) => (
                <span key={`${dup}-${client.name}`} className="flex items-center">
                  <span className="font-display px-6 text-3xl font-bold uppercase tracking-[-0.03em] text-white/75 md:text-4xl">
                    {client.name}
                  </span>
                  <GearLogo className="h-5 w-5 shrink-0 text-[var(--orange)]/60" />
                </span>
              ))}
            </div>
          ))}
        </div>

        <div className="container mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-reveal-group>
          {clients.slice(0, 8).map((client) => (
            <article key={client.name} className="panel card-hover rounded-[1.35rem] p-5" data-reveal>
              <p className="annotation">{client.term}</p>
              <h3 className="font-display mt-8 text-2xl font-bold uppercase leading-none tracking-[-0.04em] text-white">
                {client.name}
              </h3>
            </article>
          ))}
        </div>
      </section>

      {/* SEC.05 — Recruitment */}
      <section className="section border-y border-white/10 bg-white/[0.025]">
        <div className="container grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="annotation annotation-accent" data-reveal>
              Sec. 05 — Recruitment
            </p>
            <h2 className="display mt-5 text-5xl uppercase text-white md:text-7xl" data-split>
              Winter 2026 timeline.
            </h2>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/56" data-reveal>
              Learn about MECG through open events, then apply and move through
              invite-only stages.
            </p>
            <a
              href="/recruitment"
              data-magnetic
              className="focus-ring mt-8 inline-block rounded-full border border-white/16 px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-white/40 hover:text-white"
              data-reveal
            >
              Full timeline
            </a>
          </div>

          <div className="grid gap-3" data-reveal-group>
            {recruitmentEvents.slice(0, 5).map((event) => (
              <article
                key={event.code}
                className="panel card-hover grid gap-4 rounded-[1.35rem] p-5 md:grid-cols-[5rem_1fr_12rem]"
                data-reveal
              >
                <p className="font-mono font-bold text-[var(--orange)]">{event.code}</p>
                <div>
                  <h3 className="font-display text-xl font-bold uppercase tracking-[-0.035em] text-white">
                    {event.title}
                  </h3>
                  <p className="mt-2 text-sm text-white/48">{event.body}</p>
                </div>
                <p className="font-mono text-xs uppercase leading-relaxed tracking-[0.08em] text-white/42">
                  {event.date}
                  <br />
                  {event.time}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* SEC.06 — Apply */}
      <section className="section">
        <div className="container grid gap-5 md:grid-cols-[1.15fr_0.85fr]">
          <div className="sheet rounded-[2rem] p-8 md:p-12" data-reveal="wipe">
            <p className="annotation !text-[var(--orange-dark)]">Sec. 06 — Apply</p>
            <h2 className="font-display mt-7 max-w-4xl text-5xl font-bold uppercase leading-[0.92] tracking-[-0.065em] text-[var(--navy-950)] md:text-7xl">
              Join MECG this recruitment cycle.
            </h2>
          </div>

          <div className="panel rounded-[2rem] p-8 md:p-10" data-reveal>
            <p className="text-lg leading-relaxed text-white/58">
              MECG is open to students across majors who want to learn
              consulting through structured education, client work, and
              collaboration.
            </p>
            <a
              href="/apply"
              data-magnetic
              className="focus-ring mt-8 inline-block rounded-full bg-[var(--orange)] px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-white hover:text-[var(--navy-950)]"
            >
              Start application
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
