"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { canRefreshApplicantStatus, formatLastChecked } from "./status-refresh-state";

const ACTION_EVENT = "applicant-action-pending";
const LIVE_REGION_ID = "applicant-live-status";

function subscribeToOnlineState(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

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
  const [isRefreshing, startRefreshTransition] = useTransition();
  const visible = useSyncExternalStore(subscribeToVisibility, () => !document.hidden, () => true);
  const online = useSyncExternalStore(subscribeToOnlineState, () => navigator.onLine, () => true);
  const [pendingActions, setPendingActions] = useState(0);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [displayTime, setDisplayTime] = useState(0);
  const pendingActionsRef = useRef(0);
  const refreshInFlightRef = useRef(false);
  const transitionStartedRef = useRef(false);

  const requestRefresh = useCallback(() => {
    if (!canRefreshApplicantStatus({
      hidden: document.hidden,
      online: navigator.onLine,
      pendingActions: pendingActionsRef.current,
      refreshing: refreshInFlightRef.current,
    })) return;

    refreshInFlightRef.current = true;
    transitionStartedRef.current = false;
    startRefreshTransition(() => router.refresh());
  }, [router]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (!document.hidden) requestRefresh();
    };
    const updatePending = (event: Event) => {
      const pending = (event as CustomEvent<boolean>).detail;
      const nextCount = Math.max(0, pendingActionsRef.current + (pending ? 1 : -1));
      pendingActionsRef.current = nextCount;
      setPendingActions(nextCount);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", requestRefresh);
    window.addEventListener("online", requestRefresh);
    window.addEventListener(ACTION_EVENT, updatePending);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", requestRefresh);
      window.removeEventListener("online", requestRefresh);
      window.removeEventListener(ACTION_EVENT, updatePending);
    };
  }, [requestRefresh]);

  useEffect(() => {
    if (!refreshInFlightRef.current) return;
    if (isRefreshing) {
      transitionStartedRef.current = true;
      return;
    }
    if (!transitionStartedRef.current) return;

    refreshInFlightRef.current = false;
    transitionStartedRef.current = false;
    const checkedAt = Date.now();
    setLastCheckedAt(checkedAt);
    setDisplayTime(checkedAt);
  }, [isRefreshing]);

  useEffect(() => {
    const interval = window.setInterval(requestRefresh, 60_000);
    return () => window.clearInterval(interval);
  }, [requestRefresh]);

  const statusMessage = !online
    ? "Offline. Status will be checked when you reconnect."
    : isRefreshing
      ? "Checking for status updates…"
      : lastCheckedAt !== null
        ? formatLastChecked(lastCheckedAt, displayTime)
        : visible
          ? "Status updates automatically while this tab is open."
          : "Status updates are paused while this tab is hidden.";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-mecg-navy/60">
      <p role="status" aria-live="polite">{statusMessage}</p>
      <button
        type="button"
        className="min-h-10 rounded-full px-3 font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] hover:bg-mecg-blue/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!online || isRefreshing || pendingActions > 0}
        onClick={requestRefresh}
      >
        {isRefreshing ? "Checking…" : "Check now"}
      </button>
    </div>
  );
}
