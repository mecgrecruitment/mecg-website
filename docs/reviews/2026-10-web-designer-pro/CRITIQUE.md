# Critique rounds

One critic subagent scored all four rounds against Web Designer Pro's
`critique.md` rubric, plus line 16 (Fidelity) for a redesign. The critic saw
only the rendered PNGs and the brief.

## Scores

| # | Line | R1 | R2 | R3 | R4 |
|---|---|---|---|---|---|
| 1 | Concept on the page | 3 | 4 | 4 | 4 |
| 2 | Not the category average | 3 | 3 | 3 | 3 |
| 3 | Not a slop face or rut | 3 | 3 | 3 | 3 |
| 4 | First screen | 3 | 3 | 3 | 4 |
| 5 | Typography | 3 | 3 | 4 | 4 |
| 6 | Colour | 3 | 4 | 4 | 4 |
| 7 | Imagery | 3 | 3 | 3 | 4 |
| 8 | Depth and finish | 3 | 3 | 4 | 4 |
| 9 | Below the first screen | 2 | 3 | 4 | 4 |
| 10 | Craft | 3 | 3 | 3 | 3 |
| 11 | Responsive | 3 | 4 | 4 | 4 |
| 12 | Everyone's computer | 4 | 4 | 4 | 4 |
| 13 | Signature | 3 | 3 | 4 | 5 |
| 14 | Copy and conversion | 3 | 4 | 4 | 4 |
| 15 | Screenshot test | 2 | 3 | 3 | 4 |
| 16 | Fidelity | 4 | 4 | 5 | 5 |

**Stop rule after round 4:** not done, by one line. No line is below 3, and
12 of 15 lines score 4 or more. Line 10 (Craft) stayed at 3 because the LSX
logo overlapped its label in the `/work` logo grid at 390px. The critic
said that fixing that collision meets the rule. The four-round budget was
spent, so the fixes below are recorded as made after the last round and
were not rescored.

## Fixed after the last round (not rescored)

Each fix was verified with `shoot.mjs`, `matrix.mjs` and by eye.

1. **`/work` logo labels on phones.** The labels are now in normal flow
   under a fixed-height logo, so there is no overlap at 320 or 390, and no
   scan FAIL.
2. **`/work` hero card label.** "Every project starts here" is now "Start
   with your question".
3. **`/contact` at 1440×900.** The gap above the form is smaller, so "Send
   message" is fully in view.
4. **`/contact` fields.** The fill is the cool ground tint instead of a
   neutral grey.
5. **`/work` question rows on phones.** There is now space between each
   description and its "Example question" label.

## Declined asks, with reasons

- **Deleting the home stats strip.** DESIGN.md requires "numbers over
  adjectives", and the smoke test pins those figures.
- **Deleting the mono footer row.** It is the recorded title-block
  signature.
- **Renaming the contact "Subject" field and the "Contact Us" / "Join Our
  Team" titles.** Tests and navigation pin those names.
- **A 112–120px home headline.** It strands "consulting," on a line of its
  own. The headline is 84px instead.
- **Folding the join preparation section into the FAQ.** A test pins
  "Have your materials ready", and students look for it directly.
- **White-balance correction of members' flash photos.** These are real
  people, so they need the owner's permission. They were re-cropped
  instead.
- **Overlapping the `/work` hero card onto its headline.** Text over text
  is a scan FAIL. The card crosses the section edge instead. The scanner's
  split-hero warning stays because it only checks image-versus-headline
  overlap.
- **Board headshots under "Who reads your message".** Which board members
  read the inbox is not verified.
- **Concentric radii on buttons inside cards.** DESIGN.md fixes controls
  at 8px.

## Remaining warnings, answered

- **`/work` matrix l10n FAIL.** A pseudo-localized client name wraps. Client
  names are proper nouns and are not translated.
- **`/contact` "no action in the first screen".** The scan counts only
  buttons. The form fields and the "Or email mecg-board@umich.edu" link are
  in view at 390, 1280 and 1440.
- **Windows and Mac matrix passes report buttons wrapping from 1 to 2
  lines.** Those passes render a serif stand-in font, because this Linux
  machine has neither Segoe UI nor Avenir. The renders show no wrapping,
  and public buttons are `white-space: nowrap`.
- **Remaining defect the critic noted.** The empty paper above the `/work`
  hero card at 1440.

## Not verified

- No real Windows, macOS, iOS or Android devices. The fonts were stand-ins.
- No WebKit or Safari run. The cross-browser Playwright project was not run.
- No screen reader pass.
- No performance measurement.
- `/join` with live recruitment data. Local runs use a placeholder backend,
  so only the outage state was rendered.
