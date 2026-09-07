import "server-only";

import { cache } from "react";
import { screeningRpc, type WorkspaceContext } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

// React cache shares this result only within one server render. It prevents the
// page and WorkspaceNav from independently loading the same cycle snapshot,
// without allowing one member's context to survive into another request.
export const loadWorkspaceContext = cache(async (cycleId: string) => {
  const supabase = await createClient();
  const context = await screeningRpc<WorkspaceContext>(supabase, "workspace_context", {
    target_cycle_id: cycleId,
  });
  if (context.error?.code !== "PGRST202") return context;

  // Keep the existing member workspace available while an application deploy
  // is briefly ahead of its database migration. The previous RPC preserves the
  // important screening isolation rule; new task shortcuts remain hidden until
  // the canonical context RPC exists.
  const screeningReviewer = await screeningRpc<boolean>(
    supabase,
    "is_active_screening_reviewer",
    { target_cycle_id: cycleId },
  );
  if (screeningReviewer.error) return { data: null, error: screeningReviewer.error };

  return {
    data: {
      cycleId,
      isScreeningReviewer: screeningReviewer.data ?? false,
      openScreeningCount: 0,
      openEvaluationCount: 0,
      openCalibrationCount: 0,
      openLiveEventCount: 0,
      openTaskCount: 0,
      hasGradingEvent: false,
      hasSpeedDatingRound: false,
      hasGroupCaseWork: false,
    },
    error: null,
  };
});
