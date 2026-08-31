import PillNav from "@/components/pill-nav";

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
  return <PillNav ariaLabel="Board workspace" current={current} links={links} />;
}
