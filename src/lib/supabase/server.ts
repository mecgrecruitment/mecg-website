import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv, hasClerkConfiguration } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";
import { fetchWithDeadline } from "@/lib/supabase/timeout";

export async function createClient() {
  // Without Clerk configured, proxy() runs handleUnconfiguredProxy and never
  // reaches clerkMiddleware, so auth() throws "Clerk can't detect usage of
  // clerkMiddleware()" and takes the whole route down with a 500.
  // resolveCurrentIdentity() has always guarded this and degraded to
  // signed-out; this call site did not. An anon client is the honest answer,
  // since there is no session to attach and nothing to authorize with.
  if (!hasClerkConfiguration()) return createPublicClient();
  const { url, anonKey } = getSupabasePublicEnv();
  const session = await auth();
  return createSupabaseClient<Database, "rush">(url, anonKey, {
    db: { schema: "rush" },
    accessToken: () => session.getToken(),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchWithDeadline },
  });
}
