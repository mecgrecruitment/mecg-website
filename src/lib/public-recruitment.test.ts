import assert from "node:assert/strict";
import test from "node:test";
import { recruitmentAction } from "./public-recruitment";

const NOW = Date.parse("2026-09-02T16:00:00-04:00");

test("recruitment action sends visitors to an open application", () => {
  assert.deepEqual(
    recruitmentAction({
      status: "OPEN",
      opensAt: "2026-09-02T08:00:00-04:00",
      closesAt: "2026-09-10T23:59:00-04:00",
    }, { now: NOW }),
    { href: "/apply", label: "Apply now" },
  );
});

test("recruitment action never advertises a future application as open", () => {
  assert.deepEqual(
    recruitmentAction({
      status: "OPEN",
      opensAt: "2026-09-03T08:00:00-04:00",
      closesAt: "2026-09-10T23:59:00-04:00",
    }, { now: NOW }),
    { href: "/join", label: "Join MECG" },
  );
});

test("recruitment action supports an on-page update path while applications are inactive", () => {
  assert.deepEqual(
    recruitmentAction(
      { status: "IN_PROCESS" },
      {
        now: NOW,
        inactiveHref: "#recruitment-updates",
        inactiveLabel: "Get recruitment updates",
      },
    ),
    { href: "#recruitment-updates", label: "Get recruitment updates" },
  );
});

test("public recruitment distinguishes an available empty cycle from missing data", async () => {
  const { parsePublicRecruitment } = await import("./public-recruitment");
  assert.deepEqual(parsePublicRecruitment({ cycle: null, events: [] }), { kind: "available", cycle: null, events: [] });
  assert.equal(parsePublicRecruitment(null).kind, "unavailable");
  assert.equal(parsePublicRecruitment({ cycle: null }).kind, "unavailable");
});
test("public recruitment validates dates and permits only public event fields", async () => {
  const { parsePublicRecruitment } = await import("./public-recruitment");
  const cycle = { name: "Fall", status: "OPEN", opensAt: null, closesAt: "2026-10-30T23:00:00Z" };
  const event = { id: "public-event", name: "Meet MECG", kind: "GENERAL", startsAt: "2026-10-20T18:00:00Z", endsAt: null, location: "Campus", visibility: "PUBLIC" };
  const result = parsePublicRecruitment({ cycle, events: [event] });
  assert.equal(result.kind, "available");
  assert.equal(result.events.length, 1);
  for (const candidate of [{ cycle, events: [{ ...event, startsAt: "unknown" }] }, { cycle, events: [{ ...event, visibility: "INTERNAL" }] }, { cycle: { ...cycle, opensAt: "unknown" }, events: [] }, { cycle: null, events: [event] }]) assert.equal(parsePublicRecruitment(candidate).kind, "unavailable");
});
test("failed public recruitment RPC preserves an explicit unavailable outcome", async (t) => {
  let rejectTransport = false;
  t.mock.module("@/lib/supabase/public", { namedExports: { createPublicClient: () => ({ rpc: async () => {
    if (rejectTransport) throw new Error("private provider detail");
    return { data: { cycle: { name: "Active cycle", status: "OPEN", opensAt: null, closesAt: null }, events: [] }, error: { message: "unavailable" } };
  } }) } });
  const scenario = "failure";
  const { fetchPublicRecruitment } = await import(`./public-recruitment.ts?case=${scenario}`);
  assert.equal((await fetchPublicRecruitment()).kind, "unavailable");
  rejectTransport = true;
  assert.equal((await fetchPublicRecruitment()).kind, "unavailable");
});
