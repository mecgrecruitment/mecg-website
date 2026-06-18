import React from "react";
import Image from "next/image";
import teamData from "@/lib/team-members.json";

type TeamMember = {
  name: string;
  role: string;
  image?: string | null;
  linkedin?: string | null;
  email?: string | null;
};

const people = (teamData.people || []) as TeamMember[];

const board = people.filter((person) => {
  const role = person.role.toLowerCase();
  return role.includes("president") || role.includes("vp");
});

const projectManagers = people.filter((person) => {
  const role = person.role.toLowerCase();
  return role.includes("project manager") && !role.includes("assistant");
});

const assistantProjectManagers = people.filter((person) =>
  person.role.toLowerCase().includes("assistant project manager")
);

const strategicLeads = people.filter((person) =>
  person.role.toLowerCase().includes("strategic lead")
);

const analysts = people.filter((person) =>
  person.role.toLowerCase().includes("analyst")
);

function MemberCard({ member }: { member: TeamMember }) {
  return (
    <article className="group overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.035] shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-1 hover:border-white/18 hover:bg-white/[0.055]">
      <div className="relative mx-auto mt-4 aspect-[4/5] w-[86%] overflow-hidden rounded-[1rem] bg-white/[0.04]">
        {member.image ? (
          <Image
            src={member.image}
            alt={member.name}
            fill
            sizes="(min-width: 1280px) 220px, (min-width: 768px) 28vw, 80vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-white/35">
            No photo
          </div>
        )}
      </div>

      <div className="px-5 pb-5 pt-4 text-center">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--orange-soft)]">
          {member.role}
        </p>

        <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
          {member.name}
        </h3>

        <div className="mt-4 flex justify-center gap-2">
          {member.linkedin ? (
            <a
              href={member.linkedin}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/10 px-3.5 py-2 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-white/60 transition hover:border-[var(--orange)] hover:text-white"
            >
              LinkedIn
            </a>
          ) : null}

          {member.email ? (
            <a
              href={`mailto:${member.email}`}
              className="rounded-full border border-white/10 px-3.5 py-2 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-white/60 transition hover:border-[var(--orange)] hover:text-white"
            >
              Email
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function TeamSection({
  title,
  subtitle,
  members,
}: {
  title: string;
  subtitle?: string;
  members: TeamMember[];
}) {
  if (members.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl">
      <div className="mb-5 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--orange-soft)]">
          {title}
        </p>
        {subtitle ? (
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-white/48">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="grid justify-center gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {members.map((member) => (
          <MemberCard key={`${member.name}-${member.role}`} member={member} />
        ))}
      </div>
    </section>
  );
}

export default function OurTeamPage() {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-14 px-4 pb-10 pt-10 md:pt-16">
      <section className="mx-auto mt-6 max-w-4xl rounded-[1.5rem] border border-white/10 bg-[#122033]/70 px-6 py-10 text-center shadow-[0_22px_70px_rgba(4,12,24,0.28)] md:mt-10 md:px-10 md:py-12">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--orange-soft)]">
          Our Team
        </p>

        <h1 className="mx-auto mt-5 max-w-3xl text-balance text-4xl font-semibold leading-[1.03] tracking-[-0.05em] text-white md:text-6xl">
          Meet the people behind MECG.
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-balance text-sm leading-6 text-white/60 md:text-base">
          A student-led consulting group built around client projects, recruitment, education, and community.
        </p>
      </section>

      <TeamSection title="Executive Board" members={board} />

      <TeamSection title="Project Managers" members={projectManagers} />
      <TeamSection title="Assistant Project Managers" members={assistantProjectManagers} />
      <TeamSection title="Strategic Leads" members={strategicLeads} />
      <TeamSection title="Analysts" members={analysts} />
    </div>
  );
}
