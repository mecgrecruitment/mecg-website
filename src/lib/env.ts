/** Read a required env var or throw with a setup hint. */
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill values from \`supabase status\`.`
    );
  }
  return value;
}
