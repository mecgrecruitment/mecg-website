// One-command backup of every applicant's data and resume for the open rush
// cycle. Writes one JSON file per table, an applicants.csv, every attached
// resume and a manifest.json under backups/<cycle>-<timestamp>/.
//
// Usage: node scripts/backup-rush.mjs [--dry-run]
// The output contains applicant PII: it is gitignored, keep it off-repo.
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadSupabaseEnv, requireServiceRoleKey } from "./lib/supabase-env.mjs";

const PAGE = 1000;
const ID_CHUNK = 200; // keeps `in=(...)` filters under URL length limits
const RESUME_CONCURRENCY = 4;

// Copied from src/app/api/admin/export/route.ts (csvEscape is not exported and
// that module needs Next's bundler to load).
export function csvEscape(value) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const slug = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unnamed";
const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");

/** Fetch every row matching `filter`, paging with .range() so PostgREST's default limit never truncates. */
export async function fetchRows(db, table, filter = (q) => q, orderBy = "id") {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await filter(db.from(table).select("*")).order(orderBy).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

// Tables with a composite key (no `id`) page in `column` order instead.
async function fetchByIds(db, table, column, ids, orderBy = "id") {
  const rows = [];
  if (!ids.length) return rows;
  for (let i = 0; i < ids.length; i += ID_CHUNK) rows.push(...(await fetchRows(db, table, (q) => q.in(column, ids.slice(i, i + ID_CHUNK)), orderBy)));
  return rows;
}

export function buildApplicantsCsv({ applications, pnms, questions, responses, documents }) {
  const pnmById = new Map(pnms.map((p) => [p.id, p]));
  const sorted = [...questions].sort((a, b) => a.sort_order - b.sort_order);
  const answers = new Map();
  for (const r of responses) answers.set(`${r.application_id}\0${r.question_key}`, r.response_text);
  const resumeName = new Map(documents.filter((d) => d.status === "ATTACHED").map((d) => [d.application_id, d.original_filename]));
  const header = ["application_id", "status", "submitted_at", "name", "preferred_name", "email", "phone", "class_year", "major", ...sorted.map((q) => q.prompt), "resume_filename"];
  const rows = applications.map((a) => {
    const p = pnmById.get(a.pnm_id) ?? {};
    return [a.id, a.status, a.submitted_at, p.name, p.preferred_name, p.contact, p.phone, p.class_year, p.major, ...sorted.map((q) => answers.get(`${a.id}\0${q.key}`)), resumeName.get(a.id)];
  });
  return `${[header, ...rows].map((row) => row.map((v) => csvEscape(String(v ?? ""))).join(",")).join("\n")}\n`;
}

async function downloadResumes(db, jobs, outDir) {
  const failures = [];
  let done = 0;
  const queue = [...jobs];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      let error = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await db.storage.from("resumes").download(job.path);
          if (res.error) throw new Error(res.error.message);
          await writeFile(join(outDir, "resumes", job.file), Buffer.from(await res.data.arrayBuffer()));
          error = null;
          break;
        } catch (err) {
          error = err;
        }
      }
      if (error) failures.push({ application_id: job.applicationId, path: job.path, error: error.message });
      else done++;
    }
  };
  await Promise.all(Array.from({ length: RESUME_CONCURRENCY }, worker));
  return { done, failures };
}

export async function backupRush({ db, root, dryRun = false, now = new Date(), headSha = null, log = console.log }) {
  const cycles = await db.from("rush_cycles").select("*").order("created_at", { ascending: false });
  if (cycles.error) throw new Error(`rush_cycles: ${cycles.error.message}`);
  const cycle = cycles.data.find((x) => x.status === "OPEN") ?? cycles.data[0];
  if (!cycle) throw new Error("no rush cycles");

  const byCycle = (table) => fetchRows(db, table, (q) => q.eq("cycle_id", cycle.id));
  const t = {};
  t.applications = await byCycle("applications");
  const appIds = t.applications.map((a) => a.id);
  t.pnms = await fetchByIds(db, "pnms", "id", [...new Set(t.applications.map((a) => a.pnm_id))]);
  t.application_questions = await byCycle("application_questions");
  t.application_responses = await fetchByIds(db, "application_responses", "application_id", appIds);
  t.application_documents = await byCycle("application_documents");
  t.screening_batches = await byCycle("screening_batches");
  const batchIds = t.screening_batches.map((b) => b.id);
  t.screening_reviewers = await fetchByIds(db, "screening_reviewers", "batch_id", batchIds, "reviewer_id");
  t.screening_packets = await fetchByIds(db, "screening_packets", "batch_id", batchIds);
  t.screening_assignments = await fetchByIds(db, "screening_assignments", "packet_id", t.screening_packets.map((p) => p.id));
  t.screening_reviews = await fetchByIds(db, "screening_reviews", "assignment_id", t.screening_assignments.map((a) => a.id));
  t.screening_ratings = await fetchByIds(db, "screening_ratings", "review_id", t.screening_reviews.map((r) => r.id), "criterion_id");
  t.conflict_declarations = await fetchByIds(db, "conflict_declarations", "application_id", appIds);
  t.memberships = await byCycle("memberships");
  // profiles has no cycle or application link; keep the cycle's members.
  t.profiles = await fetchByIds(db, "profiles", "id", [...new Set(t.memberships.map((m) => m.user_id))]);

  const pnmById = new Map(t.pnms.map((p) => [p.id, p]));
  const attached = new Set(t.application_documents.filter((d) => d.status === "ATTACHED").map((d) => d.application_id));
  const resumeJobs = t.applications
    .filter((a) => a.resume_storage_path && attached.has(a.id))
    .map((a) => ({ applicationId: a.id, path: a.resume_storage_path, file: `${slug(pnmById.get(a.pnm_id)?.name)}-${a.id.slice(0, 8)}.pdf` }));

  const counts = Object.fromEntries(Object.entries(t).map(([k, v]) => [`${k}.json`, v.length]));
  for (const [file, n] of Object.entries(counts)) log(`${String(n).padStart(6)}  ${file}`);
  log(`${String(resumeJobs.length).padStart(6)}  resumes`);
  if (dryRun) return { cycle, counts, resumes: resumeJobs.length, failures: [], outDir: null };

  const outDir = join(root, "backups", `${slug(cycle.name)}-${stamp(now)}`);
  await mkdir(join(outDir, "resumes"), { recursive: true });
  for (const [name, rows] of Object.entries(t)) await writeFile(join(outDir, `${name}.json`), JSON.stringify(rows, null, 2));
  await writeFile(join(outDir, "applicants.csv"), buildApplicantsCsv({ applications: t.applications, pnms: t.pnms, questions: t.application_questions, responses: t.application_responses, documents: t.application_documents }));
  const { done, failures } = await downloadResumes(db, resumeJobs, outDir);
  const manifest = { cycle_id: cycle.id, cycle_name: cycle.name, timestamp: now.toISOString(), git_head: headSha, counts, resumes: done, failures };
  await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return { ...manifest, outDir };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = resolve(import.meta.dirname, "..");
  const { url, serviceRoleKey } = loadSupabaseEnv(root);
  const db = createClient(url, requireServiceRoleKey(serviceRoleKey), { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: "rush" } });
  let headSha = null;
  try { headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); } catch { /* best effort */ }
  const result = await backupRush({ db, root, dryRun: process.argv.includes("--dry-run"), headSha });
  if (result.outDir) console.log(`\nWrote ${result.outDir}`);
  else console.log("\nDRY RUN. Nothing was written.");
  if (result.failures.length) console.warn(`WARNING: ${result.failures.length} resume download(s) failed; see manifest.json`);
}
