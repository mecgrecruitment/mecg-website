import test from "node:test";
import assert from "node:assert/strict";
import { directoryInitials, filterAndSortDirectory, type DirectoryEntry } from "./directory-model.ts";

const person = (overrides: Partial<DirectoryEntry>): DirectoryEntry => ({
  id: "one",
  name: "Jordan Lee",
  gradTerm: "Winter 2028",
  major: "Industrial Engineering",
  position: "Member",
  bio: "",
  roles: ["MEMBER"],
  ...overrides,
});

test("directory search spans profile metadata and roles", () => {
  const rows = [person({ id: "one" }), person({ id: "two", name: "Avery Kim", major: "Data Science", roles: ["BOARD"] })];
  assert.deepEqual(filterAndSortDirectory(rows, "data", "ALL", "NAME").map((row) => row.id), ["two"]);
  assert.deepEqual(filterAndSortDirectory(rows, "board", "ALL", "NAME").map((row) => row.id), ["two"]);
});

test("Board filter includes owners and sorting remains stable by name", () => {
  const rows = [person({ id: "two", name: "Zed", roles: ["BOARD"] }), person({ id: "one", name: "Ana", roles: ["OWNER"] }), person({ id: "three", roles: ["MEMBER"] })];
  assert.deepEqual(filterAndSortDirectory(rows, "", "BOARD", "NAME").map((row) => row.id), ["one", "two"]);
});

test("directoryInitials handles one and multiple names", () => {
  assert.equal(directoryInitials("Maya"), "M");
  assert.equal(directoryInitials("  Maya   Menon "), "MM");
});
