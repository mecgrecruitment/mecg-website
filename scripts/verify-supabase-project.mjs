import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  fetchWithTimeout,
  loadSupabaseEnv,
  requireServiceRoleKey,
} from "./lib/supabase-env.mjs";

const MECG_RECRUITMENT_PROJECT = {
  ref: "chrxtsohxazngabdcpzb",
  name: "mecgrecruitment's Project",
};

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
let env;
try {
  env = loadSupabaseEnv(root);
} catch (error) {
  fail(error.message);
}
const configuredRef = projectRefFromUrl(env.url);

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

if (!projectKeys.some(({ api_key: key, type }) => type === "publishable" && key === env.anonKey)) {
  fail("NEXT_PUBLIC_SUPABASE_ANON_KEY is not MECG Recruitment's publishable key; run npm run supabase:sync-env");
}

let serviceRoleKey;
try {
  serviceRoleKey = requireServiceRoleKey(env.serviceRoleKey);
} catch (error) {
  fail(error.message);
}

let schemaResponse;
try {
  schemaResponse = await fetchWithTimeout(`${env.url}/rest/v1/rush_cycles?select=id&limit=0`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Accept-Profile": "rush",
    },
  });
} catch {
  fail("the rush schema could not be reached through the Supabase API");
}

if (!schemaResponse.ok) {
  fail(`the rush schema API returned HTTP ${schemaResponse.status}`);
}

console.log(
  `Verified ${project.name} (${project.ref}) is linked, configured, ${project.status}, and serving the rush schema.`,
);
