import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { parseSpeedDatingPairRatings } from "@/lib/speed-dating-pairs";
import { createClient } from "@/lib/supabase/server";

type PairSubmitRpc = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;

export async function POST(req: NextRequest, { params }: { params: Promise<{ pairId: string }> }) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { pairId } = await params;
  if (!pairId || pairId.length > 200) return NextResponse.json({ error: "Invalid pair" }, { status: 400 });

  const parsedBody = await readJsonBody(req, 16 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error || !parsedBody.data || typeof parsedBody.data !== "object" || Array.isArray(parsedBody.data)) {
    return NextResponse.json({ error: "Invalid pair ratings" }, { status: 400 });
  }
  const ratings = parseSpeedDatingPairRatings((parsedBody.data as Record<string, unknown>).members);
  if (!ratings) return NextResponse.json({ error: "Rate both applicants from 1 to 5 and add evidence for scores of 1, 2, or 5" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await (supabase.rpc.bind(supabase) as unknown as PairSubmitRpc)(
    "submit_speed_dating_pair",
    { target_pair_id: pairId, submitted_members: ratings },
  );
  if (error) {
    console.error("submit_speed_dating_pair failed", error);
    const mapped = mapRpcError(error, "This pair could not be submitted");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json(data, { status: 201 });
}
