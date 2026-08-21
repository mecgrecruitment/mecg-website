import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MECG_RECRUITMENT_PROJECT = {
  ref: "chrxtsohxazngabdcpzb",
  name: "mecgrecruitment's Project",
};

function readEnvFile(path) {
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^(["'])(.*)\1$/u, "$2");
        return [key, value];
      }),
  );
}

function projectRefFromUrl(value) {
  try {
    return new URL(value).hostname.match(/^([a-z0-9]+)\.supabase\.co$/u)?.[1];
  } catch {
    return undefined;
  }
}

function fail(message) {
  console.error(`Supabase project check failed: ${message}`);
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const localEnv = {
  ...readEnvFile(resolve(root, ".env")),
  ...readEnvFile(resolve(root, ".env.local")),
};
const configuredRef = projectRefFromUrl(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL,
);
const configuredUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (configuredRef !== MECG_RECRUITMENT_PROJECT.ref) {
  fail(
    `NEXT_PUBLIC_SUPABASE_URL must point to MECG Recruitment (${MECG_RECRUITMENT_PROJECT.ref}), not ${configuredRef ?? "an invalid or missing URL"}`,
  );
}

const linkedRefPath = resolve(root, "supabase/.temp/project-ref");
if (!existsSync(linkedRefPath)) {
  fail("the Supabase CLI is not linked; run npm run supabase:link");
}

const linkedRef = readFileSync(linkedRefPath, "utf8").trim();
if (linkedRef !== MECG_RECRUITMENT_PROJECT.ref) {
  fail(
    `the CLI is linked to ${linkedRef || "no project"}, not MECG Recruitment (${MECG_RECRUITMENT_PROJECT.ref})`,
  );
}

let projects;
try {
  projects = JSON.parse(
    execFileSync("supabase", ["projects", "list", "--output", "json"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
} catch {
  fail("the CLI could not confirm the linked project with Supabase");
}

const project = projects.find(({ ref }) => ref === MECG_RECRUITMENT_PROJECT.ref);
if (!project) fail("MECG Recruitment is not available to the current Supabase account");
if (project.name !== MECG_RECRUITMENT_PROJECT.name) {
  fail(`project ${project.ref} is named ${project.name}, expected ${MECG_RECRUITMENT_PROJECT.name}`);
}
if (project.status !== "ACTIVE_HEALTHY") {
  fail(`MECG Recruitment reports status ${project.status}`);
}

let projectKeys;
try {
  projectKeys = JSON.parse(
    execFileSync(
      "supabase",
      [
        "projects",
        "api-keys",
        "--project-ref",
        MECG_RECRUITMENT_PROJECT.ref,
        "--output",
        "json",
      ],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ),
  );
} catch {
  fail("the CLI could not confirm the MECG Recruitment API keys");
}

if (!projectKeys.some(({ api_key: key, type }) => type === "publishable" && key === publicKey)) {
  fail("NEXT_PUBLIC_SUPABASE_ANON_KEY is not MECG Recruitment's publishable key; run npm run supabase:sync-env");
}

if (!serviceRoleKey) fail("SUPABASE_SERVICE_ROLE_KEY is missing");

let schemaResponse;
try {
  schemaResponse = await fetch(
    `${configuredUrl}/rest/v1/rush_cycles?select=id&limit=0`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Accept-Profile": "rush",
      },
    },
  );
} catch {
  fail("the rush schema could not be reached through the Supabase API");
}

if (!schemaResponse.ok) {
  fail(`the rush schema API returned HTTP ${schemaResponse.status}`);
}

console.log(
  `Verified ${project.name} (${project.ref}) is linked, configured, ${project.status}, and serving the rush schema.`,
);
