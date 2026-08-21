import { NextResponse } from "next/server";
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
    const status = error.code === "P0002" ? 404 : error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ alreadyCheckedIn: data }, { status: data ? 200 : 201 });
}
