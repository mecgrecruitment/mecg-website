# Separate current-tree account provisioning source QA

Coordinator QA, not a V1 panel vote. Inspected account-provisioning.tsx hook/recovery links, PeopleWorkspace tabs, account form callers in rush-controls.tsx, and ADD_USER/ADD_EXISTING_USER route branches.

No actionable defect found in the targeted receipt/unknown-handling changes by source inspection. The shared hook prevents synchronous double dispatch, bounds headers/body consumption, requires a nonblank returned ID before reset, and retains entered details on unknown outcomes. Both forms disable their fieldsets during the write. Recovery links open separately and preserve the current form; copy explicitly warns to check existing account/membership even without an incident. PeopleWorkspace keeps panels mounted while hiding inactive views, preserving entered access details across keyboard-operated tabs. Tabs expose selected state, controls/label relations, roving focus and arrow/Home/End navigation.

Both API branches require a nonblank membership grant ID before normal success. Transport/unknown identity or membership outcomes retain partial state for reconciliation, and existing identity access is not broadly deleted as compensation. Uncertain Clerk creation records a recoverable incident; definitive creation rejection offers the existing-account route. Recovery UI avoids asserting that an unconfirmed setup failed.

Limits: source review only. Did not reproduce the reported 40 browser/31 API checks, real Clerk/Supabase operations, tab reload persistence or screen-reader interaction. Mounted-panel preservation does not promise persistence across reload or navigation. No whole-site/world-class endorsement follows, and frozen V1 votes are unchanged.
