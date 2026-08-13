import Image from "next/image";
import type { Metadata } from "next";
import teamData from "@/lib/team-members.json";
import { PageHero } from "../components/PageHero";

const title = "Our Team";
const description =
  "Meet MECG's current executive board—the student leaders responsible for consulting, education, recruitment, community, finance, marketing, and external relationships.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/our-team" },
  openGraph: { title, description },
};

type TeamMember = {
  name: string;
  role: string;
  image?: string | null;
  linkedin?: string | null;
};

const people = (teamData.people || []) as TeamMember[];

const teamMoments = [
  {
    src: "/images/community/community-70.jpg",
    alt: "MECG members together during a consulting firm visit",
    label: "Learning together",
    className: "lg:col-span-8 lg:row-span-2",
    imageClassName: "object-cover object-center",
  },
  {
    src: "/images/community/community-56.jpg",
    alt: "Five MECG members gathered outdoors",
    label: "Community beyond projects",
    className: "lg:col-span-4",
    imageClassName: "object-cover object-center",
  },
  {
    src: "/images/community/community-60.jpg",
    alt: "Two MECG members wearing club sweatshirts in Ann Arbor",
    label: "Built at Michigan",
    className: "lg:col-span-4",
    imageClassName: "object-cover object-[center_62%]",
  },
];

const sections = [
  {
    title: "Executive Board",
    slug: "executive-board",
    people: people.filter((person) => {
      const role = person.role.toLowerCase();
      return role.includes("president") || role.includes("vp");
    }),
  },
  {
    title: "Project Managers",
    slug: "project-managers",
    people: people.filter((person) => {
      const role = person.role.toLowerCase();
      return role.includes("project manager") && !role.includes("assistant");
    }),
  },
  {
    title: "Assistant Project Managers",
    slug: "assistant-project-managers",
    people: people.filter((person) => person.role.toLowerCase().includes("assistant project manager")),
  },
  {
    title: "Strategic Leads",
    slug: "strategic-leads",
    people: people.filter((person) => person.role.toLowerCase().includes("strategic lead")),
  },
  {
    title: "Analysts",
    slug: "analysts",
    people: people.filter((person) => person.role.toLowerCase().includes("analyst")),
  },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

function MemberCard({ member }: { member: TeamMember }) {
  return (
    <article className="group overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#122033]/72 shadow-[0_22px_70px_rgba(4,12,24,0.24)] transition duration-300 hover:-translate-y-1 hover:border-[var(--orange)]/45">
      <div className="relative aspect-[4/5] bg-white/[0.04]">
        {member.image ? (
          <Image src={member.image} alt={member.name} fill sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-[1.035]" />
        ) : (
          <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.06),transparent_65%)]">
            <span className="font-display text-5xl font-black uppercase tracking-[-0.05em] text-white/20 transition duration-500 group-hover:text-[var(--orange-soft)]/40">
              {initials(member.name)}
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--orange-soft)]">{member.role}</p>
        <h3 className="mt-3 text-3xl font-black uppercase leading-[0.9] tracking-[-0.07em] text-white">{member.name}</h3>

        <div className="mt-5 flex flex-wrap gap-2">
          {member.linkedin ? (
            <a href={member.linkedin} target="_blank" rel="noreferrer" className="focus-ring inline-flex min-h-11 items-center rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white/55 transition hover:border-[var(--orange)] hover:text-white">LinkedIn</a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function OurTeamPage() {
  const visibleSections = sections.filter((section) => section.people.length > 0);

  return (
    <main className="grid gap-16 pb-16">
      <PageHero
        eyebrow="Sheet 03 — Our Team"
        title={<>Many disciplines.<br />{" "}<span className="text-ghost">One working team.</span></>}
        description="Meet the students who lead MECG, manage client engagements, build recommendations, and create the community around the work."
        tone="orange"
      />

      <section
        aria-labelledby="team-in-action"
        className="mx-auto w-full max-w-7xl px-6 md:px-16"
      >
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--orange-soft)]">
              In the room
            </p>
            <h2
              id="team-in-action"
              className="font-display mt-3 text-4xl font-black uppercase leading-[0.9] tracking-[-0.07em] text-white md:text-6xl"
            >
              The team in action.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-white/55 sm:text-right">
            From firm visits to the moments between meetings, MECG is built by
            people who learn and work together.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-12 lg:grid-rows-2">
          {teamMoments.map((moment, index) => (
            <figure
              key={moment.src}
              className={`group relative min-h-72 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#122033] shadow-[0_22px_70px_rgba(4,12,24,0.24)] ${moment.className}`}
            >
              <Image
                src={moment.src}
                alt={moment.alt}
                fill
                sizes={
                  index === 0
                    ? "(min-width: 1024px) 66vw, 100vw"
                    : "(min-width: 1024px) 33vw, 100vw"
                }
                className={`${moment.imageClassName} transition duration-500 group-hover:scale-[1.02]`}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07111f] via-[#07111f]/70 to-transparent px-5 pb-5 pt-16">
                <figcaption className="text-xs font-black uppercase tracking-[0.18em] text-white">
                  {moment.label}
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </section>

      {visibleSections.length > 1 ? (
        <nav
          aria-label="Jump to section"
          className="sticky top-20 z-30 mx-auto flex w-full max-w-7xl flex-wrap gap-2 px-6 md:px-16"
        >
          {visibleSections.map((section) => (
            <a
              key={section.slug}
              href={`#${section.slug}`}
              className="focus-ring inline-flex min-h-11 items-center rounded-full border border-white/10 bg-[#0c1626]/85 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white/60 backdrop-blur-md transition hover:border-[var(--orange)]/45 hover:text-white"
            >
              {section.title}
            </a>
          ))}
        </nav>
      ) : null}

      {visibleSections.map((section, index) => (
        <section
          key={section.title}
          id={section.slug}
          className="mx-auto w-full max-w-7xl scroll-mt-28 px-6 md:px-16"
        >
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--orange-soft)]">
            Fig. {String(index + 1).padStart(2, "0")} — {section.title}
          </p>
          <h2 className="font-display mt-5 max-w-5xl text-6xl font-black uppercase leading-[0.86] tracking-[-0.08em] text-white md:text-8xl">
            {section.title}
          </h2>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {section.people.map((member) => (
              <MemberCard key={`${member.name}-${member.role}`} member={member} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
