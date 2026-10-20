import { NextRequest, NextResponse } from "next/server";
import { authServiceUnavailableResponse } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";
import { streamResume } from "@/lib/resume-stream";

type ReadyResume = { path: string; filename: string };

export async function GET(req: NextRequest) {
  let user;
  try { user = await currentUser(); } catch { return authServiceUnavailableResponse(); }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestedPath = req.nextUrl.searchParams.get("path");
  if (!requestedPath || requestedPath.length > 240) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await screeningRpc<ReadyResume>(supabase, "my_ready_resume", { target_path: requestedPath });
  if (error || !data?.path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return streamResume(supabase, data.path);
}
