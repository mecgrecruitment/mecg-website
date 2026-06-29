import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Authenticated zones. Public marketing pages, /auth/*, /portal (the public
// chooser), and /api/apply are intentionally NOT here. /apply and /apply/create
// are public redirect-shims into /auth/*, so only the real applicant surfaces
// (/apply/dashboard|application|checkin) are guarded.
const PROTECTED_PREFIXES = [
  "/internal",
  "/apply/dashboard",
  "/apply/application",
  "/apply/checkin",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

// Refreshes the Supabase auth cookies on every matched request (rotating tokens
// so Server Components read a live session) and bounces unauthenticated users
// away from protected zones. Mirrors src/lib/supabase/server.ts's cookie wiring
// but writes onto the outgoing NextResponse.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run logic between createServerClient and getUser (Supabase SSR
  // guidance): getUser revalidates the token and refreshes cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
