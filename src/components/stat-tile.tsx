export default function StatTile({
  label,
  value,
  tone = "dark",
}: {
  label: string;
  value: string | number;
  tone?: "light" | "dark";
}) {
  const valueClass = tone === "dark" ? "text-white" : "text-mecg-navy";
  const labelClass = tone === "dark" ? "text-white/50" : "text-mecg-navy/60";
  return (
    <div>
      <p className={`font-mono text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
      <p className={`mt-1 text-[10px] uppercase tracking-[0.1em] ${labelClass}`}>{label}</p>
    </div>
  );
}
