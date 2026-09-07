import "server-only";

import { cache } from "react";
import { screeningRpc, type WorkspaceContext } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

// React cache shares this result only within one server render. It prevents the
// page and WorkspaceNav from independently loading the same cycle snapshot,
// without allowing one member's context to survive into another request.
export const loadWorkspaceContext = cache(async (cycleId: string) => {
  const supabase = await createClient();
  return screeningRpc<WorkspaceContext>(supabase, "workspace_context", {
    target_cycle_id: cycleId,
  });
});
