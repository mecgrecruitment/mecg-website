import { clients, pillars, services } from "@/lib/site-content";

export default function Home() {
  return (
    <main>
      <section className="relative overflow-hidden px-6 py-20 md:px-12 md:py-28">
        <div className="absolute right-[-5rem] top-[-5rem] h-72 w-72 rounded-full bg-[var(--mecg-orange)] opacity-15 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-[-6rem] h-96 w-96 rounded-full bg-[var(--mecg-blue-light)] opacity-50 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.25em] text-orange">
            Michigan Engineering Consulting Group
          </p>

          <h1 className="mt-8 max-w-6xl text-6xl font-black leading-[0.98] tracking-[-0.07em] text-[var(--mecg-blue-dark)] md:text-6xl lg:text-9xl">
            Multifaceted. Driven. Inclusive.
          </h1>

          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-muted md:text-2xl">
            MECG is a pro-bono consulting group open to all majors at the University of Michigan.
            We help students grow through professional development, education, project experience,
            and community.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="/apply"
              className="focus-ring bg-[var(--mecg-orange)] px-6 py-4 font-mono text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[var(--mecg-orange-dark)]"
            >
              Apply Now
            </a>
            <a
              href="/services"
              className="focus-ring border border-[var(--mecg-blue)] px-6 py-4 font-mono text-sm font-bold uppercase tracking-[0.18em] text-blue transition hover:bg-[var(--mecg-blue)] hover:text-white"
            >
              Work With Us
            </a>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white/70 px-6 py-10 md:px-12">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {[
            ["Founded", "2023"],
            ["Projects", "Client-facing"],
            ["Members", "All majors"],
          ].map(([label, value]) => (
            <div key={label} className="border border-line bg-white p-6">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">{label}</p>
              <p className="mt-4 text-4xl font-black uppercase tracking-[-0.05em] text-[var(--mecg-blue-dark)]">
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row">
            <div>
              <p className="font-mono text-sm font-bold uppercase tracking-[0.22em] text-orange">
                [ Our Pillars ]
              </p>
              <h2 className="mt-4 text-4xl font-black uppercase tracking-[-0.05em] text-[var(--mecg-blue-dark)] md:text-6xl">
                Built for growth.
              </h2>
            </div>
            <p className="max-w-xl text-lg leading-relaxed text-muted">
              MECG combines career preparation, practical client work, technical education,
              and a supportive cross-major community.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {pillars.map((pillar) => (
              <article key={pillar.index} className="group border border-line bg-white p-6 transition hover:-translate-y-1 hover:border-[var(--mecg-orange)]">
                <p className="font-mono text-sm font-bold text-orange">[{pillar.index}]</p>
                <h3 className="mt-8 text-2xl font-black uppercase leading-none tracking-[-0.04em] text-[var(--mecg-blue-dark)]">
                  {pillar.title}
                </h3>
                <p className="mt-5 leading-relaxed text-muted">{pillar.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--mecg-blue-dark)] px-6 py-20 text-white md:px-12">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-mono text-sm font-bold uppercase tracking-[0.22em] text-[var(--mecg-orange)]">
              [ Client Services ]
            </p>
            <h2 className="mt-4 text-4xl font-black uppercase tracking-[-0.05em] md:text-6xl">
              Traditional consulting meets technical problem solving.
            </h2>
            <a
              href="/services"
              className="mt-8 inline-block border border-white px-5 py-3 font-mono text-sm font-bold uppercase tracking-[0.18em] transition hover:bg-white hover:text-[var(--mecg-blue-dark)]"
            >
              Explore services
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <div key={service.title} className="border border-white/20 bg-white/5 p-5 text-xl font-bold">
                {service.title}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.22em] text-orange">
            [ Past Clients ]
          </p>
          <h2 className="mt-4 text-4xl font-black uppercase tracking-[-0.05em] text-[var(--mecg-blue-dark)] md:text-6xl">
            Real project experience.
          </h2>

          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
            {clients.slice(0, 12).map((client) => (
              <div key={client.name} className="flex min-h-28 items-center justify-center border border-line bg-white p-4 text-center font-mono text-sm font-bold uppercase tracking-[0.08em] text-blue">
                {client.name}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}