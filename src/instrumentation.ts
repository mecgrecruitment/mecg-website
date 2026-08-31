// Fail fast at server boot if Supabase env vars are missing, instead of
// letting `requireEnv` throw deep inside the first request. See
// src/lib/supabase/{admin,client,server,proxy}.ts for the MECG_-prefixed
// fallback pattern this mirrors.
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_MECG_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("set NEXT_PUBLIC_MECG_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }
  if (
    !process.env.NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    missing.push("set NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!process.env.MECG_SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("set MECG_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required env var: ${missing.join("; ")}`);
  }
}
