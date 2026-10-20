import assert from "node:assert/strict";
import test from "node:test";
import { notificationReceipt, notificationStatusMessage } from "./retry-receipt";

test("a send acknowledgement must belong to the exact notification and use a recognized state", () => {
  assert.deepEqual(notificationReceipt({ notificationId: "n1", status: "SENT" }, "n1"), { notificationId: "n1", status: "SENT" });
  for (const body of [null, {}, { notificationId: "n2", status: "SENT" }, { notificationId: "n1", status: "DELIVERED" }, { delivered: true }]) {
    assert.equal(notificationReceipt(body, "n1"), null);
  }
  assert.match(notificationStatusMessage("SENT"), /provider.*delivery is not confirmed/);
  assert.match(notificationStatusMessage("NOT_DUE"), /No new send attempted/);
  assert.match(notificationStatusMessage("UNCONFIRMED"), /could not be confirmed/);
});
