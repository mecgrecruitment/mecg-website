# Public navigation and forms accessibility audit

Date: 2026-10-16. Independent AI specialist code review; not a user study.
Scope: public header/footer, contact/interest forms, signup/login/recovery and application form.
Method: read-only source inspection against `docs/DESIGN.md`; only this report written.
No browser, keyboard session, screen reader, network submission or external account action performed.
Line references describe the inspected snapshot; concurrent implementations may move them.

## Top 3 confirmed source defects

1. **P2 — Signup stage replacement has no focus handoff.**
   `src/app/apply/applicant-signup-form.tsx:99` switches to verification; `:159–174` replaces the details form with the code form.
   The component uses no focus ref/effect; changing details (`:151–156`) also replaces the focused control without restoring focus.
   Keyboard users lack a deliberate starting point after either transition; exact browser fallback remains untested.
   Fix: focus the code input or a new step heading after verification appears, and the name field after returning.
   Verify: submit details by keyboard, then change details; focus must land in the newly relevant step.

2. **P2 — Field-specific signup/recovery errors are detached from their controls.**
   Signup code failures are set at `src/app/apply/applicant-signup-form.tsx:120–126`, but the code field (`:162`) has neither error association nor invalid state.
   Signup detail fields (`:180–184`), recovery email (`src/app/forgot-password/forgot-password-form.tsx:28,42–44`) and reset password (`src/app/reset-password/reset-password-form.tsx:32–34,49–50`) follow the same pattern.
   Alerts announce errors, but revisiting the affected input does not expose its error or invalid state programmatically.
   Fix: pass field errors through `FormField.error`, or supply stable `aria-describedby` and `aria-invalid` for known field failures; keep network/rate-limit errors global.
   The shared helper already supports these relationships (`src/components/form-field.tsx:9–24`).
   Verify: reject a verification code/password, refocus that input, and confirm its error is available with its label.

3. **P2 — Header/footer links miss MECG's explicit 44px target floor.**
   Desktop navigation/auth links use `min-h-10` (40px) at `src/components/site-header.tsx:86,91`.
   Footer navigation/email/social links use the same 40px minimum at `src/components/site-footer.tsx:27,33–35`.
   These targets fall below `docs/DESIGN.md` §2's ≥44px requirement, reducing pointer/motor accessibility.
   Fix: use a 44px minimum and retain adequate spacing; logo and mobile menu button already use `min-h-11`.
   This is a project-standard defect, not by itself proof of failing WCAG 2.2's 24px AA target-size criterion.

## Hypotheses / verification required

- **Mobile disclosure dismissal:** `src/components/site-header.tsx:94–121` exposes expanded state and native links, but has no Escape handler or focus return when a menu link unmounts. Test keyboard navigation and route-change focus before classifying impact. This is an inline disclosure; a modal focus trap is not inherently required.
- **Pending announcements:** contact clears the live message at submit (`src/app/(marketing)/contact/contact-form.tsx:16–17`) and only changes the disabled button text (`:51–52`); interest does likewise (`src/app/(marketing)/join/interest-form.tsx:109–114`). Test whether “Sending/Saving” is announced; consider persistent status text and `aria-busy` if it is missed.
- **Live-region mounting:** `src/components/operation-notice.tsx:10,19–22` mounts populated status regions conditionally. Test polite success/info announcements with supported screen readers; prefer an existing empty live region if updates are missed.
- **Sticky focus visibility:** header is sticky (`src/components/site-header.tsx:75`); global scroll padding exists (`src/app/globals.css:59`). Test reverse tabbing, expanded mobile navigation and zoom for focus obscuration; source alone does not prove it.

## Confirmed protections to retain

- Banner/contentinfo and named navigation landmarks: `src/components/site-header.tsx:75,80,105`; `src/components/site-footer.tsx:13,25`.
- Skip link: `src/app/(marketing)/layout.tsx:7–12`; its `main-content` target exists on home, team, work, work detail, join and contact pages.
- Keyboard-native menu button with `aria-expanded`/`aria-controls`; hidden desktop/mobile variants use responsive display classes (`src/components/site-header.tsx:80,94–105`).
- Global focus outlines and navy-surface orange override: `src/app/globals.css:90–102`; fields have additional focus styles.
- Contact controls have explicit labels; interest controls have wrapping labels; both expose success/error status roles (`src/app/(marketing)/contact/contact-form.tsx:42–52`; `src/app/(marketing)/join/interest-form.tsx:51–114`).
- Application validates and focuses fields/step heading (`src/app/apply/application-form.tsx:278–282,361`), associates response guidance/errors (`:519–528`), and announces uploads/submission (`:536,553`).
- Footer external social links announce new-tab behavior (`src/components/site-footer.tsx:34–35`).
