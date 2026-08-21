import { createBrowserClient } from "@supabase/ssr";
import { requireEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export function createClient() {
  return createBrowserClient<Database, "rush">(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { db: { schema: "rush" } },
  );
}
