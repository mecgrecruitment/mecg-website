export default function StatusPill({
  tone,
  children,
}: {
  tone: "orange" | "navy" | "neutral";
  children: React.ReactNode;
}) {
  const toneClass = {
    orange: "bg-mecg-orange/[0.16] text-mecg-orange-ink",
    navy: "bg-mecg-navy text-white",
    neutral: "bg-mecg-navy/10 text-mecg-navy/70",
  }[tone];
  return (
    <span className={`inline-flex w-fit items-center rounded-[2px] px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] ${toneClass}`}>
      {children}
    </span>
  );
}
