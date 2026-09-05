import assert from "node:assert/strict";
import test from "node:test";
import { buildAllowlistPlan } from "./seed-membership-allowlist.mjs";

test("a valid roster normalizes the email and keeps the name as a note", () => {
  assert.deepEqual(buildAllowlistPlan("Aoste@umich.edu,board,Abigail Osterhart\nzed@umich.edu,MEMBER,\n"), [
    { email: "aoste@umich.edu", role: "BOARD", note: "Abigail Osterhart" },
    { email: "zed@umich.edu", role: "MEMBER", note: null },
  ]);
});

test("OWNER is never granted from a roster", () => {
  assert.throws(() => buildAllowlistPlan("aoste@umich.edu,OWNER,Abigail Osterhart\n"), /OWNER/);
});

test("an unknown role is refused rather than silently downgraded", () => {
  assert.throws(() => buildAllowlistPlan("aoste@umich.edu,ADMIN,Abigail Osterhart\n"), /unknown role/);
});

test("a duplicate email is refused, including one that differs only by case", () => {
  assert.throws(() => buildAllowlistPlan("a@umich.edu,MEMBER,A\nA@umich.edu,BOARD,A again\n"), /repeats an email/);
});

test("a malformed email is refused", () => {
  for (const line of ["not-an-email,MEMBER,X", "@umich.edu,MEMBER,X", "a@umich,MEMBER,X", ",MEMBER,X"]) {
    assert.throws(() => buildAllowlistPlan(`${line}\n`), /invalid email/);
  }
});

test("nothing is planned from an empty roster", () => {
  assert.throws(() => buildAllowlistPlan("\n\n"), /empty/);
});
