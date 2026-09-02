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
