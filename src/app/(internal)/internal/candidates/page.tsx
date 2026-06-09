import { candidates } from "../../../../lib/internal-data";

export default function CandidatesPage() {
  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Candidate roster</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Open-rush candidates.
        </h2>
        <p className="mt-4 max-w-2xl text-white/54">
          General members can view basic candidate information only. Scores, notes, reactions, and hash data are restricted to authorized reviewers.
        </p>
      </section>

      <section className="panel rounded-[2rem] overflow-hidden">
        <div className="grid grid-cols-[5rem_1fr_1fr_9rem_8rem] gap-4 border-b border-white/10 px-5 py-4 text-xs font-bold uppercase tracking-[0.15em] text-white/40">
          <span>ID</span>
          <span>Name</span>
          <span>Major</span>
          <span>Stage</span>
          <span>Status</span>
        </div>

        {candidates.map((candidate) => (
          <a
            key={candidate.code}
            href={`/internal/candidates/${candidate.code}`}
            className="grid grid-cols-[5rem_1fr_1fr_9rem_8rem] gap-4 border-b border-white/10 px-5 py-5 transition hover:bg-white/[0.045]"
          >
            <span className="font-bold text-[var(--orange)]">{candidate.code}</span>
            <span>
              <strong>{candidate.name}</strong>
              <span className="block text-sm text-white/40">{candidate.email}</span>
            </span>
            <span className="text-white/58">{candidate.major}</span>
            <span className="text-white/58">{candidate.stage}</span>
            <span className="text-white/58">{candidate.status}</span>
          </a>
        ))}
      </section>
    </div>
  );
}
