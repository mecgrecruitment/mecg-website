import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { filterReleaseItems, RELEASE_REASONS, labelReleaseItems, parseReleasePreflight, parseReleaseReport, parseReleaseSnapshot, releaseSnapshot } from "./decision-release";
const eligible = { decisionId: "d1", applicationId: "a1", outcome: "OFFER", reasonCode: null };
const blocked = { decisionId: "d2", applicationId: "a2", outcome: "REJECT", reasonCode: "ACTOR_CONFLICT" };
test("preflight distinguishes locked eligibility and preserves exact outcomes/reasons in snapshot", () => {
  const items = parseReleasePreflight({ items: [eligible, blocked] });
  assert.ok(items);
  assert.deepEqual(releaseSnapshot(items), [
    { decisionId: "d1", outcome: "OFFER", reasonCode: null },
    { decisionId: "d2", outcome: "REJECT", reasonCode: "ACTOR_CONFLICT" },
  ]);
  assert.deepEqual(parseReleaseSnapshot(releaseSnapshot(items)), releaseSnapshot(items));
});
test("malformed, duplicate and unrecognized reason responses cannot become eligible outcomes", () => {
  for (const items of [[{ ...eligible, reasonCode: "provider database email failure" }], [eligible, eligible], [{ ...eligible, reasonCode: undefined }], [{ ...eligible, outcome: "ACCEPT" }]]) {
    assert.equal(parseReleasePreflight({ items }), null);
  }
  assert.equal(parseReleaseSnapshot([{ decisionId: "d1", outcome: "OFFER" }]), null);
});
test("report rejects fabricated or inconsistent aggregate success counts", () => {
  assert.equal(parseReleaseReport({ items: [eligible, blocked], released: 2, skipped: 0 }), null);
  assert.equal(parseReleaseReport({ items: [eligible, blocked], released: 1, skipped: -1 }), null);
  assert.deepEqual(parseReleaseReport({ items: [eligible, blocked], released: 1, skipped: 1 }), { items: [eligible, blocked], released: 1, skipped: 1 });
});

test("client release display consumes server pseudonyms and rejects missing/untrusted labels", () => {
  const items = parseReleasePreflight({ items: [eligible] });
  assert.ok(items);
  assert.deepEqual(labelReleaseItems(items, { applicantLabels: { a1: "Applicant A1B2C3" } }), [{ ...eligible, applicantLabel: "Applicant A1B2C3" }]);
  assert.equal(labelReleaseItems(items, { applicantLabels: {} }), null);
  assert.equal(labelReleaseItems(items, { applicantLabels: { a1: "Real applicant name" } }), null);
});

test("release client boundary never imports Node crypto or the server hashing helper", async () => {
  const component = await readFile(new URL("../app/admin/decision-form.tsx", import.meta.url), "utf8");
  const helper = await readFile(new URL("./decision-release.ts", import.meta.url), "utf8");
  assert.doesNotMatch(component, /from ["'](?:node:|@\/lib\/applicant-code)/);
  assert.doesNotMatch(helper, /from ["'](?:node:|@\/lib\/applicant-code)/);
});


test("large-cohort view filters never shrink the authoritative release snapshot", () => {
  const items = Array.from({ length: 500 }, (_, index) => ({ decisionId: `decision-${index}`, applicationId: `app-${index}`, applicantLabel: `Applicant ${index.toString(16).toUpperCase().padStart(6, "0")}`, outcome: "OFFER" as const, reasonCode: index % 2 ? null : "EVIDENCE_NOT_READY" as const }));
  const original = releaseSnapshot(items);
  assert.equal(filterReleaseItems(items, { query: " applicant 00000a ", eligibility: "BLOCKED", outcome: "OFFER" }).length, 1);
  assert.equal(filterReleaseItems(items, { query: "", eligibility: "ELIGIBLE", outcome: "WAITLIST" }).length, 0);
  assert.deepEqual(releaseSnapshot(items), original);
  assert.equal(items.length, 500);
});
test("evidence blocker guidance distinguishes open collection from closed-round escalation", () => {
  assert.match(RELEASE_REASONS.EVIDENCE_NOT_READY, /If grading is still open/);
  assert.match(RELEASE_REASONS.EVIDENCE_NOT_READY, /If a required round is already closed/);
  assert.match(RELEASE_REASONS.EVIDENCE_NOT_READY, /recruitment owner/);
  assert.match(RELEASE_REASONS.EVIDENCE_NOT_READY, /outcome stays blocked/);
});
