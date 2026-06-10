import { requireCommittee } from "@/lib/auth";
import { candidates, rubricCriteria } from "../../../../../lib/internal-data";

export default async function CandidateProfilePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  // Full candidate profiles are committee+ (§9.1); general members only get
  // the roster at /internal/candidates.
  await requireCommittee();
  const { code } = await params;
  const candidate = candidates.find((item) => item.code === code) ?? candidates[0];

  return (
    <div className="grid gap-7">
      <section className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
        <div className="panel-strong rounded-[2rem] p-7">
          <p className="eyebrow">{candidate.code}</p>
          <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
            {candidate.name}
          </h2>
          <p className="mt-4 text-lg text-white/56">
            {candidate.year} · {candidate.major} · {candidate.email}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {candidate.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/52">
                {tag}
              </span>
            ))}
          </div>
        </div>

      <aside className="panel rounded-[2rem] p-7">
          <p className="eyebrow">Review summary</p>
          <div className="mt-6 grid gap-4">
            <div>
              <p className="text-sm text-white/42">Current stage</p>
              <p className="text-2xl font-bold">{candidate.stage}</p>
            </div>
            <div>
              <p className="text-sm text-white/42">Composite</p>
              <p className="text-4xl font-bold text-[var(--orange)]">{candidate.composite}</p>
            </div>
            <div>
              <p className="text-sm text-white/42">Reaction</p>
              <p className="text-2xl font-bold">{candidate.reaction}</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Application</p>
          <div className="mt-6 grid gap-4 text-white/56">
            <p><strong className="text-white">Submitted:</strong> {candidate.submitted}</p>
            <p><strong className="text-white">Why MECG:</strong> Interested in solving ambiguous problems with technical and business context.</p>
            <p><strong className="text-white">Experience:</strong> Project work, analytics, teamwork, and student organization leadership.</p>
          </div>
        </div>

        <div className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Scoring</p>
          <div className="mt-6 grid gap-3">
            {rubricCriteria.map((criteria) => (
              <a
                key={criteria.label}
                href={`/internal/score/${candidate.code}/application`}
                className="grid gap-3 rounded-[1rem] border border-white/10 p-4 transition hover:border-[var(--orange)] md:grid-cols-[1fr_8rem]"
              >
                <span>
                  <strong>{criteria.label}</strong>
                  <span className="block text-sm text-white/44">{criteria.description}</span>
                </span>
                <span className="text-sm text-[var(--orange)]">Score →</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
