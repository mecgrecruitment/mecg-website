"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { switchedWorkspaceHref } from "@/lib/workspace-cycle-url";

type Option = { id: string; name: string; status: string };
export default function WorkspaceCycleSwitcher({ cycleId, cycles }: { cycleId: string; cycles: readonly Option[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  return <label className="flex flex-wrap items-center gap-3 text-sm font-semibold text-mecg-navy">
    Cohort
    <select aria-label="Cohort" className="select-control min-h-11 w-full sm:w-auto sm:max-w-sm" value={cycleId} onChange={(event) => {
      const selected = event.target.value;
      if (!cycles.some((cycle) => cycle.id === selected)) return;
      router.push(switchedWorkspaceHref(`${pathname}?${searchParams.toString()}${window.location.hash}`, selected));
    }}>
      {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name} · {cycle.status}</option>)}
    </select>
  </label>;
}
