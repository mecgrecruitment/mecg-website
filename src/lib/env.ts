export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function firstNonblank(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).find(Boolean);
}

function requireSupabaseValue(value: string | undefined, names: string) {
  if (!value) throw new Error(`Missing required environment variable: ${names}`);
  return value;
}

export function getSupabasePublicEnv() {
  const url = firstNonblank(
    process.env.NEXT_PUBLIC_MECG_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const anonKey = firstNonblank(
    process.env.NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return {
    url: requireSupabaseValue(
      url,
      "NEXT_PUBLIC_MECG_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL",
    ),
    anonKey: requireSupabaseValue(
      anonKey,
      "NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
  };
}

export function getSupabaseServiceRoleKey() {
  return firstNonblank(
    process.env.MECG_SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function requireSupabaseServiceRoleKey() {
  return requireSupabaseValue(
    getSupabaseServiceRoleKey(),
    "MECG_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY",
  );
}

export function requireClerkIssuer() {
  return requireEnv("CLERK_ISSUER").replace(/\/+$/, "");
}

export function hasClerkConfiguration(
  environment: Record<string, string | undefined> = process.env,
) {
  return Boolean(
    hasClerkFrontendConfiguration(environment)
    && environment.CLERK_SECRET_KEY?.trim(),
  );
}

export function hasClerkFrontendConfiguration(
  environment: Record<string, string | undefined> = process.env,
) {
  return Boolean(environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
}

export function hasClerkRuntimeConfiguration(
  environment: Record<string, string | undefined> = process.env,
) {
  return Boolean(
    hasClerkConfiguration(environment)
    && environment.CLERK_ISSUER?.trim(),
  );
}

export function requireClerkWebhookSigningSecret() {
  return requireEnv("CLERK_WEBHOOK_SIGNING_SECRET");
}
