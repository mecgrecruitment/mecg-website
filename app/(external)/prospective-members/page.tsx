import React from "react";
import Image from "next/image";
import type { Metadata } from "next";
import { faqs, recruitmentCycle } from "@/lib/site-content";
import { PageHero } from "../components/PageHero";

const title = "Prospective Members";
const description =
  "MECG recruitment for UMich students of every major. Timeline, event dates, FAQs, and how to apply through the applicant portal.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/prospective-members" },
  openGraph: { title, description },
};

const memberSignals = [
  {
    index: "01",
    title: "Any major",
    body: "Technical, creative, and analytical backgrounds all show up on project teams.",
  },
  {
    index: "02",
    title: "No consulting prerequisite",
    body: "Recruitment looks for curiosity, collaboration, and follow-through.",
  },
  {
    index: "03",
    title: "Learn through practice",
    body: "Education, mentorship, and semester client engagements.",
  },
  {
    index: "04",
    title: "Community calendar",
    body: "Coffee chats, socials, and shared campus time sit next to project work.",
  },
];

export default function ProspectiveMembersPage() {
  return (
    <main>
      <PageHero
        title="Prospective Members"
        description="Explore consulting, work with real clients, and join a community of students from across Michigan. Recruitment details will be posted once confirmed."
        tone="orange"
      >
        <a href="/apply" data-magnetic className="button-primary focus-ring">
          Login / Apply
        </a>
      </PageHero>

      <section className="section">
        <div className="container">
          <h2 className="font-display max-w-5xl text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
            Why join MECG
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-4">
            {memberSignals.map((item) => (
              <article key={item.index} className="bg-[var(--navy-900)] p-7 lg:min-h-72">
                <p className="font-mono text-sm font-bold text-[var(--orange)]">{item.index}</p>
                <h3 className="font-display mt-10 text-2xl font-semibold tracking-[-0.03em] text-white">
                  {item.title}
                </h3>
                <p className="mt-5 text-sm leading-7 text-white/56">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="font-display max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
            Where our alumni work
          </h2>
          <p className="mt-6 max-w-2xl text-white/58">
            Logos shown with member permission. This is not a placement rate or ranking.
            A consent-backed placement page is still in progress.
          </p>
          <div className="mt-10 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white p-6 md:p-10">
            <Image
              src="/images/placement/alumni-employers.jpg"
              alt="Collage of employer logos shared by MECG alumni with permission"
              width={1800}
              height={1013}
              sizes="(min-width: 1024px) 1400px, 100vw"
              className="h-auto w-full"
              style={{ width: "100%", height: "auto" }}
            />
          </div>
        </div>
      </section>

      <section className="sheet px-5 py-20 md:px-8 md:py-28">
        <div className="container">
          <div className="mb-16 grid gap-6 rounded-[1.5rem] border border-[var(--paper-rule)] p-6 md:grid-cols-[0.35fr_1fr] md:p-8">
            <div>
              <p className="annotation !text-[var(--orange-dark)]">Current status</p>
              <p className="mt-3 text-sm font-semibold text-[var(--navy-950)]">
                {recruitmentCycle.status}
              </p>
            </div>
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-[-0.04em] text-[var(--navy-950)]">
                {recruitmentCycle.title}
              </h2>
              <p className="mt-4 max-w-3xl leading-relaxed text-[var(--on-paper-muted)]">
                {recruitmentCycle.body}
              </p>
            </div>
          </div>
          <h2 className="font-display max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-[var(--navy-950)] md:text-6xl" data-split>
            Recruitment timeline coming soon
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--on-paper-muted)]">
            We will publish confirmed event dates, times, locations, and application deadlines here.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="font-display max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
            Frequently asked questions
          </h2>
          <div className="mt-10 grid gap-4" data-reveal-group>
            {faqs.map((faq) => (
              <details key={faq.question} className="group panel card-hover rounded-[1.35rem]" data-reveal>
                <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-6 p-6">
                  <h3 className="font-display text-xl font-semibold tracking-[-0.02em] text-white md:text-2xl">
                    {faq.question}
                  </h3>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 font-mono text-lg font-bold text-[var(--orange)] transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="border-t border-white/10 px-6 pb-6 pt-5 leading-relaxed text-white/56">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
