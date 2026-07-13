import React from "react";
import type { Metadata } from "next";
import { contact } from "@/lib/site-content";
import { ContactForm } from "../components/ContactForm";

const title = "Contact";
const description =
  "Open a channel with MECG. Reach the board about recruitment, client projects, partnerships, or general questions — we read everything.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contact" },
  openGraph: { title, description },
};

export default function ContactPage() {
  return (
    <main>
      <section className="grid-bg relative overflow-hidden px-5 pb-16 pt-36 md:px-8 md:pb-24 md:pt-44">
        <div className="orb right-[-12rem] top-[-10rem] h-[28rem] w-[28rem] bg-[var(--blue)]" />
        <div className="container relative">
          <p className="annotation annotation-accent" data-reveal>
            Sheet 07 — Contact Us
          </p>
          <h1 className="display-xl mt-6 max-w-6xl text-white" data-split>
            Open a <span className="text-ghost">channel.</span>
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-white/62" data-reveal>
            Recruitment, client projects, partnerships, or general questions — the board reads everything.
          </p>
          <div className="dim-rule mt-12" data-reveal />
        </div>
      </section>

      <section className="px-5 pb-24 md:px-8">
        <div className="container grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <ContactForm />

          <aside className="grid content-start gap-5">
            <div className="sheet rounded-[2rem] p-7 md:p-9" data-reveal="wipe">
              <p className="annotation !text-[var(--orange-dark)]">Direct line</p>
              <a
                href={`mailto:${contact.email}`}
                className="focus-ring mt-6 block break-all font-display text-2xl font-bold tracking-[-0.03em] text-[var(--navy-950)] hover:text-[var(--orange-dark)] md:text-3xl"
              >
                {contact.email}
              </a>
              <p className="mt-6 leading-relaxed text-[var(--on-paper-muted)]">{contact.location}</p>
            </div>

            <div className="panel rounded-[2rem] p-7 md:p-9" data-reveal>
              <p className="annotation annotation-accent">Elsewhere</p>
              <div className="mt-6 grid gap-3">
                <a href={contact.instagram} target="_blank" rel="noreferrer" className="focus-ring group flex items-center justify-between border-b border-white/10 py-3">
                  <span className="font-display text-xl font-bold uppercase tracking-[-0.03em] text-white group-hover:text-[var(--orange)]">
                    Instagram
                  </span>
                  <span className="annotation">@mecgmichigan ↗</span>
                </a>
                <a href={contact.linkedin} target="_blank" rel="noreferrer" className="focus-ring group flex items-center justify-between py-3">
                  <span className="font-display text-xl font-bold uppercase tracking-[-0.03em] text-white group-hover:text-[var(--orange)]">
                    LinkedIn
                  </span>
                  <span className="annotation">MECG ↗</span>
                </a>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
