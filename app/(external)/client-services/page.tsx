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
import { PageHero } from "../components/PageHero";

const title = "Client Services";
const description =
  "Pro-bono consulting from MECG at UMich. Semester engagements covering strategy, operations, analytics, product, and marketing. " +
  `${clients.length}+ listed past clients.`;

const fitSignals = [
  "A focused question that needs research, analysis, or an outside view",
  "A point person who can meet regularly and give the team context",
  "A 10-12 week window for collaboration, feedback, and final handoff",
];

const clientOutputs = [
  "A defined scope and working timeline",
  "Regular progress updates and chances to redirect the work",
  "A final presentation, supporting analysis, and practical next steps",
];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/client-services" },
  openGraph: { title, description },
};

export default function ClientServicesPage() {
  return (
    <main>
      <PageHero
        title="Client Services"
        description="Semester consulting for organizations. Research, recommendations, and a handoff clients can use."
        tone="mixed"
      >
        <a href="/contact" className="button-primary focus-ring" data-magnetic>
          Contact
        </a>
      </PageHero>

      <section className="section pb-0">
        <div className="container grid gap-5 lg:grid-cols-2">
          <article className="panel rounded-[1.5rem] p-7 md:p-10">
            <p className="text-sm font-semibold text-[var(--orange-soft)]">Before we begin</p>
            <h2 className="font-display mt-4 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">A good engagement fit</h2>
            <ul className="mt-8 grid gap-5">
              {fitSignals.map((item, index) => (
                <li key={item} className="grid grid-cols-[2rem_1fr] gap-3 border-t border-white/10 pt-5 text-white/62">
                  <span className="font-mono text-xs font-bold text-[var(--orange)]">0{index + 1}</span>
                  <span className="leading-7">{item}</span>
                </li>
              ))}
            </ul>
          </article>
          <article className="sheet rounded-[1.5rem] p-7 md:p-10">
            <p className="text-sm font-semibold text-[var(--orange-dark)]">What clients receive</p>
            <h2 className="font-display mt-4 text-4xl font-semibold tracking-[-0.04em] text-[var(--navy-950)] md:text-5xl">Clear work and practical next steps</h2>
            <ul className="mt-8 grid gap-5">
              {clientOutputs.map((item, index) => (
                <li key={item} className="grid grid-cols-[2rem_1fr] gap-3 border-t border-[var(--paper-rule)] pt-5 text-[var(--on-paper-muted)]">
                  <span className="font-mono text-xs font-bold text-[var(--orange-dark)]">0{index + 1}</span>
                  <span className="leading-7">{item}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="font-display max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl" data-split>
            What we help with
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

                  <h3 className="font-display mt-8 text-2xl font-semibold tracking-[-0.035em] text-white">
                    {service.title}
                  </h3>

                  <p className="annotation mt-6 text-white/35 group-open:hidden">
                    Open details +
                  </p>

                  <p className="annotation mt-6 hidden text-[var(--orange)] group-open:block">
                    Close details
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
          <h2 className="font-display max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-[var(--navy-950)] md:text-6xl" data-split>
            From first call to final deliverable
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
                <h3 className="font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--navy-950)]">
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
            Contact
          </a>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="font-display text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl" data-split>
            Past clients
          </h2>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/56" data-reveal>
            {clients.length} organizations from recent semesters. Logos appear only when we have permission to show them.
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
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      className="object-contain grayscale transition duration-300 group-hover:grayscale-0"
                    />
                  </div>
                ) : (
                  <p className="font-mono text-sm font-bold text-[var(--orange)]">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                )}

                <p className="annotation mt-10">{client.term}</p>

                <h3 className="font-display mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
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
