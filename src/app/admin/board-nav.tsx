import Link from "next/link";

  const LINKS = [
  ["/admin", "Pipeline"],
  ["/admin/screening", "Blind screening"],
  ["/admin/speed-dating", "Speed Dating"],
  ["/admin/group-case", "Group Case"],
  ["/admin/groups", "Case teams"],
  ["/admin/hash", "Hash"],
] as const;

export default function BoardNav({ current }: { current: string }) {
  return (
    <nav aria-label="Board workspace" className="flex flex-wrap gap-2">
      {LINKS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={`rounded-full px-3 py-2 text-sm ${current === href ? "bg-mecg-navy text-white" : "border border-mecg-navy/15"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
