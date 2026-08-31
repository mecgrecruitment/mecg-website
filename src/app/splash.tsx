"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

const HeroScene = dynamic(() => import("@/components/hero-scene"), {
  ssr: false,
});

export default function Splash() {
  const [exiting, setExiting] = useState(false);
  const router = useRouter();

  const enter = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push("/home");
      return;
    }
    setExiting(true);
    setTimeout(() => router.push("/home"), 420);
  };

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-clip bg-white text-mecg-navy">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(63,99,175,0.15), transparent 70%)",
        }}
      />
      <div className="splash-grid pointer-events-none absolute inset-0" />
      <HeroScene exiting={exiting} />

      <div
        className={`relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-20 text-center transition-[opacity,transform,filter] duration-[var(--t-shift)] ease-in ${
          exiting ? "scale-[0.98] opacity-0 blur-sm" : ""
        }`}
      >
        <div className="fade-up" style={{ animationDelay: "0ms" }}>
          <Image
            src="/logos/mecg-color.svg"
            alt="MECG Consulting"
            width={220}
            height={66}
            priority
            className="h-12 w-auto sm:h-14"
            style={{ width: "auto" }}
          />
        </div>
        <p
          className="fade-up mt-10 text-[0.72rem] font-medium uppercase tracking-[0.22em] text-mecg-navy/60"
          style={{ animationDelay: "40ms" }}
        >
          University of Michigan · Ann Arbor
        </p>
        <h1
          className="fade-up mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-mecg-navy sm:text-6xl"
          style={{ animationDelay: "50ms" }}
        >
          Engineering ideas
          <br />
          <span className="text-mecg-orange-ink">into impact.</span>
        </h1>
        <div className="fade-up mt-10" style={{ animationDelay: "100ms" }}>
          <button
            type="button"
            onClick={enter}
            className="button-primary"
          >
            Explore MECG <span className="translate-x-0.5" aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </main>
  );
}
