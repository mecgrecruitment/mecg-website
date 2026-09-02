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
      <p className={`tabular text-2xl font-semibold ${valueClass}`}>{value}</p>
      <p className={`mt-1 text-[12px] ${labelClass}`}>{label}</p>
    </div>
  );
}
