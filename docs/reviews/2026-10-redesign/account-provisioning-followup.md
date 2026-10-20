# Account provisioning follow-up

The later working tree addresses panel seats 091–097. V1 votes remain immutable and assess the older snapshot.

Both new-account and existing-account flows now require a nonempty membership ID before returning a success receipt. Identity and membership writes with missing or failed acknowledgements record a restricted reconciliation incident when possible, preserve accounts and access, and return uncertainty guidance. No destructive compensation or automatic replay was added.

The actual People controls bound the complete request and JSON body wait to fifteen seconds. Lost, stalled or malformed success responses preserve the entered form and explain that the account or membership may exist. Links open Clerk, this cycle's People roster and account recovery in separate tabs. A successfully committed request with a lost response may have no incident; the UI says so. A valid receipt alone clears the form and announces success. Pending fields are disabled.

People tabs now have associated panels, roving keyboard focus and Arrow/Home/End navigation. Both panels stay mounted, preserving account details and in-flight work when the owner changes views. Select labels are explicitly associated with controls.

Verification: 40/40 focused browser checks passed across desktop Chromium, mobile Chromium, Firefox, WebKit and mobile WebKit. They exercise the real PeopleControls component with synthetic intercepted responses: both account actions × lost/malformed/stalled responses, keyboard navigation and form retention, and confirmed success. Thirty-one API tests passed, including uncertain identity/grant writes, incident-store failure and missing membership acknowledgements. Logs are in `evidence/account-provisioning-browser.log` and `evidence/account-provisioning-node.log`.

An earlier cross-browser run exposed horizontal overflow in the test fixture. Inspection found the fixture omitted the real page's width-bearing workspace-stack parent. The fixture now matches that parent; the mobile capture measured a 390px document in a 390px viewport with no overflowing elements. Earlier failure logs remain available; overflow was not hidden to pass the assertion.

These are local browser and mocked-provider route checks. Hosted Clerk/Supabase integration, delayed actual provider reconciliation and an authenticated owner's complete recovery journey remain unverified. Authorized cohort navigation is a separate follow-up; see its receipt when available.
