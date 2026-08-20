import type { Metadata } from "next";
import { CommunityStory } from "@/components/site/CommunityStory";
import {
  clients,
  faqs,
  pillars,
  projectTimeline,
  services,
} from "@/lib/site-content";
import HeroGears from "./components/HeroGears";
import { SectionHeading } from "./components/SectionHeading";

const title = "MECG | Michigan Engineering Consulting Group";
const description =
  "Pro-bono, student-led consulting at the University of Michigan. Open to every major.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: { title, description },
};

const proof = [
  { value: `${clients.length}+`, label: "Client engagements" },
  { value: `${services.length}`, label: "Consulting capabilities" },
  { value: "10-12", label: "Weeks per engagement" },
  { value: "All", label: "Majors welcome" },
];

const communityStory = [
  {
    src: "/images/community/community-52.jpg",
    alt: "Two MECG members wearing club hoodies outdoors at night",
    label: "Identity",
    title: "Club gear, same standard.",
    description:
      "Show up, help each other, follow through. That holds after a project ends.",
    position: "center 56%",
  },
  {
    src: "/images/community/community-32.jpg",
    alt: "MECG members gathered outdoors in Michigan colors",
    label: "Campus life",
    title: "Different majors, same roster.",
    description:
      "Members study across campus and still make time to meet.",
    position: "center 58%",
  },
  {
    src: "/images/community/community-40.jpg",
    alt: "A large group of MECG members dressed for a formal social gathering",
    label: "Community",
    title: "Outside the project room.",
    description:
      "Socials and formals sit next to client work on the calendar.",
    position: "center 48%",
  },
  {
    src: "/images/community/community-63.jpg",
    alt: "MECG members posing in front of the McKinsey & Company sign during a firm visit",
    label: "Industry exposure",
    title: "Firm visits before recruiting.",
    description:
      "Treks put members in offices they care about, with time to ask questions in the room.",
    position: "center 42%",
  },
  {
    src: "/images/community/community-62.jpg",
    alt: "A large group of MECG members in business attire posing in front of Cloud Gate in Chicago",
    label: "On the road",
    title: "Chicago trek photo.",
    description:
      "Past trek weekend: office visits and alumni conversations. Future dates publish when confirmed.",
    position: "center 50%",
  },
  {
    src: "/images/community/community-73.jpg",
    alt: "The incoming MECG board standing together as their names are introduced on screen",
    label: "Leadership",
    title: "Board transition each year.",
    description:
      "A new board takes responsibility for the next cycle of projects and recruitment.",
    position: "center 40%",
  },
  {
    src: "/images/community/community-70.jpg",
    alt: "MECG members gathered around a firepit under string lights at night",
    label: "Off the clock",
    title: "Retreat nights.",
    description:
      "Off-campus time without a deliverable agenda.",
    position: "center 55%",
  },
  {
    src: "/images/community/community-76.jpg",
    alt: "A large group of MECG members seated together at a restaurant dinner",
    label: "Celebrating together",
    title: "End-of-cycle dinners.",
    description:
      "Formals and banquets when a cycle closes.",
    position: "center 45%",
  },
];

export default function Home() {
  return (
    <main>
      <section className="grid-bg relative flex min-h-svh flex-col justify-center overflow-hidden px-5 pb-16 pt-36 md:px-8 md:pb-24 md:pt-44">
        <div className="orb right-[-12rem] top-[-12rem] h-[34rem] w-[34rem] bg-[var(--blue)]" />
        <div className="orb bottom-[-14rem] left-[-12rem] h-[28rem] w-[28rem] bg-[var(--orange-dark)]" />

        <div className="absolute inset-0 lg:left-auto lg:w-[60%] lg:pointer-events-auto pointer-events-none">
          <HeroGears />
        </div>

        <div className="container relative z-10 pointer-events-none">
          <p className="annotation annotation-accent" data-reveal>
            Michigan Engineering Consulting Group
          </p>

          <h1 className="display-xl mt-6 max-w-6xl text-white" data-split>
            Pro-bono.
            <br />
            <span className="text-ghost">Student-led.</span>
            <br />
            Open to every major.
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/68 md:text-xl" data-reveal>
            University of Michigan students deliver semester consulting for
            real clients. Members get project experience. Clients get research,
            recommendations, and a usable handoff.
          </p>

          {/* Hero budget: brand + headline + one support line + one CTA group only. */}
          <div className="pointer-events-auto mt-10 flex flex-wrap gap-3" data-reveal>
            <a href="/prospective-members" data-magnetic className="button-primary focus-ring">
              Prospective members
            </a>
            <a href="/client-services" data-magnetic className="button-secondary focus-ring">
              Client services
            </a>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025] px-5 md:px-8">
        <div className="container grid grid-cols-2 lg:grid-cols-4">
          {proof.map((item, index) => (
            <article
              key={item.label}
              className="border-white/10 px-4 py-7 even:border-l lg:border-l lg:first:border-l-0 md:px-7 md:py-9"
              data-reveal
            >
              <p className="stat text-4xl font-bold text-white md:text-5xl">
                {item.value}
              </p>
              <p className="annotation mt-2 text-white/42">
                0{index + 1} — {item.label}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Fig. 01 — One organization, four forms"
            title={<>Four pillars.</>}
            description="Professional development, education, client projects, and community. Same roster for each."
          />

          <div className="mt-14 grid gap-3 lg:grid-cols-4" data-reveal-group>
            {pillars.map((pillar) => (
              <article key={pillar.index} className="system-card group" data-reveal>
                <div className="system-card-index" aria-hidden="true">
                  {pillar.index}
                </div>
                <p className="annotation annotation-accent">Pillar {pillar.index}</p>
                <h3 className="font-display mt-7 text-3xl font-bold uppercase leading-[0.92] tracking-[-0.05em] text-white">
                  {pillar.title}
                </h3>
                <p className="mt-5 text-sm leading-7 text-white/58">{pillar.body}</p>
                <div className="system-card-axis" aria-hidden="true" />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sheet px-5 py-20 md:px-8 md:py-28">
        <div className="container">
          <SectionHeading
            eyebrow="Fig. 02 — Engagement model"
            title={<>Meet, scope, build, share.</>}
            description="A 10-12 week engagement with a defined scope, client check-ins, and deliverables meant for use after the final presentation."
            inverted
          />

          <div className="process-map mt-16">
            {projectTimeline.map((step, index) => (
              <article key={step.step} className="process-step" data-reveal>
                <div className="process-node" aria-hidden="true">
                  {step.step}
                </div>
                <p className="annotation !text-[var(--orange-dark)]">Phase {step.step}</p>
                <h3 className="font-display mt-4 text-3xl font-bold uppercase tracking-[-0.05em] text-[var(--navy-950)]">
                  {step.title}
                </h3>
                <p className="mt-4 leading-relaxed text-[var(--on-paper-muted)]">{step.body}</p>
                {index < projectTimeline.length - 1 ? (
                  <span className="process-connector" aria-hidden="true" />
                ) : null}
              </article>
            ))}
          </div>

          <div className="mt-14 flex flex-wrap gap-3">
            <a href="/client-services" className="button-dark focus-ring" data-magnetic>
              Client services
            </a>
            <a href="/contact" className="button-paper focus-ring">
              Contact
            </a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Fig. 03 — Consulting capabilities"
            title={<>Five service areas.</>}
            description="Strategy, operations, analytics, product, and marketing. Teams draw on students across UMich."
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-5">
            {services.map((service) => (
              <article key={service.index} className="bg-[var(--navy-900)] p-6 md:min-h-72" data-reveal>
                <p className="font-mono text-sm font-bold text-[var(--orange)]">{service.index}</p>
                <h3 className="font-display mt-12 text-2xl font-bold uppercase leading-[0.95] tracking-[-0.05em] text-white">
                  {service.title}
                </h3>
                <p className="mt-5 text-sm leading-6 text-white/54">{service.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="px-5 pb-12 md:px-8 md:pb-20">
        <div className="container">
          <CommunityStory frames={communityStory} />
        </div>
      </div>

      <section className="section pt-12">
        <div className="container">
          <SectionHeading
            eyebrow="Fig. 05 — Quick answers"
            title={<>FAQs.</>}
          />
          <div className="mt-10 grid gap-4" data-reveal-group>
            {faqs.map((faq) => (
              <details key={faq.question} className="group panel card-hover rounded-[1.35rem] p-0" data-reveal>
                <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-6 p-6">
                  <h3 className="font-display text-2xl font-bold uppercase tracking-[-0.04em] text-white md:text-3xl">
                    {faq.question}
                  </h3>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 font-mono text-lg font-bold text-[var(--orange)] transition group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="border-t border-white/10 px-6 pb-6 pt-5">
                  <p className="max-w-4xl text-lg leading-relaxed text-white/60">{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
