"use client";

import { useEffect } from "react";

type Motion = { focus: number; x: number; y: number; lens: number; mx: number; my: number };

const clamp = (value: number, min = -1, max = 1) => Math.min(max, Math.max(min, value));

// Drives the home hero through CSS variables on the section: scrolling pulls the photo into focus and spreads the letters,
// the pointer moves a sharp lens and tilts the letters, each letter fills with the photo on hover, and the stats count up once.
export default function HomeHeroMotion() {
  useEffect(() => {
    const hero = document.getElementById("home-title")?.closest("section");
    const sharp = hero?.querySelector<HTMLImageElement>(".home-photo-sharp");
    if (!hero || !sharp) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const target: Motion = { focus: 0, x: 0, y: 0, lens: 0, mx: 0, my: 0 };
    const now: Motion = { ...target };
    let frame = 0;

    const tick = () => {
      let moving = false;
      for (const key of Object.keys(target) as (keyof Motion)[]) {
        const gap = target[key] - now[key];
        now[key] = still || Math.abs(gap) < 0.002 ? target[key] : now[key] + gap * 0.14;
        if (now[key] !== target[key]) moving = true;
      }
      hero.style.setProperty("--focus", now.focus.toFixed(3));
      hero.style.setProperty("--x", now.x.toFixed(3));
      hero.style.setProperty("--y", now.y.toFixed(3));
      hero.style.setProperty("--lens", now.lens.toFixed(3));
      hero.style.setProperty("--mx", `${now.mx.toFixed(1)}px`);
      hero.style.setProperty("--my", `${now.my.toFixed(1)}px`);
      frame = moving ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => { if (!frame) frame = requestAnimationFrame(tick); };

    const onScroll = () => {
      target.focus = clamp(window.scrollY / (hero.offsetHeight * 0.5), 0, 1);
      kick();
    };
    const onPointerMove = (event: PointerEvent) => {
      const box = hero.getBoundingClientRect();
      target.mx = event.clientX - box.left;
      target.my = event.clientY - box.top;
      if (target.lens === 0) { now.mx = target.mx; now.my = target.my; }
      target.lens = 1;
      if (!still) { target.x = clamp((target.mx / box.width) * 2 - 1); target.y = clamp((target.my / box.height) * 2 - 1); }
      kick();
    };
    const onPointerLeave = () => { target.lens = 0; target.x = 0; target.y = 0; kick(); };
    const onTilt = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      target.x = clamp(event.gamma / 30);
      target.y = clamp((event.beta - 45) / 30);
      kick();
    };

    // Each letter shows the sharp photo through its glyph, aligned with the photo behind it.
    const letters = [...hero.querySelectorAll<HTMLElement>(".home-letter")];
    const placeLetters = () => {
      const source = sharp.currentSrc;
      if (!source || !sharp.naturalWidth) return;
      const box = hero.getBoundingClientRect();
      // Mirror the photo's object-fit: cover at 50% 45%, then its scale(1.06) about the centre.
      const cover = Math.max(box.width / sharp.naturalWidth, box.height / sharp.naturalHeight);
      const width = sharp.naturalWidth * cover * 1.06;
      const height = sharp.naturalHeight * cover * 1.06;
      const left = box.width / 2 + ((box.width - sharp.naturalWidth * cover) * 0.5 - box.width / 2) * 1.06;
      const top = box.height / 2 + ((box.height - sharp.naturalHeight * cover) * 0.45 - box.height / 2) * 1.06;
      hero.style.setProperty("--letter-photo", `url("${source}")`);
      for (const letter of letters) {
        const own = letter.getBoundingClientRect();
        letter.style.setProperty("--photo-size", `${width}px ${height}px`);
        letter.style.setProperty("--photo-at", `${left - (own.left - box.left)}px ${top - (own.top - box.top)}px`);
      }
      hero.classList.add("has-photo-letters");
    };
    const resize = new ResizeObserver(placeLetters);
    if (finePointer) {
      resize.observe(hero);
      sharp.addEventListener("load", placeLetters);
      if (sharp.complete) placeLetters();
      hero.addEventListener("pointermove", onPointerMove);
      hero.addEventListener("pointerleave", onPointerLeave);
    }
    if (!still) {
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      if (!finePointer) window.addEventListener("deviceorientation", onTilt);
    }

    // Count the numeric stats up as they first enter the screen. Until then they keep the server-rendered value.
    const counters = still ? [] : [...hero.querySelectorAll<HTMLElement>(".home-facts dd")].flatMap(element => {
      const match = element.textContent?.match(/^(\d+)(.*)$/);
      if (!match) return [];
      const end = Number(match[1]);
      return [{ element, end, start: end >= 1000 ? end - 20 : 0, suffix: match[2], text: element.textContent ?? "" }];
    });
    const timers: number[] = [];
    const seen = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const counter = counters.find(item => item.element === entry.target);
        if (!entry.isIntersecting || !counter) continue;
        seen.unobserve(entry.target);
        counter.element.textContent = `${counter.start}${counter.suffix}`;
        const began = performance.now();
        const step = (time: number) => {
          const progress = Math.min(1, (time - began) / 1100);
          const eased = 1 - (1 - progress) ** 3;
          counter.element.textContent = `${Math.round(counter.start + (counter.end - counter.start) * eased)}${counter.suffix}`;
          if (progress < 1) timers.push(requestAnimationFrame(step));
        };
        timers.push(requestAnimationFrame(step));
      }
    });
    for (const counter of counters) seen.observe(counter.element);

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(cancelAnimationFrame);
      seen.disconnect();
      resize.disconnect();
      for (const counter of counters) counter.element.textContent = counter.text;
      sharp.removeEventListener("load", placeLetters);
      hero.removeEventListener("pointermove", onPointerMove);
      hero.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("deviceorientation", onTilt);
    };
  }, []);
  return null;
}
