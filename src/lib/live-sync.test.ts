import assert from "node:assert/strict";
import test from "node:test";
import { LIVE_SYNC_START, liveSyncNotice, nextLiveSync, pollOutcome } from "./live-sync";

function run(statuses: (number | null)[]) {
  return liveSyncNotice(statuses.reduce((state, status) => nextLiveSync(state, pollOutcome(status)), LIVE_SYNC_START));
}

test("a single dropped poll stays quiet", () => {
  assert.equal(run([200, null]), null);
  assert.equal(run([500]), null);
});

test("two consecutive failures show reconnecting", () => {
  assert.equal(run([null, 502]), "reconnecting");
  assert.equal(run([null, null, null]), "reconnecting");
});

test("a success clears reconnecting and restarts the count", () => {
  assert.equal(run([null, null, 200]), null);
  assert.equal(run([null, 200, null]), null);
});

test("an ended session is reported at once instead of reconnecting forever", () => {
  assert.equal(run([401]), "session-ended");
  assert.equal(run([200, 403]), "session-ended");
  assert.equal(run([401, null, null, 401]), "session-ended", "a dropped poll does not hide the sign-in problem");
});

test("the session notice clears once a poll succeeds again", () => {
  assert.equal(run([401, 200]), null);
});
