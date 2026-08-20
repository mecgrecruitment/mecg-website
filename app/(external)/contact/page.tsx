import React from "react";
import type { Metadata } from "next";
import { contact } from "@/lib/site-content";
import { ContactForm } from "../components/ContactForm";
import { PageHero } from "../components/PageHero";

const title = "Contact";
const description =
  "Contact MECG at mecg-board@umich.edu for recruitment, client projects, or partnerships. One path: the form or that board email.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contact" },
  openGraph: { title, description },
};

const contactTopics = [
  ["Students", "Recruitment, eligibility, events, and the application process."],
  ["Clients", "Project timing, scope, and engagement fit."],
  ["Partnerships", "Firm visits, workshops, and sponsorships."],
];

export default function ContactPage() {
  return (
    <main>
      <PageHero
        eyebrow="Sheet 07 — Contact"
        title={
          <>
            Contact.
            <br /> <span className="text-ghost">Board email.</span>
          </>
        }
        description="Recruitment, client work, or partnerships. Use the form or email the board. Same inbox."
        tone="blue"
        compact
      />

      <section className="px-5 pb-24 pt-12 md:px-8 md:pt-16">
        <div className="container grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <ContactForm />

          <aside className="grid content-start gap-5">
            <div className="panel rounded-[2rem] p-7 md:p-9" data-reveal>
              <p className="annotation annotation-accent">What to include</p>
              <div className="mt-6 grid gap-5">
                {contactTopics.map(([topicTitle, body], index) => (
                  <div key={topicTitle} className="grid grid-cols-[2rem_1fr] gap-3 border-t border-white/10 pt-5">
                    <span className="font-mono text-xs font-bold text-[var(--orange)]">0{index + 1}</span>
                    <div>
                      <h2 className="font-display text-xl font-bold uppercase tracking-[-0.03em] text-white">{topicTitle}</h2>
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
          </aside>
        </div>
      </section>
    </main>
  );
}
