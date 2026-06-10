import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// SEC-3/SEC-32: service-role client. Server-only — import exclusively from
// Route Handlers / Server Components; the key must never reach a client bundle.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
