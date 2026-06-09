import { hashQueue } from "../../../../../lib/internal-data";

export default async function HashSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Session {id}</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Live hash session.
        </h2>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.7fr]">
        <div className="panel rounded-[2rem] p-7">
          <p className="eyebrow">Queue</p>
          <div className="mt-6 grid gap-3">
            {hashQueue.map((candidate) => (
              <article key={candidate.code} className="rounded-[1rem] border border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{candidate.name}</h3>
                  <span className="text-[var(--orange)]">{candidate.score}</span>
                </div>
                <p className="mt-2 text-sm text-white/44">{candidate.code} · Controversy: {candidate.controversy}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="panel-strong rounded-[2rem] p-7">
          <p className="eyebrow">Vote</p>
          <div className="mt-6 grid gap-3">
            {["Advance", "Discuss More", "Hold", "Cut"].map((vote) => (
              <button key={vote} className="rounded-full border border-white/10 px-5 py-4 font-bold hover:border-[var(--orange)]">
                {vote}
              </button>
            ))}
          </div>
          <p className="mt-6 text-sm text-white/42">
            Voting UI is ready. Database-backed anonymous vote storage comes with Supabase.
          </p>
        </aside>
      </section>
    </div>
  );
}
