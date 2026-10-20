# Reference moves for the public site

Date: 2026-10-19. Source: six references the owner supplied (offersaccelerator,
Focaccia, Afterglow, Still, Night Shift, Lumo). Five match plates in Web
Designer Pro's kits (`poster-pages`, `aura-landing`, `dashboard`), which show
how they are built.

## What each reference does

| Ref | Ground | Type | The layering move | What makes it work |
|---|---|---|---|---|
| 01 offersaccelerator | full-bleed dusk photo | light serif, centred | text over a graded photo | one photo graded dark enough to carry white type |
| 02 Focaccia | one hot field (yellow) | condensed black grotesque, edge to edge | a photo card dropped onto the word, cutting a letter | live, specific data as the subhead ("Out at 7:40. 14 slices left."); a strip of small cards with real items |
| 03 Afterglow | white | condensed black, one word edge to edge | a square photo placed over one letter | a clean table of rows under the word, with the active row inverted |
| 04 Still | dark | quiet sans | a glass orb holding the live number | light lives inside objects; three lit cards with one reading each |
| 05 Night Shift | cobalt | wide red display set over a portrait | letters cross the face | one hot colour on one cool field; small edge labels like a magazine cover |
| 06 Lumo | soft light app | quiet sans | pastel metric cards fading to white | one number and one drawing per card |

**What they share:**
- A display face with a voice, set at 150–250px.
- About 20:1 scale contrast between display type and labels.
- One hot colour on a calm field.
- An image or object locked into the type, not placed beside it.
- Real, specific data in the copy.

## What MECG is missing against them

1. **A display face.** The system stack (Avenir, Segoe, Helvetica, Arial)
   renders as Arial or Liberation Sans on most machines. It cannot produce
   a condensed or wide poster word. Every poster reference depends on one.
2. **Scale.** The largest type is 84px against 13px labels, about 6:1.
3. **The hot colour in an object.** Orange appears only on buttons. Blue on
   orange is MECG's own Night Shift pairing: cobalt field and hot
   orange-red type. It is already the brand.
4. **Locked type and image.** The home card crosses the photo, but the
   headline and the photo still sit side by side.

## Moves to use, mapped to MECG

- **Home (Night Shift + Focaccia).**
  - A blue field with "Pro bono" set edge to edge in orange Archivo, as
    part of the real h1.
  - The PwC photo dropped onto the word so it cuts the letters.
  - The rest of the h1 and the actions set below.
  - The client logo strip at the foot of the screen, used the way
    Focaccia uses its item strip.
- **Team (Night Shift).** A giant "Our Team" word on the blue band, with
  the board portraits crossing in front of the lower half of the letters.
- **Work (Afterglow).** One word edge to edge ("Clients") with a client
  logo tile dropped onto it, over the existing grid.
- **Join (Focaccia).** A giant "Join" with live, specific copy from the
  recruitment cycle (the status line and countdown that already exist).
- **Lit objects (Still and Lumo).** Already in use as `.public-lit` cards.
  Keep them as they are.

## What not to use

- **Generated portraits or cut-outs of members.** These are real people, and
  background removal is not available on this machine.
- **Grain or filters on members' photos.** These are real people, so that
  needs the owner's say.
- **The references' compositions, names or copy.** Only their techniques
  are used.

## Type decision

**Archivo** (SIL OFL 1.1, Omnibus-Type), self-hosted, latin subset, about
90KB with width (62–125) and weight (100–900) axes. It is used only for
display moments on public pages. Body text stays on the system stack.

**Why this face:** it is a grotesque with an engineered, signage
construction. That suits an engineering consulting group, and one file gives
both a compressed poster word and a wide label voice. This changes the
DESIGN.md rule "No new font download", and the change is reversible by
deleting the font and the `--font-display` variable.
