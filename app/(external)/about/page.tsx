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
  "MECG is a pro-bono, student-led consulting group founded at UMich in 2023. Four pillars: professional development, education, project experience, and community.";

const principles = [
  {
    index: "01",
    title: "Open by design",
    body: "Any major. Prior consulting experience is not required.",
  },
  {
    index: "02",
    title: "Learn by doing",
    body: "Education sticks when it meets a real client question.",
  },
  {
    index: "03",
    title: "Grow together",
    body: "Teams challenge and support each other on and off projects.",
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
        title={
          <>
            About MECG.
            <br />{" "}
            <span className="text-ghost">Student-led at Michigan.</span>
          </>
        }
        description="Founded in 2023 at the University of Michigan. Pro-bono consulting, open to every major."
        tone="blue"
      />

      <section className="px-5 md:px-8">
        <div className="container grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="annotation annotation-accent">Fig. 01 — Why MECG exists</p>
            <h2 className="display mt-5 max-w-5xl text-5xl uppercase text-white md:text-7xl">
              Consulting practice
              <br />
              without a major gate.
            </h2>
          </div>
          <p className="max-w-xl text-lg leading-8 text-white/58">
            Learn the craft, staff client projects, and work with students from
            across campus.
          </p>
        </div>
      </section>

      <section className="px-5 md:px-8">
        <div className="container grid gap-px overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/10 md:grid-cols-3">
          {principles.map((principle) => (
            <article key={principle.index} className="bg-[var(--navy-900)] p-7 md:min-h-64 md:p-9">
              <p className="font-mono text-sm font-bold text-[var(--orange)]">{principle.index}</p>
              <h3 className="font-display mt-10 text-3xl font-bold uppercase tracking-[-0.05em] text-white">
                {principle.title}
              </h3>
              <p className="mt-5 leading-7 text-white/56">{principle.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-5 md:px-8">
        <div className="container">
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
        </div>
      </section>

      <section className="px-5 md:px-8">
        <div className="container">
          <div className="grid gap-8 rounded-[1.5rem] border border-white/10 bg-[#122033]/60 p-8 sm:grid-cols-2 md:p-10">
            <div data-reveal>
              <p className="stat text-5xl font-black text-white md:text-6xl" data-counter>
                {clients.length}+
              </p>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-[var(--orange-soft)]">
                Client projects listed
              </p>
            </div>
            <div data-reveal>
              <p className="stat text-5xl font-black text-white md:text-6xl">2023</p>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-[var(--orange-soft)]">
                Founded
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 md:px-8">
        <div className="container grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <ImagePanel src="/images/about/president-welcome.webp" alt="Annie Callam, President of MECG" />
          <TextPanel label="President's Welcome" title="President's Welcome">
            <p>
              Michigan Engineering Consulting Group is a student-led, pro-bono
              consulting organization at UMich. Members work client problems and
              learn how to listen, collaborate, and communicate across majors.
            </p>
            <p>
              Project work covers strategy, operations, analytics, product, and
              marketing. Education and mentorship sit alongside those engagements.
            </p>
            <p>
              You do not need a particular major or consulting vocabulary to
              contribute. Curiosity and follow-through matter more.
            </p>
            <p>
              For membership or a client engagement, use Contact. The board reads
              every message.
            </p>
            <p className="pt-2 text-white/78">
              Annie Callam
              <br />
              President of MECG, 2026
            </p>
          </TextPanel>
        </div>
      </section>

      <section className="px-5 md:px-8">
        <div className="container grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <TextPanel label="Our History" title="Our History">
            <p>
              Jonathan Fay (Mechanical Engineering) and Aaryan Singh (Industrial
              and Operations Engineering) founded MECG in 2023 so students could
              practice consulting while growing professionally and socially.
            </p>
            <p>
              The first member cohort started in Winter 2024. The org was built
              for students across majors and experience levels, not only people
              who already spoke business language.
            </p>
            <p>
              Since then, members have staffed client projects, run workshops,
              visited firms, and built cross-disciplinary teams.
            </p>
          </TextPanel>
          <ImagePanel src="/images/about/founders-history.webp" alt="MECG Founders Jonathan Fay and Aaryan Singh" />
        </div>
      </section>

      <section className="px-5 md:px-8">
        <div className="container">
          <SectionHeading
            eyebrow="Fig. 03 — Life at MECG"
            title="Photos from the roster."
            description="Treks, retreats, formals, and socials. The parts that sit next to client deliverables."
          />
          <div className="mt-10">
            <PhotoStrip photos={lifeAtMecgPhotos} />
          </div>
        </div>
      </section>
    </main>
  );
}
