import test from "node:test";
import assert from "node:assert/strict";
import { initials } from "./initials.ts";

test("initials takes the first two words' first letters, uppercased", () => {
  assert.equal(initials("Jane Doe"), "JD");
  assert.equal(initials("cher"), "C");
  assert.equal(initials("Mary Jane Watson"), "MJ");
});

test("initials ignores extra whitespace and empty input", () => {
  assert.equal(initials("  Jane   Doe  "), "JD");
  assert.equal(initials(""), "");
});
