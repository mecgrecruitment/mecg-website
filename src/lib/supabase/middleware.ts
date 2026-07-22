import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Authenticated zones. Public marketing pages, /auth/*, and /portal (the public
// chooser) are intentionally NOT here. /apply and /apply/create
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

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/login";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

// Refreshes the Supabase auth cookies on every matched request (rotating tokens
// so Server Components read a live session) and bounces unauthenticated users
// away from protected zones. Mirrors src/lib/supabase/server.ts's cookie wiring
// but writes onto the outgoing NextResponse.
//
// This runs on EVERY matched request, so anything thrown here 500s the whole
// site — public marketing pages included. Missing env or a Supabase outage must
// therefore degrade, not crash: protected zones fail closed (bounce to login),
// public pages keep serving.
export async function updateSession(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Defensive: Supabase's OAuth callback is expected to land on /auth/callback
  // with a `code` param, but if its redirect_to allow-list ever falls back to
  // the bare Site URL instead (misconfiguration, propagation delay, whatever),
  // the `code` shows up as a query param on the homepage. Catch it there and
  // route it into the real exchange handler so login doesn't silently no-op.
  // Scoped to "/" (the only fallback target) so an unrelated `?code=` on some
  // other page is never hijacked into the auth flow.
  if (pathname === "/" && searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  const isProtectedPath = isProtected(pathname);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return isProtectedPath
      ? redirectToLogin(request)
      : NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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
  let user = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch {
    // Auth is unreachable (outage, DNS, network). We cannot prove who this is,
    // so a protected path must fail closed; the public site stays up.
    return isProtectedPath ? redirectToLogin(request) : response;
  }

  if (!user && isProtectedPath) {
    return redirectToLogin(request);
  }

  return response;
}
