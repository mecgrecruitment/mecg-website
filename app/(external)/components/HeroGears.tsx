"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { GearFocus } from "@/components/three/types";

// ssr:false must live inside a client boundary in Next 16. The WebGL stage is
// pure enhancement: nothing is rendered on the server, and the hero reads
// fully without it (no-JS, slow networks, WebGL-less browsers). Absolute
// fallback + delayed enable keep LCP on the SSR headline, not the canvas.
const GearCanvas = dynamic(() => import("@/components/three/GearCanvas"), {
  ssr: false,
  loading: () => <div className="gear-stage-fallback" aria-hidden="true" />,
});

const modes = [
  { id: "question", label: "Question", detail: "Define what needs to change" },
  { id: "evidence", label: "Evidence", detail: "Test the assumptions" },
  { id: "recommendation", label: "Recommendation", detail: "Make the next move clear" },
] as const;

function WorkingSystemFallback() {
  return (
    <svg
      className="working-system-fallback"
      viewBox="0 0 720 560"
      role="img"
      aria-label="Three connected gears representing a client question, evidence, and recommendation"
    >
      <defs>
        <radialGradient id="mecg-gear-hub" cx="42%" cy="35%">
          <stop offset="0" stopColor="#ffb072" />
          <stop offset="1" stopColor="#f5823a" />
        </radialGradient>
        <filter id="mecg-gear-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="24" stdDeviation="24" floodColor="#020814" floodOpacity=".55" />
        </filter>
      </defs>
      <g filter="url(#mecg-gear-shadow)" fill="none" strokeLinecap="round">
        <circle cx="390" cy="275" r="142" stroke="#26436f" strokeWidth="52" strokeDasharray="64 14" />
        <circle cx="390" cy="275" r="76" stroke="#f5823a" strokeWidth="2" opacity=".7" />
        <circle cx="390" cy="275" r="40" fill="url(#mecg-gear-hub)" stroke="none" />
        <circle cx="190" cy="170" r="83" stroke="#1b3257" strokeWidth="34" strokeDasharray="39 11" />
        <circle cx="190" cy="170" r="23" fill="#9dbdfa" stroke="none" />
        <circle cx="190" cy="417" r="105" stroke="#ffb072" strokeWidth="2" strokeDasharray="34 12" opacity=".8" />
      </g>
    </svg>
  );
}

export default function HeroGears() {
  const [focus, setFocus] = useState<GearFocus>("question");
  const [enabled, setEnabled] = useState(false);
  const disableCanvas = useCallback(() => setEnabled(false), []);

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
    <div className="working-system">
      <div className="working-system-visual">
        <WorkingSystemFallback />
        {enabled ? <GearCanvas focus={focus} onUnavailable={disableCanvas} /> : null}
      </div>
      <div className="gear-stage-controls" aria-label="How an MECG project moves">
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
    </div>
  );
}
