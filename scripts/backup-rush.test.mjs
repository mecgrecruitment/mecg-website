import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { backupRush, buildApplicantsCsv, fetchRows } from "./backup-rush.mjs";

/** A client whose table rows come from `tables` and whose resume downloads come from `resumes`. */
function mockClient(tables, resumes = {}) {
  const calls = [];
  const query = (table) => {
    const filters = [];
    const q = {
      select: () => q,
      eq: (col, v) => (filters.push((r) => r[col] === v), q),
      in: (col, vs) => (filters.push((r) => vs.includes(r[col])), q),
      order: () => q,
      // Awaiting the builder without .range() (the rush_cycles query) resolves every row.
      then: (res, rej) => q.range(0, Infinity).then(res, rej),
      range: async (from, to) => {
        calls.push({ table, from, to });
        const rows = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
        return { data: rows.slice(from, to + 1), error: null };
      },
    };
    return q;
  };
  return {
    calls,
    from: query,
    storage: { from: () => ({ download: async (path) => resumes[path] ?? { data: null, error: { message: "not found" } } }) },
  };
}

const cycle = { id: "c1", name: "Fall 2026", status: "OPEN", created_at: "2026-09-01" };
const questions = [
  { id: "q2", cycle_id: "c1", key: "why", prompt: "Why MECG?", sort_order: 2 },
  { id: "q1", cycle_id: "c1", key: "intro", prompt: "Tell us, briefly", sort_order: 1 },
];
const app = { id: "a1234567-0000", cycle_id: "c1", pnm_id: "p1", status: "SUBMITTED", submitted_at: "2026-09-02", resume_storage_path: "c1/a1.pdf" };
const pnm = { id: "p1", name: "Ada Lovelace", preferred_name: "Ada", contact: "ada@umich.edu", phone: "555", class_year: "2028", major: "CS" };
const doc = { id: "d1", cycle_id: "c1", application_id: app.id, status: "ATTACHED", original_filename: "ada.pdf" };
const responses = [
  { id: "r1", application_id: app.id, question_key: "why", response_text: "=SUM(1)" },
  { id: "r2", application_id: app.id, question_key: "intro", response_text: "hi" },
];

test("pagination stops at the first short page", async () => {
  const many = Array.from({ length: 1500 }, (_, i) => ({ id: String(i) }));
  const db = mockClient({ big: many });
  const rows = await fetchRows(db, "big");
  assert.equal(rows.length, 1500);
  assert.deepEqual(db.calls.map((c) => [c.from, c.to]), [[0, 999], [1000, 1999]]);
});

test("the CSV has one column per question in sort order and guards a leading =", () => {
  const csv = buildApplicantsCsv({ applications: [app], pnms: [pnm], questions, responses, documents: [doc] });
  const [header, row] = csv.trim().split("\n");
  assert.equal(header, `application_id,status,submitted_at,name,preferred_name,email,phone,class_year,major,"Tell us, briefly",Why MECG?,resume_filename`);
  assert.equal(row, `${app.id},SUBMITTED,2026-09-02,Ada Lovelace,Ada,ada@umich.edu,555,2028,CS,hi,'=SUM(1),ada.pdf`);
});

test("a full run writes every file and records resume failures without throwing", async () => {
  const root = await mkdtemp(join(tmpdir(), "backup-rush-"));
  try {
    const app2 = { ...app, id: "b2222222-0000", pnm_id: "p2", resume_storage_path: "c1/b2.pdf" };
    const pnm2 = { ...pnm, id: "p2", name: "Grace Hopper" };
    const doc2 = { ...doc, id: "d2", application_id: app2.id };
    const db = mockClient(
      { rush_cycles: [cycle], applications: [app, app2], pnms: [pnm, pnm2], application_questions: questions, application_responses: responses, application_documents: [doc, doc2] },
      { "c1/a1.pdf": { data: new Blob(["%PDF"]), error: null } },
    );
    const result = await backupRush({ db, root, now: new Date("2026-09-11T14:50:58Z"), headSha: "abc", log: () => {} });
    assert.equal(result.outDir, join(root, "backups", "fall-2026-20260911-145058"));
    const files = await readdir(result.outDir);
    for (const f of ["pnms", "applications", "application_questions", "application_responses", "application_documents", "screening_batches", "screening_reviewers", "screening_packets", "screening_assignments", "screening_reviews", "screening_ratings", "conflict_declarations", "memberships", "profiles"]) assert.ok(files.includes(`${f}.json`), f);
    assert.ok(files.includes("applicants.csv"));
    assert.deepEqual(await readdir(join(result.outDir, "resumes")), ["ada-lovelace-a1234567.pdf"]);
    const manifest = JSON.parse(await readFile(join(result.outDir, "manifest.json"), "utf8"));
    assert.equal(manifest.cycle_id, "c1");
    assert.equal(manifest.git_head, "abc");
    assert.equal(manifest.resumes, 1);
    assert.equal(manifest.counts["applications.json"], 2);
    assert.deepEqual(manifest.failures, [{ application_id: app2.id, path: "c1/b2.pdf", error: "not found" }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("dry-run prints counts and writes nothing", async () => {
  const root = await mkdtemp(join(tmpdir(), "backup-rush-"));
  try {
    const lines = [];
    const db = mockClient({ rush_cycles: [cycle], applications: [app], pnms: [pnm], application_documents: [doc] });
    const result = await backupRush({ db, root, dryRun: true, log: (l) => lines.push(l) });
    assert.equal(result.outDir, null);
    assert.equal(result.resumes, 1);
    assert.ok(lines.some((l) => /1\s+applications\.json/.test(l)));
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a failed table fetch throws", async () => {
  const db = mockClient({ rush_cycles: [cycle] });
  db.from = (table) => (table === "applications" ? { select: () => ({ eq: () => ({ order: () => ({ range: async () => ({ data: null, error: { message: "boom" } }) }) }) }) } : mockClient({ rush_cycles: [cycle] }).from(table));
  await assert.rejects(backupRush({ db, root: tmpdir(), dryRun: true, log: () => {} }), /applications: boom/);
});
