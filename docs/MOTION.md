# Motion attributes (external site)

Canonical guide lives at the top of `app/(external)/components/MotionProvider.tsx`.
Summary for authors:

| Attribute | Use for | Avoid |
|---|---|---|
| `data-reveal` | One-shot enter on scrolled-in blocks | Hero/LCP copy already above the fold (auto-skipped) |
| `data-reveal="wipe"` | Clip wipe on a single panel | Large text blocks |
| `data-reveal-group` | Stagger children that each have `data-reveal` | Nesting groups inside groups |
| `data-split` | Display headlines (reveal alias only) | Expecting glyph/line SplitText |
| `data-counter` | Quantity roll-ups (`17+`) | Years / IDs (`2023` → `2,023`) |
| `data-magnetic` | Fine-pointer CTA polish | Touch-only affordances |
| `data-timeline` (+ track/marker/node) | Vertical scroll-scrubbed rail | Horizontal static timelines |
| `data-hud-gear` | Fixed progress dial (one per layout) | Content UI |

Not implemented: `data-parallax` — do not add markup for it.

Gates: `prefers-reduced-motion: reduce` disables all JS motion. Magnetic + drafting cursor + HUD also require `(pointer: fine)` / desktop width.
