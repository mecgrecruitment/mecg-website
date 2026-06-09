import { clients, projectTimeline, services } from "../../../lib/site-content";

export default function ServicesPage() {
  return (
    <main>
      <section className="px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
            [ Client Services ]
          </p>
          <h1 className="mt-6 max-w-6xl text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] text-[var(--mecg-blue-dark)] md:text-8xl">
            Traditional consulting meets technical problem solving.
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-muted">
            MECG focuses on a diverse mix of traditional consulting and tech consulting projects for real clients.
          </p>
        </div>
      </section>

      <section className="border-y border-line bg-white px-6 py-16 md:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
            [ Services ]
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-5">
            {services.map((service) => (
              <article key={service.title} className="border border-line bg-[var(--paper)] p-6 transition hover:-translate-y-1 hover:border-[var(--mecg-orange)]">
                <p className="font-mono text-sm font-bold text-orange">[{service.index}]</p>
                <h2 className="mt-8 text-2xl font-black uppercase leading-none tracking-[-0.04em] text-[var(--mecg-blue-dark)]">
                  {service.title}
                </h2>
                <p className="mt-5 leading-relaxed text-muted">{service.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
            [ Project Timeline ]
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {projectTimeline.map((item) => (
              <article key={item.step} className="border-l-4 border-[var(--mecg-orange)] bg-white p-6">
                <p className="font-mono text-sm font-bold text-blue">Step {item.step}</p>
                <h2 className="mt-5 text-2xl font-black uppercase tracking-[-0.04em] text-[var(--mecg-blue-dark)]">
                  {item.title}
                </h2>
                <p className="mt-4 leading-relaxed text-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--mecg-blue-dark)] px-6 py-20 text-white md:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-[var(--mecg-orange)]">
            [ Past Clients ]
          </p>
          <h2 className="mt-4 text-4xl font-black uppercase tracking-[-0.05em] md:text-6xl">
            Client-facing project experience.
          </h2>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {clients.map((client) => (
              <article key={client.name} className="border border-white/20 bg-white/5 p-5">
                <h3 className="font-bold uppercase tracking-[-0.02em]">{client.name}</h3>
                <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-white/60">
                  {client.term}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
