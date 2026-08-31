import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createBrowserClient<Database, "rush">(url, anonKey, {
    db: { schema: "rush" },
  });
}
