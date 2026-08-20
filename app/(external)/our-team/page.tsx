import Image from "next/image";
import type { Metadata } from "next";
import teamData from "@/lib/team-members.json";
import { PageHero } from "../components/PageHero";

const title = "Our Team";
const description =
  "MECG executive board and project teams: student leaders for consulting, education, recruitment, community, finance, marketing, and external relationships.";

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
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-[#122033]/72 transition duration-300 hover:-translate-y-1 hover:border-[var(--orange)]/45">
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
        <p className="text-sm font-semibold text-[var(--orange-soft)]">{member.role}</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">{member.name}</h3>

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
    <main className="grid gap-14 pb-20">
      <PageHero
        title="Our Team"
        description="Meet the students who lead MECG and support our client engagements, member education, and recruitment."
        tone="orange"
        compact
      />

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

      {visibleSections.map((section) => (
        <section
          key={section.title}
          id={section.slug}
          className="mx-auto w-full max-w-7xl scroll-mt-28 px-6 md:px-16"
        >
          <h2 className="font-display max-w-5xl text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
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
