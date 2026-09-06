import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { fetchWithDeadline } from "@/lib/supabase/timeout";

export function createPublicClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createClient<Database, "rush">(url, anonKey, {
    db: { schema: "rush" },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchWithDeadline },
  });
}
