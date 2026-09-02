import assert from "node:assert/strict";
import test from "node:test";
import { loadCalibrationStates } from "./load";

test("a not-yet-deployed calibration RPC cannot interrupt My Work", async () => {
  const client = {
    async rpc() {
      return {
        data: null,
        error: {
          code: "PGRST202",
          message: "Could not find the function rush.my_round_calibrations(target_cycle_id) in the schema cache",
        },
      };
    },
  };

  assert.deepEqual(await loadCalibrationStates(client, "cycle-1"), []);
});

test("unrelated calibration failures remain visible", async () => {
  const client = {
    async rpc() {
      return { data: null, error: { code: "42501", message: "forbidden" } };
    },
  };

  await assert.rejects(loadCalibrationStates(client, "cycle-1"), /forbidden/);
});
