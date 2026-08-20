"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import GearAssembly from "./GearAssembly";
import type { GearFocus } from "./types";

// @react-three/fiber's render loop constructs `new THREE.Clock()` internally,
// and three@0.184 logs a one-time deprecation notice from Clock's constructor
// ("THREE.Clock … deprecated. Please use THREE.Timer instead."). It is library
// noise we can't reach from app code. Drop only that exact line; pass through
// everything else.
// ponytail: remove this shim once @react-three/fiber adopts THREE.Timer.
if (typeof window !== "undefined") {
  const w = window as typeof window & { __mecgClockWarnPatched?: boolean };
  if (!w.__mecgClockWarnPatched) {
    w.__mecgClockWarnPatched = true;
    const originalWarn = console.warn.bind(console);
    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("THREE.Clock")) return;
      originalWarn(...args);
    };
  }
}

function FrameDriver({ active }: { active: boolean }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    invalidate();
    if (!active) return;
    const interval = window.setInterval(invalidate, 1000 / 30);
    return () => window.clearInterval(interval);
  }, [active, invalidate]);

  return null;
}

/**
 * Performance-guarded WebGL stage for the gear assembly.
 * - DPR clamped to [1, 1.5].
 * - frameloop="demand" + FrameDriver @ 30fps only while in-viewport AND tab
 *   visible; IntersectionObserver + visibilitychange pause offscreen/hidden.
 * - prefers-reduced-motion: one static pose (GearAssembly animated=false).
 * - Host fades in on Canvas onCreated; parent HeroGears keeps a sized fallback
 *   so mount cannot shift layout / block hero text LCP.
 */
export default function GearCanvas({ focus = "strategy" }: { focus?: GearFocus }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [inViewport, setInViewport] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMedia = () => setReduced(media.matches);
    applyMedia();
    media.addEventListener("change", applyMedia);

    const host = hostRef.current;
    let io: IntersectionObserver | null = null;
    if (host) {
      io = new IntersectionObserver(
        ([entry]) => setInViewport(entry.isIntersecting),
        { rootMargin: "120px" }
      );
      io.observe(host);
    }

    const onVisibility = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      media.removeEventListener("change", applyMedia);
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const active = !reduced && inViewport && tabVisible;

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="h-full w-full"
      style={{
        opacity: ready ? 1 : 0,
        transition: "opacity 1.2s var(--ease-out-expo)",
      }}
    >
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 7.2], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={() => setReady(true)}
      >
        <FrameDriver active={active} />
        <GearAssembly animated={!reduced} focus={focus} />
      </Canvas>
    </div>
  );
}
