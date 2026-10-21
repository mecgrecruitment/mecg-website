"use client";

import { useLinkStatus } from "next/link";
import { useEffect } from "react";

// Marks the document while the enclosing link's navigation is in flight, so one CSS
// rule can show progress for any link without each page drawing its own loading state.
export default function NavigationSignal() {
  const { pending } = useLinkStatus();
  useEffect(() => {
    if (!pending) return;
    const root = document.documentElement;
    root.dataset.navigating = "";
    return () => { delete root.dataset.navigating; };
  }, [pending]);
  return null;
}
