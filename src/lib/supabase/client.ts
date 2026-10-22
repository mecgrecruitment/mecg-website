"use client";

import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

// Null until Clerk has a session: a request sent before then goes out as anon,
// and every rush RPC refuses anon, which would read as a lost sign-in.
function useClerkSupabase() {
  const { session } = useSession();
  const { url, anonKey } = getSupabasePublicEnv();
  return useMemo(() => session ? createClient<Database, "rush">(url, anonKey, {
    db: { schema: "rush" },
    accessToken: () => session.getToken(),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }) : null, [anonKey, session, url]);
}

// The root layout renders no ClerkProvider without a publishable key, and useSession throws outside one.
// The key is inlined at build time, so the choice never changes between renders.
export const useSupabase = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ? useClerkSupabase : () => null;
