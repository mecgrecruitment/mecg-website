import { requireCommittee } from "@/lib/auth";
import { candidates, rubricCriteria } from "../../../../../../lib/internal-data";

export default async function ScorePage({
  params,
}: {
  params: Promise<{ code: string; stage: string }>;
}) {
  await requireCommittee();
  const { code, stage } = await params;
  const candidate = candidates.find((item) => item.code === code) ?? candidates[0];

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Blind scoring</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Score {candidate.name}
        </h2>
        <p className="mt-4 text-white/54">
          Stage: {stage}. You cannot view other reviewers' notes or scores until your own score is submitted.
        </p>
      </section>

      <form className="panel rounded-[2rem] p-7">
        <div className="grid gap-5">
          {rubricCriteria.map((criteria) => (
            <fieldset key={criteria.label} className="rounded-[1.25rem] border border-white/10 p-5">
              <legend className="px-2 font-bold">{criteria.label}</legend>
              <p className="mt-2 text-sm text-white/44">{criteria.description}</p>
              <div className="mt-5 grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <label key={score} className="cursor-pointer rounded-full border border-white/10 px-4 py-3 text-center hover:border-[var(--orange)]">
                    <input type="radio" name={criteria.label} value={score} className="sr-only" />
                    {score}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <label className="grid gap-2">
            <span className="font-bold">Private notes</span>
            <textarea
              rows={6}
              placeholder="Add structured notes. These remain hidden from peers until submission rules allow access."
              className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4 text-white outline-none focus:border-[var(--orange)]"
            />
          </label>

          <button className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
            Submit score
          </button>
        </div>
      </form>
    </div>
  );
}
