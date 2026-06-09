import { clients, pillars, services } from "../../lib/site-content";

const impactStats = [
  { value: "80+", label: "Members", detail: "across majors and class years" },
  { value: "25+", label: "Projects Completed", detail: "with real client teams" },
  { value: "15+", label: "Different Majors", detail: "represented in the community" },
];

export default function Home() {
  return (
    <main>
      <section className="noise relative overflow-hidden px-5 py-20 md:px-10 md:py-28">
        <div className="absolute right-[-12rem] top-[-10rem] h-[34rem] w-[34rem] rounded-full bg-[var(--mecg-sky)] opacity-70 blur-3xl" />
        <div className="absolute bottom-[-16rem] left-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[var(--mecg-orange)] opacity-20 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-3 border border-[var(--line)] bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--mecg-blue)] shadow-sm backdrop-blur">
              <span className="h-2 w-2 bg-[var(--mecg-orange)]" />
              University of Michigan
            </div>

            <h1 className="display-tight mt-8 text-6xl font-black uppercase text-[var(--mecg-blue-dark)] md:text-8xl xl:text-[7.8rem]">
              Multifaceted.
              <span className="block text-[var(--mecg-blue)]">Driven.</span>
              <span className="block text-[var(--mecg-orange)]">Inclusive.</span>
            </h1>

            <p className="mt-8 max-w-2xl text-xl leading-relaxed text-[var(--muted)] md:text-2xl">
              Michigan Engineering Consulting Group is a pro-bono consulting group open to all majors at the University of Michigan.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="/apply"
                className="focus-ring bg-[var(--mecg-orange)] px-7 py-4 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_18px_38px_rgba(245,130,58,0.32)] transition hover:-translate-y-1 hover:bg-[var(--mecg-orange-dark)]"
              >
                Apply Now
              </a>
              <a
                href="/services"
                className="focus-ring border border-[var(--mecg-blue)] bg-white/70 px-7 py-4 text-sm font-black uppercase tracking-[0.18em] text-[var(--mecg-blue-dark)] shadow-sm transition hover:-translate-y-1 hover:bg-[var(--mecg-blue)] hover:text-white"
              >
                Work With Us
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="glass-card relative overflow-hidden p-6 md:p-8">
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[var(--mecg-orange)] opacity-20 blur-2xl" />

              <div className="blue-panel p-8 shadow-[0_28px_70px_rgba(20,43,82,0.24)]">
                <p className="text-sm font-black uppercase tracking-[0.22em] text-[var(--mecg-orange)]">
                  MECG / Consulting
                </p>
                <h2 className="mt-8 text-4xl font-black uppercase leading-none tracking-[-0.055em] md:text-6xl">
                  Student consultants. Real clients. Practical impact.
                </h2>
                <p className="mt-7 text-lg leading-relaxed text-white/78">
                  Our members learn by doing: strategy, operations, analytics, product, and marketing work for organizations that need clear recommendations.
                </p>

                <div className="mt-10 grid gap-3 sm:grid-cols-2">
                  {["Strategy", "Analytics", "Operations", "Product"].map((item) => (
                    <div key={item} className="border border-white/18 bg-white/8 px-4 py-3 text-sm font-black uppercase tracking-[0.13em] text-white/88">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="h-28 bg-[var(--mecg-orange)]" />
                <div className="h-28 bg-[var(--mecg-blue)]" />
                <div className="h-28 bg-[var(--mecg-sky)]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-14 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-3">
            {impactStats.map((stat) => (
              <article key={stat.label} className="glass-card p-7 transition hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(20,43,82,0.16)]">
                <p className="text-6xl font-black tracking-[-0.07em] text-[var(--mecg-blue-dark)]">
                  {stat.value}
                </p>
                <h2 className="mt-3 text-xl font-black uppercase tracking-[-0.03em] text-[var(--mecg-blue)]">
                  {stat.label}
                </h2>
                <p className="mt-2 text-[var(--muted)]">{stat.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[var(--mecg-orange)]">
                Our Four Pillars
              </p>
              <h2 className="display-tight mt-5 text-5xl font-black uppercase text-[var(--mecg-blue-dark)] md:text-7xl">
                Learn. Build. Lead. Belong.
              </h2>
            </div>

            <p className="max-w-2xl text-xl leading-relaxed text-[var(--muted)]">
              MECG centers a community of diverse students who share a passion to learn more about consulting and gain experience in the field.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {pillars.map((pillar) => (
              <article key={pillar.index} className="group relative overflow-hidden bg-white p-7 shadow-[0_14px_34px_rgba(20,43,82,0.10)] transition hover:-translate-y-1">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--mecg-orange)] to-[var(--mecg-blue)]" />
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[var(--mecg-orange)]">
                  {pillar.index}
                </p>
                <h3 className="mt-8 text-2xl font-black uppercase leading-none tracking-[-0.045em] text-[var(--mecg-blue-dark)]">
                  {pillar.title}
                </h3>
                <p className="mt-5 leading-relaxed text-[var(--muted)]">
                  {pillar.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="blue-panel px-5 py-20 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[var(--mecg-orange)]">
              Client Services
            </p>
            <h2 className="display-tight mt-5 text-5xl font-black uppercase md:text-7xl">
              Consulting with technical range.
            </h2>
            <p className="mt-7 text-xl leading-relaxed text-white/75">
              MECG supports a diverse mix of traditional consulting and tech consulting projects.
            </p>
            <a
              href="/services"
              className="focus-ring mt-10 inline-block bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-[var(--mecg-blue-dark)] transition hover:bg-[var(--mecg-orange)] hover:text-white"
            >
              Explore Services
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((service) => (
              <article key={service.title} className="border border-white/16 bg-white/8 p-6 backdrop-blur transition hover:-translate-y-1 hover:bg-white/12">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[var(--mecg-orange)]">
                  {service.index}
                </p>
                <h3 className="mt-6 text-2xl font-black uppercase tracking-[-0.04em]">
                  {service.title}
                </h3>
                <p className="mt-4 leading-relaxed text-white/68">{service.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[var(--mecg-orange)]">
                Past Clients
              </p>
              <h2 className="display-tight mt-5 text-5xl font-black uppercase text-[var(--mecg-blue-dark)] md:text-7xl">
                Project experience that leaves the classroom.
              </h2>
            </div>
            <a href="/placement" className="text-sm font-black uppercase tracking-[0.18em] text-[var(--mecg-blue)] hover:text-[var(--mecg-orange)]">
              View project index →
            </a>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">
            {clients.slice(0, 12).map((client) => (
              <article key={client.name} className="min-h-32 bg-white p-5 shadow-[0_12px_28px_rgba(20,43,82,0.08)] transition hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(20,43,82,0.14)]">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--mecg-orange)]">
                  {client.term}
                </p>
                <h3 className="mt-6 text-xl font-black uppercase leading-none tracking-[-0.04em] text-[var(--mecg-blue-dark)]">
                  {client.name}
                </h3>
              </article>
            ))}
        </div>
        </div>
      </section>

      <section className="px-5 pb-24 md:px-10">
        <div className="mx-auto max-w-7xl overflow-hidden bg-white shadow-[0_28px_80px_rgba(20,43,82,0.16)] lg:grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="min-h-[24rem] bg-[var(--mecg-sky)] p-8">
            <div className="h-full border-4 border-[var(--mecg-orange)] bg-gradient-to-br from-[var(--mecg-blue)] to-[var(--mecg-blue-dark)] p-8 text-white">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-[var(--mecg-orange)]">
                President's Welcome
              </p>
              <h2 className="mt-8 text-4xl font-black uppercase leading-none tracking-[-0.05em]">
                Welcome to the MECG community.
              </h2>
            </div>
          </div>

          <div className="p-8 md:p-12">
            <p className="text-lg leading-relaxed text-[var(--muted)]">
              At MECG, every project is an opportunity to grow, innovate, and make a meaningful impact. Our members bring diverse backgrounds and majors, combining technical depth with business curiosity.
            </p>
            <p className="mt-6 text-lg leading-relaxed text-[var(--muted)]">
              Whether you're a potential client looking for strategic guidance or a student eager to join our community, we'd love to hear from you.
            </p>
            <div className="mt-10">
              <p className="text-3xl font-black text-[var(--mecg-blue-dark)]">Annie Callam</p>
              <p className="mt-1 text-[var(--muted)]">President of MECG, 2026</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
