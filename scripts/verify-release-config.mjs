import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import nextEnv from "@next/env";

const first = (...values) => values.map(value => value?.trim()).find(Boolean);
const placeholder = value => /(?:^your-|placeholder|ci\.invalid|your-project-ref|your-instance)/iu.test(value);

/** Configuration checks only. This never reads account data or calls a provider. */
export function releaseConfigurationIssues(env, { production = true } = {}) {
  const issues = [];
  const required = (name, value = env[name]) => {
    const text = value?.trim();
    if (!text || placeholder(text)) issues.push(`${name}: missing or placeholder configuration`);
    return text;
  };
  const databaseUrl = required("NEXT_PUBLIC_MECG_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL", first(env.NEXT_PUBLIC_MECG_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL));
  required("NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY", first(env.NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY, env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  required("MECG_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY", first(env.MECG_SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_SERVICE_ROLE_KEY));
  const publishable = required("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  const secret = required("CLERK_SECRET_KEY");
  const issuer = required("CLERK_ISSUER");
  required("CLERK_WEBHOOK_SIGNING_SECRET");
  required("RESEND_API_KEY");
  required("RESEND_FROM_EMAIL");
  required("CONTACT_TO_EMAIL");
  required("CRON_SECRET");

  for (const [name, value] of [["Supabase URL", databaseUrl], ["CLERK_ISSUER", issuer]]) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) issues.push(`${name}: use a clean HTTPS provider URL`);
      if (production && name === "Supabase URL" && url.hostname !== "chrxtsohxazngabdcpzb.supabase.co") issues.push("Supabase URL: production must target the MECG Recruitment project");
    } catch { issues.push(`${name}: invalid URL`); }
  }
  if (production && publishable && !publishable.startsWith("pk_live_")) issues.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: production requires a live Clerk key");
  if (production && secret && !secret.startsWith("sk_live_")) issues.push("CLERK_SECRET_KEY: production requires a live Clerk key");
  for (const name of ["E2E_LOCAL_HTTP", "PLAYWRIGHT_APPLICATION_HARNESS"]) {
    if (env[name] === "1") issues.push(`${name}: must not be enabled in a hosted deployment`);
  }
  return issues;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, "..");
  nextEnv.loadEnvConfig(root, false, { info() {}, error() {} });
  const issues = releaseConfigurationIssues(process.env, { production: !process.argv.includes("--preview") });
  if (!existsSync(resolve(root, "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"))) issues.push("PDF.js runtime worker: missing; run npm ci");
  if (issues.length) {
    console.error("Release configuration is incomplete (values are never printed):\n" + issues.map(issue => `- ${issue}`).join("\n"));
    process.exitCode = 1;
  } else console.log("Release configuration checks passed. Provider connectivity, hosted migrations and authenticated journeys still require verification.");
}
