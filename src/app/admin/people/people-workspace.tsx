"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type View = "DIRECTORY" | "ONBOARDING" | "ACCESS";

export default function PeopleWorkspace({
  directory,
  onboarding,
  access,
  directoryCount,
  onboardingCount,
  duplicateAccountCount,
}: {
  directory: ReactNode;
  onboarding?: ReactNode;
  access?: ReactNode;
  directoryCount: number;
  onboardingCount: number;
  duplicateAccountCount: number;
}) {
  const [view, setView] = useState<View>("DIRECTORY");
  const id = useId();
  const tabRefs = useRef<Partial<Record<View, HTMLButtonElement>>>({});
  const options: Array<{ value: View; label: string; count?: number; warning?: number }> = [
    { value: "DIRECTORY", label: "Directory", count: directoryCount },
    ...(onboarding ? [{ value: "ONBOARDING" as const, label: "Onboarding", count: onboardingCount }] : []),
    ...(access ? [{ value: "ACCESS" as const, label: "Access", warning: duplicateAccountCount }] : []),
  ];

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, current: View) {
    const index = options.findIndex((option) => option.value === current);
    const nextIndex = event.key === "ArrowRight" ? (index + 1) % options.length
      : event.key === "ArrowLeft" ? (index - 1 + options.length) % options.length
      : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : null;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = options[nextIndex]!.value;
    setView(next); tabRefs.current[next]?.focus();
  }

  return (
    <section id="workspace-content" aria-label="People workspace" className="min-w-0">
      <div className="scroll-cue flex gap-2 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.09)]" role="tablist" aria-label="People views">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={`${id}-tab-${option.value}`}
            ref={(element) => { if (element) tabRefs.current[option.value] = element; }}
            tabIndex={view === option.value ? 0 : -1}
            onKeyDown={(event) => navigateTabs(event, option.value)}
            aria-selected={view === option.value}
            aria-controls={`${id}-panel-${option.value}`}
            onClick={() => setView(option.value)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-[background-color,color,scale] active:scale-[0.96] ${view === option.value ? "bg-mecg-navy text-white" : "text-mecg-navy/65 hover:bg-mecg-blue/[0.08] hover:text-mecg-navy"}`}
          >
            {option.label}
            {option.count !== undefined && <span className={`tabular-nums rounded-full px-2 py-0.5 text-[11px] ${view === option.value ? "bg-white/15 text-white" : "bg-mecg-navy/[0.06] text-mecg-navy/60"}`}>{option.count}</span>}
            {Boolean(option.warning) && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-mecg-orange px-1 text-[10px] font-semibold text-mecg-navy" aria-label={`${option.warning} possible duplicate accounts`}>{option.warning}</span>}
          </button>
        ))}
      </div>

      {options.map((option) => <div key={option.value} id={`${id}-panel-${option.value}`} role="tabpanel" aria-labelledby={`${id}-tab-${option.value}`} tabIndex={0} hidden={view !== option.value} className="mt-6 min-w-0">
        {option.value === "DIRECTORY" ? directory : option.value === "ONBOARDING" ? onboarding : access}
      </div>)}
    </section>
  );
}
