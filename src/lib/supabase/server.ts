import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export async function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  const session = await auth();
  return createSupabaseClient<Database, "rush">(url, anonKey, {
    db: { schema: "rush" },
    accessToken: () => session.getToken(),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
