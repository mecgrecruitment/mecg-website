import { NextResponse } from "next/server";
import { authServiceUnavailableResponse, mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Points a submitted application at the applicant's newest READY resume.
// submit_application does this at intake; without it a replacement uploaded
// successfully and was then invisible to the board.
//
// No request body: the RPC resolves the caller's application in the open cycle
// itself, so there is no id for a client to tamper with.
export async function POST() {
  let user;
  try { user = await currentUser(); } catch { return authServiceUnavailableResponse(); }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attach_ready_resume");
  if (error) {
    console.error("attach_ready_resume failed", error);
    const { body, status } = mapRpcError(error, "Could not update your resume");
    return NextResponse.json(body, { status });
  }
  return NextResponse.json({ path: data });
}
