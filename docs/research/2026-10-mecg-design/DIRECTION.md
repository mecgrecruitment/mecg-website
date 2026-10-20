# MECG design essence — open engineering studio

Status: research proposal, 17 October 2026. Subsequently carried into shared styles and representative pages after the user asked to continue; see [implementation and checks](IMPLEMENTATION.md). User decision: evolve existing blue and orange with a bolder personality. This is research and visual exploration, not approval to replace `docs/DESIGN.md` or a claim that production pages were redesigned in this round.

## Brief and current design

MECG is a student-led, pro bono consulting group at Michigan, open to all majors. Clients need to understand fit, scope, timing and the next contact step. Students need to understand the community, eligibility, preparation and current recruitment. Board and members need to complete real tasks without navigating a bulky interface.

The user rejected private pages as confusing, dated, bulky and unintuitive. The current public design emphasizes engineering documents, mono labels, hairlines, subdued paper and a mechanical illustration. The revised private layout improves geometry but still has limited visual character. Root inspected the running public homepage and repository photography; researchers inspected 13 accessible official peer/company homepages, plus supporting pages. PGN was unavailable and excluded from visual comparison.

Keep: MECG name and logo, recognizable blue/orange, real photography, all-major welcome, student-led/pro-bono truth, permission boundaries, blind review, draft/save/conflict/recovery semantics, practical client information. Do not replace real work with invented performance statistics or decorative dashboards.

Reconsider through this proposal: how much mono labeling and engineering-document ceremony the public site needs, public button geometry, tonal surfaces, image scale, exact blue values, and where blue/orange occupy larger areas. Existing design rules remain authoritative until this direction is selected and the canonical document is deliberately revised.

## Evidence and comparative position

Research is divided into [consulting clubs](consulting-clubs.md), [business fraternities](business-fraternities.md) and [companies](companies.md), with official links and saved browser evidence. These are design judgments, not organizational rankings. Public sites do not disclose private portal quality.

- MECC pairs saturated colour with substantial real-member photography. MECG's present opening is more restrained and technical; it could give people and colour equal confidence while keeping its own identity.
- APEX's services page organizes detailed case work and dated testimonials. MECG should match the specificity of proof when approved evidence exists, rather than match another club's claims.
- BOND's documentary people media and DSP/PCT's chapter photography make belonging tangible. MECG should show collaboration and friendship together with engineering/client work, without requiring text over a busy image.
- AKPsi's immersive blue/gold image gives it a strong identity moment. MECG can use a confident visual composition, grounded in its own palette and material.
- Nexecon and 180DC supply useful engagement details. Clear team, timing, communication and eligibility information is part of a good brand experience.
- IDEO is the conceptual reference for visible people and making; Stripe for expressive technical presentation; Linear for organizing current work; Apple for one focal subject; Airbnb for explicit, considerate task language.

MECG's opportunity is the combination: human belonging, engineering reasoning and inspectable work. This is a differentiation hypothesis from the sampled pages, not an assertion that no peer uses these elements.

## Essence

**MECG is an open engineering studio.** Different disciplines work together on real questions, then make the reasoning clear enough for someone else to act on.

Three qualities: capable, curious, welcoming. Visual shorthand: clear blue structure, warm orange moments, real people, readable evidence. A reader should understand the offer and see a useful next step before learning the visual metaphor.

The standard to match is coherence and craft: every colour has a role, every action has a clear result, each section has a focal point, and claims have evidence. Famous company imagery or elaborate motion cannot supply MECG's credibility.

## Three concepts on the same content

The [interactive exploration](explore.html) shows an identical public introduction and member task sample in each direction. Tasks are illustrative and the mockup controls are nonfunctional; only direction tabs operate.

1. **Open studio — place / blue public field and light workspace / grotesque / photography.** Blue public fields, cool-white working surfaces, orange public actions and real member imagery. Recommended foundation, borrowing Momentum's confident scale. Most balanced across clients, prospective members and everyday private work.
2. **Precision tool — object / dark / serif display plus sans UI / method diagram.** Deep blue working ground, ice-blue type, orange focal signal. Useful for an engineering story or supporting presentation. Not recommended as the default: risks repeating the distance and seriousness the user disliked.
3. **Momentum — media / orange colour field / heavy display / meaningful shapes.** Saturated orange, blue emphasis, typographic scale, stages represented as equal-size labeled shapes. Strongest for recruitment campaigns and event graphics. Borrow its confidence without filling dense forms with colour.

All three intentionally retain blue/orange under the user's explicit preference; the skill's default different-hue exploration is adapted to that decision. Typeface styles are browser-available exploratory stand-ins, not a final commissioned/bundled typography selection. No new logo is proposed. The existing engineering-document identity remains the historical comparison; this proposal changes the source metaphor, ground and richness emphasis. The recommended hybrid uses the light workspace with a saturated public field; alternatives vary the surface balance rather than substituting arbitrary new hues.

## Recommended colour roles

- Ink `#12213E`: primary reading, navigation and dark brand detail; softer than the current near-black navy without losing depth.
- Blue `#254F9F`: proposed deeper evolution of current `#3F63AF`; identity, selected navigation and primary workspace actions. Blue full-section grounds are reserved for public brand/campaign moments.
- Orange `#FE904D`: retain the existing recognizable orange. Public primary actions; private next-task marker. The private action button stays blue so the orange marker has one local role.
- Orange ink `#A83E0B`: retain existing accessible orange text treatment on light surfaces. Never use bright orange small text on white.
- Ground `#F5F8FD`; raised `#FFFFFF`; rule `#D8E1ED`; secondary ink `#52627C`: a cool family belonging to the blue.
- Focus: dark ink on pale surfaces; orange on dark navy; contrasting offset outline on blue. Validate against each actual adjacent surface in implementation.
- Success/error/warning remain separate labeled semantic states. Brand orange is not a universal status colour, and selection/progress cannot rely on colour alone.

Solid text combinations were [contrast checked](contrast.md). These are proposed roles, not a full production accessibility audit. Brand logo colors are not silently changed by this research.

## Type, spacing and geometry

Recommended type direction: a humanist sans with open apertures for everyday labels/body, and a more expressive weight/scale of the same family for public display. Source Sans 3 is a candidate to compare against the existing face during implementation; no additional font dependency is installed in this study. Avoid all-caps mono as ordinary workspace chrome. Mono remains useful for anonymous IDs, timestamps and quantitative data.

Working scale: 12 / 14 / 16 / 20 / 28 / 40 / 56px. Body 16px; dense UI 14px; 12px only for supporting metadata. Public display uses 40–56px responsively; mockup sizes are fitted to the chat presentation.

Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px. Within groups use 8–12; between groups 24–32; public sections 48–64. Containers stay aligned. Controls 8px radius, content objects 12px, circular portraits. Avoid turning every section into a card. Touch targets 44px; dense pointer-only layouts may use compact variants with adequate target spacing and keyboard focus. These are proposed design choices, not claims of a universal platform mandate.

## Richness, voice and motion

People and approved work are the main visual material. Use real faces at useful scale, natural colour, purposeful crops and captions describing actual context. The available chapter photo supports community, not evidence of client results. Asset gap: current photos are mostly social/formal; collect working-session photos and redacted approved project artifacts. Until those exist, use honest method diagrams or plainly described project questions. Do not manufacture deliverables or testimonials.

Voice: say what MECG does; give the practical next step; explain unfamiliar terms. Proposed headline: “Different minds. Real client work.” Supporting sentence states student-led, pro bono and University of Michigan. Client and student routes remain visible. Avoid “premier”, “world-class” or vague transformation claims.

Signature for later implementation: completing a task changes its visible state, acknowledges the save, and reveals the next useful task without reordering a row while someone types. 150–200ms state transition, immediate equivalent with reduced motion. This is a storyboarded behavior proposal, not implemented or tested by this identity study. Public process disclosure can reuse evidence-to-recommendation structure without decorative looping machinery.

## How to judge parity with strong clubs and companies

Use task completion and evidence, not a taste score: can a new client explain scope and contact MECG; can a student find eligibility and the current cycle; can a member resume the correct task; can a board member find attention items without losing context? Then inspect coherence of palette, typography, alignment, photo art direction and motion. Test narrow layouts, keyboard focus, contrast, long copy, loading/error/empty/conflict states and reduced motion during implementation. Current research inspected desktop benchmark openings, not their complete accessibility, mobile UX or private software.

## Verification and next implementation boundary

The exploration was rendered at 728px and 360px with no horizontal overflow in the default direction. Alternate direction renders and an independent review are recorded in REVIEW.md. No production UI, dependencies, application data or canonical design rules changed. Full usability, responsive production flows and motion behavior remain implementation work after direction selection.
