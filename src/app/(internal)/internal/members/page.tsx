import { currentMember, members } from "../../../../lib/internal-data";

export default function MembersPage() {
  return (
    <div className="grid gap-7">
      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="panel-strong rounded-[2rem] p-7">
          <p className="eyebrow">Member profile</p>
          <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
            {currentMember.name}
          </h2>
          <p className="mt-4 text-white/54">{currentMember.role} · {currentMember.major} · {currentMember.year}</p>
          <button className="mt-7 rounded-full bg-[var(--orange)] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.16em]">
            Edit profile
          </button>
        </aside>

        <div className="panel rounded-[2rem] p-7">
          <p className="eyebrow">Directory</p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {members.map((member) => (
              <article key={member.name} className="rounded-[1rem] border border-white/10 p-4">
                <h3 className="font-bold">{member.name}</h3>
                <p className="mt-1 text-sm text-white/44">{member.role} · {member.team}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
