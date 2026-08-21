import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizePersonInput } from "@/lib/workflow";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in before applying" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const person = normalizePersonInput(body?.name, user.email);
  if (!person || body?.consent !== true) {
    return NextResponse.json({ error: "A valid name and consent are required" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_application", {
    applicant_name: person.name,
    applicant_contact: user.email,
  });
  if (error) {
    const status = error.code === "55000" ? 409 : error.code === "23505" ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ applicationId: data }, { status: 201 });
}
