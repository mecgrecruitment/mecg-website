"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ACTION_EVENT = "applicant-action-pending";
const LIVE_REGION_ID = "applicant-live-status";

export function setApplicantActionPending(pending: boolean) {
  window.dispatchEvent(new CustomEvent(ACTION_EVENT, { detail: pending }));
}

// A single sr-only node attached directly to <body>, created once and never removed. Background
// polling can change *which* section of the applicant page is mounted (e.g. a released decision
// swaps the "in review" branch for the outcome card, unmounting this component) — a live region
// declared inside that branch would vanish at the exact moment it needs to announce something. A
// live region only announces changes if it already existed when they happened, so this one lives
// outside React's tree entirely and survives every remount on this page.
export function announceApplicantUpdate(message: string) {
  if (typeof document === "undefined") return;
  let node = document.getElementById(LIVE_REGION_ID);
  if (!node) {
    node = document.createElement("p");
    node.id = LIVE_REGION_ID;
    node.className = "sr-only";
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    document.body.appendChild(node);
  }
  node.textContent = message;
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
    const refresh = () => {
      const before = document.querySelector("main")?.textContent ?? "";
      router.refresh();
      // ponytail: fixed delay heuristic for "the RSC refresh has landed," not a real completion
      // signal (router.refresh() gives none). Upgrade to a proper change event if refresh grows
      // a callback/promise API. Deliberately not cleared on unmount — the release-decision case
      // this exists for is exactly the case where this component unmounts before the delay ends.
      window.setTimeout(() => {
        const after = document.querySelector("main")?.textContent ?? "";
        if (after !== before) announceApplicantUpdate("Your application status just updated.");
      }, 900);
    };
    const interval = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(interval);
  }, [pendingActions, router, visible]);

  return <p className="mt-3 text-xs text-mecg-navy/60" role="status">Status updates while this tab is open.</p>;
}
