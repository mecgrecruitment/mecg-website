import assert from "node:assert/strict";
import test from "node:test";
import { detroitToday, healthIsStale, overdueMilestones, parseDeliveryInput, parseHealthInput, parseTracker } from "./model";

const delivery = {
  status: "ACTIVE",
  milestones: [{ id: "m1", title: "Kickoff", due: "2026-11-20", done: "" }],
  risks: [{ id: "r1", kind: "BLOCKER", text: "Waiting on client data", status: "OPEN" }],
  lastContactOn: "2026-11-17",
  lastContactNote: "Weekly call",
};

test("delivery input accepts the documented shape and trims text", () => {
  const parsed = parseDeliveryInput({ ...delivery, lastContactNote: "  Weekly call  " });
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.value.lastContactNote, "Weekly call");
});

test("delivery input rejects injected health, lead and unknown fields", () => {
  for (const extra of [{ health: "ON_TRACK" }, { leadId: "x" }, { revision: 9 }]) {
    assert.equal(parseDeliveryInput({ ...delivery, ...extra }).ok, false);
  }
});

test("delivery input rejects bad status, impossible dates and empty milestones or risks", () => {
  assert.equal(parseDeliveryInput({ ...delivery, status: "DONE" }).ok, false);
  assert.equal(parseDeliveryInput({ ...delivery, lastContactOn: "2026-02-30" }).ok, false);
  assert.equal(parseDeliveryInput({ ...delivery, milestones: [{ id: "m1", title: " ", due: "2026-11-20", done: "" }] }).ok, false);
  assert.equal(parseDeliveryInput({ ...delivery, milestones: [{ id: "m1", title: "Kickoff", due: "", done: "" }] }).ok, false);
  assert.equal(parseDeliveryInput({ ...delivery, risks: [{ id: "r1", kind: "ISSUE", text: "x", status: "OPEN" }] }).ok, false);
  assert.equal(parseDeliveryInput({ ...delivery, milestones: Array.from({ length: 31 }, (_, i) => ({ id: `m${i}`, title: "t", due: "2026-11-20", done: "" })) }).ok, false);
});

test("health needs an explanation unless on track", () => {
  assert.equal(parseHealthInput({ health: "ON_TRACK", note: "" }).ok, true);
  assert.equal(parseHealthInput({ health: "AT_RISK", note: " " }).ok, false);
  assert.equal(parseHealthInput({ health: "OFF_TRACK", note: "Client paused" }).ok, true);
  assert.equal(parseHealthInput({ health: "GREEN", note: "" }).ok, false);
});

test("a health flag older than seven days, or never set, is stale", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  assert.equal(healthIsStale(null, now), true);
  assert.equal(healthIsStale("2026-11-12T12:00:00Z", now), false);
  assert.equal(healthIsStale("2026-11-10T12:00:00Z", now), true);
});

test("overdue milestones are past due and not done", () => {
  const milestones = [
    { id: "a", title: "Past", due: "2026-11-10", done: "" },
    { id: "b", title: "Done", due: "2026-11-10", done: "2026-11-09" },
    { id: "c", title: "Future", due: "2026-12-01", done: "" },
  ];
  assert.deepEqual(overdueMilestones(milestones, "2026-11-18").map((m) => m.id), ["a"]);
});

test("tracker responses parse and malformed responses fail closed", () => {
  const row = {
    projectId: "p1", title: "Alpha", clientLabel: "", semester: "Fall 2026", status: "ACTIVE", leadId: null, leadName: null,
    leadStaffed: false, health: null, healthNote: "", healthSetAt: null, healthSetByName: null, lastContactOn: "", lastContactNote: "",
    milestones: [], risks: [], revision: 0, updatedAt: null, isLead: false, staff: [{ id: "u1", name: "Synthetic" }],
  };
  const parsed = parseTracker({ canManage: true, projects: [row] });
  assert.equal(parsed.projects[0]?.title, "Alpha");
  assert.equal(parsed.canManage, true);
  assert.throws(() => parseTracker({ canManage: true, projects: [{ ...row, status: "DONE" }] }));
  assert.throws(() => parseTracker({ projects: [] }));
});

test("today is the Detroit calendar day", () => {
  assert.equal(detroitToday(new Date("2026-11-18T03:30:00Z")), "2026-11-17");
  assert.equal(detroitToday(new Date("2026-11-18T12:00:00Z")), "2026-11-18");
});
