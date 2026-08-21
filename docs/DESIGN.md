# MECG Design Philosophy

The single sentence: **a student consulting group that presents like a professional firm, with one engineering-native signature (the particle gears) and zero decoration beyond it.**

Reference set studied: Apex Consulting (Michigan), 180 Degrees Consulting, UMich Solar Car, Instrument, IDEO, Linear, Stripe. The traits below are the ones that consistently separated professional sites from student-made ones.

## 1. Principles

1. **Neutrals everywhere, orange as the only accent.** Near-black (`--foreground` / navy `#070d1f`) text on white. `mecg-orange #fe904d` appears only on CTAs, active states, and the gear scene. `mecg-blue #3f63af` is for headings and the logo, never for large fills. `mecg-sky #90b7fc` only as sub-10% opacity tints and in the particle scene. Using the whole palette on everything is the #1 student-site tell.
2. **Numbers over adjectives.** Every credibility claim is a specific figure ("40+ members, 25+ projects") or a named client. No "passionate", no "excellence", no "Welcome to".
3. **Declarative one-line hero.** "Engineering ideas into impact." already fits. Keep copy verb-led (Stripe/Linear style: "Turn", "Build", "Deliver").
4. **Proof before people.** Section order: hero, stats, projects/case studies, clients/testimonials, team, dual CTA, footer. Apex leads with its presidents; Instrument and IDEO lead with work. Lead with work.
5. **Two audiences, one CTA each.** "Work With Us" (clients) and "Rush MECG" (students). Never more than these two actions on screen.
6. **Case study card formula.** Image or CAD screenshot + client name + one problem/result line + link. Three real projects in this format beat ten described in prose. (IDEO's pattern.)
7. **Animation moves content, not decoration.** The gear scene is the one flourish. Everything else: opacity/position reveals on scroll (`whileInView`), nothing that loops. Never animate stat counters from 0 (Apex renders "0" before JS loads); render real numbers, animate only their entrance.
8. **Real artifacts, never stock.** Project photos, CAD screenshots, prototypes, the headshots we have. The particle gears count as a real artifact; a stock handshake photo would undo them.
9. **One typeface, big scale jumps.** Geist Sans only for prose. Hero ~64-80px, section headings ~36-40px, body 16-18px, heavy weight contrast. Geist Mono (already loaded, currently unused) gets a job: section numbers, stat labels, technical badges.
10. **Engineering-native structure as identity.** Numbered sections ("01 About", "02 Projects"), spec-sheet style stats, mono labels. This is what differentiates a *mechanical engineering* consulting group from business clubs like Apex, and it costs nothing. (Linear's numbered-document homepage is the model.)

## 2. Tokens (current, keep)

| Token | Value | Role |
|---|---|---|
| `mecg-navy` | `#070d1f` | Primary text, dark surfaces |
| `mecg-blue` | `#3f63af` | Headings, logo |
| `mecg-sky` | `#90b7fc` | Tints (max 10% opacity), particles |
| `mecg-orange` | `#fe904d` | CTAs, accents, particles. The only accent. |

Rules: orange CTAs are always `bg-mecg-orange text-white` (currently inconsistent between splash and home). Containers `max-w-6xl px-6`, sections `py-24`, pills `rounded-full`, cards `rounded-2xl`. Light theme only; delete the dark-mode variables.

## 3. Homepage section order (target)

1. Splash `/` — particle gears + one-line hero + Enter (exists, keep)
2. `/home` hero — declarative line + dual CTA (Work With Us / Rush MECG)
3. Stats band — mono-labeled, spec-sheet style
4. Projects — 3+ case study cards (missing entirely; we claim 25+ projects and show none)
5. Clients / testimonials — logo row + one attributed quote (180DC pattern)
6. Team — headshots **with full names and roles** (currently first names, no roles)
7. Rush — timeline/FAQ, links to `/apply` (link currently missing; the conversion path is broken)
8. Footer — real contact email + socials (currently just "University of Michigan"), no Admin link

## 4. Known fixes (from audit)

- [ ] Orange CTA text color mismatch (splash `text-white` vs home `text-mecg-navy`)
- [ ] `/apply` is off-brand (slate/gray generic Tailwind, no logo/nav); restyle with brand tokens
- [ ] Rush section and nav pill must link to `/apply`
- [ ] Hero and About paragraphs are duplicated verbatim
- [ ] Team grid: add roles + last names, normalize headshot crops
- [ ] Remove Admin from public nav/footer
- [ ] Delete Next.js starter SVGs and dead dark-mode CSS
- [ ] Wire the brand favicon from the logo kit

## 5. Toolbox (all free; add only when a section needs it)

- **motion (framer-motion)**, MIT — all DOM reveals and micro-interactions (`whileInView`)
- **GSAP + ScrollTrigger**, free since 2025 (incl. SplitText) — only if we add scroll-pinned choreography
- **lenis**, MIT — smooth scroll, pairs with ScrollTrigger; skip until scroll choreography exists
- **@react-three/drei**, MIT — `Environment preset="warehouse"` + `metalness 1 / roughness 0.25` is the whole metallic-gear trick if we ever move from particles to meshes; `ContactShadows`, `Float`
- **@react-three/postprocessing**, MIT — Bloom + Vignette for the cheap expensive look
- **shadcn/ui**, MIT — forms/dialogs base; **Magic UI**, MIT — marquee (client logos), bento, number ticker; **Aceternity UI** — free tier only, one hero effect max

Stealable reference code:
- [basementstudio/scrollytelling](https://github.com/basementstudio/scrollytelling) (MIT) — pinned-section scrollytelling pattern
- [brunosimon/folio-2025](https://github.com/brunosimon/folio-2025) (MIT) — scene structure, camera choreography; steal techniques, not the look
- [wass08 r3f scroll tutorials](https://github.com/wass08/r3f-scrolling-animation-tutorial) (MIT) — scroll-driven R3F wiring
- [Codrops dissolve effect](https://tympanus.net/codrops/2025/02/17/implementing-a-dissolve-effect-with-shaders-and-particles-in-three-js/) + [emissive-dissolve-effect](https://github.com/JatinChopra/emissive-dissolve-effect) — upgrade path for the gear explode
- Gear physics, if meshes ever replace particles: `gearB.rotation = -gearA.rotation * (teethA/teethB)`; that ratio is what makes it feel mechanical
- [gsimone/awesome-react-three-fiber](https://github.com/gsimone/awesome-react-three-fiber) — index for further R3F tricks

## 6. Anti-patterns (never)

- "Welcome to…" copy, presidents' letter on the homepage
- Stat counters animating from 0
- More than one accent color per view
- Stock photography
- Carousels of people
- Decorative animation that loops forever
