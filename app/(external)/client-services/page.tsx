import React from "react";
import {
  clients,
  projectExpectations,
  projectTimeline,
  services,
} from "@/lib/site-content";

export const metadata = {
  title: "Client Services — MECG",
  description: "Pro-bono consulting services from MECG.",
};

export default function ClientServicesPage() {
  return (
    <main>
      

      <section className="section">
        <div className="container">
          <p className="annotation annotation-accent" data-reveal>
            Fig. 03.1 — Click a service to learn more
          </p>

          <h2 className="display mt-5 max-w-4xl text-5xl uppercase text-white md:text-7xl" data-split>
            What we help with.
          </h2>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5" data-reveal-group>
            {services.map((service) => (
              <details
                key={service.title}
                className="group panel card-hover rounded-[1.35rem] p-6 open:border-[var(--orange)]/50"
                data-reveal
              >
                <summary className="cursor-pointer list-none">
                <p className="font-mono text-sm font-bold text-[var(--orange)]">
                    {service.index}
                  </p>

                  <h3 className="font-display mt-8 text-3xl font-bold uppercase leading-none tracking-[-0.045em] text-white">
                    {service.title}
                  </h3>

                  <p className="annotation mt-6 text-white/35 group-open:hidden">
                    Tap to open +
                  </p>

                  <p className="annotation mt-6 hidden text-[var(--orange)] group-open:block">
                    Tap to close —
                  </p>
                </summary>

                <p className="mt-5 leading-relaxed text-white/58">
                  {service.body}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="sheet px-5 py-20 md:px-8 md:py-28">
        <div className="container">
          <p className="annotation !text-[rgba(5,9,20,0.45)]" da-reveal>
            Fig. 03.2 — Engagement structure
          </p>

          <h2 className="display mt-5 max-w-3xl text-5xl uppercase text-[var(--navy-950)] md:text-7xl" data-split>
            From first call to final deliverable.
          </h2>

          <div className="mt-14 grid gap-10 md:grid-cols-4" data-reveal-group>
            {projectTimeline.map((item, i) => (
              <article key={item.step} className="relative" data-reveal>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-sm font-bold text-[var(--orange-dark)]">
                    Step {item.step}
                  </p>

                  {i < projectTimeline.length - 1 ? (
                    <span className="dim-rule hidden flex-1 !bg-[var(--paper-rule)] md:block" />
                  ) : null}
                </div>

                <h3 className="font-display mt-6 text-2xl font-bold uppercase tracking-[-0.04em] text-[var(--navy-950)]">
                  {item.title}
              </h3>

                <p className="mt-4 leading-relaxed text-[var(--on-paper-muted)]">
                  {item.body}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-4" data-reveal-group>
            {projectExpectations.map((item) => (
              <article
                key={item.title}
                className="rounded-[1rem] border border-[var(--paper-rule)] p-6"
                data-reveal
              >
                <h3 className="font-display text-2xl font-bold uppercase tracking-[-0.04em] text-[var(--navy-950)]">
                  {item.title}
                </h3>

                <p className="mt-4 leading-relaxed text-[var(--on-paper-muted)]">
                  {item.body}
                </p>
              </article>
            ))}
          </div>

          <a
            href="/contact"
            data-magnetic
            className="focus-ring mt-14 inline-block rounded-full bg-[var(--navy-950)] px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[var(--orange)]"
            data-reveal
          >
            Start a project
          </a>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="annotation annotation-accent" data-reveal>
            Fig. 03.3 — Past Projects
          </p>

          <h2 className="display mt-5 text-5xl uppercase text-white md:text-7xl" data-split>
            Client-facing experience.
          </h2>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/56" data-reveal>
            A sample of MECG client work and project experience. Logos and photos are intentionally excluded from this section for now.
          </p>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-reveal-group>
            {clients.map((client, index) => (
              <article
                key={client.name}
                className="panel card-hover rounded-[1.35rem] p-6"
                data-reveal
              >
                <p className="font-mono text-sm font-bold text-[var(--orange)]">
                  {String(index + 1).padStart(2, "0")}
                </p>

                <p className="annotation mt-10">{client.term}</p>

                <h3 className="font-display mt-3 text-2xl font-bold uppercase leading-none tracking-[-0.04em] text-white">
                  {client.name}
                </h3>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
