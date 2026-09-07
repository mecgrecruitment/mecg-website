"use client";

import { useState, type ReactNode } from "react";

export default function ScreeningReadingDesk({ reader, scorer }: { reader: ReactNode; scorer: ReactNode }) {
  const [view, setView] = useState<"read" | "score">("read");
  return (
    <>
      <div className="sticky top-2 z-10 grid grid-cols-2 rounded-xl bg-paper p-1 shadow-[0_8px_24px_rgba(7,13,31,0.08),inset_0_0_0_1px_rgba(7,13,31,0.1)] lg:hidden" role="tablist" aria-label="Application review view">
        {(["read", "score"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={view === option}
            onClick={() => setView(option)}
            className={`min-h-11 rounded-lg text-sm font-semibold transition-[background-color,color,box-shadow,scale] active:scale-[0.96] ${view === option ? "bg-white text-mecg-navy shadow-[0_1px_5px_rgba(7,13,31,0.12)]" : "text-mecg-navy/60"}`}
          >
            {option === "read" ? "Read application" : "Score application"}
          </button>
        ))}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(24rem,0.92fr)]">
        <div className={`${view === "read" ? "block" : "hidden"} lg:block`}>{reader}</div>
        <div className={`${view === "score" ? "block" : "hidden"} lg:block lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1`}>{scorer}</div>
      </div>
    </>
  );
}
