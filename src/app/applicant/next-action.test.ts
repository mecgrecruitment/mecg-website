import assert from "node:assert/strict";
import test from "node:test";
import { scheduleNextAction, type ApplicantSchedule } from "./next-action";

const now = Date.parse("2026-10-16T12:00:00Z");
const buddy = { slotId: "chat-1", cycleId: "fall", startsAt: "2026-10-17T12:00:00Z", endsAt: "2026-10-17T13:00:00Z" };

function loaded(plan: ApplicantSchedule) {
  return scheduleNextAction({ schedule: { kind: "loaded", plan }, now });
}

test("failed schedule lookup requires recovery rather than reassuring the applicant", () => {
  const action = scheduleNextAction({ schedule: { kind: "unavailable" }, now });
  assert.equal(action.title, "Your schedule could not be loaded");
  assert.match(action.detail, /could not check your bookings/);
  assert.match(action.detail, /contact the recruitment team/);
  assert.equal(action.href, "#applicant-schedule");
  assert.notEqual(action.eyebrow, "No action needed");
});

test("only a successfully loaded empty schedule gives caught-up reassurance", () => {
  assert.equal(loaded({}).title, "You're caught up");
  assert.equal(loaded({ rsvps: [], buddies: [], openSlots: [], openBuddy: [] }).eyebrow, "No action needed");
});

test("the earliest future booking wins over open times, ignoring past bookings", () => {
  const action = loaded({
    buddies: [buddy],
    rsvps: [
      { slotId: "past", eventId: "old", eventName: "Past event", startsAt: "2026-10-15T12:00:00Z", endsAt: "2026-10-15T13:00:00Z", location: null },
      { slotId: "later", eventId: "new", eventName: "Later event", startsAt: "2026-10-18T12:00:00Z", endsAt: "2026-10-18T13:00:00Z", location: "GG Brown" },
    ],
    openBuddy: [{ id: "open-chat", cycleId: "fall", startsAt: buddy.startsAt, endsAt: buddy.endsAt }],
  });
  assert.equal(action.title, "Member chat");
  assert.equal(action.label, "View schedule");
});

test("legacy single-chat bookings still produce the next confirmed action", () => {
  assert.equal(loaded({ buddy }).title, "Member chat");
});

test("available event and chat times are counted while full events are excluded", () => {
  const slot = { id: "slot", eventId: "event", eventName: "Event", startsAt: buddy.startsAt, endsAt: buddy.endsAt };
  assert.equal(loaded({ openSlots: [{ ...slot, remaining: 0 }] }).title, "You're caught up");
  assert.equal(loaded({ openSlots: [{ ...slot, remaining: 1 }] }).title, "Choose from 1 open time");
  assert.equal(loaded({
    openSlots: [{ ...slot, remaining: 1 }, { ...slot, id: "full", remaining: 0 }],
    openBuddy: [{ id: "chat", cycleId: "fall", startsAt: buddy.startsAt, endsAt: buddy.endsAt }],
  }).title, "Choose from 2 open times");
});
