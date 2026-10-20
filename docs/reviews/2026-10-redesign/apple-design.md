# MECG clarity and restraint review

2026-10-16 · Independent AI design reviewer; no Apple affiliation.

## Direction

Make the next decision obvious, then support it with evidence. Apply Apple-inspired clarity, hierarchy, spacing, restraint, and explicit feedback within MECG’s **Precision Instrument** identity. Keep the navy/blue/orange roles, current type stack, numbered mono labels, square controls, hairlines, and factual caveats. No glass treatment, new palette, stock engineering imagery, or decorative motion is needed.

## Implement first

1. **Homepage: put proof before the organization’s story.** `src/app/(marketing)/home/page.tsx` currently follows hero/stats with “Welcome to MECG,” the president’s welcome, history, pillars, and community photos. This conflicts with `docs/DESIGN.md` and leaves client work absent from the homepage. Follow the documented sequence: hero → facts → named clients → approved selected work → engagement specification → people → verified alumni content if available → closing actions. Move the president’s message and expanded history to an appropriate team surface. Reuse approved public project data; where publication is pending, use the established status treatment. Company descriptions are not evidence of MECG’s results.

2. **Hero: separate identity, proposition, and action.** The full organization name is currently the largest element, above a long explanatory sentence. Keep the name identifiable, but give the concise statement of what MECG does the strongest reading position. Retain “Discuss a project” and the recruitment-driven student action. Keep essential text on a reliably dark field; inspect the photo crop and contrast at narrow widths before retaining a full-bleed image. A PwC visit photo is culture evidence, not a project deliverable. Do not imply otherwise.

3. **Navigation: remove duplication and clarify location.** `src/components/site-header.tsx` includes “Join Our Team” alongside the orange “Join MECG” action for signed-out visitors. Use one prominent student entry, retain access to all existing destinations, and place client services before team information. Keep member access visually secondary. Align header content to the marketing container instead of its separate `max-w-[90rem]` grid. Preserve the active underline; extend active matching to `/work/[slug]`. Raise `min-h-10` links to the documented 44px target floor. Prefer the existing hairline over the header’s broad shadow.

4. **Restore hierarchy through a shared rhythm.** Use `SectionLabel` for public sections; the homepage currently does not import it. Keep `MarketingSection`’s standard vertical spacing and use compact bands for metadata. Group heading and supporting copy tightly, with more separation between sections. Use one consistent content edge across hero, body, header, and footer. Avoid shrinking body copy to accommodate long institutional prose; shorten repetition while retaining facts and qualifications.

5. **Footer: make the ending a title block.** `src/components/site-footer.tsx` is currently three loose columns. Restore the documented hairline grid with organization, location, contact, and document metadata cells. Use only verified location information; a revision label must describe an actual revision, not suggest certification or fresh review. Keep email and social links readable, align navigation labels with the header, and provide 44px link targets. Stack cells in reading order on mobile. End the homepage with the two audience actions before this quieter utility area.

## Feedback and restraint

- Keep the mobile menu’s explicit Menu/Close text and `aria-expanded`. Add Escape dismissal, return focus to its trigger when dismissed from the keyboard, and clear open state on route changes. Keep a nonmodal disclosure unless an actual modal design is introduced.
- Reuse the existing 150ms control tokens, focus outlines, and reduced-motion rules. Avoid adding page entrances or looping decoration. Verify feedback rather than assuming a CSS declaration proves behavior.
- Replace the homepage community carousel with a small static selection and factual figure captions. The carousel conflicts with the documented prohibition on people carousels; its existing disabled controls and reduced-motion handling are useful behavior, but do not resolve that identity conflict. Never invent a date, location, or project context for a caption.

## Implementation acceptance checks

Inspect desktop and 375px-wide layouts, including long headings, wrapped email addresses, and the open mobile menu. Confirm visible focus, keyboard order, Escape behavior, nested-route selection, reduced motion, 44px targets, and no horizontal overflow. Check signed-out and signed-in navigation, recruitment-open/closed actions, and approved-project/empty-project states. Preserve server-rendered facts and publication restrictions.

## Evidence and limits

Source review: `docs/DESIGN.md`, homepage, marketing layout, header/footer, marketing section/heading/label components, carousel, globals, site content, and work page. Guidance: shared design routing, design-system-workflow and craft/review reference, Impeccable review guidance, and App Designer Pro’s preservation/platform caveats. Explicit scope prohibits subdelegation; this is a single-reviewer brief, not the skill’s dual-agent critique or a usability study.

No code changed. No live page or viewport was inspected: collaborative preview initialized to a blank tab, and no standard Next development port was found. The Impeccable context launcher returned permission denied; project context was read directly. No accessibility pass, measured contrast, task success, conversion impact, external design research, or Apple endorsement is claimed. Recommendations are source-based design judgments. Shared files may change during parallel work; confirm observations against the parent’s final revision.
