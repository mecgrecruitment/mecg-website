import { NextResponse } from "next/server";

export function retiredSupabaseAuthResponse(_request: Request) {
  void _request;
  return NextResponse.json(
    { error: "This authentication endpoint has moved to Clerk." },
    { status: 410 },
  );
}
