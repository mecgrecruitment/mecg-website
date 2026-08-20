import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { requireEnv } from "@/lib/env";

// SEC-3/SEC-32: service-role client. Server-only — import exclusively from
// Route Handlers / Server Actions; the key must never reach a client bundle.
export function createAdminClient() {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
