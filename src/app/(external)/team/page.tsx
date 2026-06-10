import React from "react";
import { teamMembers } from "../../../lib/site-content";

export const metadata = {
  title: "Team — MECG",
  description: "Meet the students leading the Michigan Engineering Consulting Group.",
};

export default function TeamPage() {
  return (
    <main>
      {/* Sheet header */}
      <section className="grid-bg relative overflow-hidden px-5 pb-16 pt-36 md:px-8 md:pb-24 md:pt-44">
        <div className="orb right-[-10rem] top-[-12rem] h-[30rem] w-[30rem] bg-[var(--blue)]" />
        <div className="container relative">
          <p className="annotation annotation-accent" data-reveal>
            Sheet 04 — Our team
          </p>
          <h1 className="display-xl mt-6 max-w-6xl text-white" data-split>
            The people <span className="text-ghost">in the room.</span>
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-white/62" data-reveal>
            MECG is led by students across consulting, education, recruitment,
            finance, marketing, internal operations, and external relations.
          </p>
          <div className="dim-rule mt-12" data-reveal />
        </div>
      </section>

      {/* Roster */}
      <section className="section">
        <div className="container">
          <p className="annotation annotation-accent" data-reveal>
            Fig. 04.1 — Executive board
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-reveal-group>
            {teamMembers.map((member, index) => (
              <article
                key={member.name}
                className="panel card-hover group rounded-[1.35rem] p-5"
                data-reveal
              >
                <div className="relative grid aspect-square place-items-center overflow-hidden rounded-[1rem] bg-gradient-to-br from-[var(--navy-700)] to-[var(--navy-900)]">
                  <span className="font-display text-5xl font-bold uppercase tracking-[-0.04em] text-white/85 transition-transform duration-500 group-hover:scale-110">
                    {member.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")}
                  </span>
                  <span className="annotation absolute bottom-3 left-3 !text-white/35">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background:
                        "radial-gradient(circle at 30% 20%, rgba(245,130,58,0.28), transparent 60%)",
                    }}
                    aria-hidden="true"
                  />
                </div>
                <p className="annotation mt-5">{member.group}</p>
                <h2 className="font-display mt-2 text-xl font-bold uppercase leading-none tracking-[-0.035em] text-white">
                  {member.name}
                </h2>
                <p className="mt-2 text-sm text-white/50">{member.role}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Join strip */}
      <section className="px-5 pb-24 md:px-8">
        <div className="container">
          <div className="sheet flex flex-col items-start justify-between gap-6 rounded-[2rem] p-8 md:flex-row md:items-center md:p-12" data-reveal="wipe">
            <div>
              <p className="annotation !text-[var(--orange-dark)]">Open seat</p>
              <h2 className="font-display mt-4 text-3xl font-bold uppercase tracking-[-0.05em] text-[var(--navy-950)] md:text-5xl">
                Your name belongs on this sheet.
              </h2>
            </div>
            <a
              href="/apply"
              data-magnetic
              className="focus-ring shrink-0 rounded-full bg-[var(--navy-950)] px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[var(--orange)]"
            >
              Apply to MECG
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
