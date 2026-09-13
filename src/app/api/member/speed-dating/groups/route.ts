import { NextRequest, NextResponse } from "next/server";
import { mapRpcErrorVerbose, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { screeningRpc } from "@/lib/screening-rpc";
import { groupSizeAllowed } from "@/lib/speed-dating-pairs";
import { createClient } from "@/lib/supabase/server";

function parseGroup(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { roundId, applicationIds, session = 1, table } = value as Record<string, unknown>;
  if (typeof roundId !== "string" || !roundId || roundId.length > 200) return null;
  if (!Array.isArray(applicationIds)
    || !groupSizeAllowed(applicationIds.length)
    || !applicationIds.every((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 200)
    || new Set(applicationIds).size !== applicationIds.length) return null;
  if (typeof session !== "number" || !Number.isInteger(session) || session < 1 || session > 4) return null;
  if (typeof table !== "number" || !Number.isInteger(table) || table < 1 || table > 99) return null;
  return { roundId, applicationIds, session, table };
}

export async function POST(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedBody = await readJsonBody(req, 16 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  const group = parsedBody.error ? null : parseGroup(parsedBody.data);
  if (!group) return NextResponse.json({ error: "Pick one to three different applicants and enter your table number" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await screeningRpc<{ pairId: string; label: string }>(
    supabase,
    "start_speed_dating_group",
    { target_round_id: group.roundId, target_application_ids: group.applicationIds, target_session: group.session, target_table: group.table },
  );
  if (error) {
    console.error("start_speed_dating_group failed", error);
    const mapped = mapRpcErrorVerbose(error, "This group could not be started");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json(data, { status: 201 });
}
