"use client";

import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export function useSupabase() {
  const { session } = useSession();
  const { url, anonKey } = getSupabasePublicEnv();
  return useMemo(() => createClient<Database, "rush">(url, anonKey, {
    db: { schema: "rush" },
    accessToken: () => session?.getToken() ?? Promise.resolve(null),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }), [anonKey, session, url]);
}
