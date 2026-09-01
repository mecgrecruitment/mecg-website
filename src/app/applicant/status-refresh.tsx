"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ACTION_EVENT = "applicant-action-pending";

export function setApplicantActionPending(pending: boolean) {
  window.dispatchEvent(new CustomEvent(ACTION_EVENT, { detail: pending }));
}

export default function ApplicantStatusRefresh() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [pendingActions, setPendingActions] = useState(0);

  useEffect(() => {
    const updateVisibility = () => setVisible(!document.hidden);
    const updatePending = (event: Event) => {
      const pending = (event as CustomEvent<boolean>).detail;
      setPendingActions((count) => Math.max(0, count + (pending ? 1 : -1)));
    };
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener(ACTION_EVENT, updatePending);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      window.removeEventListener(ACTION_EVENT, updatePending);
    };
  }, []);

  useEffect(() => {
    if (!visible || pendingActions > 0) return;
    const refresh = () => router.refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(interval);
  }, [pendingActions, router, visible]);

  return <p className="mt-3 text-xs text-mecg-navy/50" role="status">Status updates while this tab is open.</p>;
}
