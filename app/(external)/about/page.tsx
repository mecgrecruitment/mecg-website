import Image from "next/image";
import { clients, pillars } from "@/lib/site-content";
import type { Metadata } from "next";
import { PageHero } from "../components/PageHero";
import { PhotoStrip } from "@/components/site/PhotoStrip";
import { SectionHeading } from "../components/SectionHeading";

const lifeAtMecgPhotos = [
  {
    src: "/images/community/community-64.jpg",
    alt: "MECG members posing together in downtown Chicago during the annual trek",
  },
  {
    src: "/images/community/community-65.jpg",
    alt: "MECG members gathered together at a local pub",
  },
  {
    src: "/images/community/community-66.jpg",
    alt: "MECG members outdoors together near central campus",
  },
  {
    src: "/images/community/community-67.jpg",
    alt: "Three MECG members posing together indoors",
  },
  {
    src: "/images/community/community-68.jpg",
    alt: "Three MECG members dressed up together for a night out",
  },
  {
    src: "/images/community/community-69.jpg",
    alt: "MECG members posing together at a social gathering, one wearing a club sweatshirt",
  },
  {
    src: "/images/community/community-71.jpg",
    alt: "MECG members dressed up together for a semi-formal event",
  },
  {
    src: "/images/community/community-72.jpg",
    alt: "Three MECG members posing together in blazers",
  },
  {
    src: "/images/community/community-74.jpg",
    alt: "A large group of MECG members dressed up together at a formal social event",
  },
  {
    src: "/images/community/community-75.jpg",
    alt: "MECG members embracing at a social gathering, one wearing a club hoodie with the gear logo",
  },
  {
    src: "/images/community/community-77.jpg",
    alt: "MECG members celebrating St. Patrick's Day together outdoors",
  },
  {
    src: "/images/community/community-78.jpg",
    alt: "MECG members in costume together at a Halloween party",
  },
];

const title = "About";
const description =
  "The four pillars behind MECG — professional development, education, project experience, and community — plus a welcome from our president and the story of how MECG was founded at Michigan in 2023.";

const principles = [
  {
    index: "01",
    title: "Open by design",
    body: "Consulting should not be limited by major, prior experience, or familiarity with business language.",
  },
  {
    index: "02",
    title: "Learn by doing",
    body: "Education becomes more useful when members can apply it to a real question with a real client.",
  },
  {
    index: "03",
    title: "Grow together",
    body: "Strong work comes from people who challenge, support, and genuinely know one another.",
  },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/about" },
  openGraph: { title, description },
};

function TextPanel({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-[#122033]/70 p-7 shadow-[0_22px_70px_rgba(4,12,24,0.24)] md:p-10">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--orange-soft)]">
        {label}
      </p>
      <h2 className="font-display mt-5 text-5xl font-black uppercase leading-[0.86] tracking-[-0.08em] text-white md:text-6xl">
        {title}
      </h2>
      <div className="mt-7 grid gap-4 text-sm leading-7 text-white/62 md:text-base">
        {children}
      </div>
    </article>
  );
}

function ImagePanel({ src, alt }: { src: string; alt: string }) {
  return (
    <article className="relative min-h-[360px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#122033]/70 shadow-[0_22px_70px_rgba(4,12,24,0.24)] md:min-h-[520px]">
      <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
    </article>
  );
}

export default function AboutPage() {
  return (
    <main className="grid gap-16 pb-16">
      <PageHero
        eyebrow="Sheet 02 — About MECG"
        title={<>An engineering mindset.<br />{" "}<span className="text-ghost">A human organization.</span></>}
        description="MECG was created to make consulting education, meaningful project work, and a close interdisciplinary community accessible to students across Michigan."
        tone="blue"
      />

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-6 md:px-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <p className="annotation annotation-accent">Fig. 01 — Why MECG exists</p>
          <h2 className="display mt-5 max-w-5xl text-5xl uppercase text-white md:text-7xl">
            More ways in.<br />More range at the table.
          </h2>
        </div>
        <p className="max-w-xl text-lg leading-8 text-white/58">
          MECG gives students across Michigan a practical entry point into consulting:
          learn the craft, contribute to client work, and grow alongside an
          interdisciplinary team.
        </p>
      </section>

      <section className="mx-auto grid w-[calc(100%-3rem)] max-w-7xl gap-px overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/10 md:w-[calc(100%-8rem)] md:grid-cols-3">
        {principles.map((principle) => (
          <article key={principle.index} className="bg-[var(--navy-900)] p-7 md:min-h-64 md:p-9">
            <p className="font-mono text-sm font-bold text-[var(--orange)]">{principle.index}</p>
            <h3 className="font-display mt-10 text-3xl font-bold uppercase tracking-[-0.05em] text-white">
              {principle.title}
            </h3>
            <p className="mt-5 leading-7 text-white/56">{principle.body}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 md:px-16">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--orange-soft)]">
          Fig. 02 — Four Pillars
        </p>
        <h2 className="font-display mt-5 max-w-5xl text-6xl font-black uppercase leading-[0.86] tracking-[-0.08em] text-white md:text-8xl">
         WHAT SHAPES
          <br />
          MECG.
        </h2>

        <div className="mt-10 grid overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#122033]/60 md:grid-cols-4">
          {pillars.map((pillar, index) => (
            <article key={pillar.title} className="border-white/10 p-6 md:border-r md:last:border-r-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--orange-soft)]">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-5 text-2xl font-black uppercase leading-[0.9] tracking-[-0.07em] text-white">
                {pillar.title}
              </h3>
              <p className="mt-5 text-sm leading-7 text-white/56">
                {pillar.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 md:px-16">
        <div className="grid gap-8 rounded-[1.5rem] border border-white/10 bg-[#122033]/60 p-8 sm:grid-cols-2 md:p-10">
          <div data-reveal>
            <p className="stat text-5xl font-black text-white md:text-6xl" data-counter>
              {clients.length}+
            </p>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-[var(--orange-soft)]">
              Client projects delivered
            </p>
          </div>
          <div data-reveal>
            <p className="stat text-5xl font-black text-white md:text-6xl">2023</p>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-[var(--orange-soft)]">
              Founded
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-6 md:px-16 lg:grid-cols-[0.95fr_1.05fr]">
        <ImagePanel src="/images/about/president-welcome.png" alt="Annie Callam, President of MECG" />
        <TextPanel label="President's Welcome" title="President's Welcome">
          <p>Welcome to the Michigan Engineering Consulting Group. MECG brings together students who are curious about difficult problems, eager to learn, and generous with one another.</p>
          <p>Members build practical skills through education, mentorship, and client engagements spanning strategy, operations, analytics, product development, and marketing. Just as importantly, they learn how to listen, collaborate, and communicate across disciplines.</p>
          <p>That range of perspectives is central to who we are. Students do not need a particular major or a pre-existing consulting vocabulary to contribute; they need curiosity, follow-through, and a willingness to grow with the team.</p>
          <p>Whether you are considering membership or looking for a thoughtful student team to support your organization, I hope this site gives you a clear sense of how MECG works. We would be glad to hear from you.</p>
          <p className="pt-2 text-white/78">Best,<br />Annie Callam<br />President of MECG, 2026</p>
        </TextPanel>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-6 md:px-16 lg:grid-cols-[1.05fr_0.95fr]">
        <TextPanel label="Our History" title="Our History">
          <p>Michigan Engineering Consulting Group was founded in 2023 by Jonathan Fay, a Mechanical Engineering student, and Aaryan Singh, an Industrial and Operations Engineering student. Their goal was to create a place where students could explore consulting while growing professionally, personally, and socially.</p>
          <p>MECG welcomed its first member cohort in Winter 2024. From the beginning, the organization was designed for students across majors and experience levels—not only those who already knew the language of business.</p>
          <p>As MECG grew, members began working on technical and business-focused client questions, learning through workshops and mentorship, visiting firms, and building cross-disciplinary teams.</p>
          <p>That founding idea still guides the organization today: combine analytical range with human connection, and give students room to build a path that feels like their own.</p>
        </TextPanel>
        <ImagePanel src="/images/about/founders-history.png" alt="MECG Founders Jonathan Fay and Aaryan Singh" />
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 md:px-16">
        <SectionHeading
          eyebrow="Fig. 03 — Life at MECG"
          title="On the record, and off it."
          description="Treks, retreats, formals, and everything between—the parts of MECG that don't show up in a client deliverable."
        />
        <div className="mt-10">
          <PhotoStrip photos={lifeAtMecgPhotos} />
        </div>
      </section>
    </main>
  );
}
