"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

// A1/A2 — the external-zone motion system.
//
// One Lenis instance driven by the GSAP ticker and synced to ScrollTrigger;
// never instantiated under prefers-reduced-motion (torn down live on change).
//
// Declarative motion contract (all hiding happens inside gsap.matchMedia, so
// reduced-motion and no-JS users always see final, static content):
//   [data-reveal]            scroll-in reveal (y + fade), once
//   [data-reveal="wipe"]     clip-path wipe instead
//   [data-reveal-group]      children with [data-reveal] stagger as a unit
//   [data-split]             SplitText masked line reveal (kinetic type)
//   [data-parallax="0.2"]    scrubbed vertical drift, fraction of viewport
//   [data-counter]           numeric text rolls up from 0 when scrolled in
//   [data-magnetic]          element eases toward the pointer on hover
//   [data-hud-gear]          fixed dial rotated by overall scroll progress
// Plus a drafting-cursor (dot + ring) on fine pointers.
export default function MotionProvider() {
  const pathname = usePathname();
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    let lenis: Lenis | null = null;
    let tick: ((time: number) => void) | null = null;

    const start = () => {
      if (lenis) return;
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      tick = (time) => lenis?.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    };

    const stop = () => {
      if (tick) gsap.ticker.remove(tick);
      tick = null;
      lenis?.destroy();
      lenis = null;
    };

    const apply = () => (media.matches ? stop() : start());

    apply();
    media.addEventListener("change", apply);

    return () => {
      media.removeEventListener("change", apply);
      stop();
    };
  }, []);

  // Drafting cursor — fine pointers, motion allowed. Outside matchMedia so it
  // tracks its own media queries; CSS hides it for coarse pointers/RM anyway.
  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const fine = window.matchMedia("(pointer: fine)");
    const noRM = window.matchMedia("(prefers-reduced-motion: no-preference)");
    if (!fine.matches || !noRM.matches) return;

    const dotX = gsap.quickTo(dot, "x", { duration: 0.12, ease: "power3.out" });
    const dotY = gsap.quickTo(dot, "y", { duration: 0.12, ease: "power3.out" });
    const ringX = gsap.quickTo(ring, "x", { duration: 0.35, ease: "power3.out" });
    const ringY = gsap.quickTo(ring, "y", { duration: 0.35, ease: "power3.out" });

    gsap.set([dot, ring], { xPercent: -50, yPercent: -50, x: -100, y: -100 });

    const onMove = (e: PointerEvent) => {
      dotX(e.clientX);
      dotY(e.clientY);
      ringX(e.clientX);
      ringY(e.clientY);
    };

    const HOT = "a, button, [data-magnetic], input, textarea, select, label";
    const onOver = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.(HOT)) {
        document.body.classList.add("cursor-hot");
      }
    };
    const onOut = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.(HOT)) {
        document.body.classList.remove("cursor-hot");
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerout", onOut, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerout", onOut);
      document.body.classList.remove("cursor-hot");
    };
  }, []);

  useEffect(() => {
    const mm = gsap.matchMedia();
    const splits: SplitText[] = [];
    const magneticCleanups: Array<() => void> = [];

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const seen = new Set<Element>();

      // Kinetic type: masked line reveals. autoSplit re-splits after font
      // load so line boxes are final; SplitText preserves accessibility via
      // aria-label on the split element.
      document.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => {
        seen.add(el);
        el.classList.add("split-mask");
        const split = SplitText.create(el, {
          type: "lines",
          mask: "lines",
          linesClass: "split-line",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 112,
              duration: 1.1,
              ease: "power4.out",
              stagger: 0.09,
              scrollTrigger: { trigger: el, start: "top 88%", once: true },
            }),
        });
        splits.push(split);
      });

      // Grouped reveals stagger together, triggered by the group container.
      document
        .querySelectorAll<HTMLElement>("[data-reveal-group]")
        .forEach((group) => {
          const items = Array.from(
            group.querySelectorAll<HTMLElement>("[data-reveal]")
          );
          if (items.length === 0) return;
          items.forEach((el) => seen.add(el));

          gsap.from(items, {
            y: 28,
            autoAlpha: 0,
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.06,
            scrollTrigger: { trigger: group, start: "top 85%", once: true },
          });
        });

      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        if (seen.has(el)) return;

        const wipe = el.dataset.reveal === "wipe";
        gsap.from(el, {
          ...(wipe
            ? {
                clipPath: "inset(0 0 100% 0)",
                duration: 1.0,
                ease: "power4.out",
              }
            : { y: 28, autoAlpha: 0, duration: 0.8, ease: "power3.out" }),
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        });
      });

      // Parallax drift — scrubbed, fraction of viewport height.
      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
        const amount = parseFloat(el.dataset.parallax || "0.15");
        gsap.fromTo(
          el,
          { y: () => amount * window.innerHeight * 0.5 },
          {
            y: () => -amount * window.innerHeight * 0.5,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          }
        );
      });

      // Interactive timeline: the marker travels down [data-timeline-track]
      // scrubbed to the container's scroll position; each [data-timeline-node]
      // gains .timeline-node--active as it crosses viewport center.
      document.querySelectorAll<HTMLElement>("[data-timeline]").forEach((container) => {
        const track = container.querySelector<HTMLElement>("[data-timeline-track]");
        const marker = container.querySelector<HTMLElement>("[data-timeline-marker]");
        const nodes = container.querySelectorAll<HTMLElement>("[data-timeline-node]");
        if (!track || !marker) return;

        const setY = gsap.quickSetter(marker, "y", "px");
        ScrollTrigger.create({
          trigger: container,
          start: "top center",
          end: "bottom center",
          scrub: true,
          onUpdate: (self) => {
            setY(self.progress * Math.max(track.offsetHeight - marker.offsetHeight, 0));
          },
        });

        nodes.forEach((node) => {
          ScrollTrigger.create({
            trigger: node,
            start: "top center",
            toggleClass: { targets: node, className: "timeline-node--active" },
          });
        });
      });

      // Stat roll-ups: "80+" counts 0 → 80 keeping the suffix.
      document.querySelectorAll<HTMLElement>("[data-counter]").forEach((el) => {
        const match = (el.textContent || "").trim().match(/^([\d,]+)(.*)$/);
        if (!match) return;
        const target = parseInt(match[1].replace(/,/g, ""), 10);
        const suffix = match[2] || "";
        const state = { value: 0 };

        gsap.to(state, {
          value: target,
          duration: 1.6,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
          onUpdate: () => {
            el.textContent = `${Math.round(state.value).toLocaleString("en-US")}${suffix}`;
          },
        });
      });

      // Magnetic pulls — buttons lean toward the pointer.
      document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
        const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
        const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });

        const onMove = (e: PointerEvent) => {
          const rect = el.getBoundingClientRect();
          xTo((e.clientX - rect.left - rect.width / 2) * 0.32);
          yTo((e.clientY - rect.top - rect.height / 2) * 0.32);
        };
        const onLeave = () => {
          xTo(0);
          yTo(0);
        };

        el.addEventListener("pointermove", onMove, { passive: true });
        el.addEventListener("pointerleave", onLeave, { passive: true });
        magneticCleanups.push(() => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerleave", onLeave);
        });
      });

      // Scroll HUD: the corner gear turns with overall page progress.
      const hud = document.querySelector<HTMLElement>("[data-hud-gear]");
      if (hud) {
        const setRotation = gsap.quickSetter(hud, "rotation", "deg");
        const st = ScrollTrigger.create({
          start: 0,
          end: () => ScrollTrigger.maxScroll(window),
          onUpdate: (self) => setRotation(self.progress * 720),
        });
        return () => st.kill();
      }
    });

    // Late layout shifts (fonts, images) move trigger positions.
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    ScrollTrigger.refresh();

    return () => {
      window.removeEventListener("load", refresh);
      magneticCleanups.forEach((fn) => fn());
      splits.forEach((s) => s.revert());
      mm.revert();
    };
  }, [pathname]);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
    </>
  );
}
