import test from "node:test";
import assert from "node:assert/strict";
import { duplicateAccountIdsFor, memberAccountsFor } from "./member-accounts.ts";

const row = (id: string, role: "MEMBER" | "BOARD" | "OWNER", email: string | null, name = "Jordan Lee") => ({
  user_id: id,
  role,
  active: true,
  profiles: { display_name: name, primary_email: email },
});

test("memberAccountsFor preserves all roles and selects the strongest role", () => {
  const accounts = memberAccountsFor([
    row("one", "MEMBER", "jordan@umich.edu"),
    row("one", "BOARD", "jordan@umich.edu"),
  ]);
  assert.deepEqual(accounts, [{ id: "one", name: "Jordan Lee", role: "BOARD", roles: ["BOARD", "MEMBER"], active: true }]);
});

test("duplicateAccountIdsFor uses exact normalized email rather than display name", () => {
  const ids = duplicateAccountIdsFor([
    row("one", "MEMBER", " SAME@umich.edu "),
    row("two", "BOARD", "same@umich.edu"),
    row("three", "MEMBER", "other@umich.edu"),
    row("four", "MEMBER", null),
  ]);
  assert.deepEqual(ids.sort(), ["one", "two"]);
});
