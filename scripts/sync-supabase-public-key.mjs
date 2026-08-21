import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "chrxtsohxazngabdcpzb";
const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env.local");

if (!existsSync(envPath)) {
  console.error("Cannot sync the Supabase public key because .env.local is missing.");
  process.exit(1);
}

const keys = JSON.parse(
  execFileSync(
    "supabase",
    ["projects", "api-keys", "--project-ref", PROJECT_REF, "--output", "json"],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ),
);
const publicKey = keys.find(({ type }) => type === "publishable")?.api_key;

if (!publicKey) {
  console.error("MECG Recruitment does not have a publishable API key.");
  process.exit(1);
}

const source = readFileSync(envPath, "utf8");
const setting = `NEXT_PUBLIC_SUPABASE_ANON_KEY="${publicKey}"`;
const updated = /^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*$/mu.test(source)
  ? source.replace(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*$/mu, setting)
  : `${source.trimEnd()}\n${setting}\n`;

writeFileSync(envPath, updated, { mode: 0o600 });
console.log("Updated .env.local with the MECG Recruitment publishable key.");
