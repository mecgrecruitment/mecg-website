import Image from "next/image";

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
    <main className="grid gap-16 pb-16 pt-24 md:pt-32">
      <section className="mx-auto w-full max-w-7xl px-6 md:px-16">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--orange-soft)]">
          Fig. 01 — Four Pillars
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

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-6 md:px-16 lg:grid-cols-[0.95fr_1.05fr]">
        <ImagePanel src="/images/about/president-welcome.png" alt="Annie Callam, President of MECG" />
        <TextPanel label="President's Welcome" title="President's Welcome">
          <p>Welcome to the Michigan Engineering Consulting Group! I&apos;m thrilled to introduce you to our dynamic community of passionate students and professionals.</p>
          <p>At MECG, we believe in delivering high-impact solutions to real-world challenges. Our diverse team of consultants works with clients across all industries, from startups to Fortune 500 companies, providing strategic insights and actionable recommendations.</p>
          <p>What sets MECG apart is our commitment to excellence and our eagerness to learn. Every project is an opportunity to grow, innovate, and make a meaningful impact. Whether you&apos;re interested in strategy, operations, technology, or any other consulting domain, MECG provides the platform to develop your skills and build your network.</p>
          <p>Our members come from various backgrounds and majors, bringing unique perspectives to every engagement. This diversity of thought, combined with our rigorous training and mentorship programs, enables us to tackle complex business challenges with creativity and precision.</p>
          <p>I invite you to explore our website, attend our events, and connect with our team. Whether you&apos;re a potential client looking for strategic guidance or a student eager to join our community, we&apos;d love to hear from you.</p>
          <p className="pt-2 text-white/78">Best,<br />Annie Callam<br />President of MECG, 2026</p>
        </TextPanel>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-6 md:px-16 lg:grid-cols-[1.05fr_0.95fr]">
        <TextPanel label="Our History" title="Our History">
          <p>Michigan Engineering Consulting Group (MECG) was founded in 2023 by Jonathan Fay (Mechanical Engineering, Class of 2026) and Aaryan Singh (Industrial and Operations Engineering, Class of 2026) with the vision of creating a space where students could grow personally, professionally, and socially. What began as an idea between two students quickly took shape, and by Winter 2024, MECG welcomed its first cohort of members.</p>
          <p>When MECG was founded, the University of Michigan lacked strong opportunities for non-business students to explore consulting. MECG filled that gap, offering students of all majors a chance to acquire business acumen, gain project experience, and collaborate regardless of their prior background or academic level.</p>
          <p>As the club expanded, so did the opportunities. Members began taking on technical and business-focused projects, connecting through coffee chats, building cross-disciplinary teams, and touring top firms. With each semester, MECG has evolved into more than just a consulting club, it has become a place where students can create their own paths while contributing to meaningful work and building a closer community.</p>
          <p>Today, MECG reflects both the growth of its members and the rapid changes of the world around us. By meeting the growing demand to combine both hard and soft skills, MECG continues to prepare students to thrive in consulting and beyond, carrying forward the founding vision to cultivate students growth for a successful career.</p>
        </TextPanel>
        <ImagePanel src="/images/about/founders-history.png" alt="MECG Founders Jonathan Fay and Aaryan Singh" />
      </section>
    </main>
  );
}
