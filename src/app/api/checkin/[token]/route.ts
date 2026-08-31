import { NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!(await currentUser())) return NextResponse.json({ error: "Sign in before checking in" }, { status: 401 });
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_in", { raw_token: token });
  if (error) {
    console.error("check_in failed", error);
    const { body, status } = mapRpcError(error);
    return NextResponse.json(body, { status });
  }
  return NextResponse.json({ alreadyCheckedIn: data }, { status: data ? 200 : 201 });
}
