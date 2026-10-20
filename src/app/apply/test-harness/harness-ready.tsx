"use client";

import { useEffect, useRef } from "react";

// Tests must wait for event handlers, not just the server-rendered controls.
export default function HarnessReady() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    marker.current?.setAttribute("data-application-harness-ready", "true");
  }, []);
  return <span ref={marker} hidden />;
}
