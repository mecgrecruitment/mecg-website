"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";

const TABS = [
  ["responses", "Responses"],
  ["evaluations", "Evaluations"],
  ["decision", "Decision"],
  ["activity", "Activity"],
] as const;

type TabKey = (typeof TABS)[number][0];

export default function DossierTabs({ panels }: { panels: Record<TabKey, ReactNode> }) {
  const [active, setActive] = useState<TabKey>("responses");
  const id = useId();
  function selectFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, key: TabKey) {
    const index = TABS.findIndex(([tab]) => tab === key);
    const nextIndex = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? (index + 1) % TABS.length
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? (index - 1 + TABS.length) % TABS.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? TABS.length - 1
            : null;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextKey = TABS[nextIndex][0];
    setActive(nextKey);
    document.getElementById(`${id}-${nextKey}`)?.focus();
  }
  return (
    <div>
      <div role="tablist" aria-label="Applicant dossier sections" className="scroll-cue sticky top-[60px] z-20 -mx-2 flex gap-2 overflow-x-auto border-b border-mecg-navy/8 bg-white/95 px-2 py-2 backdrop-blur">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            onKeyDown={(event) => selectFromKeyboard(event, key)}
            id={`${id}-${key}`}
            role="tab"
            aria-selected={active === key}
            aria-controls={`${id}-${key}-panel`}
            tabIndex={active === key ? 0 : -1}
            className={`min-h-11 shrink-0 rounded-full px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
              active === key ? "bg-mecg-navy text-white" : "text-mecg-navy/55 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] hover:bg-mecg-blue/[0.08]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div id={`${id}-${active}-panel`} role="tabpanel" aria-labelledby={`${id}-${active}`} tabIndex={0} className="mt-5 outline-none">{panels[active]}</div>
    </div>
  );
}
