import type { Metadata } from "next";
import { MARKETING_METADATA } from "@/lib/seo";
import type { CSSProperties } from "react";
import Link from "next/link";
import ApplicationCountdown from "@/components/application-countdown";
import MarketingSection from "@/components/marketing-section";
import PageIntro from "@/components/page-intro";
import Image from "next/image";
import SectionHeading from "@/components/section-heading";
import { EVALUATION_TRAITS, JOIN_FAQS, JOIN_REASONS, PREPARATION_NOTES, RECRUITMENT_STEPS } from "@/lib/join-content";
import {
  applicationCycleStatus,
  fetchPublicRecruitment,
  formatRecruitmentEventTime,
  isBeforeApplicationOpen,
  recruitmentAction,
} from "@/lib/public-recruitment";
import InterestForm from "./interest-form";

// This page reads one public RPC and no session, so it is served from the
// ISR cache instead of rendering cold on every visit. The Supabase client is
// built here rather than via lib/supabase/server so it never touches
// cookies(), which is the only thing that was forcing dynamic rendering.
// One minute, not five: the cached copy states whether applications are open,
// so a longer window leaves the page contradicting /apply after the cycle flips.
export const revalidate = 60;

export const metadata: Metadata = MARKETING_METADATA.join;

const JOIN_PHOTOS = [
  { src: "/mecg/chapter-presentation-2026.jpeg", alt: "MECG members presenting together at a formal chapter event" },
  { src: "/mecg/chicago-community-2026.jpeg", alt: "MECG members exploring downtown Chicago together" },
  { src: "/mecg/formal-group-2026.jpeg", alt: "MECG members together at a formal chapter event" },
  { src: "/mecg/community-formal-group.jpeg", alt: "MECG members dressed for a formal event" },
  { src: "/mecg/community-maize-day.jpeg", alt: "MECG members celebrating in Michigan colors" },
  { src: "/mecg/formal-social-2026.jpeg", alt: "Three MECG members at a formal social event" },
  { src: "/mecg/community-green-day.jpeg", alt: "MECG members together at a community event" },
] as const;

export default async function JoinPage() {
  const recruitment = await fetchPublicRecruitment();
  const unavailable = recruitment.kind === "unavailable";
  const events = recruitment.events ?? [];
  const status = recruitment.cycle ? applicationCycleStatus(recruitment.cycle) : null;
  const showInterestForm = !unavailable && recruitment.cycle !== null && status?.isOpen !== true;
  const action = unavailable ? { href: "/apply", label: "Go to the application" } : !recruitment.cycle ? { href: "mailto:mecg-board@umich.edu", label: "Ask about recruitment" } : recruitmentAction(recruitment.cycle, {
    inactiveHref: "#recruitment-updates",
    inactiveLabel: "Get recruitment updates",
  });
  // Only before the window opens. Keyed off isOpen !== true, this countdown also
  // rendered after closes_at, under an "Applications are closed" heading.
  const upcomingCycle = recruitment.cycle && isBeforeApplicationOpen(recruitment.cycle) ? recruitment.cycle : null;

  return (
    <main id="main-content" className="bg-white text-mecg-navy">
      <PageIntro label="Recruitment" title="Join Our Team" copy="MECG is open to University of Michigan students in every major. No previous consulting experience is required." overlap tone="blue" poster posterMedia={
        <div className="relative aspect-square overflow-hidden rounded-xl shadow-lift"><Image src={JOIN_PHOTOS[4].src} alt={JOIN_PHOTOS[4].alt} fill sizes="280px" className="object-cover object-[60%_50%]" /></div>
      }>
        <Link href={action.href} className="button-primary">{action.label} <span aria-hidden="true">→</span></Link>
        <Link href="#how-we-evaluate" className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-white underline-offset-4 hover:underline">How we evaluate <span aria-hidden="true">↓</span></Link>
      </PageIntro>

      <section className="px-6 sm:px-10" aria-label="Recruitment status">
        <div className="mx-auto -mt-16 max-w-6xl"><div className="flex max-w-3xl flex-col justify-between gap-5 rounded-xl border border-public-rule bg-white p-5 shadow-lift sm:p-7 md:flex-row md:items-center">
          <div>
            <h2 className={unavailable ? "text-xl font-semibold" : "text-2xl font-semibold"}>{unavailable ? "This cycle’s dates" : status?.label ?? "Recruitment dates are not available"}</h2>
            <p className="mt-2 leading-7 text-muted">{unavailable ? "We couldn’t load this cycle’s dates." : status?.detail ?? "Email the Board about the next recruitment cycle, or check back for published dates."}</p>
            {unavailable && <div className="mt-3 flex flex-wrap items-center gap-x-4"><a href="/join" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Reload dates</a><a href="mailto:mecg-board@umich.edu" className="inline-flex min-h-11 flex-wrap items-center gap-x-1.5 font-semibold"><span className="underline underline-offset-4">Email the Board</span> <span className="whitespace-nowrap font-normal text-muted">(mecg-board@umich.edu)</span></a></div>}
            {upcomingCycle?.opensAt ? <ApplicationCountdown opensAt={upcomingCycle.opensAt} /> : null}
          </div>
          {recruitment.cycle?.name ? <p className="shrink-0 text-[15px] font-semibold text-mecg-blue">{recruitment.cycle.name}</p> : null}
        </div></div>
      </section>

      {unavailable ? null : (
      <MarketingSection aria-labelledby="timeline-title">
          <SectionHeading id="timeline-title">Recruitment timeline</SectionHeading>
          <div className="relative mt-8 before:absolute before:bottom-6 before:left-[15px] before:top-6 before:w-px before:bg-mecg-navy/12">
            {events.length === 0 ? (
              <p className="border-y border-line py-6 pl-12 leading-7 text-muted">{recruitment.cycle ? "No event dates are published for this cycle yet. " : "No recruitment cycle is currently published. "}{showInterestForm ? "Join the interest list for date announcements." : "Email mecg-board@umich.edu for recruitment questions."}</p>
            ) : events.map((event, index) => (
              <article
                key={event.id}
                className="recruitment-event relative grid gap-3 border-t border-line py-6 pl-12 last:border-b md:grid-cols-[15rem_1fr_auto] md:items-center"
                style={{ "--event-index": index } as CSSProperties}
              >
                <span className="absolute left-0 top-6 grid size-8 place-items-center rounded-full bg-mecg-navy text-[13px] font-semibold tabular-nums text-white ring-4 ring-white" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-[15px] font-semibold leading-6 text-mecg-blue">{formatRecruitmentEventTime(event.startsAt, event.endsAt)}</p>
                <div>
                  <h3 className="text-lg font-semibold">{event.name}</h3>
                  <p className="mt-1 text-[15px] text-muted">{event.location ?? "Location shared closer to the event"}</p>
                </div>
                <a href={`/api/events/${event.id}/ics`} className="inline-flex min-h-11 items-center font-semibold text-mecg-blue">Add to calendar <span className="ml-2" aria-hidden="true">↓</span></a>
              </article>
            ))}
          </div>
      </MarketingSection>
      )}

      <MarketingSection tone="paper">
          <SectionHeading>Why join MECG?</SectionHeading>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {JOIN_REASONS.map((reason) => (
              <article key={reason.title} className="border-t-2 border-mecg-blue pt-4">
                <h3 className="text-xl font-semibold">{reason.title}</h3>
                <p className="mt-2 leading-7 text-muted">{reason.copy}</p>
              </article>
            ))}
          </div>
      </MarketingSection>

      <MarketingSection id="how-we-evaluate" className="scroll-mt-24" aria-labelledby="evaluation-title">
        <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <div>
            <SectionHeading id="evaluation-title">Show us how you think.</SectionHeading>
            <p className="mt-5 leading-7 text-muted">You do not need a memorized framework or a particular major. We look at your reasoning, your judgment, and how you work with people.</p>
            <Link href="#prepare" className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-mecg-blue">Prepare your application <span aria-hidden="true">↓</span></Link>
          </div>
          <ol className="border-t border-line">
            {RECRUITMENT_STEPS.map((step) => (
              <li key={step.number} className="grid grid-cols-[2rem_1fr] gap-4 border-b border-line py-5">
                <span className="pt-1 text-[15px] font-semibold tabular-nums text-mecg-blue">{step.number}</span>
                <div><h3 className="text-xl font-semibold">{step.title}</h3><p className="mt-1 text-[15px] font-medium text-mecg-blue">{step.eyebrow}</p><p className="mt-3 leading-7 text-muted">{step.copy}</p></div>
              </li>
            ))}
          </ol>
        </div>
        <figure className="relative mt-14">
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl sm:aspect-[21/9]"><Image src={JOIN_PHOTOS[3].src} alt={JOIN_PHOTOS[3].alt} fill sizes="(min-width:1152px) 1152px, 100vw" className="object-cover object-[50%_35%]" /></div>
          <figcaption className="absolute right-3 top-3 rounded-md bg-public-ink/75 px-2.5 py-1 text-[13px] text-white">Dressed up for a chapter formal.</figcaption>
        </figure>
        <div className="public-lit relative mx-3 -mt-24 rounded-xl p-6 shadow-lift sm:mx-8 sm:-mt-32 sm:p-8 lg:max-w-3xl">
          <h3 className="display-face text-[28px]">What we look for</h3>
          <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {EVALUATION_TRAITS.map(([title, copy]) => <div key={title}><dt className="font-semibold">{title}</dt><dd className="mt-1 text-[15px] leading-6 text-white">{copy}</dd></div>)}
          </dl>
        </div>
      </MarketingSection>

      <MarketingSection id="prepare" tone="paper" className="scroll-mt-24" innerClassName="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
        <div><SectionHeading>A little preparation helps.</SectionHeading></div>
        <div>
          <h3 className="text-xl font-semibold">Have your materials ready</h3>
          <p className="mt-3 leading-7 text-muted">Prepare a resume as a PDF, up to 10 MB, and your written responses. The application will ask for a photo when supported. You can save a draft before submitting.</p>
          <ul className="mt-6 list-disc space-y-3 pl-5 text-muted">{PREPARATION_NOTES.map((note) => <li key={note} className="pl-1 leading-7">{note}</li>)}</ul>
        </div>
      </MarketingSection>

      {showInterestForm ? (
        <MarketingSection id="recruitment-updates" className="scroll-mt-24" tone="navy" innerClassName="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <SectionHeading>Get recruitment updates</SectionHeading>
              <p className="mt-4 max-w-md leading-7 text-white/70">We will email you when the Board publishes dates for the active cycle.</p>
            </div>
            <InterestForm />
        </MarketingSection>
      ) : null}

      <MarketingSection aria-labelledby="faq-title" innerClassName="grid gap-8 lg:grid-cols-[0.6fr_1.4fr]">
          <div><SectionHeading id="faq-title">Frequently asked questions</SectionHeading><Link href={action.href} className="button-primary mt-6">{action.label} <span aria-hidden="true">→</span></Link></div>
          <div className="divide-y divide-line border-y border-line">
            {JOIN_FAQS.map(([question, answer]) => (
              <details key={question} className="group py-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 font-semibold"><span>{question}</span><span className="text-xl text-mecg-blue transition-transform duration-[--t-control] ease-[--ease-out] group-open:rotate-45" aria-hidden="true">+</span></summary>
                <p className="disclosure-panel mt-3 max-w-2xl pr-8 leading-7 text-muted">{answer}{question === "How do I prepare?" ? <Link href="#how-we-evaluate" className="ml-2 inline-flex min-h-11 items-center font-semibold text-mecg-blue underline underline-offset-4">See our evaluation criteria</Link> : null}</p>
              </details>
            ))}
          </div>
      </MarketingSection>

    </main>
  );
}
