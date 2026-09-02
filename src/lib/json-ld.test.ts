import test from "node:test";
import assert from "node:assert/strict";
import { serializeJsonLd } from "./json-ld.ts";

test("JSON-LD serialization cannot terminate its script element", () => {
  const value = { name: "Client </script><script>alert(1)</script>", separator: "\u2028\u2029" };
  const serialized = serializeJsonLd(value);

  assert.equal(serialized.includes("<"), false);
  assert.equal(serialized.includes("\u2028"), false);
  assert.equal(serialized.includes("\u2029"), false);
  assert.deepEqual(JSON.parse(serialized), value);
});
