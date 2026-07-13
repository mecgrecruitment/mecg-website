"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
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

  return (
    <div className="relative h-full w-full">
      <GearCanvas focus={focus} />
      <div className="gear-stage-controls" aria-label="Explore the MECG project system">
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
