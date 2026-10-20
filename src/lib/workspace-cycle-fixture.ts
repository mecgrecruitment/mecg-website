import type { CurrentUser } from "./auth";

// Synthetic routing fixture. Production's one-unfinished-cycle constraint is
// unchanged; live+draft coexistence here deliberately stresses URL selection.
export const workspaceCycleFixture: CurrentUser = {
  id: "synthetic-owner", name: "Synthetic Owner", email: "owner@example.invalid", active: true,
  memberships: [
    { id: "membership-live", cycleId: "live-cycle", role: "OWNER", active: true, cycle: { id: "live-cycle", name: "Current cohort", status: "IN_PROCESS", hash_stage: null, createdAt: new Date("2026-09-01") } },
    { id: "membership-draft", cycleId: "draft-cycle", role: "OWNER", active: true, cycle: { id: "draft-cycle", name: "Next cohort draft", status: "DRAFT", hash_stage: null, createdAt: new Date("2026-10-16") } },
    { id: "membership-old", cycleId: "old-cycle", role: "OWNER", active: true, cycle: { id: "old-cycle", name: "Previous cohort", status: "CLOSED", hash_stage: null, createdAt: new Date("2026-01-01") } },
  ],
};
