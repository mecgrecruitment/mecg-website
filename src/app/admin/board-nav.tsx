import Link from "next/link";

const OPERATION_LINKS = [
  ["/admin", "Pipeline"],
  ["/admin/screening", "Blind screening"],
  ["/admin/speed-dating", "Speed Dating"],
  ["/admin/group-case", "Group Case"],
  ["/admin/groups", "Case teams"],
] as const;

export default function BoardNav({
  current,
  recruitmentOperations = true,
  hashPanel = false,
}: {
  current: string;
  recruitmentOperations?: boolean;
  hashPanel?: boolean;
}) {
  const links = [
    ...(recruitmentOperations ? OPERATION_LINKS : []),
    ...(hashPanel ? [["/admin/hash", "Hash"]] as const : []),
  ];
  return (
    <nav aria-label="Board workspace" className="-mx-6 overflow-x-auto px-6 pb-1 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-2">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={current === href ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-full px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors active:scale-[0.96] ${
              current === href ? "bg-mecg-navy text-white" : "text-mecg-navy/55 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] hover:bg-mecg-blue/[0.08]"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
