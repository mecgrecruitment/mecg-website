"use client";

import dynamic from "next/dynamic";

// ssr:false must live inside a client boundary in Next 16. The WebGL stage is
// pure enhancement: nothing is rendered on the server, and the hero reads
// fully without it (no-JS, slow networks, WebGL-less browsers).
const GearCanvas = dynamic(() => import("@/components/three/GearCanvas"), {
  ssr: false,
});

export default function HeroGears() {
  return <GearCanvas />;
}
