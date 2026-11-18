import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, exportFilename, parseExport, parseOverview, parseRetentionInput, parseRetentionReport, projectsCsv, recordsCsv } from "./model.ts";

const overview = {
  cycle: { id: "c1", name: "Fall 2026", status: "CLOSED", archivedAt: null },
  tools: [{ kind: "pipeline", records: 2, full: false }, { kind: "evidence", records: 1, full: true }, { kind: "lab", records: 0, full: false }],
  projects: 3, lastExportAt: "2026-11-18T10:00:00Z", exportedSinceClose: null,
};

test("parses the overview and refuses malformed shapes", () => {
  const parsed = parseOverview(overview);
  assert.equal(parsed?.cycle.status, "CLOSED");
  assert.equal(parsed?.tools[1].full, true);
  assert.equal(parsed?.canArchive, false);
  assert.equal(parseOverview({ ...overview, exportedSinceClose: "2026-11-18T11:00:00Z" })?.canArchive, true);
  assert.equal(parseOverview({ ...overview, cycle: { ...overview.cycle, status: "OPEN" }, exportedSinceClose: "2026-11-18T11:00:00Z" })?.canArchive, false);
  assert.equal(parseOverview({ ...overview, tools: [{ kind: "secret", records: 1, full: true }] }), null);
  assert.equal(parseOverview({ ...overview, projects: "3" }), null);
  assert.equal(parseOverview(null), null);
});

const exported = {
  format: "mecg-cycle-records/1", exportedAt: "2026-11-18T12:00:00Z", cycle: { id: "c1", name: "Fall 2026", status: "CLOSED" }, fullContentTools: ["evidence"],
  memberToolRecords: [
    { id: "r1", kind: "pipeline", ownerId: "u1", ownerName: "Ada", revision: 2, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z", verification: null, sharing: null, contentWithheld: true, content: null, review: null },
    { id: "r2", kind: "evidence", ownerId: "u2", ownerName: "=cmd", revision: 1, createdAt: "2026-10-03T00:00:00Z", updatedAt: "2026-10-03T00:00:00Z", verification: "Verified", sharing: "Restricted", contentWithheld: false,
      content: { title: "Client, \"win\"", problem: "Line\nbreak" }, review: { note: "ok", scope: "internal" } },
  ],
  reviewerGrants: [], projects: [{ id: "p1", slug: "acme", title: "Acme", client_label: "Acme Co", is_public: false }],
  projectMembers: [{ projectId: "p1", userId: "u1", name: "Ada", roleLabel: "Analyst" }, { projectId: "p1", userId: "u2", name: "Bo", roleLabel: "" }],
};

test("records CSV flattens content, marks withheld rows and neutralises formulas", () => {
  const parsed = parseExport(exported);
  assert.ok(parsed);
  const lines = recordsCsv(parsed).trimEnd().split("\n");
  assert.equal(lines[0], "id,tool,owner,owner_id,revision,created_at,updated_at,verification,sharing,content_withheld,content_title,content_problem,review_note,review_scope");
  assert.equal(lines[1], "r1,pipeline,Ada,u1,2,2026-10-01T00:00:00Z,2026-10-02T00:00:00Z,,,yes,,,,");
  assert.ok(lines[2].startsWith("r2,evidence,'=cmd,u2,1,"));
  assert.ok(lines[2].includes(',"Client, ""win""","Line'));
});

test("formula guard covers every trigger character and leading whitespace", () => {
  for (const value of ["+1", "-1", "@x", "\tx", " =1", "\n=1"]) assert.ok(csvCell(value).replace(/^"/, "").startsWith("'"), value);
  assert.equal(csvCell("plain"), "plain");
});

test("projects CSV lists staffing on each project", () => {
  const parsed = parseExport(exported)!;
  const lines = projectsCsv(parsed).trimEnd().split("\n");
  assert.equal(lines[0], "id,slug,title,client_label,is_public,team");
  assert.equal(lines[1], "p1,acme,Acme,Acme Co,no,Ada (Analyst); Bo");
});

test("export parse refuses an unknown format or a withheld record with content", () => {
  assert.equal(parseExport({ ...exported, format: "other" }), null);
  const leaky = structuredClone(exported);
  leaky.memberToolRecords[0].content = { title: "x" } as never;
  assert.equal(parseExport(leaky), null);
});

test("export filenames are safe and dated", () => {
  assert.equal(exportFilename({ id: "Fall 2026/../x", exportedAt: "2026-11-18T12:00:00Z" }, "records", "csv"), "mecg-cycle-fall-2026-x-records-2026-11-18.csv");
  assert.equal(exportFilename({ id: "c1", exportedAt: "2026-11-18T12:00:00Z" }, "all", "json"), "mecg-cycle-c1-all-2026-11-18.json");
});

test("retention report parses unset and set categories", () => {
  const parsed = parseRetentionReport({ generatedAt: "2026-11-18T12:00:00Z", categories: [
    { category: "audit_events", keepMonths: null, revision: 1, updatedAt: "2026-11-18T00:00:00Z", eligible: null, byCycle: null },
    { category: "member_tool_records", keepMonths: 24, revision: 2, updatedAt: "2026-11-18T00:00:00Z", eligible: 4, byCycle: [{ cycleId: "old", cycleName: "Fall 2023", archivedAt: "2023-12-01T00:00:00Z", records: 4 }] },
  ] });
  assert.equal(parsed?.categories.length, 2);
  assert.equal(parsed?.categories[1].byCycle?.[0].records, 4);
  assert.equal(parseRetentionReport({ generatedAt: "x", categories: [{ category: "applicants", keepMonths: null, revision: 1, updatedAt: "x", eligible: null, byCycle: null }] }), null);
});

test("retention input accepts blank or 1-240 whole months only", () => {
  assert.deepEqual(parseRetentionInput({ category: "audit_events", keepMonths: null, revision: 1 }), { ok: true, value: { category: "audit_events", keepMonths: null, revision: 1 } });
  assert.deepEqual(parseRetentionInput({ category: "member_tool_records", keepMonths: 240, revision: 3 }), { ok: true, value: { category: "member_tool_records", keepMonths: 240, revision: 3 } });
  for (const keepMonths of [0, 241, 1.5, "12"]) assert.equal(parseRetentionInput({ category: "audit_events", keepMonths, revision: 1 }).ok, false);
  assert.equal(parseRetentionInput({ category: "applicants", keepMonths: 12, revision: 1 }).ok, false);
  assert.equal(parseRetentionInput({ category: "audit_events", keepMonths: 12, revision: 0 }).ok, false);
  assert.equal(parseRetentionInput({ category: "audit_events", keepMonths: 12, revision: 1, extra: true }).ok, false);
});
