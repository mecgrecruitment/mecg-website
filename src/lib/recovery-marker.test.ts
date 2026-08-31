import assert from "node:assert/strict";
import test from "node:test";
import { signMarker, verifyMarker } from "./recovery-marker.ts";

const SECRET = "test-service-role-key";
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const NOW = 1_772_000_000_000;

test("a freshly issued marker verifies for its own user", () => {
  const marker = signMarker(SECRET, USER, NOW + 60_000);
  assert.equal(verifyMarker(SECRET, USER, marker, NOW), true);
});

test("a marker is worthless without one of its three inputs", () => {
  const marker = signMarker(SECRET, USER, NOW + 60_000);
  // Different user: this is the stolen-cookie case the whole control exists for.
  assert.equal(verifyMarker(SECRET, OTHER, marker, NOW), false);
  assert.equal(verifyMarker("wrong-secret", USER, marker, NOW), false);
  // Expiry is signed, so moving it invalidates the mac rather than extending it.
  assert.equal(verifyMarker(SECRET, USER, `${NOW + 600_000}.${marker.split(".")[1]}`, NOW), false);
});

test("an expired marker is rejected", () => {
  const marker = signMarker(SECRET, USER, NOW - 1);
  assert.equal(verifyMarker(SECRET, USER, marker, NOW), false);
});

test("a missing or malformed marker is rejected, never thrown on", () => {
  for (const value of [null, undefined, "", "garbage", ".", "abc.def", `${NOW + 60_000}.`]) {
    assert.equal(verifyMarker(SECRET, USER, value, NOW), false);
  }
});

test("a tampered signature is rejected", () => {
  const marker = signMarker(SECRET, USER, NOW + 60_000);
  const [exp, mac] = marker.split(".");
  const flipped = `${mac.slice(0, -1)}${mac.slice(-1) === "A" ? "B" : "A"}`;
  assert.equal(verifyMarker(SECRET, USER, `${exp}.${flipped}`, NOW), false);
});
