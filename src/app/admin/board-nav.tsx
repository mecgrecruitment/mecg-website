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
          className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium ${current === href ? "bg-mecg-navy text-white" : "border border-mecg-navy/15"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
