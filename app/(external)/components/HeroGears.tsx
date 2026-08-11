"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { GearFocus } from "@/components/three/types";

// ssr:false must live inside a client boundary in Next 16. The WebGL stage is
// pure enhancement: nothing is rendered on the server, and the hero reads
// fully without it (no-JS, slow networks, WebGL-less browsers).
const GearCanvas = dynamic(() => import("@/components/three/GearCanvas"), {
  ssr: false,
  loading: () => <div className="gear-stage-fallback" aria-hidden="true" />,
});

const modes = [
  { id: "strategy", label: "Strategy", detail: "Frame the right question" },
  { id: "analysis", label: "Analysis", detail: "Find the useful signal" },
  { id: "delivery", label: "Delivery", detail: "Build the next step" },
] as const;

export default function HeroGears() {
  const [focus, setFocus] = useState<GearFocus>("strategy");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(
      "(min-width: 768px) and (prefers-reduced-motion: no-preference)"
    );
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean };
    }).connection;
    const capable = (navigator.hardwareConcurrency || 4) >= 4;
    if (!media.matches || connection?.saveData || !capable) return;

    const enable = () => setEnabled(true);
    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(enable, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timeoutId = globalThis.setTimeout(enable, 500);
    return () => globalThis.clearTimeout(timeoutId);
  }, []);

  return (
    <div className="relative h-full w-full">
      {enabled ? <GearCanvas focus={focus} /> : <div className="gear-stage-fallback" aria-hidden="true" />}
      {enabled ? (
        <div
          className="gear-stage-controls transition-opacity duration-300"
          aria-label="Explore the MECG project system"
        >
          {modes.map((mode, index) => (
            <button
              key={mode.id}
              type="button"
              aria-pressed={focus === mode.id}
              onClick={() => setFocus(mode.id)}
              className="gear-stage-control focus-ring"
            >
              <span>0{index + 1}</span>
              <strong>{mode.label}</strong>
              <small>{mode.detail}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
