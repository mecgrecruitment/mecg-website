"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Motion attribute guide — when to use which:
 *
 * [data-reveal]         One-shot enter (fade/rise). Use on blocks, cards, copy.
 *                       Optional value "wipe" for a clip wipe. Skip on LCP/hero
 *                       text that is already above the fold (this provider
 *                       auto-skips above-fold targets so paint is not delayed).
 * [data-reveal-group]   Parent of staggered [data-reveal] children (55ms steps).
 * [data-split]          Alias of [data-reveal] for display headlines. Does NOT
 *                       split glyphs/lines — keep content SSR-visible; do not
 *                       expect SplitText masking.
 * [data-counter]        Numeric roll-up from 0 → parsed text (suffix kept).
 *                       Quantities only (e.g. "17+"); never years like "2023"
 *                       (toLocaleString would insert a comma).
 * [data-magnetic]       Fine-pointer CTA tug only. Never on touch targets as the
 *                       sole affordance; always pair with a real link/button.
 * [data-timeline]       Scroll-scrubbed vertical rail: needs track / marker /
 *                       node children. Static horizontal timelines omit this.
 * [data-hud-gear]       Fixed progress dial. Desktop-only in CSS; do not reuse
 *                       for content.
 *
 * Not implemented (do not add markup for these): [data-parallax].
 *
 * Global gates: prefers-reduced-motion disables all of the above. Magnetic and
 * the drafting cursor also require (pointer: fine). No-JS = static content.
 */

type Cleanup = () => void;

function observeOnce(
  targets: Element[],
  onEnter: (target: Element) => void,
  threshold = 0.12
): Cleanup {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        onEnter(entry.target);
      });
    },
    { threshold, rootMargin: "0px 0px -6%" }
  );
  targets.forEach((target) => observer.observe(target));
  return () => observer.disconnect();
}

/** True when the element is already in the first viewport (protect LCP paint). */
function isAboveFold(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
}

function reveal(element: HTMLElement, delay = 0) {
  const wipe = element.dataset.reveal === "wipe";
  // fill: "forwards" only — avoid fill:"both", which applies opacity:0 before
  // the first frame and can flash-hide above-fold copy after hydration.
  const animation = element.animate(
    wipe
      ? [
          { clipPath: "inset(0 0 100% 0)", opacity: 0.75 },
          { clipPath: "inset(0 0 0 0)", opacity: 1 },
        ]
      : [
          { transform: "translate3d(0, 24px, 0)", opacity: 0 },
          { transform: "translate3d(0, 0, 0)", opacity: 1 },
        ],
    {
      duration: wipe ? 800 : 620,
      delay,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    }
  );
  return () => animation.cancel();
}

export default function MotionProvider() {
  const pathname = usePathname();
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const finePointer = window.matchMedia("(pointer: fine)");
    const cleanups: Cleanup[] = [];
    const animated = new Set<HTMLElement>();

    document.querySelectorAll<HTMLElement>("[data-reveal-group]").forEach((group) => {
      const items = Array.from(group.querySelectorAll<HTMLElement>("[data-reveal]"));
      items.forEach((item) => animated.add(item));
      // Above-fold groups stay painted; stagger only kicks in on scroll-in.
      if (isAboveFold(group)) return;
      cleanups.push(
        observeOnce([group], () => {
          items.forEach((item, index) => cleanups.push(reveal(item, index * 55)));
        })
      );
    });

    const reveals = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal], [data-split]")
    ).filter((element) => !animated.has(element) && !isAboveFold(element));
    cleanups.push(
      observeOnce(reveals, (target) => {
        cleanups.push(reveal(target as HTMLElement));
      })
    );

    document.querySelectorAll<HTMLElement>("[data-counter]").forEach((element) => {
      const match = (element.textContent ?? "").trim().match(/^([\d,]+)(.*)$/);
      if (!match) return;
      const target = Number.parseInt(match[1].replaceAll(",", ""), 10);
      const suffix = match[2] ?? "";
      cleanups.push(
        observeOnce([element], () => {
          const started = performance.now();
          let frame = 0;
          const tick = (now: number) => {
            const progress = Math.min((now - started) / 1100, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            element.textContent = `${Math.round(target * eased).toLocaleString("en-US")}${suffix}`;
            if (progress < 1) frame = requestAnimationFrame(tick);
          };
          frame = requestAnimationFrame(tick);
          cleanups.push(() => cancelAnimationFrame(frame));
        })
      );
    });

    // Magnetic tug is desktop-pointer only — on touch it fights scroll/tap.
    if (finePointer.matches) {
      document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((element) => {
        const onMove = (event: PointerEvent) => {
          const rect = element.getBoundingClientRect();
          const x = (event.clientX - rect.left - rect.width / 2) * 0.22;
          const y = (event.clientY - rect.top - rect.height / 2) * 0.22;
          element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        };
        const onLeave = () => {
          element.style.transform = "translate3d(0, 0, 0)";
        };
        element.addEventListener("pointermove", onMove, { passive: true });
        element.addEventListener("pointerleave", onLeave, { passive: true });
        cleanups.push(() => {
          element.removeEventListener("pointermove", onMove);
          element.removeEventListener("pointerleave", onLeave);
          element.style.transform = "";
        });
      });
    }

    const timelines = Array.from(document.querySelectorAll<HTMLElement>("[data-timeline]"));
    // HUD is CSS-hidden on small viewports / reduced motion — skip work if absent.
    const hud = document.querySelector<HTMLElement>("[data-hud-gear]");
    const hudVisible =
      Boolean(hud) &&
      window.matchMedia("(min-width: 768px)").matches &&
      finePointer.matches;

    if (timelines.length > 0 || hudVisible) {
      let scrollFrame = 0;
      const updateScrollEffects = () => {
        scrollFrame = 0;
        const viewportCenter = window.innerHeight / 2;

        timelines.forEach((container) => {
          const track = container.querySelector<HTMLElement>("[data-timeline-track]");
          const marker = container.querySelector<HTMLElement>("[data-timeline-marker]");
          if (!track || !marker) return;
          const rect = container.getBoundingClientRect();
          const range = Math.max(rect.height, 1);
          const progress = Math.min(Math.max((viewportCenter - rect.top) / range, 0), 1);
          marker.style.transform = `translate3d(0, ${progress * Math.max(track.offsetHeight - marker.offsetHeight, 0)}px, 0)`;
          container.querySelectorAll<HTMLElement>("[data-timeline-node]").forEach((node) => {
            node.classList.toggle(
              "timeline-node--active",
              node.getBoundingClientRect().top <= viewportCenter
            );
          });
        });

        if (hud && hudVisible) {
          const maxScroll = Math.max(
            document.documentElement.scrollHeight - window.innerHeight,
            1
          );
          hud.style.transform = `rotate(${(window.scrollY / maxScroll) * 720}deg)`;
        }
      };
      const queueScrollEffects = () => {
        if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollEffects);
      };
      window.addEventListener("scroll", queueScrollEffects, { passive: true });
      window.addEventListener("resize", queueScrollEffects, { passive: true });
      queueScrollEffects();
      cleanups.push(() => {
        window.removeEventListener("scroll", queueScrollEffects);
        window.removeEventListener("resize", queueScrollEffects);
        cancelAnimationFrame(scrollFrame);
      });
    }

    return () => cleanups.splice(0).forEach((cleanup) => cleanup());
  }, [pathname]);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    const fine = window.matchMedia("(pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!dot || !ring || !fine.matches || reduced.matches) return;

    let frame = 0;
    let x = -100;
    let y = -100;
    const render = () => {
      frame = 0;
      const transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      dot.style.transform = transform;
      ring.style.transform = transform;
    };
    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(render);
    };
    const onOver = (event: PointerEvent) => {
      const target = event.target as Element | null;
      document.body.classList.toggle(
        "cursor-hot",
        Boolean(target?.closest("a, button, [data-magnetic], input, textarea, select, label"))
      );
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      cancelAnimationFrame(frame);
      document.body.classList.remove("cursor-hot");
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
    </>
  );
}
