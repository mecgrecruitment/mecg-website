export default function InternalGradingPage() {
  const rubrics = [
    ["Application Review", "Written responses, resume, fit, problem solving"],
    ["Speed Dating", "Communication, presence, interest, member fit"],
    ["Group Case", "Problem structure, analysis, teamwork, presentation"],
    ["Interview", "Case thinking, motivation, experience, final fit"],
  ];

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Grading</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Evaluation center.
        </h2>
        <p className="mt-4 text-white/54">
          Mock rubric hub for reviewing candidates across every recruitment stage.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {rubrics.map(([stage, detail]) => (
          <article key={stage} className="panel card-hover rounded-[1.5rem] p-6">
            <p className="eyebrow">Rubric</p>
            <h3 className="font-display mt-4 text-3xl font-bold uppercase tracking-[-0.05em]">
              {stage}
            </h3>
            <p className="mt-4 text-white/50">{detail}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
