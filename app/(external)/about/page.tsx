import Image from "next/image";
import type { ReactNode } from "react";

const pillars = [
  {
    title: "Professional Development",
    body: "MECG is dedicated to professional growth through resources, workshops, office visits, and networking, aiming to prepare members for consulting roles and long-term career success.",
  },
  {
    title: "Education",
    body: "MECG's educational initiatives equip members with technical and analytical skills through hands-on learning, client projects, software tools, and case workshops, bridging the gap between engineering expertise and business acumen.",
  },
  {
    title: "Project Experience",
    body: "MECG takes pride in delivering impactful solutions for clients, working on diverse projects like optimizing schedules, market research, and business strategies, providing real-world consulting experience, and fostering collaboration.",
  },
  {
    title: "Community",
    body: "MECG values community and collaboration, achieved through social events and mentorship programs, fostering a supportive environment, and creating an inclusive space for people of all majors to explore consulting and build relationships.",
  },
];

function ImagePanel({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative min-h-[300px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#122033]/70 shadow-[0_22px_70px_rgba(4,12,24,0.24)] md:min-h-[420px]">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 42vw, 100vw"
        className="object-cover"
        priority={src.includes("president")}
      />
    </div>
  );
}

function TextPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-[#122033]/70 p-6 shadow-[0_22px_70px_rgba(4,12,24,0.24)] md:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--orange-soft)]">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white md:text-5xl">
        {title}
      </h2>
      <div className="mt-5 grid gap-3 text-sm leading-7 text-white/62 md:text-[0.95rem]">
        {children}
      </div>
    </div>
  );
}

function PillarsSection() {
  return (
    <section className="mx-auto w-full max-w-7xl rounded-[1.75rem] border border-white/10 bg-[#122033]/55 p-6 shadow-[0_22px_70px_rgba(4,12,24,0.22)] md:p-8">
      <div className="mb-7 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--orange-soft)]">
          Our Pillars
        </p>
        <h2 className="mx-auto mt-4 max-w-2xl text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.05em] text-white md:text-5xl">
          What shapes the MECG experience.
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {pillars.map((pillar, index) => (
          <article
            key={pillar.title}
            className="group relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-6 transition duration-300 hover:-translate-y-1 hover:border-[var(--orange)]/45 hover:bg-white/[0.07]"
          >
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[var(--orange)]/10 blur-2xl transition duration-300 group-hover:bg-[var(--orange)]/18" />

            <div className="relative">
              <div className="mb-5 grid h-10 w-10 place-items-center rounded-full border border-[var(--orange)]/35 bg-[var(--orange)]/10 text-xs font-black text-[var(--orange-soft)]">
                {String(index + 1).padStart(2, "0")}
              </div>

              <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">
                {pillar.title}
              </h3>

              <p className="mt-3 text-sm leading-7 text-white/58">
                {pillar.body}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto grid w-full max-w-[92rem] gap-12 px-4 pb-12 pt-10 md:pt-16">
      <section className="mx-auto max-w-4xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--orange-soft)]">
          About MECG
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.055em] text-white md:text-7xl">
          Built for students exploring consulting.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-white/58">
          MECG brings together students across majors to learn, lead, and work on meaningful consulting projects.
        </p>
      </section>

      <PillarsSection />

      <section className="grid items-stretch gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <ImagePanel
          src="/images/about/president-welcome.png"
          alt="Annie Callam, President of MECG"
        />

        <TextPanel eyebrow="President's Welcome" title="President's Welcome">
          <p>
            Welcome to the Michigan Engineering Consulting Group! I&apos;m thrilled to introduce you to our dynamic community of passionate students and professionals.
          </p>
          <p>
            At MECG, we believe in delivering high-impact solutions to real-world challenges. Our diverse team of consultants works with clients across all industries, from startups to Fortune 500 companies, providing strategic insights and actionable recommendations.
          </p>
          <p>
            What sets MECG apart is our commitment to excellence and our eagerness to learn. Every project is an opportunity to grow, innovate, and make a meaningful impact. Whether you&apos;re interested in strategy, operations, technology, or any other consulting domain, MECG provides the platform to develop your skills and build your network.
          </p>
          <p>
            Our members come from various backgrounds and majors, bringing unique perspectives to every engagement. This diversity of thought, combined with our rigorous training and mentorship programs, enables us to tackle complex business challenges with creativity and precision.
          </p>
          <p>
            I invite you to explore our website, attend our events, and connect with our team. Whether you&apos;re a potential client looking for strategic guidance or a student eager to join our community, we&apos;d love to hear from you.
          </p>
          <p className="pt-2 text-white/75">
            Best,<br />
            Annie Callam<br />
            President of MECG, 2026
          </p>
        </TextPanel>
      </section>

      <section className="grid items-stretch gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <TextPanel eyebrow="Our History" title="Our History">
          <p>
            Michigan Engineering Consulting Group (MECG) was founded in 2023 by Jonathan Fay (Mechanical Engineering, Class of 2026) and Aaryan Singh (Industrial and Operations Engineering, Class of 2026) with the vision of creating a space where students could grow personally, professionally, and socially. What began as an idea between two students quickly took shape, and by Winter 2024, MECG welcomed its first cohort of members.
          </p>
          <p>
            When MECG was founded, the University of Michigan lacked strong opportunities for non-business students to explore consulting. MECG filled that gap, offering students of all majors a chance to acquire business acumen, gain project experience, and collaborate regardless of their prior background or academic level.
          </p>
          <p>
            As the club expanded, so did the opportunities. Members began taking on technical and business-focused projects, connecting through coffee chats, building cross-disciplinary teams, and touring top firms. With each semester, MECG has evolved into more than just a consulting club, it has become a place where students can create their own paths while contributing to meaningful work and building a closer community.
          </p>
          <p>
            Today, MECG reflects both the growth of its members and the rapid changes of the world around us. By meeting the growing demand to combine both hard and soft skills, MECG continues to prepare students to thrive in consulting and beyond, carrying forward the founding vision to cultivate students growth for a successful career.
          </p>
        </TextPanel>

        <ImagePanel
          src="/images/about/founders-history.png"
          alt="MECG Founders Jonathan Fay and Aaryan Singh"
        />
      </section>
    </div>
  );
}
