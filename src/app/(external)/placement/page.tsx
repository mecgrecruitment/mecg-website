import React from "react";
import { clients } from "../../../lib/site-content";

export const metadata = {
  title: "Placement — MECG",
  description:
    "Where MECG members and projects go — client project index and, soon, the member placement and internship index.",
};

export default function PlacementPage() {
  return (
    <main>
      {/* Sheet header */}
      <section className="grid-bg relative overflow-hidden px-5 pb-16 pt-36 md:px-8 md:pb-24 md:pt-44">
        <div className="orb left-[-10rem] top-[-12rem] h-[30rem] w-[30rem] bg-[var(--blue)]" />
        <div className="container relative">
          <p className="annotation annotation-accent" data-reveal>
            Sheet 06 — Placement
          </p>
          <h1 className="display-xl mt-6 max-w-6xl text-white" data-split>
            Where the work <span className="text-ghost">leads.</span>
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-white/62" data-reveal>
            This page is becoming the placement and internship index. Today it
            documents MECG&apos;s client-facing project experience from past
            semesters.
          </p>
          <div className="dim-rule mt-12" data-reveal />
        </div>
      </section>

      {/* Project index */}
      <section className="section">
        <div className="container">
          <p className="annotation annotation-accent" data-reveal>
            Fig. 06.1 — Project index
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-reveal-group>
            {clients.map((client, index) => (
              <article
                key={client.name}
                className="panel card-hover flex min-h-44 flex-col justify-between rounded-[1.35rem] p-5"
                data-reveal
              >
                <p className="font-mono text-sm font-bold text-[var(--orange)]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <div>
                  <h2 className="font-display text-xl font-bold uppercase tracking-[-0.035em] text-white md:text-2xl">
                    {client.name}
                  </h2>
                  <p className="annotation mt-3">{client.term}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Coming soon — alumni index */}
      <section className="px-5 pb-24 md:px-8">
        <div className="container">
          <div className="panel-strong relative overflow-hidden rounded-[2rem] p-8 md:p-12" data-reveal>
            <div className="grid-bg absolute inset-0 opacity-50" aria-hidden="true" />
            <div className="relative max-w-2xl">
              <p className="annotation annotation-accent">In drafting</p>
              <h2 className="display mt-5 text-4xl uppercase text-white md:text-6xl">
                The member placement index.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-white/56">
                Where MECG members intern and work after the club — built from
                member-submitted profiles. Publishing with the member portal.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
