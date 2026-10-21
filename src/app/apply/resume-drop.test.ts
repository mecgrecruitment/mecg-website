import assert from "node:assert/strict";
import test from "node:test";
import { resumeDrop } from "./resume-drop";

test("one file uploads", () => {
  assert.deepEqual(resumeDrop(1, false), { kind: "upload" });
});

test("a drop during an upload is refused with a reason", () => {
  assert.deepEqual(resumeDrop(1, true), { kind: "notice", message: "Wait for the current upload to finish." });
});

test("several files upload nothing and ask for one", () => {
  assert.deepEqual(resumeDrop(3, false), { kind: "notice", message: "Drop one PDF at a time." });
});

test("a drop with no files, such as dragged text, does nothing", () => {
  assert.deepEqual(resumeDrop(0, false), { kind: "ignore" });
});
