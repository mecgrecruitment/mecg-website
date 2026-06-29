"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import GearAssembly from "./GearAssembly";

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

type Frameloop = "always" | "demand" | "never";

/**
 * Performance-guarded WebGL stage for the gear assembly.
 * - DPR clamped to 1.75 (retina text stays sharp, fill rate stays sane).
 * - Render loop runs only while the canvas is on screen (IntersectionObserver)
 *   and the tab is visible.
 * - prefers-reduced-motion renders a single static frame, no loop.
 * - Fades in once the first frame is committed, so there is no pop.
 */
export default function GearCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
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
        ([entry]) => setVisible(entry.isIntersecting),
        { rootMargin: "120px" }
      );
      io.observe(host);
    }

    const onVisibility = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      media.removeEventListener("change", applyMedia);
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const frameloop: Frameloop = reduced ? "demand" : visible ? "always" : "never";

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
        frameloop={frameloop}
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 7.2], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={() => setReady(true)}
      >
        <GearAssembly animated={!reduced} />
      </Canvas>
    </div>
  );
}
