import React from "react";
import type { Metadata } from "next";
import { contact } from "@/lib/site-content";
import { ContactForm } from "../components/ContactForm";
import { PageHero } from "../components/PageHero";

const title = "Contact";
const description =
  "Open a channel with MECG. Reach the board about recruitment, client projects, partnerships, or general questions — we read everything.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contact" },
  openGraph: { title, description },
};

const contactTopics = [
  ["Student questions", "Recruitment, eligibility, events, and the application process."],
  ["Client inquiries", "Potential project questions, timing, scope, and engagement fit."],
  ["Partnerships", "Firm visits, workshops, sponsorships, and community opportunities."],
];

export default function ContactPage() {
  return (
    <main>
      <PageHero
        eyebrow="Sheet 07 — Contact Us"
        title={<>Start with a question.<br /> <span className="text-ghost">We’ll find the path.</span></>}
        description="Recruitment, client projects, partnerships, or general questions—the MECG board reads every message and routes it to the right person."
        tone="blue"
        compact
      />

      <section className="px-5 pb-24 pt-12 md:px-8 md:pt-16">
        <div className="container grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <ContactForm />

          <aside className="grid content-start gap-5">
            <div className="panel rounded-[2rem] p-7 md:p-9" data-reveal>
              <p className="annotation annotation-accent">Choose the closest topic</p>
              <div className="mt-6 grid gap-5">
                {contactTopics.map(([title, body], index) => (
                  <div key={title} className="grid grid-cols-[2rem_1fr] gap-3 border-t border-white/10 pt-5">
                    <span className="font-mono text-xs font-bold text-[var(--orange)]">0{index + 1}</span>
                    <div>
                      <h2 className="font-display text-xl font-bold uppercase tracking-[-0.03em] text-white">{title}</h2>
                      <p className="mt-2 text-sm leading-6 text-white/52">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
