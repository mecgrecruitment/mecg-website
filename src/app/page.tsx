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
        className={`relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-20 text-center transition-[opacity,transform,filter] duration-200 ease-in ${
          exiting ? "scale-[0.98] opacity-0 blur-sm" : ""
        }`}
      >
        <div className="fade-up" style={{ animationDelay: "0ms" }}>
          <Image src="/logos/mecg-color.svg" alt="MECG Consulting" width={240} height={72} priority />
        </div>
        <h1
          className="hero-title fade-up mt-9 max-w-4xl text-balance text-5xl font-semibold leading-[0.92] tracking-[-0.06em] text-mecg-navy sm:text-7xl lg:text-[6rem]"
          style={{ animationDelay: "50ms" }}
        >
          Engineering ideas
          <br />
          <span className="text-mecg-orange">into impact.</span>
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
