import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicProjects, serializePublicProjects } from "./export-public-projects.mjs";

const approved = (value) => ({ value, approved: true });
const withheld = (value) => ({ value, approved: false });

function reviewRecord(overrides = {}) {
  return {
    status: "publishable",
    boardApprovedAt: "2026-08-30",
    clientApprovedAt: "2026-08-30",
    slug: approved("sample-project"),
    title: approved("A specific project"),
    clientName: withheld("Private client name"),
    anonymousLabel: approved("Consumer products company"),
    industry: approved("Consumer products"),
    semester: approved("Fall 2025"),
    decision: approved("Which customer group should the team study first?"),
    context: approved("The client needed a repeatable way to compare options."),
    methods: [approved("Compared customer segments"), withheld("PRIVATE METHOD")],
    deliverables: [approved("Segment comparison"), withheld("PRIVATE DELIVERABLE")],
    constraints: [approved("One semester"), withheld("PRIVATE CONSTRAINT")],
    memberWork: [approved("Research and comparison")],
    handoff: withheld("PRIVATE OUTCOME"),
    sourceFiles: ["PRIVATE SOURCE FILE"],
    notes: "PRIVATE REVIEW NOTE",
    ...overrides,
  };
}

test("draft and review records cannot produce public routes", () => {
  const projects = buildPublicProjects([
    reviewRecord({ status: "internal" }),
    reviewRecord({ status: "review" }),
  ]);

  assert.deepEqual(projects, []);
});

test("the exporter releases only approved, allowlisted fields", () => {
  const projects = buildPublicProjects([reviewRecord()]);
  const serialized = JSON.stringify(projects);

  assert.equal(projects[0].clientLabel, "Consumer products company");
  assert.deepEqual(projects[0].methods, ["Compared customer segments"]);
  assert.deepEqual(Object.keys(projects[0]).sort(), [
    "clientLabel",
    "constraints",
    "context",
    "decision",
    "deliverables",
    "industry",
    "memberWork",
    "methods",
    "semester",
    "slug",
    "title",
  ]);
  assert.doesNotMatch(serialized, /PRIVATE/);
});

test("publishable records fail closed without both approvals", () => {
  assert.throws(() => buildPublicProjects([reviewRecord({ clientApprovedAt: "" })]), /client approval/);
  assert.throws(() => buildPublicProjects([reviewRecord({ boardApprovedAt: "" })]), /board approval/);
});

test("generated source contains only the released data", () => {
  const source = serializePublicProjects(buildPublicProjects([reviewRecord()]));

  assert.match(source, /sample-project/);
  assert.doesNotMatch(source, /PRIVATE/);
});
