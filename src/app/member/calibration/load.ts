import { screeningRpc } from "@/lib/screening-rpc";
import type { CalibrationState } from "./types";

type RpcError = { code?: string; message: string };
export function isMissingCalibrationRpc(error: RpcError | null) {
  return error?.code === "PGRST202"
    && error.message.includes("my_round_calibrations");
}

export async function loadCalibrationStates(client: unknown, cycleId: string) {
  const result = await screeningRpc<CalibrationState[]>(client, "my_round_calibrations", {
    target_cycle_id: cycleId,
  });
  if (isMissingCalibrationRpc(result.error)) return [];
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}
