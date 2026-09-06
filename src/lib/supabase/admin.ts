import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv, requireSupabaseServiceRoleKey } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { fetchWithDeadline } from "@/lib/supabase/timeout";

export function createAdminClient() {
  const { url } = getSupabasePublicEnv();
  return createClient<Database, "rush">(url, requireSupabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "rush" },
    global: { fetch: fetchWithDeadline },
  });
}
