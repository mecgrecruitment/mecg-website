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

const sections = [
  {
    title: "Executive Board",
    people: people.filter((person) => {
      const role = person.role.toLowerCase();
      return role.includes("president") || role.includes("vp");
    }),
  },
  {
    title: "Project Managers",
    people: people.filter((person) => {
      const role = person.role.toLowerCase();
      return role.includes("project manager") && !role.includes("assistant");
    }),
  },
  {
    title: "Assistant Project Managers",
    people: people.filter((person) => person.role.toLowerCase().includes("assistant project manager")),
  },
  {
    title: "Strategic Leads",
    people: people.filter((person) => person.role.toLowerCase().includes("strategic lead")),
  },
  {
    title: "Analysts",
    people: people.filter((person) => person.role.toLowerCase().includes("analyst")),
  },
];

function MemberCard({ member }: { member: TeamMember }) {
  return (
    <article className="group overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#122033]/72 shadow-[0_22px_70px_rgba(4,12,24,0.24)] transition duration-300 hover:-translate-y-1 hover:border-[var(--orange)]/45">
      <div className="relative aspect-[4/5] bg-white/[0.04]">
        {member.image ? (
          <Image src={member.image} alt={member.name} fill sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw" className="object-cover transition duration-500 group-hover:scale-[1.035]" />
        ) : (
          <div className="grid h-full place-items-center text-white/35">No photo</div>
        )}
      </div>

      <div className="p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--orange-soft)]">{member.role}</p>
        <h3 className="mt-3 text-3xl font-black uppercase leading-[0.9] tracking-[-0.07em] text-white">{member.name}</h3>

        <div className="mt-5 flex flex-wrap gap-2">
          {member.linkedin ? (
            <a href={member.linkedin} target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white/55 transition hover:border-[var(--orange)] hover:text-white">LinkedIn</a>
          ) : null}
          {member.email ? (
            <a href={`mailto:${member.email}`} className="rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white/55 transition hover:border-[var(--orange)] hover:text-white">Email</a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function OurTeamPage() {
  return (
    <main className="grid gap-16 pb-16 pt-24 md:pt-32">
      

      {sections.map((section, index) =>
        section.people.length > 0 ? (
          <section key={section.title} className="mx-auto w-full max-w-7xl px-6 md:px-16">
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
        ) : null
      )}
    </main>
  );
}
