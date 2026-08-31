import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const firstNonblank = (...values) => values.map((value) => value?.trim()).find(Boolean);

function required(value, names) {
  if (!value) throw new Error(`Missing required environment variable: ${names}`);
  return value;
}

export function loadSupabaseEnv(projectDir) {
  loadEnvConfig(projectDir);

  const url = firstNonblank(
    process.env.NEXT_PUBLIC_MECG_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const anonKey = firstNonblank(
    process.env.NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const serviceRoleKey = firstNonblank(
    process.env.MECG_SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  return {
    url: required(url, "NEXT_PUBLIC_MECG_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required(
      anonKey,
      "NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
    serviceRoleKey,
  };
}

export function requireServiceRoleKey(value) {
  return required(
    value,
    "MECG_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY",
  );
}

export function fetchWithTimeout(input, init = {}) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(15_000) });
}
