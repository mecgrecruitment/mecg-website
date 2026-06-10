import Link from "next/link";

export default function InternalScorePage() {
  const stages = [
    ["Application Review", "/internal/score/C001/application"],
    ["Speed Dating", "/internal/speed-dating"],
    ["Group Case", "/internal/grading"],
    ["Interview", "/internal/grading"],
  ];

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Scoring</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Candidate evaluation.
        </h2>
        <p className="mt-4 text-white/54">
          Mock scoring center for applications, speed dating, group case, and interviews.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {stages.map(([stage, href]) => (
          <Link key={stage} href={href} className="panel card-hover rounded-[1.5rem] p-6">
            <p className="eyebrow">Stage</p>
            <h3 className="font-display mt-4 text-3xl font-bold uppercase tracking-[-0.05em]">
              {stage}
            </h3>
            <p className="mt-4 text-white/50">
              Open rubric, notes, and reviewer score entry.
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
