"use client";

import { useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 8_000;

export default function AttendanceRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-mecg-navy/55">
      <button type="button" onClick={refresh} disabled={pending} className="font-semibold underline underline-offset-2 disabled:opacity-50">
        {pending ? "Refreshing…" : "Refresh now"}
      </button>
      <span aria-live="polite">
        {pending ? "Updating attendance…" : "Updates every 8 seconds"}
      </span>
    </div>
  );
}
