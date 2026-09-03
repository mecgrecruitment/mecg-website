import assert from "node:assert/strict";
import test from "node:test";
import { isMissingSchemaObject } from "./schema-availability.ts";

test("a missing function or column reads as not-yet-migrated", () => {
  for (const code of ["PGRST202", "PGRST204", "42883", "42703", "42P01"]) {
    assert.equal(isMissingSchemaObject({ code }), true, code);
  }
});

test("a real failure is never mistaken for a missing object", () => {
  // These must keep throwing. Treating them as "feature is off" would hide an
  // outage behind a silently disabled photo step.
  for (const code of ["42501", "23514", "23505", "55000", "P0002", "57014"]) {
    assert.equal(isMissingSchemaObject({ code }), false, code);
  }
  // A transport failure resolves with a message and no code.
  assert.equal(isMissingSchemaObject({ message: "FetchError: network timeout" }), false);
  assert.equal(isMissingSchemaObject({}), false);
});

test("no error is not a missing object", () => {
  assert.equal(isMissingSchemaObject(null), false);
  assert.equal(isMissingSchemaObject(undefined), false);
});
