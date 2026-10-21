"use client";

import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

// Null until Clerk has a session: a request sent before then goes out as anon,
// and every rush RPC refuses anon, which would read as a lost sign-in.
export function useSupabase() {
  const { session } = useSession();
  const { url, anonKey } = getSupabasePublicEnv();
  return useMemo(() => session ? createClient<Database, "rush">(url, anonKey, {
    db: { schema: "rush" },
    accessToken: () => session.getToken(),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }) : null, [anonKey, session, url]);
}
