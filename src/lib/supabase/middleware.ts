import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Authenticated zones. Public marketing pages, /auth/*, and redirect-shims
// (/portal, /member-login, /apply, /apply/create) are intentionally NOT here.
// Only the real authenticated surfaces are guarded; shims bounce into /auth/*
// or into a guarded path that then sets ?next=.
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
  // Preserve the intended destination so login can return the user there.
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

// Forward the matched pathname to Server Components so role gates can build
// an accurate /auth/login?next=… when middleware did not already bounce.
function nextWithPathname(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
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
  const { pathname } = request.nextUrl;

  const isProtectedPath = isProtected(pathname);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return isProtectedPath
      ? redirectToLogin(request)
      : nextWithPathname(request, pathname);
  }

  let response = nextWithPathname(request, pathname);

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
          // Rebuild the response so refreshed cookies land on the outgoing
          // response while preserving the x-pathname request header.
          response = nextWithPathname(request, pathname);
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
