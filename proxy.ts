import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16 renamed the `middleware` file convention to `proxy` (see
// node_modules/next/dist/docs/.../proxy.md). Defaults to the Node.js runtime,
// which @supabase/ssr requires. This refreshes the auth session on every
// matched request and guards the authenticated zones.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on everything except API routes, Next internals, and static assets.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
