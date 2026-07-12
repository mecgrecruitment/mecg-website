import React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import {
  clients,
  projectExpectations,
  projectTimeline,
  services,
} from "@/lib/site-content";
import { Timeline } from "../components/Timeline";

const title = "Client Services";
const description =
  "MECG delivers pro-bono consulting for startups, nonprofits, and established firms — market research, operations, strategy, and analytics — on a structured semester engagement from first call to final deliverable.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/client-services" },
  openGraph: { title, description },
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

          <div className="mt-14">
            <Timeline
              variant="static"
              items={projectTimeline.map((item) => ({
                id: item.step,
                index: `Step ${item.step}`,
                title: item.title,
                body: item.body,
              }))}
            />
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
            A sample of MECG client work and project experience.
          </p>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-reveal-group>
            {clients.map((client, index) => (
              <article
                key={client.name}
                className="group panel card-hover rounded-[1.35rem] p-6"
                data-reveal
              >
                {client.logo ? (
                  <div className="relative h-16 w-full overflow-hidden rounded-[0.85rem] bg-white/92 p-3">
                    <Image
                      src={client.logo}
                      alt={`${client.name} logo`}
                      fill
                      sizes="200px"
                      className="object-contain grayscale transition duration-300 group-hover:grayscale-0"
                    />
                  </div>
                ) : (
                  <p className="font-mono text-sm font-bold text-[var(--orange)]">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                )}

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
