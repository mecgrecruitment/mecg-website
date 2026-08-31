type ProjectWorkCardProps = {
  readonly example: {
    readonly number: string;
    readonly title: string;
    readonly question: string;
    readonly work: readonly string[];
    readonly handoff: string;
  };
  readonly tone?: "light" | "dark";
};

export default function ProjectWorkCard({ example, tone = "light" }: ProjectWorkCardProps) {
  const dark = tone === "dark";

  return (
    <article className={dark ? "rounded-2xl bg-white/[0.06] p-5 text-white sm:p-6" : "rounded-2xl bg-white p-5 shadow-[0_16px_40px_rgba(7,13,31,0.07)] sm:p-6"}>
      <p className={dark ? "font-mono text-xs text-mecg-orange" : "font-mono text-xs text-mecg-orange-ink"}>{example.number}</p>
      <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em]">{example.title}</h3>
      <p className={dark ? "mt-3 leading-7 text-white/68" : "mt-3 leading-7 text-mecg-navy/65"}>{example.question}</p>
      <ul className={dark ? "mt-5 space-y-2.5 border-t border-white/12 pt-4 text-sm text-white/62" : "mt-5 space-y-2.5 border-t border-mecg-navy/10 pt-4 text-sm text-mecg-navy/60"}>
        {example.work.map((item) => (
          <li key={item} className="flex gap-3 leading-6">
            <span className="text-mecg-orange" aria-hidden="true">→</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className={dark ? "mt-5 border-t border-white/12 pt-4 text-sm leading-6 text-white/72" : "mt-5 border-t border-mecg-navy/10 pt-4 text-sm leading-6 text-mecg-navy/70"}>
        <span className={dark ? "block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-white/42" : "block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-mecg-navy/42"}>Handoff</span>
        <span className="mt-2 block">{example.handoff}</span>
      </p>
    </article>
  );
}
