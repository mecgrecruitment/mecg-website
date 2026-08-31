import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MarketingSection from "@/components/marketing-section";
import PageIntro from "@/components/page-intro";
import PhotoCarousel from "@/components/photo-carousel";
import SectionHeading from "@/components/section-heading";
import { requireEnv } from "@/lib/env";
import { JOIN_FAQS, JOIN_REASONS } from "@/lib/join-content";
import type { Database } from "@/lib/supabase/database.types";
import InterestForm from "./interest-form";

// This page reads one public RPC and no session, so it is served from the
// ISR cache instead of rendering cold on every visit. The Supabase client is
// built here rather than via lib/supabase/server so it never touches
// cookies(), which is the only thing that was forcing dynamic rendering.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Join Our Team",
  description: "See the MECG recruitment timeline and learn why students join the team.",
  alternates: { canonical: "/join" },
};

type Recruitment = {
  cycle?: { name?: string; status?: string; opensAt?: string | null; closesAt?: string | null } | null;
  events?: { id: string; name: string; kind: string; startsAt: string; endsAt?: string | null; location?: string | null; visibility: string }[];
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Detroit",
  timeZoneName: "short",
});

const TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Detroit",
  timeZoneName: "short",
});

const JOIN_PHOTOS = [
  { src: "/mecg/members-board-professional.jpeg", alt: "MECG executive board in a professional group portrait" },
  { src: "/mecg/members-chicago-professional.jpeg", alt: "MECG members on a professional visit to Chicago" },
  { src: "/mecg/members-professional.jpeg", alt: "MECG members visiting PwC in Chicago" },
  { src: "/mecg/community-formal-group.jpeg", alt: "MECG members dressed for a formal event" },
  { src: "/mecg/community-maize-day.jpeg", alt: "MECG members celebrating in Michigan colors" },
  { src: "/mecg/community-formal-pair.jpeg", alt: "Two MECG members dressed for a formal event" },
  { src: "/mecg/community-green-day.jpeg", alt: "MECG members together at a community event" },
] as const;

function formatDate(value: string) {
  return DATE_FORMAT.format(new Date(value));
}

function formatEventTime(startsAt: string, endsAt?: string | null) {
  const start = formatDate(startsAt);
  return endsAt ? `${start} to ${TIME_FORMAT.format(new Date(endsAt))}` : start;
}

function cycleStatus(cycle: NonNullable<Recruitment["cycle"]>, now = Date.now()) {
  const opensAt = cycle.opensAt ? new Date(cycle.opensAt).getTime() : null;
  const closesAt = cycle.closesAt ? new Date(cycle.closesAt).getTime() : null;
  const isWithinApplicationWindow = cycle.status === "OPEN"
    && (opensAt === null || opensAt <= now)
    && (closesAt === null || closesAt >= now);

  if (isWithinApplicationWindow) return { label: "Applications are open", detail: cycle.closesAt ? `Apply by ${formatDate(cycle.closesAt)}.` : "Apply now.", isOpen: true };
  if (cycle.status === "OPEN" && closesAt !== null && closesAt < now) {
    return { label: "Applications are closed", detail: `Applications closed ${formatDate(cycle.closesAt!)}.`, isOpen: false };
  }
  if (cycle.status === "IN_PROCESS") {
    return { label: "Selection is in progress", detail: "Current applicants can find invitations and updates on their status page.", isOpen: false };
  }
  return {
    label: "Applications open soon",
    detail: cycle.opensAt
      ? `Applications open ${formatDate(cycle.opensAt)}${cycle.closesAt ? ` and close ${formatDate(cycle.closesAt)}` : ""}.`
      : "Join the interest list for published dates.",
    isOpen: false,
  };
}

export default async function JoinPage() {
  const supabase = createClient<Database, "rush">(
    process.env.NEXT_PUBLIC_MECG_SUPABASE_URL ?? requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    process.env.NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY ?? requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: "rush" } },
  );
  const { data } = await supabase.rpc("public_recruitment");
  const recruitment = data && typeof data === "object" ? data as Recruitment : { cycle: null, events: [] };
  const events = recruitment.events ?? [];
  const status = recruitment.cycle ? cycleStatus(recruitment.cycle) : null;
  const showInterestForm = status?.isOpen !== true;

  return (
    <main className="bg-white text-mecg-navy">
      <PageIntro title="Join Our Team" copy="MECG is open to University of Michigan students in every major. No previous consulting experience is required.">
        <Link href="/apply" className="button-primary">Apply now <span aria-hidden="true">→</span></Link>
      </PageIntro>

      <MarketingSection spacing="compact">
        <div className="flex flex-col justify-between gap-5 rounded-2xl bg-mecg-blue/[0.08] p-5 sm:p-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold">{status?.label ?? "No active recruitment cycle"}</h2>
            <p className="mt-2 leading-7 text-mecg-navy/65">{status?.detail ?? "Join the interest list and we will send the next published dates."}</p>
          </div>
          {recruitment.cycle?.name ? <p className="shrink-0 text-sm font-semibold text-mecg-blue">{recruitment.cycle.name}</p> : null}
        </div>
      </MarketingSection>

      <MarketingSection aria-labelledby="timeline-title">
          <SectionHeading id="timeline-title">Recruitment timeline</SectionHeading>
          <div className="mt-8 divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
            {events.length === 0 ? (
              <p className="py-6 leading-7 text-mecg-navy/65">The Board has not published events for this cycle yet. Join the interest list for date announcements.</p>
            ) : events.map((event) => (
              <article key={event.id} className="grid gap-3 py-5 md:grid-cols-[15rem_1fr_auto] md:items-center">
                <p className="text-sm font-semibold leading-6 text-mecg-blue">{formatEventTime(event.startsAt, event.endsAt)}</p>
                <div>
                  <h3 className="text-lg font-semibold">{event.name}</h3>
                  <p className="mt-1 text-sm text-mecg-navy/60">{event.location ?? "Location shared closer to the event"}</p>
                </div>
                <a href={`/api/events/${event.id}/ics`} className="inline-flex min-h-11 items-center font-semibold text-mecg-blue">Add to calendar <span className="ml-2" aria-hidden="true">↓</span></a>
              </article>
            ))}
          </div>
      </MarketingSection>

      <MarketingSection tone="paper">
          <SectionHeading>Why join MECG?</SectionHeading>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {JOIN_REASONS.map((reason) => (
              <article key={reason.title} className="rounded-2xl bg-white p-5 sm:p-6">
                <h3 className="text-xl font-semibold">{reason.title}</h3>
                <p className="mt-3 leading-7 text-mecg-navy/65">{reason.copy}</p>
              </article>
            ))}
          </div>
          <div className="mt-10"><PhotoCarousel images={JOIN_PHOTOS} label="MECG member photos" /></div>
      </MarketingSection>

      {showInterestForm ? (
        <MarketingSection tone="navy" innerClassName="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <SectionHeading>Get recruitment updates</SectionHeading>
              <p className="mt-4 max-w-md leading-7 text-white/70">We will email you when the Board publishes dates for the active cycle.</p>
            </div>
            <InterestForm />
        </MarketingSection>
      ) : null}

      <MarketingSection aria-labelledby="faq-title" innerClassName="grid gap-8 lg:grid-cols-[0.6fr_1.4fr]">
          <SectionHeading id="faq-title">Frequently asked questions</SectionHeading>
          <div className="divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
            {JOIN_FAQS.map(([question, answer]) => (
              <details key={question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-semibold"><span>{question}</span><span className="text-mecg-orange-ink group-open:rotate-45" aria-hidden="true">+</span></summary>
                <p className="mt-3 max-w-2xl pr-8 leading-7 text-mecg-navy/65">{answer}</p>
              </details>
            ))}
          </div>
      </MarketingSection>

      <MarketingSection tone="blue" spacing="compact" innerClassName="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <SectionHeading>Ready to apply?</SectionHeading>
          <Link href="/apply" className="button-light">Apply now <span aria-hidden="true">→</span></Link>
      </MarketingSection>
    </main>
  );
}
