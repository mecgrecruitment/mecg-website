"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  ["responses", "Responses"],
  ["evaluations", "Evaluations"],
  ["decision", "Decision"],
  ["activity", "Activity"],
] as const;

type TabKey = (typeof TABS)[number][0];

export default function DossierTabs({ panels }: { panels: Record<TabKey, ReactNode> }) {
  const [active, setActive] = useState<TabKey>("responses");
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            className={`rounded-full px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
              active === key ? "bg-mecg-navy text-white" : "text-mecg-navy/55 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] hover:bg-mecg-blue/[0.08]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-5">{panels[active]}</div>
    </div>
  );
}
