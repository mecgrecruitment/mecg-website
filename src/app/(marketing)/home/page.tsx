import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import MarketingSection from "@/components/marketing-section";
import PhotoCarousel from "@/components/photo-carousel";
import SectionHeading from "@/components/section-heading";
import { PILLARS } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Michigan Engineering Consulting Group",
  description: "MECG is a pro-bono consulting group open to all majors at the University of Michigan.",
  alternates: { canonical: "/home" },
};

const HOME_PHOTOS = [
  { src: "/mecg/members-formal.jpg", alt: "MECG members together at a formal event" },
  { src: "/mecg/members-outdoors.jpg", alt: "MECG members together outdoors" },
  { src: "/mecg/members-in-chicago.jpg", alt: "MECG members during a visit to Chicago" },
  { src: "/mecg/members-together.jpg", alt: "MECG members spending time together" },
] as const;

export default function HomePage() {
  return (
    <main className="bg-white text-mecg-navy">
      <section className="relative min-h-[56svh] overflow-hidden bg-mecg-navy text-white">
        <Image
          src="/mecg/members-professional.png"
          alt="MECG members visiting PwC in Chicago"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-linear-to-r from-mecg-navy via-mecg-navy/75 to-mecg-navy/15" />
        <div className="relative mx-auto flex min-h-[56svh] max-w-6xl items-end px-6 py-10 sm:px-10 sm:py-12">
          <div className="max-w-4xl">
            <h1 className="text-balance text-4xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
              Michigan Engineering Consulting Group
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-white/85 sm:text-lg">
              Pro-bono consulting group open to all majors at UMich. Each member is united by a shared interest in problem-solving and impact-driven work.
            </p>
          </div>
        </div>
      </section>

      <MarketingSection innerClassName="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <SectionHeading>Welcome to MECG</SectionHeading>
          <p className="text-pretty leading-7 text-mecg-navy/70">
            MECG is a student-led consulting organization at the University of Michigan. Founded in 2023, our community has grown to over 70 members from diverse academic and personal backgrounds. Through semester-long consulting engagements, MECG has partnered with more than 30 organizations across the country, from local businesses and innovative startups to Fortune 500 companies. Our teams work closely with clients to solve complex business challenges and deliver strategic, data-driven recommendations that create lasting impact.
          </p>
      </MarketingSection>

      <MarketingSection tone="paper" innerClassName="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <SectionHeading>President&apos;s welcome</SectionHeading>
            <div className="mt-5 space-y-4 text-pretty leading-7 text-mecg-navy/70">
              <p>MECG gives students a place to work on real client questions while learning how to listen, analyze, and communicate across disciplines.</p>
              <p>Project work sits beside education, mentorship, and professional development. You do not need a particular major or prior consulting experience to contribute. Curiosity and follow-through matter more.</p>
            </div>
            <p className="mt-7 font-semibold">Annie Callam</p>
            <p className="mt-1 text-sm text-mecg-navy/60">President of MECG, 2026</p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-mecg-blue/[0.08]">
            <Image src="/about/president-2026.jpg" alt="Annie Callam, President of MECG" fill className="object-cover object-center" sizes="(min-width: 1024px) 36rem, 100vw" />
          </div>
      </MarketingSection>

      <MarketingSection id="our-history" className="scroll-mt-24" innerClassName="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <SectionHeading>Our history</SectionHeading>
          <div className="grid gap-7 sm:grid-cols-[0.9fr_1.1fr] sm:items-start">
            <figure>
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-mecg-blue/[0.08]">
                <Image src="/about/founders.jpg" alt="MECG founders Aaryan Singh and Jonny Fay at Michigan's 2024 national championship" fill className="object-cover object-center" sizes="(min-width: 1024px) 24rem, (min-width: 640px) 42vw, 100vw" />
              </div>
              <figcaption className="mt-3 text-sm leading-6 text-mecg-navy/55">Founders Aaryan Singh and Jonny Fay</figcaption>
            </figure>
            <div className="space-y-4 text-pretty leading-7 text-mecg-navy/70">
              <p>Jonny Fay and Aaryan Singh founded MECG in 2023 to give students across the University of Michigan a place to practice consulting while growing professionally and personally.</p>
              <p>The first member cohort began in Winter 2024. Since then, MECG has grown to more than 70 members and partnered with more than 30 organizations.</p>
              <Link href="/team" className="inline-flex min-h-11 items-center font-semibold text-mecg-blue">Meet the current board <span className="ml-2" aria-hidden="true">→</span></Link>
            </div>
          </div>
      </MarketingSection>

      <MarketingSection tone="softBlue">
          <SectionHeading>Our pillars</SectionHeading>
          <div className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-mecg-navy/10 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((pillar) => (
              <article key={pillar.title} className="bg-white p-5 sm:p-6">
                <h3 className="text-xl font-semibold">{pillar.title}</h3>
                <p className="mt-4 text-sm leading-6 text-mecg-navy/65">{pillar.body}</p>
              </article>
            ))}
          </div>
      </MarketingSection>

      <MarketingSection>
          <PhotoCarousel images={HOME_PHOTOS} label="MECG community photos" />
      </MarketingSection>
    </main>
  );
}
