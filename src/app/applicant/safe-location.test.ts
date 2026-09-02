import test from "node:test";
import assert from "node:assert/strict";
import { mapSearchUrl, safeHumanLocation } from "./safe-location";

test("safeHumanLocation accepts readable places and rejects URLs and controls", () => {
  assert.equal(safeHumanLocation("  Ross School, Room 1230  "), "Ross School, Room 1230");
  assert.equal(safeHumanLocation("https://example.com/room"), null);
  assert.equal(safeHumanLocation("javascript:alert(1)"), null);
  assert.equal(safeHumanLocation("Room\n<script>"), null);
  assert.equal(safeHumanLocation("---"), null);
  assert.equal(mapSearchUrl("Michigan Union, 530 S State St"), "https://www.google.com/maps/search/?api=1&query=Michigan%20Union%2C%20530%20S%20State%20St");
});
