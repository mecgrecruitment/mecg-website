import React from "react";
import { clients, projectTimeline, services } from "../../../lib/site-content";

export const metadata = {
  title: "Client Services — MECG",
  description:
    "Pro-bono strategy, operations, data analytics, product, and marketing consulting from MECG teams at the University of Michigan.",
};

export default function ServicesPage() {
  return (
    <main>
      {/* Sheet header */}
      <section className="grid-bg relative overflow-hidden px-5 pb-16 pt-36 md:px-8 md:pb-24 md:pt-44">
        <div className="orb left-[-12rem] top-[-12rem] h-[30rem] w-[30rem] bg-[var(--orange-dark)]" />
        <div className="container relative">
          <p className="annotation annotation-accent" data-reveal>
            Sheet 03 — Client services
          </p>
          <h1 className="display-xl mt-6 max-w-6xl text-white" data-split>
            Consulting, <span className="text-ghost">engineered.</span>
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-white/62" data-reveal>
            MECG takes on a diverse mix of traditional and technical consulting
            projects for real clients — at no cost to the organization.
          </p>
          <div className="dim-rule mt-12" data-reveal />
        </div>
      </section>

      {/* Capabilities — numbered ledger rows. */}
      <section className="section">
        <div className="container">
          <p className="annotation annotation-accent" data-reveal>
            Fig. 03.1 — Capabilities
          </p>
          <div className="mt-8 border-t border-white/10" data-reveal-group>
            {services.map((service) => (
              <article
                key={service.title}
                className="card-hover grid gap-4 border-b border-white/10 py-8 md:grid-cols-[6rem_1fr_1.2fr] md:items-baseline"
                data-reveal
              >
                <p className="font-mono text-sm font-bold text-[var(--orange)]">{service.index}</p>
                <h2 className="font-display text-3xl font-bold uppercase leading-none tracking-[-0.045em] text-white md:text-5xl">
                  {service.title}
                </h2>
                <p className="max-w-xl leading-relaxed text-white/52">{service.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Engagement timeline — the drawing sheet. */}
      <section className="sheet px-5 py-20 md:px-8 md:py-28">
        <div className="container">
          <p className="annotation !text-[rgba(5,9,20,0.45)]" data-reveal>
            Fig. 03.2 — How an engagement runs
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
                  {i < projectTimeline.length - 1 && (
                    <span className="dim-rule hidden flex-1 !bg-[var(--paper-rule)] md:block" />
                  )}
                </div>
                <h3 className="font-display mt-6 text-2xl font-bold uppercase tracking-[-0.04em] text-[var(--navy-950)]">
                  {item.title}
                </h3>
                <p className="mt-4 leading-relaxed text-[var(--on-paper-muted)]">{item.body}</p>
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

      {/* Past clients */}
      <section className="section">
        <div className="container">
          <p className="annotation annotation-accent" data-reveal>
            Fig. 03.3 — Past clients
          </p>
          <h2 className="display mt-5 text-5xl uppercase text-white md:text-7xl" data-split>
            Client-facing experience.
          </h2>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-reveal-group>
            {clients.map((client) => (
              <article key={client.name} className="panel card-hover rounded-[1.35rem] p-5" data-reveal>
                <p className="annotation">{client.term}</p>
                <h3 className="font-display mt-8 text-xl font-bold uppercase leading-none tracking-[-0.035em] text-white">
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
