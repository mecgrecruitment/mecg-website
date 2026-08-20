import Image from "next/image";
import type { Metadata } from "next";
import { SectionHeading } from "./components/SectionHeading";

const title = "MECG | Michigan Engineering Consulting Group";
const description =
  "MECG is a student-led consulting organization at the University of Michigan.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: { title, description },
};

const impact = [
  { value: "70+", label: "Members" },
  { value: "30+", label: "Organizations served" },
  { value: "2023", label: "Founded at Michigan" },
  { value: "All", label: "Majors welcome" },
];

const photos = [
  ["/images/community/community-52.jpg", "MECG members together outdoors"],
  ["/images/community/community-40.jpg", "MECG members at a formal gathering"],
  ["/images/community/community-62.jpg", "MECG members during a Chicago consulting trek"],
  ["/images/community/community-70.jpg", "MECG members spending time together outside project work"],
] as const;

export default function Home() {
  return (
    <main>
      <section className="relative flex min-h-[72svh] items-center overflow-hidden border-b border-white/10 px-5 pb-20 pt-36 md:px-8 md:pb-28 md:pt-44">
        <div className="page-hero-glow page-hero-glow--mixed" aria-hidden="true" />
        <div className="container relative z-10">
          <p className="text-sm font-semibold text-[var(--orange-soft)]" data-reveal>
            Michigan Engineering Consulting Group
          </p>
          <h1 className="mt-5 max-w-5xl font-display text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-white md:text-7xl lg:text-8xl" data-split>
            Students solving real business challenges
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-white/65 md:text-xl" data-reveal>
            MECG brings University of Michigan students together to deliver thoughtful, data-driven work for organizations across the country.
          </p>
          <div className="mt-9 flex flex-wrap gap-3" data-reveal>
            <a href="/prospective-members" className="button-primary focus-ring">Join MECG</a>
            <a href="/client-services" className="button-secondary focus-ring">Work with us</a>
          </div>
        </div>
      </section>

      <section id="who-we-are" className="section scroll-mt-24">
        <div className="container grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <SectionHeading title="Who we are" />
          <div className="grid gap-6 text-lg leading-8 text-white/65">
            <p>
              MECG is a student-led consulting organization at the University of Michigan. Founded in 2023, our community has grown to over 70 members from diverse academic and personal backgrounds. Through semester-long consulting engagements, MECG has partnered with more than 30 organizations across the country, including local businesses, innovative startups, and Fortune 500 companies. Our teams work closely with clients to solve complex business challenges and deliver strategic, data-driven recommendations that create lasting impact.
            </p>
            <p>
              Beyond client work, MECG is committed to the professional and personal growth of our members. Through hands-on project experience, mentorship, professional development, and consulting treks, members build the skills and relationships to succeed across industries, all within a supportive and collaborative community.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025] px-5 md:px-8">
        <div className="container grid grid-cols-2 lg:grid-cols-4">
          {impact.map((item) => (
            <div key={item.label} className="border-white/10 px-4 py-8 even:border-l lg:border-l lg:first:border-l-0 md:px-7 md:py-10">
              <p className="text-4xl font-semibold tracking-tight text-white md:text-5xl">{item.value}</p>
              <p className="mt-2 text-sm text-white/50">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="container grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
            <Image src="/images/about/president-welcome.webp" alt="Annie Callam, President of MECG" fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
          </div>
          <div className="lg:px-8">
            <SectionHeading title="President's welcome" />
            <div className="mt-7 grid gap-5 leading-7 text-white/65">
              <p>MECG gives students from every major a place to learn consulting by doing it. Our members work on real client questions while learning how to listen, collaborate, analyze, and communicate across disciplines.</p>
              <p>Project work sits alongside education, mentorship, professional development, and a community that supports members well beyond a single semester.</p>
              <p>You do not need a particular major or prior consulting experience to contribute. Curiosity, kindness, and follow-through matter more.</p>
              <p className="font-semibold text-white">Annie Callam<br /><span className="font-normal text-white/55">President of MECG, 2026</span></p>
            </div>
          </div>
        </div>
      </section>

      <section className="section border-y border-white/10 bg-white/[0.025]">
        <div className="container grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="lg:pr-10">
            <SectionHeading title="Our history" />
            <div className="mt-7 grid gap-5 leading-7 text-white/65">
              <p>Jonathan Fay and Aaryan Singh founded MECG in 2023 to give students across the University of Michigan a place to practice consulting while growing professionally and personally.</p>
              <p>The first member cohort began in Winter 2024. Since then, MECG has grown to more than 70 members and has partnered with more than 30 organizations.</p>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image src="/images/about/founders-history.webp" alt="MECG founders Jonathan Fay and Aaryan Singh" fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {photos.map(([src, alt]) => (
              <div key={src} className="relative aspect-[4/5] overflow-hidden rounded-2xl">
                <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition duration-500 hover:scale-[1.02]" />
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-6 border-t border-white/10 pt-8">
            <p className="max-w-xl text-lg text-white/60">Interested in joining MECG or working with one of our project teams?</p>
            <div className="flex gap-3">
              <a href="/prospective-members" className="button-primary focus-ring">Prospective members</a>
              <a href="/contact" className="button-secondary focus-ring">Contact us</a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
