import test from "node:test";
import assert from "node:assert/strict";
import { feedbackLink, parseCloseoutOverview, parseFeedbackForm, parseFeedbackInput, parseLinkResponse, isFeedbackToken } from "./closeout";

const answers = { satisfaction: 5, wouldRehire: "YES", quote: " Great work. ", attribution: "", quotePermission: true, logoPermission: false, permissionScope: "Website only" };
const token = "a".repeat(64);
const received = { projectId: "p1", cycleId: "test", leadName: "Lead", state: "RECEIVED", requestedAt: "2026-11-18T05:00:00Z", expiresAt: null, submittedAt: "2026-11-19T05:00:00Z", satisfaction: 5, wouldRehire: "YES", quote: "Great work.", attribution: "", quotePermission: true, logoPermission: false, permissionScope: "Website only", evidenceCreated: true };

test("client answers are trimmed and checked like the database", () => {
  const parsed = parseFeedbackInput(answers);
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.value.quote, "Great work.");
  for (const bad of [
    { ...answers, satisfaction: 0 }, { ...answers, satisfaction: 4.5 }, { ...answers, satisfaction: "5" },
    { ...answers, wouldRehire: "SURE" }, { ...answers, quote: "", quotePermission: true },
    { ...answers, permissionScope: "  " }, { ...answers, logoPermission: "yes" },
    { ...answers, quote: "x".repeat(1001) }, { ...answers, attribution: "x".repeat(201) }, { ...answers, leadId: "x" }, null, [],
  ]) assert.equal(parseFeedbackInput(bad).ok, false, JSON.stringify(bad));
  assert.equal(parseFeedbackInput({ ...answers, quote: "", quotePermission: false, logoPermission: false, permissionScope: "" }).ok, true);
});

test("tokens are 64 lowercase hex characters", () => {
  assert.equal(isFeedbackToken(token), true);
  for (const bad of ["A".repeat(64), "a".repeat(63), `${"a".repeat(63)}/`, ""]) assert.equal(isFeedbackToken(bad), false);
});

test("the overview parses each state and rejects malformed rows", () => {
  const overview = parseCloseoutOverview([received, { ...received, projectId: "p2", state: "ACTIVE", expiresAt: "2026-12-18T05:00:00Z", submittedAt: null, satisfaction: null, wouldRehire: null, quotePermission: null, logoPermission: null, quote: "", permissionScope: "", evidenceCreated: false }]);
  assert.equal(overview.get("p1")?.state, "RECEIVED");
  assert.equal(overview.get("p2")?.satisfaction, null);
  assert.throws(() => parseCloseoutOverview([{ ...received, state: "SENT" }]));
  assert.throws(() => parseCloseoutOverview([{ ...received, satisfaction: 9 }]));
  assert.throws(() => parseCloseoutOverview({}));
});

test("form and link responses are validated", () => {
  assert.deepEqual(parseFeedbackForm({ projectTitle: "Alpha", clientLabel: "", expiresAt: "2026-12-18T05:00:00Z" }), { projectTitle: "Alpha", clientLabel: "", expiresAt: "2026-12-18T05:00:00Z" });
  assert.equal(parseFeedbackForm(null), null);
  assert.throws(() => parseFeedbackForm({ projectTitle: 1 }));
  assert.equal(parseLinkResponse({ token, expiresAt: "2026-12-18T05:00:00Z", feedback: received })?.token, token);
  assert.equal(parseLinkResponse({ token: "short", expiresAt: "x" }), null);
});

test("the link is built on the site origin", () => {
  assert.equal(feedbackLink("https://mecg.example/", token), `https://mecg.example/feedback/${token}`);
});
