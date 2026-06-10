export default function MembersPage() {
  const members = [
    ["Amani Gupta", "Board", "Internal admin + demo owner"],
    ["Annie", "Recruitment", "Interviews and candidate review"],
    ["Jandy", "Recruitment", "Interview scoring"],
    ["Nandini", "Member", "Speed dating interviewer"],
    ["Blake", "Member", "Case reviewer"],
  ];

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Members</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Internal member directory.
        </h2>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {members.map(([name, role, detail]) => (
          <article key={name} className="panel rounded-[1.5rem] p-6">
            <p className="text-sm font-bold text-[var(--orange)]">{role}</p>
            <h3 className="font-display mt-3 text-3xl font-bold uppercase tracking-[-0.05em]">{name}</h3>
            <p className="mt-3 text-white/50">{detail}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
