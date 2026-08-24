import Reveal from "@/components/reveal";
import { STATS } from "@/lib/site-content";

export default function StatsBand() {
  return (
    <section aria-label="MECG at a glance" className="border-t border-white/12">
      <div className="mx-auto grid max-w-6xl grid-cols-2 lg:grid-cols-4">
        {STATS.map(({ value, label, context }, index) => (
          <Reveal
            key={label}
            delay={index * 60}
            className="border-white/12 px-6 py-6 even:border-l lg:border-l lg:py-7 lg:first:border-l-0"
          >
            <p className="font-mono text-[1.85rem] font-semibold tracking-tight tabular-nums sm:text-[2.15rem]">
              {value}
            </p>
            <p className="mt-2 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/55">
              {label}
            </p>
            <p className="mt-1.5 text-xs leading-5 text-white/55">{context}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
