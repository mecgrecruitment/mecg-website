"use client";

import { useSyncExternalStore } from "react";

type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
};

function subscribe(onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, 1000);
  return () => window.clearInterval(id);
}

function getNow() {
  return Date.now();
}

function formatRemaining(ms: number): CountdownParts {
  if (ms <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  }

  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    done: false,
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

const UNITS = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
] as const;

export default function ApplicationCountdown({ opensAt }: { opensAt: string }) {
  const now = useSyncExternalStore(subscribe, getNow, () => Date.parse(opensAt));
  const remaining = formatRemaining(Date.parse(opensAt) - now);

  if (remaining.done) {
    return (
      <p className="mt-4 text-sm font-semibold text-emerald-800" role="status">
        Applications are open now.
      </p>
    );
  }

  return (
    <div className="mt-6" aria-live="polite">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-orange-ink">
        Applications open in
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {UNITS.map(({ key, label }) => (
          <div
            key={key}
            className="rounded-2xl bg-mecg-navy/[0.04] px-3 py-4 text-center shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]"
          >
            <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-mecg-navy">
              {pad(remaining[key])}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-mecg-navy/55">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
