import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { message: "Auth callback — not implemented (PH-0 placeholder)" },
    { status: 501 },
  );
}
