import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export function createAdminClient() {
  return createClient<Database, "rush">(
    process.env.NEXT_PUBLIC_MECG_SUPABASE_URL ?? requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    process.env.MECG_SUPABASE_SERVICE_ROLE_KEY ?? requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: "rush" },
    },
  );
}
