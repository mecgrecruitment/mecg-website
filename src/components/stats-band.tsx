import MiniSymbol from "@/components/mini-symbol";
import { STATS } from "@/lib/site-content";

const SYMBOLS = ["axis", "orbit", "signal", "spark"] as const;

export default function StatsBand() {
  return (
    <section
      aria-label="MECG at a glance"
      className="border-b border-mecg-navy/10 bg-mecg-navy text-white"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 lg:grid-cols-4">
        {STATS.map(({ value, label }, index) => (
          <div
            key={label}
            className="border-white/10 px-6 py-6 even:border-l lg:border-l lg:first:border-l-0"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-3xl font-medium tabular-nums sm:text-4xl">
                {value}
              </p>
              <MiniSymbol name={SYMBOLS[index]} className="text-mecg-orange/80" />
            </div>
            <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-white/50">
              0{index + 1} {label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
