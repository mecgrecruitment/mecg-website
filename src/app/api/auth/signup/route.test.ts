import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST } from "./route.ts";

test("legacy Supabase auth endpoint is retired", async () => {
  const response = await POST(new NextRequest("http://localhost/api/auth/signup", { method: "POST" }));
  assert.equal(response.status, 410);
  assert.match((await response.json()).error, /moved to Clerk/);
});
