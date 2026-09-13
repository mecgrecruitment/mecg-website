"use client";

import { useEffect } from "react";
import { refreshSessionToken } from "@/lib/client-fetch";

// clerk-js refreshes the 60-second session cookie only while the tab is awake.
// When a phone unlocks or wifi returns, ask for a fresh token right away so the
// first tap, image load or navigation after waking does not race an expired
// cookie. A no-op when there is no Clerk session on the page.
export default function SessionKeepalive() {
  useEffect(() => {
    const wake = () => {
      if (document.hidden || !navigator.onLine) return;
      void refreshSessionToken();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
    };
  }, []);
  return null;
}
