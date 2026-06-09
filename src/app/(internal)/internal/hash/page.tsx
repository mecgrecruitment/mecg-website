import { hashQueue } from "../../../../lib/internal-data";

export default function HashPage() {
  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Hash mode</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Candidate deliberation queue.
        </h2>
        <p className="mt-4 text-white/54">
          Votes are anonymous by default. Board can switch session visibility if needed.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {hashQueue.map((candidate) => (
          <a key={candidate.code} href="/internal/hash/winter-2026" className="panel card-hover rounded-[1.5rem] p-6">
            <p className="text-sm font-bold text-[var(--orange)]">{candidate.code}</p>
            <h3 className="font-display mt-5 text-3xl font-bold uppercase tracking-[-0.05em]">{candidate.name}</h3>
            <div className="mt-6 grid grid-cols-3 gap-3 text-sm text-white/50">
              <p>Score<br /><strong className="text-white">{candidate.score}</strong></p>
              <p>Controversy<br /><strong className="text-white">{candidate.controversy}</strong></p>
              <p>Status<br /><strong className="text-white">{candidate.status}</strong></p>
            </div>
          </a>
        ))}
      </section>
    </div>
  );
}
